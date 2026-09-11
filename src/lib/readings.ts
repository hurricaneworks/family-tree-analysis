/** Claude's readings of the certificates and headstones (scripts/read-documents.ts). */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getMedia, type Media } from "./media";

export type Check = { person: string; fact: string; document: string; tree: string; status: "agrees" | "differs" | "new" | "unreadable"; note: string };
export type Reading = {
  mediaId: string;
  readAt: string;
  documentType: string;
  dateOnDocument: string | null;
  placeOnDocument: string | null;
  transcription: string;
  peopleNamed: string[];
  checks: Check[];
  summary: string;
};

let cache: Record<string, Reading> | null = null;
export function getReadings(): Record<string, Reading> {
  if (cache) return cache;
  const p = join(process.cwd(), "data", "document-readings.json");
  cache = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  return cache!;
}

export const readingFor = (m: Media) => getReadings()[m.id];

/** Readings that found something: a fact that differs from the tree, or one the tree lacks. */
export function findings(): { media: Media; reading: Reading; differs: Check[]; fresh: Check[] }[] {
  const { byId } = getMedia();
  return Object.values(getReadings())
    .map((r) => ({ media: byId.get(r.mediaId)!, reading: r, differs: r.checks.filter((c) => c.status === "differs"), fresh: r.checks.filter((c) => c.status === "new") }))
    .filter((x) => x.media && (x.differs.length || x.fresh.length))
    .sort((a, b) => b.differs.length - a.differs.length || b.fresh.length - a.fresh.length);
}
