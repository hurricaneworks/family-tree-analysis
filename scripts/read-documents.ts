/**
 * Read the certificates, registers and headstones with Claude and check them against the tree.
 *
 * Usage:  node --env-file=.env.local scripts/read-documents.ts [--limit N] [--redo]
 *
 * For every media item that is a document or headstone (or whose title says certificate, census,
 * register...) and has an image, sends the picture plus what the tree records about the attached
 * people, and stores the structured reading in data/document-readings.json (committed, resumable).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

type Media = { id: string; title: string | null; type: string | null; people: string[]; date: { raw: string } | null; place: string | null; transcription: string | null };
type Person = { id: string; name: string; sex: string; birth: { date: { raw: string } | null; place: string | null } | null; death: { date: { raw: string } | null; place: string | null } | null; famc: string[]; fams: string[]; events: { type: string; date: { raw: string } | null; place: string | null; value: string | null }[] };
type Family = { key: string; husband: string | null; wife: string | null; children: string[]; events: { type: string; date: { raw: string } | null; place: string | null }[] };

export type Reading = {
  mediaId: string;
  readAt: string;
  documentType: string;
  dateOnDocument: string | null;
  placeOnDocument: string | null;
  transcription: string;
  peopleNamed: string[];
  checks: { person: string; fact: string; document: string; tree: string; status: "agrees" | "differs" | "new" | "unreadable"; note: string }[];
  summary: string;
};

const DATA = join(import.meta.dirname, "..", "data");
const media: Media[] = JSON.parse(readFileSync(join(DATA, "media.json"), "utf8"));
const photos: Record<string, { file: string }> = JSON.parse(readFileSync(join(DATA, "photos.json"), "utf8"));
const people: Person[] = JSON.parse(readFileSync(join(DATA, "people.json"), "utf8"));
const families: Family[] = JSON.parse(readFileSync(join(DATA, "families.json"), "utf8"));
const byId = new Map(people.map((p) => [p.id, p]));
const famByKey = new Map(families.map((f) => [f.key, f]));
const OUT = join(DATA, "document-readings.json");
const readings: Record<string, Reading> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const redo = process.argv.includes("--redo");

const looksLikeRecord = (m: Media) => /birth|death|marriage|census|certificate|register|record|baptis|burial|will|probate|statutory|passenger|war|army|service|obituar|grave|memorial|cemet/i.test(m.title ?? "");
const targets = media.filter((m) => photos[m.id] && (m.type === "document" || m.type === "headstone" || (m.type !== "portrait" && looksLikeRecord(m)))).filter((m) => redo || !readings[m.id]).slice(0, limit);
console.log(`${targets.length} documents to read (${Object.keys(readings).length} already done)`);

const d = (x: { raw: string } | null | undefined) => x?.raw ?? "unknown";
function describe(p: Person): string {
  const lines = [`${p.name} (id ${p.id}, ${p.sex === "F" ? "female" : p.sex === "M" ? "male" : "sex unknown"})`];
  lines.push(`  born ${d(p.birth?.date)}${p.birth?.place ? ` at ${p.birth.place}` : ""}`);
  if (p.death) lines.push(`  died ${d(p.death.date)}${p.death.place ? ` at ${p.death.place}` : ""}`);
  for (const k of p.famc) {
    const f = famByKey.get(k);
    const par = [f?.husband, f?.wife].map((id) => id && byId.get(id)?.name).filter(Boolean);
    if (par.length) lines.push(`  parents: ${par.join(" and ")}`);
  }
  for (const k of p.fams) {
    const f = famByKey.get(k);
    if (!f) continue;
    const sp = [f.husband, f.wife].find((id) => id && id !== p.id);
    const marr = f.events.find((e) => e.type === "MARR");
    lines.push(`  spouse: ${sp ? byId.get(sp)?.name ?? sp : "unknown"}${marr ? `, married ${d(marr.date)}${marr.place ? ` at ${marr.place}` : ""}` : ""}; children: ${f.children.map((c) => byId.get(c)?.name).filter(Boolean).join(", ") || "none recorded"}`);
  }
  for (const e of p.events) if (["OCCU", "RESI", "BURI", "BAPM"].includes(e.type)) lines.push(`  ${e.type.toLowerCase()}: ${e.value ?? ""} ${d(e.date)}${e.place ? ` at ${e.place}` : ""}`.replace(/\s+/g, " "));
  return lines.join("\n");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["documentType", "dateOnDocument", "placeOnDocument", "transcription", "peopleNamed", "checks", "summary"],
  properties: {
    documentType: { type: "string", description: "e.g. Scottish statutory birth entry, 1881 census page, headstone, marriage certificate" },
    dateOnDocument: { type: ["string", "null"] },
    placeOnDocument: { type: ["string", "null"] },
    transcription: { type: "string", description: "The key fields and names as written, kept short; mark unreadable parts [illegible]" },
    peopleNamed: { type: "array", items: { type: "string" } },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["person", "fact", "document", "tree", "status", "note"],
        properties: {
          person: { type: "string", description: "Name as in the tree, or the document's name if not in the tree" },
          fact: { type: "string", description: "What is being compared: birth date, mother's maiden name, occupation, address..." },
          document: { type: "string" },
          tree: { type: "string" },
          status: { type: "string", enum: ["agrees", "differs", "new", "unreadable"] },
          note: { type: "string" },
        },
      },
    },
    summary: { type: "string", description: "Two or three plain sentences for a family historian: what the paper is and what matters" },
  },
} as const;

const client = new Anthropic();
let n = 0;
for (const m of targets) {
  const img = readFileSync(join(DATA, "images", photos[m.id].file)).toString("base64");
  const context = m.people.map((id) => byId.get(id)).filter((p): p is Person => Boolean(p)).map(describe).join("\n\n") || "(not attached to anyone in the tree)";
  const prompt = `This image is from a family tree's media gallery. Title: "${m.title ?? "untitled"}"${m.date ? `, dated ${m.date.raw}` : ""}${m.place ? `, place ${m.place}` : ""}.${m.transcription ? `\nThe family's own note: ${m.transcription}` : ""}

What the tree records about the people it is attached to:
${context}

Read the document carefully. Transcribe the key fields. Then compare every fact you can read against the tree: mark each as agrees, differs (say exactly how), new (in the document but not in the tree, such as an occupation, address, witness, informant, cause of death, mother's maiden name), or unreadable. Be precise about spellings and dates; a one-letter spelling difference in a surname is a "differs". If the image is a headstone or memorial, treat inscriptions the same way. Use British English and no dashes.`;

  try {
    const res = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } }, { type: "text", text: prompt }] }],
    });
    if (res.stop_reason === "refusal") { console.log(`  ${m.title}: declined`); continue; }
    const text = res.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as Omit<Reading, "mediaId" | "readAt">;
    readings[m.id] = { mediaId: m.id, readAt: new Date().toISOString(), ...parsed };
    n++;
    const differs = parsed.checks.filter((c) => c.status === "differs").length;
    const fresh = parsed.checks.filter((c) => c.status === "new").length;
    console.log(`${n}/${targets.length} ${m.title}: ${parsed.documentType}; ${differs} differ, ${fresh} new`);
    writeFileSync(OUT, JSON.stringify(readings, null, 1) + "\n");
  } catch (err) {
    console.error(`  ${m.title}: ${err instanceof Anthropic.APIError ? `API ${err.status} ${err.message}` : err}`);
  }
}
writeFileSync(OUT, JSON.stringify(readings, null, 1) + "\n");
console.log(`done: ${Object.keys(readings).length} readings in data/document-readings.json`);
