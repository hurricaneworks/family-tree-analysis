import type { Person } from "./types";
import { pairKey, type Tree } from "./data";

export type GapKind = "line-stops" | "no-birth" | "no-death" | "no-sources" | "inconsistent" | "duplicate";

export type Gap = {
  kind: GapKind;
  person: Person;
  detail: string;
  /** lower is more important */
  rank: number;
  /** generation depth when the person is a direct ancestor of the root */
  gen: number | null;
  steps: number | null;
  /** the other person, for duplicates */
  related?: Person;
};

export const GAP_TITLES: Record<GapKind, { title: string; blurb: string }> = {
  "line-stops": { title: "Lines that stop", blurb: "People with no parents recorded. The closer to home, the more a new record would open up." },
  "no-birth": { title: "No birth date", blurb: "A birth or baptism record would pin these people down." },
  "no-death": { title: "No death recorded", blurb: "Born more than a century ago with nothing after the last sighting." },
  "no-sources": { title: "Nothing to back it up", blurb: "Not a single citation. The facts may be right, but nothing shows where they came from." },
  inconsistent: { title: "Doesn't add up", blurb: "Dates that contradict each other. Usually a typo or a merged record." },
  duplicate: { title: "Possible duplicates", blurb: "Same name and birth year recorded twice." },
};

const KIND_WEIGHT: Record<GapKind, number> = { inconsistent: 0, "line-stops": 10, duplicate: 15, "no-birth": 20, "no-death": 30, "no-sources": 40 };

/** lower-case letters only, doubled letters collapsed, vowels after the first letter dropped */
const fuzzy = (s: string) => {
  const t = s.toLowerCase().replace(/^(mc|mac) ?/, "mac").replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
  return t[0] + t.slice(1).replace(/[aeiouy]/g, "");
};

export function findGaps(tree: Tree): Gap[] {
  const gaps: Gap[] = [];
  const push = (kind: GapKind, person: Person, detail: string, related?: Person) => {
    const gen = tree.ancestorGen.get(person.id) ?? null;
    const steps = tree.steps.get(person.id) ?? null;
    // direct ancestors first (by generation), then everyone else by distance; unconnected people last
    const closeness = gen !== null ? gen : 100 + (steps ?? 400);
    gaps.push({ kind, person, detail, gen, steps, rank: KIND_WEIGHT[kind] * 1000 + closeness, related });
  };

  const seenNames = new Map<string, Person>();

  for (const p of tree.people) {
    if (p.withheld) continue; // nothing can be said about what is withheld
    const b = p.birth?.date?.year ?? null;
    const d = p.death?.date?.year ?? null;
    const gen = tree.ancestorGen.get(p.id) ?? null;
    const isRoot = gen === 0;
    // skip the medieval and legendary lines for the routine checks
    const modern = b === null || b >= 1500;

    if (!isRoot && p.famc.length === 0 && modern) {
      push("line-stops", p, p.fams.length ? "parents unknown" : "parents unknown, no family of their own either");
    }
    if (!p.birth?.date && modern) {
      push("no-birth", p, p.death?.date?.year ? `died ${p.death.date.year}` : "no dates at all");
    }
    const buried = p.events.some((e) => e.type === "BURI" || e.type === "CREM");
    // Ancestry writes an empty DEAT marker for anyone flagged deceased, so test for a date or place, not the marker
    const deathKnown = Boolean(p.death?.date?.year || p.death?.place);
    if (!deathKnown && !buried && !p.living && b !== null && b >= 1600) {
      const last = [...p.events].filter((e) => e.date?.year).sort((x, y) => y.date!.year! - x.date!.year!)[0];
      push("no-death", p, last && last.date!.year! > b ? `born ${b}, last seen ${last.date!.year}` : `born ${b}, nothing after birth`);
    }
    if (p.citationCount === 0 && modern && !isRoot) {
      push("no-sources", p, `${p.events.length} facts, none cited`);
    }

    // consistency
    if (b !== null && d !== null) {
      if (d < b) push("inconsistent", p, `died ${d}, before birth in ${b}`);
      else if (d - b > 110) push("inconsistent", p, `lived ${d - b} years (${b} to ${d})`);
    }
    if (b !== null) {
      for (const parent of (tree.parentsOf.get(p.id) ?? []).map((id) => tree.byId.get(id))) {
        const pb = parent?.birth?.date?.year;
        const pd = parent?.death?.date?.year;
        if (!parent || !pb) continue;
        const age = b - pb;
        if (age < 13) push("inconsistent", p, `born when ${parent.name} was ${age}`);
        else if (age > (parent.sex === "F" ? 55 : 75)) push("inconsistent", p, `born when ${parent.name} was ${age}`);
        if (pd && b > pd + 1) push("inconsistent", p, `born ${b - pd} years after ${parent.name} died`);
      }
    }

    // duplicates: loose match on name (Christine/Christina, Ferry/Ferrie) plus birth year,
    // or an exact name with the same spouse when there is no birth year
    if (p.surname && p.given) {
      const keys: string[] = [];
      if (b !== null) keys.push(`${fuzzy(p.given).slice(0, 4)}|${fuzzy(p.surname)}|${b}`);
      else for (const k of p.fams) keys.push(`${fuzzy(p.given)}|${fuzzy(p.surname)}|${k.replace(p.id, "")}`);
      for (const key of keys) {
        const other = seenNames.get(key);
        if (other && tree.notDuplicates.has(pairKey(p.id, other.id))) continue;
        if (other) {
          // flag both records so either person's page shows the twin
          push("duplicate", p, `also recorded as ${other.name}${b !== null ? `, born ${b}` : ", same spouse"}`, other);
          push("duplicate", other, `also recorded as ${p.name}${b !== null ? `, born ${b}` : ", same spouse"}`, p);
        } else seenNames.set(key, p);
      }
    }
  }

  gaps.sort((a, b) => a.rank - b.rank);
  return gaps;
}

export function gapsFor(gaps: Gap[], personId: string): Gap[] {
  return gaps.filter((g) => g.person.id === personId);
}

let cachedGaps: { version: string; gaps: Gap[] } | null = null;
export function getGaps(tree: Tree): Gap[] {
  if (!cachedGaps || cachedGaps.version !== tree.version) cachedGaps = { version: tree.version, gaps: findGaps(tree) };
  return cachedGaps.gaps;
}
