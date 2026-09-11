import type { ParsedDate, Person } from "./types";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "17 Oct 1944", "about 1850", "between 1850 and 1855". */
export function fmtDate(d: ParsedDate | null | undefined): string {
  if (!d) return "";
  if (d.year === null) return d.raw;
  const core = d.day && d.month ? `${d.day} ${MONTHS[d.month]} ${d.year}` : d.month ? `${MONTHS[d.month]} ${d.year}` : String(d.year);
  switch (d.qualifier) {
    case "ABT": return `about ${core}`;
    case "BEF": return `before ${core}`;
    case "AFT": return `after ${core}`;
    case "CAL": return `calculated ${core}`;
    case "EST": return `estimated ${core}`;
    case "BET": return d.yearTo ? `between ${d.year} and ${d.yearTo}` : `about ${d.year}`;
    case "RANGE": return d.yearTo ? `${d.year} to ${d.yearTo}` : String(d.year);
    default: return core;
  }
}

/** "1901 to 1975", "born 1944", "died 1901". */
export function lifespan(p: Person): string {
  if (p.withheld) return "may be living, details withheld";
  const b = p.birth?.date?.year;
  const d = p.death?.date?.year;
  if (b && d) return `${b} to ${d}`;
  if (b) return p.living ? `born ${b}` : `born ${b}, death not recorded`;
  if (d) return `died ${d}`;
  return "no dates recorded";
}

const EVENT_LABELS: Record<string, string> = {
  BIRT: "Born", DEAT: "Died", BURI: "Buried", CREM: "Cremated", BAPM: "Baptised", CHR: "Christened",
  CENS: "Census", RESI: "Residence", PROB: "Probate", WILL: "Will", OCCU: "Occupation", EMIG: "Emigrated",
  IMMI: "Immigrated", NATU: "Naturalised", MARR: "Married", DIV: "Divorced", ENGA: "Engaged", ADDR: "Address",
  EDUC: "Education", RETI: "Retired", GRAD: "Graduated", ADOP: "Adopted", CONF: "Confirmed", _MILT: "Military",
  _EMPLOY: "Employment", _FUN: "Funeral", NaturalizationPetition: "Naturalisation petition",
};
export const eventLabel = (t: string) => EVENT_LABELS[t] ?? t;

/** Relationship of a direct ancestor to the root person, from generation depth and sex. */
export function ancestorLabel(gen: number, sex: Person["sex"]): string {
  const base = sex === "F" ? "mother" : sex === "M" ? "father" : "parent";
  if (gen === 1) return base;
  if (gen === 2) return `grand${base}`;
  if (gen === 3) return `great-grand${base}`;
  return `${gen - 2}× great-grand${base}`;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
/** Some place strings in the export still carry HTML entities; show them as text. */
export const place = (s: string | null | undefined): string =>
  (s ?? "").replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENT[e]).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).trim();

export const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
