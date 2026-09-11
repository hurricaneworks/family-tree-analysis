/**
 * Pre-build "Their world" so person pages never show "gathering the background".
 * Drives the app's own /api/world route (locally under `next dev` with DEV_AUTH_BYPASS, or the live
 * site with the shared secret), several people at a time. Already-built people return at once.
 *
 * Usage:  node scripts/build-world.ts [--tier close|all] [--limit N] [--parallel 4] [--base http://localhost:4130]
 *   close (default): direct ancestors, anyone with a picture, anyone within 3 family links of the root
 *   all:             everyone born 1700 or later
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name: string, dflt: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : dflt; };
const tier = arg("--tier", "close"), limit = Number(arg("--limit", "0")) || Infinity, parallel = Number(arg("--parallel", "4")), base = arg("--base", "http://localhost:4130");
const secret = process.env.DIGEST_SECRET;

const DATA = join(import.meta.dirname, "..", "data");
type P = { id: string; famc: string[]; birth: { date: { year: number | null } | null } | null };
const people: P[] = JSON.parse(readFileSync(join(DATA, "people.json"), "utf8"));
const families: { key: string; husband: string | null; wife: string | null; children: string[] }[] = JSON.parse(readFileSync(join(DATA, "families.json"), "utf8"));
const media: { id: string; people: string[] }[] = JSON.parse(readFileSync(join(DATA, "media.json"), "utf8"));
const photos: Record<string, unknown> = JSON.parse(readFileSync(join(DATA, "photos.json"), "utf8"));
const ROOT = process.env.NEXT_PUBLIC_ROOT_ID ?? "";
const byId = new Map(people.map((p) => [p.id, p]));
const fam = new Map(families.map((f) => [f.key, f]));
const parentsOf = (id: string) => (byId.get(id)?.famc ?? []).flatMap((k) => [fam.get(k)?.husband, fam.get(k)?.wife]).filter((x): x is string => Boolean(x));
const gen = new Map<string, number>(); { const q: [string, number][] = [[ROOT, 0]]; while (q.length) { const [id, g] = q.shift()!; if (gen.has(id)) continue; gen.set(id, g); for (const p of parentsOf(id)) q.push([p, g + 1]); } }
const nb = new Map<string, Set<string>>(); const link = (a: string, b: string) => { if (!nb.has(a)) nb.set(a, new Set()); nb.get(a)!.add(b); };
for (const f of families) { const m = [f.husband, f.wife].filter((x): x is string => Boolean(x)); for (const a of m) for (const b of m) if (a !== b) link(a, b); for (const c of f.children) for (const x of m) { link(c, x); link(x, c); } }
const steps = new Map<string, number>(); { const q: [string, number][] = [[ROOT, 0]]; while (q.length) { const [id, n] = q.shift()!; if (steps.has(id)) continue; steps.set(id, n); for (const x of nb.get(id) ?? []) if (!steps.has(x)) q.push([x, n + 1]); } }
const withPic = new Set(media.filter((m) => photos[m.id]).flatMap((m) => m.people));
const year = new Date().getFullYear();
let list = people.filter((p) => p.birth?.date?.year && p.birth.date.year >= 1700 && p.birth.date.year <= year - 5);
if (tier === "close") list = list.filter((p) => gen.has(p.id) || withPic.has(p.id) || (steps.get(p.id) ?? 99) <= 3);
list.sort((a, b) => (gen.get(a.id) ?? 50) - (gen.get(b.id) ?? 50) || (steps.get(a.id) ?? 99) - (steps.get(b.id) ?? 99));
list = list.slice(0, limit);
console.log(`${list.length} people in tier "${tier}", ${parallel} at a time, via ${base}`);

let done = 0, ok = 0, failed = 0; const started = Date.now();
async function worker(queue: P[]) {
  for (;;) {
    const p = queue.shift(); if (!p) return;
    try {
      const res = await fetch(`${base}/api/world`, { method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { "x-cron-secret": secret } : {}) }, body: JSON.stringify({ id: p.id }) });
      const text = await res.text();
      if (res.ok && text.includes('"ok":true')) ok++; else { failed++; console.error(`  ${p.id}: ${res.status} ${text.trim().slice(-80)}`); }
    } catch (err) { failed++; console.error(`  ${p.id}: ${(err as Error).message}`); }
    done++;
    if (done % 25 === 0 || done === list.length) console.log(`${done}/${list.length}  ok ${ok}  failed ${failed}  ~${Math.round(((list.length - done) * (Date.now() - started)) / done / 60000)} min left`);
  }
}
const queue = [...list];
await Promise.all(Array.from({ length: parallel }, () => worker(queue)));
console.log(`done: ok ${ok}, failed ${failed}`);
