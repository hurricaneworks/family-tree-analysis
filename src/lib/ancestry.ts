/**
 * Ahnentafel numbering from a root person: the root is 1, a person n has father 2n and mother 2n+1.
 * Generation g (root = 0) holds numbers 2^g .. 2^(g+1)-1. Missing numbers are lines that stop.
 */
import type { Tree } from "./data";
import type { Person } from "./types";

export type Ahnen = Map<number, Person>;

export function ahnentafel(tree: Tree, rootId: string, maxGen: number): Ahnen {
  const out: Ahnen = new Map();
  const root = tree.byId.get(rootId);
  if (!root) return out;
  const queue: [number, Person][] = [[1, root]];
  while (queue.length) {
    const [n, p] = queue.shift()!;
    out.set(n, p);
    const gen = Math.floor(Math.log2(n));
    if (gen >= maxGen) continue;
    const fam = tree.familyByKey.get(p.famc[0] ?? "");
    const father = fam?.husband ? tree.byId.get(fam.husband) : undefined;
    const mother = fam?.wife ? tree.byId.get(fam.wife) : undefined;
    if (father) queue.push([2 * n, father]);
    if (mother) queue.push([2 * n + 1, mother]);
  }
  return out;
}

export const genOf = (n: number) => Math.floor(Math.log2(n));
/** true when n descends from the root's father (even side of the first split) */
export const paternal = (n: number) => n >= 2 && Number(n.toString(2)[1]) === 0;

/** "father's mother's line": the path of sides from the root to number n */
export function lineOf(n: number): string {
  const bits = n.toString(2).slice(1);
  return [...bits].map((b) => (b === "0" ? "father" : "mother")).join("'s ") + (bits.length ? "" : "self");
}

export function ancestorsInGen(a: Ahnen, gen: number): { n: number; person: Person | undefined }[] {
  const from = 2 ** gen, to = 2 ** (gen + 1);
  const rows = [];
  for (let n = from; n < to; n++) rows.push({ n, person: a.get(n) });
  return rows;
}
