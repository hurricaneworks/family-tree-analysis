/**
 * GEDCOM importer.
 *
 * Usage:  npm run import -- "GEDCOM/Family Tree 22.10.2020.ged"
 *
 * Reads an Ancestry GEDCOM 5.5.1 export and writes the app's data files to /data:
 *   people.json     every person with names, events, citations, notes, family links
 *   families.json   spouse pairs and children, keyed on the spouse pair (stable across exports)
 *   sources.json    the source catalogue (title, author, publisher)
 *   media.json      Ancestry media ids with title, type and the people each is attached to (no bytes)
 *   events.json     slim event list for the map/timeline (person, type, year, place)
 *   places.json     unique place strings with usage counts (geocoding worklist)
 *   meta.json       tree id, export date, counts, import timestamp
 *   imports/<stamp>.json   diff against the previous import (added / removed / changed people)
 *
 * Zero dependencies. Runs on Node's native TypeScript support (Node >= 22.18).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import type { ParsedDate, Citation, Event, Person, Family, Source, SlimEvent } from "../src/lib/types.ts";

// ---------- types ----------

type Node = {
  level: number;
  tag: string;
  xref?: string;
  value: string;
  children: Node[];
};

// ---------- GEDCOM line parsing ----------

function parseGedcom(text: string): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];
  const lines = text.split(/\r?\n/);
  const re = /^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/;

  for (const line of lines) {
    if (!line.trim()) continue;
    const m = re.exec(line);
    if (!m) continue;
    const level = Number(m[1]);
    const xref = m[2];
    const tag = m[3];
    const value = m[4] ?? "";

    // CONT/CONC fold into the parent's value
    if (tag === "CONT" || tag === "CONC") {
      const parent = stack[level - 1];
      if (parent) parent.value += (tag === "CONT" ? "\n" : "") + value;
      continue;
    }

    const node: Node = { level, tag, xref: xref?.replace(/@/g, ""), value, children: [] };
    stack.length = level;
    if (level === 0) roots.push(node);
    else stack[level - 1]?.children.push(node);
    stack[level] = node;
  }
  return roots;
}

const child = (n: Node, tag: string) => n.children.find((c) => c.tag === tag);
const children = (n: Node, tag: string) => n.children.filter((c) => c.tag === tag);
const val = (n: Node | undefined, tag: string) => child(n!, tag)?.value.trim() || null;
const stripAt = (s: string) => s.replace(/@/g, "");

// ---------- helpers ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function cleanNote(s: string): string {
  let t = s;
  for (let i = 0; i < 2; i++) t = t.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITIES[e]);
  t = t.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  t = t.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
  return t.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

export function parseDate(raw: string | null): ParsedDate | null {
  if (!raw) return null;
  const out: ParsedDate = { raw, year: null, month: null, day: null, iso: null, qualifier: null, yearTo: null };
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw.trim());
  if (dotted) {
    out.day = Number(dotted[1]); out.month = Number(dotted[2]); out.year = Number(dotted[3]);
    out.iso = `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
    return out;
  }
  let s = raw.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

  const bet = /^BET (.+) AND (.+)$/.exec(s);
  if (bet) {
    out.qualifier = "BET";
    out.year = yearOf(bet[1]);
    out.yearTo = yearOf(bet[2]);
    return out;
  }
  const range = /^(?:FROM )?(\d{4}) ?(?:-|TO) ?(\d{4})$/.exec(s);
  if (range) {
    out.qualifier = "RANGE";
    out.year = Number(range[1]);
    out.yearTo = Number(range[2]);
    return out;
  }
  const q = /^(ABT|BEF|AFT|CAL|EST|ABOUT|BEFORE|AFTER|CIRCA|C) (.+)$/.exec(s);
  if (q) {
    const map: Record<string, ParsedDate["qualifier"]> = { ABT: "ABT", ABOUT: "ABT", CIRCA: "ABT", C: "ABT", BEF: "BEF", BEFORE: "BEF", AFT: "AFT", AFTER: "AFT", CAL: "CAL", EST: "EST" };
    out.qualifier = map[q[1]] ?? null;
    s = q[2];
  }

  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2}) ([A-Z]+) (\d{3,4})$/.exec(s)) && MONTHS[m[2]]) {
    out.day = Number(m[1]); out.month = MONTHS[m[2]]; out.year = Number(m[3]);
  } else if ((m = /^([A-Z]+) (\d{3,4})$/.exec(s)) && MONTHS[m[1]]) {
    out.month = MONTHS[m[1]]; out.year = Number(m[2]);
  } else if ((m = /^(\d{3,4})$/.exec(s))) {
    out.year = Number(m[1]);
  } else if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) {
    out.year = Number(m[1]); out.month = Number(m[2]); out.day = Number(m[3]);
  } else {
    out.year = yearOf(s);
  }
  if (out.year && out.month && out.day) {
    out.iso = `${String(out.year).padStart(4, "0")}-${String(out.month).padStart(2, "0")}-${String(out.day).padStart(2, "0")}`;
  }
  return out;
}

function yearOf(s: string): number | null {
  const m = /(?<!\d)(\d{3,4})(?!\d)/.exec(s);
  return m ? Number(m[1]) : null;
}

// ---------- record builders ----------

const EVENT_TAGS = new Set([
  "BIRT", "DEAT", "BURI", "CREM", "BAPM", "CHR", "CENS", "RESI", "EVEN", "PROB", "WILL", "OCCU", "EMIG", "IMMI",
  "NATU", "MARR", "DIV", "ENGA", "ADDR", "EDUC", "RETI", "GRAD", "ADOP", "CONF", "_MILT", "_EMPLOY", "_FUN", "_ARRIVAL", "_DEPARTURE",
]);

function citationsOf(n: Node): Citation[] {
  return children(n, "SOUR").map((s) => ({
    sourceId: s.value.startsWith("@") ? stripAt(s.value) : null,
    page: val(s, "PAGE"),
    apid: val(s, "_APID"),
    text: child(s, "DATA") ? (val(child(s, "DATA")!, "TEXT") ? cleanNote(val(child(s, "DATA")!, "TEXT")!) : null) : null,
  }));
}

function eventOf(n: Node): Event {
  let type = n.tag;
  const typeVal = val(n, "TYPE");
  if (n.tag === "EVEN" && typeVal) type = typeVal;
  else if (n.tag === "EVEN") type = "Event";
  const note = val(n, "NOTE");
  return {
    type,
    date: parseDate(val(n, "DATE")),
    place: (() => { const v = val(n, "PLAC"); return v ? cleanNote(v) : null; })(),
    value: n.value.trim() && n.value.trim() !== "Y" ? n.value.trim() : null,
    note: note ? cleanNote(note) : null,
    citations: citationsOf(n),
  };
}

function splitName(raw: string) {
  raw = cleanNote(raw);
  const m = /^([^/]*)\/([^/]*)\/(.*)$/.exec(raw.trim());
  if (!m) return { given: raw.trim() || null, surname: null, suffix: null, name: raw.trim() };
  const given = m[1].trim() || null;
  const surname = m[2].trim() || null;
  const suffix = m[3].trim() || null;
  const name = [given, surname, suffix].filter(Boolean).join(" ");
  return { given, surname, suffix, name };
}

// ---------- main ----------

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run import -- "GEDCOM/<file>.ged"');
    process.exit(1);
  }
  const gedPath = resolve(arg);
  const text = readFileSync(gedPath, "utf8").replace(/^﻿/, "");
  const roots = parseGedcom(text);

  const head = roots.find((r) => r.tag === "HEAD");
  const headSour = head ? child(head, "SOUR") : undefined;
  const treeNode = headSour ? child(headSour, "_TREE") : undefined;
  const treeName = treeNode?.value.trim() || null;
  const treeId = treeNode ? val(treeNode, "RIN") : null;
  const exportDate = head ? val(head, "DATE") : null;

  const indi = roots.filter((r) => r.tag === "INDI");
  const fam = roots.filter((r) => r.tag === "FAM");
  const sour = roots.filter((r) => r.tag === "SOUR");

  // families: build stable keys first
  const famKey = new Map<string, string>();
  const families: Family[] = fam.map((f) => {
    const husband = val(f, "HUSB") ? stripAt(val(f, "HUSB")!) : null;
    const wife = val(f, "WIFE") ? stripAt(val(f, "WIFE")!) : null;
    const kids = children(f, "CHIL").map((c) => stripAt(c.value));
    let key = husband || wife ? `${husband ?? ""}|${wife ?? ""}` : `C:${kids[0] ?? f.xref}`;
    // guard against two spouse-less families sharing a first child
    let base = key, i = 2;
    while ([...famKey.values()].includes(key)) key = `${base}#${i++}`;
    famKey.set(f.xref!, key);
    return {
      key,
      originalId: f.xref!,
      husband,
      wife,
      children: kids,
      events: f.children.filter((c) => EVENT_TAGS.has(c.tag)).map(eventOf),
    };
  });

  const thisYear = new Date().getFullYear();
  const people: Person[] = indi.map((p) => {
    const names = children(p, "NAME").map((n) => splitName(n.value));
    const primary = names[0] ?? { given: null, surname: null, suffix: null, name: "(unknown)" };
    const events = p.children.filter((c) => EVENT_TAGS.has(c.tag)).map(eventOf);
    const birthEv = events.find((e) => e.type === "BIRT");
    const deathEv = events.find((e) => e.type === "DEAT");
    const buried = events.some((e) => e.type === "BURI" || e.type === "CREM");
    const birthYear = birthEv?.date?.year ?? null;
    const dead = Boolean(deathEv) || buried;
    const living = !dead && (birthYear === null || birthYear > thisYear - 100);
    const sex = (val(p, "SEX") as "M" | "F" | null) ?? "U";
    const numericId = p.xref!.replace(/^I/, "");
    const citationCount = children(p, "SOUR").length + events.reduce((a, e) => a + e.citations.length, 0);
    return {
      id: p.xref!,
      name: primary.name,
      given: primary.given,
      surname: primary.surname,
      suffix: primary.suffix,
      altNames: names.slice(1).map((n) => n.name),
      sex,
      birth: birthEv ? { date: birthEv.date, place: birthEv.place } : null,
      death: deathEv ? { date: deathEv.date, place: deathEv.place } : null,
      living,
      famc: children(p, "FAMC").map((c) => famKey.get(stripAt(c.value)) ?? stripAt(c.value)),
      fams: children(p, "FAMS").map((c) => famKey.get(stripAt(c.value)) ?? stripAt(c.value)),
      events,
      notes: children(p, "NOTE").map((n) => cleanNote(n.value)).filter(Boolean),
      citationCount,
      mediaCount: children(p, "OBJE").length,
      ancestryUrl: treeId ? `https://www.ancestry.co.uk/family-tree/person/tree/${treeId}/person/${numericId}/facts` : null,
    };
  });
  people.sort((a, b) => (a.id < b.id ? -1 : 1));

  // media: ids match the guids in Ancestry's gallery URLs; only the bytes are absent from the export
  const obje = roots.filter((r) => r.tag === "OBJE");
  const mediaPeople = new Map<string, string[]>();
  for (const p of indi) for (const o of children(p, "OBJE")) {
    const oid = stripAt(o.value);
    if (!mediaPeople.has(oid)) mediaPeople.set(oid, []);
    mediaPeople.get(oid)!.push(p.xref!);
  }
  const media = obje.map((o) => {
    const file = child(o, "FILE");
    const form = file ? child(file, "FORM") : undefined;
    const clone = child(o, "_CLON");
    const meta = val(o, "_META");
    const transcription = meta ? /<transcription>([\s\S]*?)<\/transcription>/.exec(meta)?.[1] : null;
    return {
      id: val(o, "_OID"),
      // when the item was copied from another tree the gallery serves it under the original's id
      sourceId: clone ? val(clone, "_OID") : null,
      title: file ? val(file, "TITL") : null,
      type: form ? val(form, "_MTYPE") : null,
      format: form?.value.trim() || null,
      width: form ? Number(val(form, "_WDTH")) || null : null,
      height: form ? Number(val(form, "_HGHT")) || null : null,
      date: parseDate(val(o, "DATE")),
      place: val(o, "PLAC"),
      transcription: transcription ? cleanNote(transcription) : null,
      people: mediaPeople.get(o.xref!) ?? [],
    };
  }).filter((m) => m.id);

  const sources: Source[] = sour.map((s) => ({
    id: s.xref!,
    title: val(s, "TITL"),
    author: val(s, "AUTH"),
    publisher: val(s, "PUBL"),
  }));

  // slim events + place worklist
  const slim: SlimEvent[] = [];
  const placeCounts = new Map<string, number>();
  const addPlace = (pl: string | null) => {
    if (!pl) return;
    const norm = pl.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
    placeCounts.set(norm, (placeCounts.get(norm) ?? 0) + 1);
    return norm;
  };
  for (const p of people) {
    for (const e of p.events) {
      const norm = addPlace(e.place);
      if (norm) slim.push({ personId: p.id, type: e.type, year: e.date?.year ?? null, place: norm });
    }
  }
  for (const f of families) {
    for (const e of f.events) {
      const norm = addPlace(e.place);
      if (norm) for (const pid of [f.husband, f.wife]) if (pid) slim.push({ personId: pid, type: e.type, year: e.date?.year ?? null, place: norm });
    }
  }
  const places = [...placeCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // diff against previous import
  const dataDir = resolve(join(import.meta.dirname, "..", "data"));
  mkdirSync(join(dataDir, "imports"), { recursive: true });
  const peoplePath = join(dataDir, "people.json");
  let diff: Record<string, unknown> | null = null;
  if (existsSync(peoplePath)) {
    const prev: Person[] = JSON.parse(readFileSync(peoplePath, "utf8"));
    const prevMap = new Map(prev.map((p) => [p.id, p]));
    const nowMap = new Map(people.map((p) => [p.id, p]));
    const sig = (p: Person) => JSON.stringify({ n: p.name, s: p.sex, b: p.birth, d: p.death, e: p.events, c: p.famc, f: p.fams, o: p.notes, a: p.altNames });
    const added = people.filter((p) => !prevMap.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
    const removed = prev.filter((p) => !nowMap.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
    const changed = people
      .filter((p) => prevMap.has(p.id) && sig(prevMap.get(p.id)!) !== sig(p))
      .map((p) => {
        const q = prevMap.get(p.id)!;
        const fields: string[] = [];
        if (q.name !== p.name) fields.push("name");
        if (JSON.stringify(q.birth) !== JSON.stringify(p.birth)) fields.push("birth");
        if (JSON.stringify(q.death) !== JSON.stringify(p.death)) fields.push("death");
        if (JSON.stringify(q.events) !== JSON.stringify(p.events)) fields.push(`events (${q.events.length} -> ${p.events.length})`);
        if (q.citationCount !== p.citationCount) fields.push(`citations (${q.citationCount} -> ${p.citationCount})`);
        if (JSON.stringify(q.famc) !== JSON.stringify(p.famc) || JSON.stringify(q.fams) !== JSON.stringify(p.fams)) fields.push("family links");
        if (JSON.stringify(q.notes) !== JSON.stringify(p.notes)) fields.push("notes");
        return { id: p.id, name: p.name, fields };
      });
    diff = { added, removed, changed, summary: { added: added.length, removed: removed.length, changed: changed.length } };
  }

  const importedAt = new Date().toISOString();
  const meta = {
    importedAt,
    sourceFile: basename(gedPath),
    treeName,
    treeId,
    gedcomExportDate: exportDate,
    counts: {
      people: people.length,
      families: families.length,
      sources: sources.length,
      media: media.length,
      events: slim.length,
      places: places.length,
      living: people.filter((p) => p.living).length,
      citations: people.reduce((a, p) => a + p.citationCount, 0),
    },
  };

  const write = (name: string, data: unknown) => writeFileSync(join(dataDir, name), JSON.stringify(data, null, 1) + "\n");
  write("people.json", people);
  write("families.json", families);
  write("sources.json", sources);
  write("media.json", media);
  write("events.json", slim);
  write("places.json", places);
  write("meta.json", meta);
  const stamp = importedAt.replace(/[:T]/g, "-").slice(0, 16);
  write(join("imports", `${stamp}.json`), { ...meta, diff });

  console.log(`Imported ${basename(gedPath)}`);
  console.log(`  tree: ${treeName} (id ${treeId}), exported ${exportDate}`);
  console.table(meta.counts);
  if (diff) {
    const d = diff.summary as { added: number; removed: number; changed: number };
    console.log(`  diff vs previous import: +${d.added} added, -${d.removed} removed, ${d.changed} changed`);
  } else {
    console.log("  first import: no diff");
  }
}

main();
