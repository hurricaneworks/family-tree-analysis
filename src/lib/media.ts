import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ParsedDate } from "./types";
import { getTree } from "./data";

export type Media = {
  id: string;
  sourceId: string | null;
  title: string | null;
  type: string | null; // portrait, document, headstone, story, place, other, null
  format: string | null;
  width: number | null;
  height: number | null;
  date: ParsedDate | null;
  place: string | null;
  transcription: string | null;
  people: string[];
};

export type Stored = { file: string; bytes: number; width: number | null; height: number | null; uploaded: string | null };

export type Kind = { kind: "portrait" | "group" | "document" | "headstone" | "place" | "other"; faces: number; note: string };

let portraitCache: Map<string, Media | null> | null = null;
let cache: { version: string; media: Media[]; byId: Map<string, Media>; byPerson: Map<string, Media[]>; photos: Record<string, Stored>; kinds: Record<string, Kind> } | null = null;
let rawMedia: Media[] | null = null;

export function getMedia() {
  const tree = getTree();
  if (cache && cache.version === tree.version) return cache;
  portraitCache = null;
  const dataDir = join(process.cwd(), "data");
  if (!rawMedia) rawMedia = JSON.parse(readFileSync(join(dataDir, "media.json"), "utf8")) as Media[];
  // people merged in the app: their pictures move to the kept record
  const media0: Media[] = tree.aliases.size ? rawMedia.map((m) => ({ ...m, people: [...new Set(m.people.map((id) => tree.aliases.get(id) ?? id))] })) : rawMedia;
  // a picture with someone who may be living in it is withheld whole (src/lib/privacy.ts)
  const media = tree.withheld.size ? media0.filter((m) => !m.people.some((id) => tree.withheld.has(id))) : media0;
  const photosPath = join(dataDir, "photos.json");
  const photos: Record<string, Stored> = existsSync(photosPath) ? JSON.parse(readFileSync(photosPath, "utf8")) : {};
  const kindsPath = join(dataDir, "media-kinds.json");
  const kinds: Record<string, Kind> = existsSync(kindsPath) ? JSON.parse(readFileSync(kindsPath, "utf8")) : {};
  const byId = new Map(media.map((m) => [m.id, m]));
  const byPerson = new Map<string, Media[]>();
  for (const m of media) for (const pid of m.people) {
    if (!byPerson.has(pid)) byPerson.set(pid, []);
    byPerson.get(pid)!.push(m);
  }
  cache = { version: tree.version, media, byId, byPerson, photos, kinds };
  return cache;
}

/** Media items that have an image we can show. */
export const hasImage = (m: Media) => Boolean(getMedia().photos[m.id]);

/** Certificates, registers and gravestones, whether typed as such or only titled that way (190 items are untyped). */
export const kindOf = (m: Media): Kind["kind"] | null => getMedia().kinds[m.id]?.kind ?? null;

export const isDocumentLike = (m: Media) =>
  (kindOf(m) ? kindOf(m) !== "portrait" && kindOf(m) !== "group" : false) ||
  m.type === "document" || m.type === "headstone" || m.type === "story" ||
  // Ancestry's type is unreliable (a census snippet can be typed "portrait"), so the title counts too
  /birth|death|marriage|census|certificate|register|record|baptis|burial|will|probate|statutory|passenger|obituar|grave|memorial|cemet|index|list|tree|map|parents of|entry|extract/i.test(m.title ?? "");

export const TYPE_LABELS: Record<string, string> = { portrait: "Portraits", group: "Groups", document: "Documents", headstone: "Headstones", story: "Stories", place: "Places", other: "Other" };

/** The best single picture to stand for a person: a portrait of them alone, else any portrait, else any photo that is not a document. */
export function portraitFor(personId: string): Media | null {
  const { byPerson } = getMedia(); // may reset the cache when the tree version changed
  if (!portraitCache) portraitCache = new Map();
  if (portraitCache.has(personId)) return portraitCache.get(personId)!;
  const mine = (byPerson.get(personId) ?? []).filter(hasImage);
  // classifier verdict first (a single face beats a group), then Ancestry's type, never a document
  const rank = (m: Media) => {
    const k = kindOf(m);
    if (isDocumentLike(m)) return 9;
    if (k === "portrait") return m.people.length === 1 ? 0 : 1;
    if (k === "group") return 3;
    return m.type === "portrait" ? (m.people.length === 1 ? 2 : 4) : 5;
  };
  const best = mine.length ? [...mine].sort((a, b) => rank(a) - rank(b))[0] : null;
  const pick = best && rank(best) < 9 ? best : null;
  portraitCache.set(personId, pick);
  return pick;
}

import type { MediaNote } from "./notes";

/** Media for a person including pictures the family attached through "Who is this?". */
export function mediaForPerson(personId: string, notes: Map<string, MediaNote>): Media[] {
  const { byPerson, byId } = getMedia();
  const own = byPerson.get(personId) ?? [];
  const extra: Media[] = [];
  for (const n of notes.values()) if (n.people.includes(personId)) { const m = byId.get(n.media_id); if (m && !own.includes(m)) extra.push(m); }
  return [...own, ...extra];
}
