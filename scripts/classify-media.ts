/**
 * Classify every gallery image as portrait / group / document / headstone / place / other with
 * Claude Haiku, because Ancestry's own media types are unreliable (census snippets typed "portrait",
 * 190 items untyped). Writes data/media-kinds.json (committed, resumable).
 *
 * Usage:  node --env-file=.env.local scripts/classify-media.ts [--redo]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const DATA = join(import.meta.dirname, "..", "data");
const media: { id: string; title: string | null; type: string | null }[] = JSON.parse(readFileSync(join(DATA, "media.json"), "utf8"));
const photos: Record<string, { file: string }> = JSON.parse(readFileSync(join(DATA, "photos.json"), "utf8"));
const OUT = join(DATA, "media-kinds.json");
const kinds: Record<string, { kind: string; faces: number; note: string }> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const redo = process.argv.includes("--redo");
const todo = media.filter((m) => photos[m.id] && (redo || !kinds[m.id]));
console.log(`${todo.length} images to classify (${Object.keys(kinds).length} done)`);

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["kind", "faces", "note"],
  properties: {
    kind: { type: "string", enum: ["portrait", "group", "document", "headstone", "place", "other"], description: "portrait: one or two people; group: three or more people; document: any paper, register, certificate, newspaper, screenshot or printed text; headstone: grave or memorial; place: building, street, landscape; other" },
    faces: { type: "integer", description: "how many people are visible" },
    note: { type: "string", description: "one short line describing the picture" },
  },
} as const;

const client = new Anthropic();
let n = 0;
for (const m of todo) {
  const img = readFileSync(join(DATA, "images", photos[m.id].file)).toString("base64");
  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } }, { type: "text", text: `Classify this family-history image. Title given by the family: "${m.title ?? "untitled"}".` }] }],
    });
    const text = res.content.find((b) => b.type === "text")?.text ?? "";
    kinds[m.id] = JSON.parse(text);
    n++;
    if (n % 25 === 0) { writeFileSync(OUT, JSON.stringify(kinds, null, 1) + "\n"); console.log(`${n}/${todo.length}`); }
  } catch (err) {
    console.error(`  ${m.title}: ${err instanceof Anthropic.APIError ? `API ${err.status} ${err.message}` : err}`);
  }
}
writeFileSync(OUT, JSON.stringify(kinds, null, 1) + "\n");
const tally: Record<string, number> = {};
for (const k of Object.values(kinds)) tally[k.kind] = (tally[k.kind] ?? 0) + 1;
console.log("done:", JSON.stringify(tally));
