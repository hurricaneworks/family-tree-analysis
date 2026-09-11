/**
 * The living-person rule. A public tool cannot show everything the way a private one for a single
 * trusted reader can: anyone plausibly alive has their dates, places, events, notes, other names and
 * pictures withheld unless the operator sets SHOW_LIVING_PEOPLE=true. Their name and their place in
 * the tree still show, so the tree stays whole.
 *
 * Plausibly living: no death or burial recorded, and the earliest year known for them is within the
 * last hundred years. The earliest year comes from their birth, any dated event, and their children's
 * births, so a parent with no dates of their own is judged by the children. Someone with no year at
 * all is left alone: there is nothing to withhold.
 */
import type { Person, Family } from "./types";

export const LIVING_CUTOFF = new Date().getFullYear() - 100;

export function plausiblyLiving(p: Person, childBirthYears: number[]): boolean {
  // an empty DEAT marker still means the tree's owner recorded them as deceased
  const dead = Boolean(p.death) || p.events.some((e) => e.type === "BURI" || e.type === "CREM");
  if (dead) return false;
  const years = [p.birth?.date?.year, ...p.events.map((e) => e.date?.year), ...childBirthYears].filter((y): y is number => Boolean(y));
  if (!years.length) return false;
  return Math.min(...years) > LIVING_CUTOFF;
}

/** Copies of the people and families with every plausibly living person's details removed. */
export function withholdLiving(people: Person[], families: Family[]): { people: Person[]; families: Family[]; withheld: Set<string> } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childYears = new Map<string, number[]>();
  for (const f of families) {
    const years = f.children.map((c) => byId.get(c)?.birth?.date?.year).filter((y): y is number => Boolean(y));
    for (const parent of [f.husband, f.wife]) if (parent) childYears.set(parent, [...(childYears.get(parent) ?? []), ...years]);
  }
  const withheld = new Set(people.filter((p) => plausiblyLiving(p, childYears.get(p.id) ?? [])).map((p) => p.id));
  if (!withheld.size) return { people, families, withheld };
  return {
    people: people.map((p) => (withheld.has(p.id) ? { ...p, withheld: true, living: true, birth: null, death: null, events: [], notes: [], altNames: [], citationCount: 0, mediaCount: 0 } : p)),
    // a marriage date or place is the couple's detail too
    families: families.map((f) => ((f.husband && withheld.has(f.husband)) || (f.wife && withheld.has(f.wife)) ? { ...f, events: [] } : f)),
    withheld,
  };
}
