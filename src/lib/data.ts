import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Person, Family, Source, SlimEvent } from "./types";
import { ROOT_ID, SHOW_LIVING } from "./config";
import { withholdLiving } from "./privacy";

export type Meta = {
  importedAt: string;
  sourceFile: string;
  treeName: string | null;
  treeId: string | null;
  gedcomExportDate: string | null;
  counts: Record<string, number>;
};

export type ImportRecord = Meta & {
  diff: null | {
    added: { id: string; name: string }[];
    removed: { id: string; name: string }[];
    changed: { id: string; name: string; fields: string[] }[];
    summary: { added: number; removed: number; changed: number };
  };
};

export type Tree = {
  /** changes whenever the set of applied edits changes; caches downstream key on it */
  version: string;
  /** dropped record id -> the record it was merged into (app-side merges) */
  aliases: Map<string, string>;
  /** kept record id -> the records merged into it */
  mergedInto: Map<string, string[]>;
  /** "a|b" pairs the family has declared to be different people */
  notDuplicates: Set<string>;
  /** people whose details are withheld under the living-person rule */
  withheld: Set<string>;
  people: Person[];
  byId: Map<string, Person>;
  families: Family[];
  familyByKey: Map<string, Family>;
  sources: Map<string, Source>;
  events: SlimEvent[];
  meta: Meta;
  /** the home person actually in use: ROOT_ID if it resolves, else the first person in the file */
  rootId: string;
  /** generation depth for every direct ancestor of the root (root = 0, parents = 1 ...) */
  ancestorGen: Map<string, number>;
  /** shortest number of family links from the root to each person (parent, child or spouse steps) */
  steps: Map<string, number>;
  /** for every person, the ids of their parents */
  parentsOf: Map<string, string[]>;
};

const DATA_DIR = join(process.cwd(), "data");
const read = <T,>(name: string): T => JSON.parse(readFileSync(join(DATA_DIR, name), "utf8"));

let raw: { people: Person[]; families: Family[]; sources: Source[]; events: SlimEvent[]; meta: Meta } | null = null;
let cached: Tree | null = null;
let currentVersion = "0";
let currentMerges: [string, string][] = [];
let currentNotDup: string[] = [];

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const aliasOf = (id: string) => getTree().aliases.get(id) ?? id;

/**
 * Pull the family's decisions (merges, not-duplicates) and rebuild the tree if they changed.
 * Call at the top of every server page or route that reads the tree.
 */
export async function syncEdits() {
  const { fetchEdits, activeEdits } = await import("./edits");
  const active = activeEdits(await fetchEdits());
  const merges: [string, string][] = active.filter((e) => e.kind === "merge").map((e) => [e.keep_id, e.drop_id]);
  const notDup = active.filter((e) => e.kind === "not-duplicate").map((e) => pairKey(e.keep_id, e.drop_id));
  const version = JSON.stringify([merges, notDup]);
  if (version !== currentVersion) {
    currentVersion = version;
    currentMerges = merges;
    currentNotDup = notDup;
    cached = null;
  }
}

function loadRaw() {
  if (!raw) raw = { people: read("people.json"), families: read("families.json"), sources: read("sources.json"), events: read("events.json"), meta: read("meta.json") };
  return raw;
}

/** Apply app-side merges: the dropped record's facts fold into the kept one, families are rewritten. */
function applyMerges(people0: Person[], families0: Family[], merges: [string, string][]) {
  const aliases = new Map<string, string>();
  const resolve = (id: string) => { let x = id; const seen = new Set<string>(); while (aliases.has(x) && !seen.has(x)) { seen.add(x); x = aliases.get(x)!; } return x; };
  for (const [keep0, drop0] of merges) {
    const keep = resolve(keep0), drop = resolve(drop0);
    if (keep === drop) continue;
    aliases.set(drop, keep);
    for (const [d, k] of aliases) if (k === drop) aliases.set(d, keep);
  }
  if (!aliases.size) return { people: people0, families: families0, aliases, mergedInto: new Map<string, string[]>(), keyMap: new Map<string, string>() };

  const al = (id: string | null) => (id ? aliases.get(id) ?? id : null);
  // families: rewrite members, then merge those that now share a key
  const keyMap = new Map<string, string>();
  const byKey = new Map<string, Family>();
  for (const f of families0) {
    const husband = al(f.husband), wife = al(f.wife);
    const children = [...new Set(f.children.map((c) => al(c)!))];
    const key = husband || wife ? `${husband ?? ""}|${wife ?? ""}` : `C:${children[0] ?? f.originalId}`;
    keyMap.set(f.key, key);
    const cur = byKey.get(key);
    if (!cur) byKey.set(key, { ...f, key, husband, wife, children, events: [...f.events] });
    else {
      for (const c of children) if (!cur.children.includes(c)) cur.children.push(c);
      for (const e of f.events) if (!cur.events.some((x) => x.type === e.type && x.date?.raw === e.date?.raw)) cur.events.push(e);
    }
  }
  const families = [...byKey.values()];

  const mergedInto = new Map<string, string[]>();
  const kept = new Map<string, Person>();
  for (const p of people0) if (!aliases.has(p.id)) kept.set(p.id, { ...p, altNames: [...p.altNames], events: [...p.events], notes: [...p.notes], famc: [...new Set(p.famc.map((k) => keyMap.get(k) ?? k))], fams: [...new Set(p.fams.map((k) => keyMap.get(k) ?? k))] });
  for (const p of people0) {
    const keepId = aliases.get(p.id);
    if (!keepId) continue;
    const k = kept.get(keepId);
    if (!k) continue;
    mergedInto.set(keepId, [...(mergedInto.get(keepId) ?? []), p.id]);
    if (p.name !== k.name && !k.altNames.includes(p.name)) k.altNames.push(p.name);
    for (const n of p.altNames) if (n !== k.name && !k.altNames.includes(n)) k.altNames.push(n);
    for (const e of p.events) if (!k.events.some((x) => x.type === e.type && x.date?.raw === e.date?.raw && x.place === e.place)) k.events.push(e);
    if (!k.birth?.date && p.birth) k.birth = p.birth;
    if (!k.death?.date && p.death?.date) k.death = p.death;
    k.citationCount += p.citationCount;
    k.mediaCount += p.mediaCount;
    for (const n of p.notes) if (!k.notes.includes(n)) k.notes.push(n);
    for (const key of p.famc) { const nk = keyMap.get(key) ?? key; if (!k.famc.includes(nk)) k.famc.push(nk); }
    for (const key of p.fams) { const nk = keyMap.get(key) ?? key; if (!k.fams.includes(nk)) k.fams.push(nk); }
    if (k.living && !p.living) k.living = false;
  }
  return { people: [...kept.values()], families, aliases, mergedInto, keyMap };
}

export function getTree(): Tree {
  if (cached) return cached;
  const r = loadRaw();
  const merged = applyMerges(r.people, r.families, currentMerges);
  const { aliases, mergedInto } = merged;
  const { people, families, withheld } = SHOW_LIVING ? { ...merged, withheld: new Set<string>() } : withholdLiving(merged.people, merged.families);
  const sources = r.sources, meta = r.meta;
  const events = (aliases.size ? r.events.map((e) => (aliases.has(e.personId) ? { ...e, personId: aliases.get(e.personId)! } : e)) : r.events).filter((e) => !withheld.has(e.personId));

  const byId = new Map(people.map((p) => [p.id, p]));
  for (const [drop, keep] of aliases) { const k = byId.get(keep); if (k) byId.set(drop, k); }
  const familyByKey = new Map(families.map((f) => [f.key, f]));

  const parentsOf = new Map<string, string[]>();
  for (const p of people) {
    const parents: string[] = [];
    for (const k of p.famc) {
      const f = familyByKey.get(k);
      if (f?.husband) parents.push(f.husband);
      if (f?.wife) parents.push(f.wife);
    }
    parentsOf.set(p.id, parents);
  }

  // direct ancestors by generation (BFS upwards; first visit wins, so it records the shortest line)
  const ancestorGen = new Map<string, number>();
  const configured = aliases.get(ROOT_ID) ?? ROOT_ID;
  const rootId = byId.has(configured) ? configured : people[0]?.id ?? "";
  if (byId.has(rootId)) {
    const queue: [string, number][] = [[rootId, 0]];
    while (queue.length) {
      const [id, gen] = queue.shift()!;
      if (ancestorGen.has(id)) continue;
      ancestorGen.set(id, gen);
      for (const pid of parentsOf.get(id) ?? []) queue.push([pid, gen + 1]);
    }
  }

  // steps from root over every family link
  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const f of families) {
    const members = [f.husband, f.wife].filter((x): x is string => Boolean(x));
    for (const a of members) for (const b of members) if (a !== b) link(a, b);
    for (const c of f.children) for (const m of members) { link(c, m); link(m, c); }
  }
  const steps = new Map<string, number>();
  if (byId.has(rootId)) {
    const queue: [string, number][] = [[rootId, 0]];
    while (queue.length) {
      const [id, n] = queue.shift()!;
      if (steps.has(id)) continue;
      steps.set(id, n);
      for (const nb of neighbours.get(id) ?? []) if (!steps.has(nb)) queue.push([nb, n + 1]);
    }
  }

  cached = { version: currentVersion, rootId, aliases, mergedInto, notDuplicates: new Set(currentNotDup), withheld, people, byId, families, familyByKey, sources: new Map(sources.map((s) => [s.id, s])), events, meta, ancestorGen, steps, parentsOf };
  return cached;
}

export function getImports(): ImportRecord[] {
  const dir = join(DATA_DIR, "imports");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ImportRecord);
}

export function parentsOf(tree: Tree, id: string): Person[] {
  return (tree.parentsOf.get(id) ?? []).map((pid) => tree.byId.get(pid)).filter((p): p is Person => Boolean(p));
}

export function spouseFamilies(tree: Tree, p: Person): { spouse: Person | null; family: Family; children: Person[] }[] {
  return p.fams
    .map((k) => tree.familyByKey.get(k))
    .filter((f): f is Family => Boolean(f))
    .map((f) => {
      const spouseId = f.husband === p.id ? f.wife : f.husband;
      return {
        family: f,
        spouse: spouseId ? tree.byId.get(spouseId) ?? null : null,
        children: f.children.map((c) => tree.byId.get(c)).filter((c): c is Person => Boolean(c)),
      };
    });
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function searchPeople(tree: Tree, q: string, limit = 100): Person[] {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits = tree.people.filter((p) => {
    const hay = fold([p.name, ...p.altNames, p.birth?.place ?? "", String(p.birth?.date?.year ?? "")].join(" "));
    return terms.every((t) => hay.includes(t));
  });
  hits.sort((a, b) => (tree.steps.get(a.id) ?? 999) - (tree.steps.get(b.id) ?? 999));
  return hits.slice(0, limit);
}
