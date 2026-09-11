import { getTree, syncEdits } from "@/lib/data";
import { ROOT_SHORT_NAME } from "@/lib/config";
import { ahnentafel, genOf, paternal } from "@/lib/ancestry";
import { portraitFor } from "@/lib/media";
import { eventLabel, fmtDate } from "@/lib/format";
import { Journey, type Chapter } from "./Journey";
import { Comments } from "@/components/Comments";

const GENS = 8;
const TITLES = [ROOT_SHORT_NAME, "Parents", "Grandparents", "Great-grandparents", "Great-great-grandparents", "3× great-grandparents", "4× great-grandparents", "5× great-grandparents", "6× great-grandparents"];

/** "York", "Robin Hood's Bay, Yorkshire" from a long place string */
const shortPlace = (s: string) => {
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  const kept = parts.filter((x) => !/^(scotland|united kingdom|uk|great britain)$/i.test(x)).slice(0, 2);
  return (kept.length ? kept : parts.slice(0, 2)).join(", ");
};

export default async function JourneyPage() {
  await syncEdits();
  const tree = getTree();
  const a = ahnentafel(tree, tree.rootId, GENS);
  const chapters: Chapter[] = [];
  for (let g = 0; g <= GENS; g++) {
    const from = 2 ** g, to = 2 ** (g + 1);
    const people = [];
    const placeCount = new Map<string, number>();
    const births: number[] = [];
    const events: Chapter["events"] = [];
    let stops = 0;
    for (let n = from; n < to; n++) {
      const p = a.get(n);
      if (!p) { if (a.has(Math.floor(n / 2))) stops++; continue; }
      const b = p.birth?.date?.year ?? null;
      if (b) births.push(b);
      const place = p.birth?.place ? shortPlace(p.birth.place) : null;
      if (place) placeCount.set(place, (placeCount.get(place) ?? 0) + 1);
      people.push({ id: p.id, n, name: p.name, paternal: paternal(n), born: b, place, face: portraitFor(p.id)?.id ?? null, stop: !p.famc.length });
      for (const e of p.events) {
        if (!e.date?.year || !e.place) continue;
        if (!["DEAT", "MARR", "Arrival", "Departure", "EMIG", "IMMI", "Military Service", "_MILT", "OCCU", "BIRT"].includes(e.type)) continue;
        const weight = e.type === "BIRT" ? 1 : e.type === "DEAT" ? 2 : 4;
        events.push({ year: e.date.year, text: `${p.name.split(" ")[0]} ${p.surname ?? ""} ${e.type === "BIRT" ? "born" : e.type === "DEAT" ? "died" : e.type === "OCCU" ? "worked" : eventLabel(e.type).toLowerCase()}${e.value ? ` as ${e.value}` : ""}${e.date.day ? ` on ${fmtDate(e.date)}` : ""} in ${shortPlace(e.place)}.`, weight, personId: p.id });
      }
    }
    for (const f of tree.families) {
      const h = f.husband && a.has([...a].find(([, p]) => p.id === f.husband)?.[0] ?? -1) ? tree.byId.get(f.husband) : null;
      if (!h || genOf([...a].find(([, p]) => p.id === h.id)![0]) !== g) continue;
      const w = f.wife ? tree.byId.get(f.wife) : null;
      const marr = f.events.find((e) => e.type === "MARR" && e.date?.year && e.place);
      if (marr && w) events.push({ year: marr.date!.year!, text: `${h.name.split(" ")[0]} ${h.surname ?? ""} married ${w.name} in ${shortPlace(marr.place!)}${marr.date!.day ? `, ${fmtDate(marr.date)}` : ""}.`, weight: 5, personId: h.id });
    }
    events.sort((x, y) => y.weight - x.weight || x.year - y.year);
    // duplicate records in the tree produce identical lines; keep one, and at most one per person
    const seenText = new Set<string>(), seenPerson = new Set<string>();
    const picked = events.filter((e) => { const k = e.text.toLowerCase(); if (seenText.has(k) || seenPerson.has(e.personId)) return false; seenText.add(k); seenPerson.add(e.personId); return true; }).slice(0, 4).sort((x, y) => x.year - y.year);
    // merge spelling variants, and drop a bare country when towns are known
    const merged = new Map<string, [string, number]>();
    for (const [k, n] of placeCount) { const key = k.toLowerCase().replace(/[^a-z]/g, ""); const cur = merged.get(key); merged.set(key, [cur?.[0] ?? k, (cur?.[1] ?? 0) + n]); }
    let places = [...merged.values()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
    if (places.length > 1) places = places.filter((k) => !/^(scotland|england|ireland|wales)$/i.test(k));
    places = places.slice(0, 4);
    chapters.push({
      gen: g,
      title: TITLES[g],
      possible: from,
      known: people.length,
      stops,
      yearFrom: births.length ? Math.min(...births) : null,
      yearTo: births.length ? Math.max(...births) : null,
      places,
      people: people.sort((x, y) => x.n - y.n),
      events: picked,
    });
  }
  const total = tree.ancestorGen.size - 1;
  const deepest = Math.max(...tree.ancestorGen.values());
  return (
    <>
      <Journey chapters={chapters} total={total} deepest={deepest} />
      <Comments page="/journey" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
