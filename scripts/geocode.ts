/**
 * Geocode every place string in data/places.json via OpenStreetMap Nominatim, one request a second,
 * into data/geocode.json (not committed: it is derived from your own tree). Resumable: places already in the cache are skipped, so a
 * re-import only costs the new place strings.
 *
 * Usage:  node scripts/geocode.ts            # all uncached places, most-used first
 *         node scripts/geocode.ts --limit 50 # first 50 uncached (a test run)
 *
 * Fallback: if the full string finds nothing, retry with the leading segment dropped
 * ("Gruline, Mull, Argyllshire, Scotland" -> "Mull, Argyllshire, Scotland" -> ...) and record how
 * much was dropped, so the map can show a coarser pin rather than none.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Geo = {
  lat: number;
  lon: number;
  displayName: string;
  /** the query that actually matched */
  matched: string;
  /** how many leading comma-segments were dropped to get a match (0 = exact) */
  dropped: number;
} | null;

const DATA = join(import.meta.dirname, "..", "data");
const CACHE = join(DATA, "geocode.json");
const UA = process.env.USER_AGENT_CONTACT
  ? `family-tree-analysis/1.0 (+${process.env.USER_AGENT_CONTACT})`
  : "family-tree-analysis/1.0 (set USER_AGENT_CONTACT to an email or URL before bulk runs)";
const DELAY_MS = 1100;

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
/** --retry-missing: second pass over the not-found places with spelling and punctuation repairs */
const retryMissing = process.argv.includes("--retry-missing");

const places: { name: string; count: number }[] = JSON.parse(readFileSync(join(DATA, "places.json"), "utf8"));
const cache: Record<string, Geo> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const todo = places.filter((p) => (retryMissing ? cache[p.name] === null : !(p.name in cache))).slice(0, limit);
console.log(`${places.length} places, ${Object.keys(cache).length} cached, ${todo.length} to do${retryMissing ? " (retrying not-found with repairs)" : ""}`);

/** Fix the spellings and missing commas that defeat Nominatim in this tree's place names. */
function repair(name: string): string[] {
  const fixes: [RegExp, string][] = [
    [/\bargyle ?shire\b|\bargyllshire\b|\bargyll-shire\b/gi, "Argyll"],
    [/\binvss\b|\binverness ?shire\b/gi, "Inverness-shire"],
    [/\bdumfrieshire\b/gi, "Dumfriesshire"],
    [/\bperthshire\b/gi, "Perth and Kinross"],
    [/\bmidothian\b/gi, "Midlothian"],
    [/\blanark ?shire\b/gi, "Lanarkshire"],
    [/\brenfrew ?shire\b/gi, "Renfrewshire"],
    [/\bross ?shire\b/gi, "Ross-shire"],
    [/\bmorayshire\b/gi, "Moray"],
    [/\bforfarshire\b/gi, "Angus"],
    [/\blinlithgowshire\b/gi, "West Lothian"],
    [/\bhaddingtonshire\b/gi, "East Lothian"],
    [/\bedinburghshire\b/gi, "Midlothian"],
    [/\bkirkcudbrightshire\b/gi, "Dumfries and Galloway"],
    [/\bwigtownshire\b/gi, "Dumfries and Galloway"],
    [/\bkincardineshire\b/gi, "Aberdeenshire"],
    [/\bbanffshire\b/gi, "Moray"],
    [/\bsutherlandshire\b/gi, "Sutherland"],
    [/\bdyfed\b/gi, "Pembrokeshire, Wales"],
    [/\s+(county|co\.?)\s+/gi, ", "],
  ];
  let fixed = name;
  for (const [re, to] of fixes) fixed = fixed.replace(re, to);
  const out = new Set<string>();
  if (fixed !== name) out.add(fixed);
  // no commas: insert them before county and country words
  const spaced = fixed.replace(/\s+(Argyll|Inverness-shire|Orkney|Shetland|Sutherland|Caithness|Lanarkshire|Renfrewshire|Ayrshire|Stirlingshire|Dumfriesshire|Midlothian|Fife|Angus|Moray|Aberdeenshire|Roxburghshire|Berwickshire|Scotland|England|Ireland|Wales|Australia|Canada|USA)\b/g, ", $1");
  if (spaced !== fixed) out.add(spaced);
  const scottish = /argyll|orkney|shire|scotland|kirk|glasgow|edinburgh|inverness|fife|angus|moray|oban|mull|iona|islay|arran|kintyre/i.test(fixed);
  if (scottish && !/scotland/i.test(fixed)) out.add(`${spaced}, Scotland`);
  if (!/scotland|england|ireland|wales|australia|canada|usa|united states|new zealand|south africa|india|france/i.test(fixed)) out.add(`${spaced}, United Kingdom`);
  return [...out].filter((v) => v !== name);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFileSync(CACHE, JSON.stringify(cache, null, 1) + "\n");

type Hit = { lat: string; lon: string; display_name: string; category: string; type: string; addresstype?: string };

/** Accept only place-like results; a free-form query for "Glasgow, Lanarkshire" otherwise lands on "Glasgow Road, Lanark". */
const placeLike = (h: Hit) => ["place", "boundary", "natural"].includes(h.category) && !["road", "residential", "house", "building"].includes(h.addresstype ?? "");

async function lookup(q: string, attempt = 1): Promise<Hit | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(q)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  } catch (err) {
    // transient socket errors (EADDRNOTAVAIL, ECONNRESET): wait and retry, up to five times
    if (attempt >= 5) throw err;
    console.log(`  network error (${(err as Error & { cause?: { code?: string } }).cause?.code ?? "fetch failed"}), retry ${attempt} in 30s`);
    await sleep(30_000);
    return lookup(q, attempt + 1);
  }
  if (res.status === 429 || res.status >= 500) {
    console.log(`  ${res.status} from Nominatim, backing off 60s`);
    await sleep(60_000);
    return lookup(q);
  }
  if (!res.ok) throw new Error(`Nominatim ${res.status} for ${q}`);
  const rows = (await res.json()) as Hit[];
  return rows.find(placeLike) ?? null;
}

/** Query order: full string; first + last segment; then drop leading segments one at a time. */
function candidates(segments: string[]): { q: string; dropped: number }[] {
  const out: { q: string; dropped: number }[] = [{ q: segments.join(", "), dropped: 0 }];
  if (segments.length > 2) out.push({ q: `${segments[0]}, ${segments[segments.length - 1]}`, dropped: 0 });
  for (let drop = 1; drop < segments.length; drop++) {
    out.push({ q: segments.slice(drop).join(", "), dropped: drop });
    if (segments.length - drop > 2) out.push({ q: `${segments[drop]}, ${segments[segments.length - 1]}`, dropped: drop });
  }
  return out;
}

let done = 0, found = 0, failed = 0;
const started = Date.now();
for (const { name } of todo) {
  const segments = name.split(",").map((s) => s.trim()).filter(Boolean);
  let result: Geo = null;
  const tries = retryMissing
    ? repair(name).flatMap((v) => candidates(v.split(",").map((s) => s.trim()).filter(Boolean)).slice(0, 2))
    : candidates(segments);
  for (const { q, dropped } of tries) {
    const hit = await lookup(q);
    await sleep(DELAY_MS);
    if (hit) {
      result = { lat: Number(hit.lat), lon: Number(hit.lon), displayName: hit.display_name, matched: q, dropped };
      break;
    }
  }
  cache[name] = result;
  done++;
  result ? found++ : failed++;
  if (done % 25 === 0 || done === todo.length) {
    save();
    const rate = (Date.now() - started) / done;
    console.log(`${done}/${todo.length}  found ${found}  none ${failed}  ~${Math.round(((todo.length - done) * rate) / 60000)} min left`);
  }
}
save();
console.log(`Finished: ${found} located, ${failed} not found, cache now ${Object.keys(cache).length}`);
