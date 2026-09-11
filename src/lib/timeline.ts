/** A life told as dated entries: the person's own events, and the family ones that happened around them. */
import type { Person, ParsedDate } from "./types";
import { getTree, parentsOf, spouseFamilies, type Tree } from "./data";
import { eventLabel, fmtDate, place } from "./format";

export type Entry = {
  sort: number;          // year * 10000 + month * 100 + day, for ordering
  date: ParsedDate | null;
  age: number | null;    // the person's age when it happened
  title: string;
  text: string;
  where: string | null;
  personId?: string;     // whose face to show beside it
  sources: string[];
  mediaId?: string;
};

const key = (d: ParsedDate | null | undefined) => (d?.year ? d.year * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0) : 0);
const ageAt = (birth: ParsedDate | null | undefined, d: ParsedDate | null | undefined) =>
  birth?.year && d?.year ? Math.max(0, d.year - birth.year - (d.month && birth.month && (d.month < birth.month || (d.month === birth.month && (d.day ?? 0) < (birth.day ?? 0))) ? 1 : 0)) : null;

const rel = (p: Person, of: Person) => {
  const male = p.sex === "M";
  return { son: male ? "son" : "daughter", brother: male ? "brother" : "sister", his: male ? "his" : "her", he: male ? "he" : "she", him: male ? "him" : "her", name: of.name };
};


/** "in" for a country or county, "at" for a street or a house. */
const preposition = (where: string) => (/^\d|street|st\.?$|road|terrace|place|farm|house|cottage|lane|square|crescent|avenue|hospital|infirmary/i.test(where.split(",")[0].trim()) ? "at" : "in");

/** Turn one recorded event into a readable sentence. */
function sentence(first: string, full: string, e: { type: string; place: string | null; value: string | null; note: string | null }, label: string, age: number | null): string {
  const where = e.place ? place(e.place) : null;
  const at = where ? ` ${preposition(where)} ${where}` : "";
  const detail = (e.value ?? "").trim();
  switch (e.type) {
    case "BIRT": return `${full} was born${at}.`;
    case "DEAT": return `${first} died${at}${age !== null ? `, aged ${age}` : ""}.`;
    case "BURI": return `${first} was buried${at}.`;
    case "CREM": return `${first} was cremated${at}.`;
    case "BAPM": case "CHR": return `${first} was ${e.type === "BAPM" ? "baptised" : "christened"}${at}.`;
    case "RESI": return `${first} was living${at}.`;
    case "CENS": return `${first} appears in the census${at}.`;
    case "OCCU": case "_EMPLOY": return detail ? `${first} was working as ${detail}${at}.` : `${first} was in work${at}.`;
    case "EMIG": return `${first} emigrated${where ? ` to ${where}` : ""}.`;
    case "IMMI": case "Arrival": return `${first} arrived${where ? ` in ${where}` : ""}.`;
    case "Departure": return `${first} left${where ? ` from ${where}` : ""}.`;
    case "NATU": return `${first} was naturalised${at}.`;
    case "PROB": case "WILL": return `${first}'s ${e.type === "WILL" ? "will was made" : "estate went to probate"}${at}.`;
    case "RETI": return `${first} retired${at}.`;
    case "EDUC": return detail ? `${first} was at school${at}: ${detail}` : `${first} was at school${at}.`;
    case "_MILT": case "Military Service": return detail ? `${first} served: ${detail}${at}.` : `${first} was in the services${at}.`;
    default: {
      const body = detail || (e.note ?? "").split("\n")[0] || "";
      return `${label}${body ? `: ${body}` : ""}${at}.`.replace(/^(\w)/, (m) => m.toUpperCase());
    }
  }
}

export function lifeEntries(tree: Tree, p: Person): Entry[] {
  const out: Entry[] = [];
  const birth = p.birth?.date ?? null;
  const first = p.given?.split(" ")[0] ?? p.name.split(" ")[0];
  const src = (e: { citations: { sourceId: string | null }[] }) =>
    e.citations.map((c) => (c.sourceId ? tree.sources.get(c.sourceId)?.title : null)).filter((t): t is string => Boolean(t));

  // the person's own events
  for (const e of p.events) {
    if (!e.date?.year && !e.place) continue;
    const label = eventLabel(e.type);
    out.push({
      sort: key(e.date), date: e.date, age: e.type === "BIRT" ? null : ageAt(birth, e.date),
      title: label,
      text: sentence(first, p.name, e, label, ageAt(birth, e.date)),
      where: e.place ? place(e.place) : null, sources: src(e), personId: p.id,
    });
  }

  // parents' deaths
  for (const parent of parentsOf(tree, p.id)) {
    const d = parent.death?.date;
    if (!d?.year) continue;
    const w = parent.sex === "F" ? "mother" : "father";
    out.push({ sort: key(d), date: d, age: ageAt(birth, d), title: `Death of ${w}`, text: `${first}'s ${w} ${parent.name} died${parent.death?.place ? ` at ${place(parent.death.place)}` : ""}${ageAt(parent.birth?.date, d) !== null ? `, aged ${ageAt(parent.birth?.date, d)}` : ""}.`, where: parent.death?.place ? place(parent.death.place) : null, sources: [], personId: parent.id });
  }

  // brothers and sisters born
  for (const k of p.famc) {
    const f = tree.familyByKey.get(k);
    for (const cid of f?.children ?? []) {
      if (cid === p.id) continue;
      const sib = tree.byId.get(cid);
      const d = sib?.birth?.date;
      if (!sib || !d?.year) continue;
      const r = rel(sib, p);
      out.push({ sort: key(d), date: d, age: ageAt(birth, d), title: `${r.brother === "brother" ? "Brother" : "Sister"} born`, text: `${first}'s ${r.brother} ${sib.name} was born${sib.birth?.place ? ` at ${place(sib.birth.place)}` : ""}${ageAt(birth, d) !== null ? `, when ${first} was ${ageAt(birth, d)}` : ""}.`, where: sib.birth?.place ? place(sib.birth.place) : null, sources: [], personId: sib.id });
    }
  }

  // marriages and children
  for (const m of spouseFamilies(tree, p)) {
    const marr = m.family.events.find((e) => e.type === "MARR");
    if (marr?.date?.year && m.spouse) {
      out.push({ sort: key(marr.date), date: marr.date, age: ageAt(birth, marr.date), title: "Marriage", text: `${first} married ${m.spouse.name}${marr.place ? ` at ${place(marr.place)}` : ""}${ageAt(birth, marr.date) !== null ? `, aged ${ageAt(birth, marr.date)}` : ""}.`, where: marr.place ? place(marr.place) : null, sources: src(marr), personId: m.spouse.id });
    }
    for (const c of m.children) {
      const d = c.birth?.date;
      if (!d?.year) continue;
      const r = rel(c, p);
      out.push({ sort: key(d), date: d, age: ageAt(birth, d), title: `${r.son === "son" ? "Son" : "Daughter"} born`, text: `${first}'s ${r.son} ${c.name} was born${c.birth?.place ? ` at ${place(c.birth.place)}` : ""}${ageAt(birth, d) !== null ? `, when ${first} was ${ageAt(birth, d)}` : ""}.`, where: c.birth?.place ? place(c.birth.place) : null, sources: [], personId: c.id });
    }
    if (m.spouse?.death?.date?.year && key(m.spouse.death.date) > key(birth)) {
      const d = m.spouse.death.date;
      out.push({ sort: key(d), date: d, age: ageAt(birth, d), title: `Death of ${m.spouse.sex === "F" ? "wife" : "husband"}`, text: `${m.spouse.name} died${m.spouse.death?.place ? ` at ${place(m.spouse.death.place)}` : ""}.`, where: m.spouse.death?.place ? place(m.spouse.death.place) : null, sources: [], personId: m.spouse.id });
    }
  }

  const seen = new Set<string>();
  return out
    .filter((e) => e.sort > 0)
    .filter((e) => { const k = `${e.sort}|${e.title}|${e.text}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.sort - b.sort || (a.title === "Birth" ? -1 : 0));
}

/** The opening paragraph, in the manner of a family-history sketch. */
export function sketch(tree: Tree, p: Person): string {
  const first = p.given?.split(" ")[0] ?? p.name.split(" ")[0];
  const he = p.sex === "F" ? "She" : p.sex === "M" ? "He" : "They";
  const his = p.sex === "F" ? "her" : "his";
  const bits: string[] = [];
  const parents = parentsOf(tree, p.id);
  if (p.birth?.date?.year) {
    const ages = parents.map((x) => { const a = x.birth?.date?.year ? p.birth!.date!.year! - x.birth.date.year : null; return a !== null && a > 12 && a < 70 ? `${x.sex === "F" ? "mother" : "father"}, ${x.given?.split(" ")[0] ?? x.name}, was ${a}` : null; }).filter(Boolean);
    bits.push(`When ${p.name} was born on ${fmtDate(p.birth.date)}${p.birth.place ? ` in ${place(p.birth.place)}` : ""}${ages.length ? `, ${his} ${ages.join(" and ${his} ")}` : ""}.`.replace(/\$\{his\}/g, his));
  }
  const ms = spouseFamilies(tree, p).filter((m) => m.spouse);
  const kids = spouseFamilies(tree, p).flatMap((m) => m.children);
  const sons = kids.filter((c) => c.sex === "M").length, daughters = kids.filter((c) => c.sex === "F").length;
  if (ms.length || kids.length) {
    const word = ["", "once", "twice", "three times", "four times", "five times"][ms.length] ?? `${ms.length} times`;
    const married = ms.length === 1 ? `${he} married ${ms[0].spouse!.name}` : ms.length > 1 ? `${he} married ${word}` : "";
    const n = (k: number) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][k] ?? String(k);
    const had = kids.length ? `${married ? " and" : he} had ${[sons ? `${n(sons)} son${sons > 1 ? "s" : ""}` : "", daughters ? `${n(daughters)} daughter${daughters > 1 ? "s" : ""}` : ""].filter(Boolean).join(" and ")}` : "";
    bits.push(`${married}${had}.`.trim());
  }
  if (p.death?.date?.year) {
    const age = ageAt(p.birth?.date, p.death.date);
    bits.push(`${he} died on ${fmtDate(p.death.date)}${p.death.place ? ` in ${place(p.death.place)}` : ""}${age !== null ? `, at the age of ${age}` : ""}.`);
  } else if (p.living) {
    bits.push(`${he} is living.`);
  }
  return bits.join(" ");
}

export const entriesFor = (p: Person) => lifeEntries(getTree(), p);
