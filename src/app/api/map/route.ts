import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getTree, syncEdits } from "@/lib/data";
import { eventLabel } from "@/lib/format";
import { currentUser } from "@/lib/supabase";
import { portraitFor } from "@/lib/media";

export const dynamic = "force-dynamic";

type Geo = { lat: number; lon: number; dropped: number } | null;

export type MapPayload = {
  places: { name: string; lat: number; lon: number; dropped: number }[];
  /** [placeIndex, year, personId, eventLabel] */
  events: [number, number, string, string][];
  people: Record<string, string>;
  faces: Record<string, string>;
  yearRange: [number, number];
  unlocated: number;
};

let cached: { version: string; payload: MapPayload } | null = null;

export async function GET() {
  await syncEdits();
  if (!(await currentUser())) return new Response("Sign in required", { status: 401 });
  const tree0 = getTree();
  if (!cached || cached.version !== tree0.version) {
    const tree = tree0;
    const geoPath = join(process.cwd(), "data", "geocode.json");
    const geo: Record<string, Geo> = existsSync(geoPath) ? JSON.parse(readFileSync(geoPath, "utf8")) : {};
    const placeIndex = new Map<string, number>();
    const places: MapPayload["places"] = [];
    const events: MapPayload["events"] = [];
    const people: Record<string, string> = {};
    const faces: Record<string, string> = {};
    let unlocated = 0;
    let min = 9999, max = 0;
    for (const e of tree.events) {
      if (e.year === null || e.year < 1500) continue;
      const g = geo[e.place];
      if (!g) { unlocated++; continue; }
      let idx = placeIndex.get(e.place);
      if (idx === undefined) {
        idx = places.length;
        placeIndex.set(e.place, idx);
        places.push({ name: e.place, lat: g.lat, lon: g.lon, dropped: g.dropped });
      }
      events.push([idx, e.year, e.personId, eventLabel(e.type)]);
      if (!(e.personId in people)) {
        people[e.personId] = tree.byId.get(e.personId)?.name ?? e.personId;
        const face = portraitFor(e.personId);
        if (face) faces[e.personId] = face.id;
      }
      if (e.year < min) min = e.year;
      if (e.year > max) max = e.year;
    }
    events.sort((a, b) => a[1] - b[1]);
    cached = { version: tree.version, payload: { places, events, people, faces, yearRange: [min, max], unlocated } };
  }
  return Response.json(cached.payload, { headers: { "Cache-Control": "private, max-age=3600" } });
}
