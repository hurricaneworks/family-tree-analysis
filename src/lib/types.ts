/** Shared data types. Written by scripts/import.ts, read by the app. */

export type ParsedDate = {
  raw: string;
  year: number | null;
  month: number | null;
  day: number | null;
  iso: string | null; // YYYY-MM-DD when the full date is known
  qualifier: "ABT" | "BEF" | "AFT" | "BET" | "CAL" | "EST" | "RANGE" | null;
  yearTo: number | null; // for BET/RANGE
};

export type Citation = {
  sourceId: string | null;
  page: string | null;
  apid: string | null;
  text: string | null;
};

export type Event = {
  type: string; // BIRT, DEAT, RESI, MARR, or a free-text EVEN type such as "Arrival"
  date: ParsedDate | null;
  place: string | null;
  value: string | null; // e.g. the occupation for OCCU
  note: string | null;
  citations: Citation[];
};

export type Person = {
  id: string; // the provider's own person id, e.g. I100000000001 (stable across exports)
  name: string; // the full name as recorded, e.g. "Mary Ann Baird"
  given: string | null;
  surname: string | null;
  suffix: string | null;
  altNames: string[];
  sex: "M" | "F" | "U";
  birth: { date: ParsedDate | null; place: string | null } | null;
  death: { date: ParsedDate | null; place: string | null } | null;
  living: boolean; // no death event and born within the last 100 years (or birth unknown and no death)
  /** set by the app, never by the import: details removed under the living-person rule (src/lib/privacy.ts) */
  withheld?: boolean;
  famc: string[]; // family keys where this person is a child
  fams: string[]; // family keys where this person is a spouse
  events: Event[];
  notes: string[];
  citationCount: number;
  mediaCount: number;
  ancestryUrl: string | null;
};

export type Family = {
  key: string; // "<husb>|<wife>" or "C:<firstChild>" when no spouse is recorded
  originalId: string; // the F id in this export (NOT stable across exports)
  husband: string | null;
  wife: string | null;
  children: string[];
  events: Event[];
};

export type Source = {
  id: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
};

export type SlimEvent = {
  personId: string;
  type: string;
  year: number | null;
  place: string;
};
