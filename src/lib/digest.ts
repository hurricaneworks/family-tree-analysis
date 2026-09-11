/**
 * "This week in the family": events whose day and month fall in the coming seven days, any year,
 * ranked with direct ancestors and round anniversaries first, plus one gap worth chasing.
 */
import { getTree, type Tree } from "./data";
import { getGaps } from "./gaps";
import { ancestorLabel, eventLabel, fmtDate } from "./format";
import { ROOT_SHORT_NAME, OWNER_NAME } from "./config";
import { getMedia, hasImage, portraitFor, isDocumentLike, type Media } from "./media";
import { createClient } from "@supabase/supabase-js";
import type { Person, Event } from "./types";

/** Signed Storage links so the email shows pictures without a login; valid for two weeks. */
async function signedPhoto(mediaId: string): Promise<string | null> {
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    const { data } = await admin.storage.from("photos").createSignedUrl(`${mediaId}.jpg`, 14 * 86400);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** A picture dated in this week (any year), else a portrait chosen by week number so it rotates. */
export function pictureOfTheWeek(start: Date): Media | null {
  const { media } = getMedia();
  const withImage = media.filter(hasImage);
  const days = new Set<string>();
  for (let i = 0; i < 7; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); days.add(`${d.getMonth() + 1}-${d.getDate()}`); }
  const dated = withImage.filter((m) => m.date?.month && m.date.day && days.has(`${m.date.month}-${m.date.day}`) && !isDocumentLike(m));
  if (dated.length) return dated[0];
  const portraits = withImage.filter((m) => m.type === "portrait" && m.people.length && !isDocumentLike(m));
  if (!portraits.length) return null;
  const week = Math.floor(start.getTime() / (7 * 86400000));
  return portraits[week % portraits.length];
}

export type DigestItem = {
  day: Date; // the calendar day this year/next
  year: number;
  yearsAgo: number;
  label: string; // "Born", "Married"...
  person: Person;
  partner?: Person;
  place: string | null;
  relationship: string | null; // e.g. "their 3× great-grandmother"
  score: number;
};

const INTERESTING = new Set(["BIRT", "DEAT", "MARR", "BAPM", "BURI", "Arrival", "Departure", "EMIG", "IMMI", "NATU", "Military Service", "_MILT"]);

function relationship(tree: Tree, p: Person): string | null {
  const gen = tree.ancestorGen.get(p.id);
  if (gen === 0) return null;
  if (gen !== undefined) return `${ROOT_SHORT_NAME}'s ${ancestorLabel(gen, p.sex)}`;
  const steps = tree.steps.get(p.id);
  return steps !== undefined && steps <= 8 ? `${steps} family links from ${ROOT_SHORT_NAME}` : null;
}

function score(tree: Tree, p: Person, yearsAgo: number, type: string): number {
  const gen = tree.ancestorGen.get(p.id);
  const steps = tree.steps.get(p.id) ?? 99;
  // close direct ancestors first; distant medieval lines drop below near relations
  let s = gen !== undefined ? (gen <= 6 ? 1000 - gen * 20 : 600 - gen * 20) : 500 - Math.min(steps, 20) * 20;
  if (yearsAgo % 100 === 0) s += 400;
  else if (yearsAgo % 50 === 0) s += 250;
  else if (yearsAgo % 25 === 0) s += 120;
  if (type === "BIRT" || type === "MARR" || type === "DEAT") s += 60;
  if (type === "Arrival" || type === "Departure" || type === "EMIG") s += 80;
  return s;
}

/** Events in the seven days starting at `start` (a local date at midnight). */
export function weekItems(start: Date, limit = 10): DigestItem[] {
  const tree = getTree();
  const days: { m: number; d: number; date: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({ m: date.getMonth() + 1, d: date.getDate(), date });
  }
  const items: DigestItem[] = [];
  const consider = (p: Person, e: Event, partner?: Person) => {
    const dt = e.date;
    if (!dt?.year || !dt.month || !dt.day || dt.qualifier) return;
    if (!INTERESTING.has(e.type) || dt.year < 1500) return;
    const hit = days.find((x) => x.m === dt.month && x.d === dt.day);
    if (!hit) return;
    const yearsAgo = hit.date.getFullYear() - dt.year;
    if (yearsAgo <= 0) return;
    items.push({
      day: hit.date,
      year: dt.year,
      yearsAgo,
      label: eventLabel(e.type),
      person: p,
      partner,
      place: e.place,
      relationship: relationship(tree, p),
      score: score(tree, p, yearsAgo, e.type),
    });
  };
  for (const p of tree.people) for (const e of p.events) consider(p, e);
  for (const f of tree.families) {
    const h = f.husband ? tree.byId.get(f.husband) : undefined;
    const w = f.wife ? tree.byId.get(f.wife) : undefined;
    const lead = h ?? w;
    if (!lead) continue;
    for (const e of f.events) consider(lead, e, lead === h ? w : undefined);
  }
  items.sort((a, b) => b.score - a.score);
  // variety: no repeated person/name+year (duplicate records), at most two items from one day+year
  // (a battle), at most two from before 1700
  const seen = new Set<string>();
  const perDayYear = new Map<string, number>();
  let early = 0;
  const picked: DigestItem[] = [];
  for (const it of items) {
    if (picked.length >= limit) break;
    const k = `${it.person.name.toLowerCase()}|${it.label}|${it.year}`;
    const dy = `${it.day.getMonth()}-${it.day.getDate()}-${it.year}`;
    if (seen.has(k) || (perDayYear.get(dy) ?? 0) >= 2 || (it.year < 1700 && early >= 2)) continue;
    seen.add(k);
    perDayYear.set(dy, (perDayYear.get(dy) ?? 0) + 1);
    if (it.year < 1700) early++;
    picked.push(it);
  }
  picked.sort((a, b) => a.day.getTime() - b.day.getTime() || a.year - b.year);
  return picked;
}

/** A different direct-ancestor line-stop each week. */
export function gapOfTheWeek(start: Date) {
  const tree = getTree();
  const stops = getGaps(tree).filter((g) => g.kind === "line-stops" && g.gen !== null && g.gen <= 6);
  if (!stops.length) return null;
  const week = Math.floor(start.getTime() / (7 * 86400000));
  return stops[week % stops.length];
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d: Date) => `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function renderDigest(start: Date, siteUrl: string) {
  const items = weekItems(start);
  const gap = gapOfTheWeek(start);
  const tree = getTree();
  const faceUrl = new Map<string, string>();
  for (const it of items) {
    const m = portraitFor(it.person.id) ?? (it.partner ? portraitFor(it.partner.id) : null);
    if (m) { const u = await signedPhoto(m.id); if (u) faceUrl.set(it.person.id, u); }
  }
  const potw = pictureOfTheWeek(start);
  const potwUrl = potw ? await signedPhoto(potw.id) : null;
  const potwPeople = potw ? potw.people.map((id) => tree.byId.get(id)).filter(Boolean) : [];
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const range = `${fmtDay(start)} to ${fmtDay(end)}`;
  const subject = `This week in the family, ${start.getDate()} ${MON[start.getMonth()]}`;

  const line = (it: DigestItem) => {
    const who = it.partner ? `${it.person.name} and ${it.partner.name}` : it.person.name;
    const what = it.label === "Married" ? "married" : it.label.toLowerCase();
    const where = it.place ? ` in ${it.place}` : "";
    const rel = it.relationship ? `${it.relationship}. ` : "";
    const ago = it.yearsAgo % 50 === 0 ? `<strong>${it.yearsAgo} years ago</strong>` : `${it.yearsAgo} years ago`;
    return { who, what, where, rel, ago };
  };

  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f3f4f1;color:#22303a;font-family:Georgia,'Iowan Old Style',serif;font-size:19px;line-height:1.5">
<div style="max-width:620px;margin:0 auto;padding:32px 24px">
<p style="margin:0;color:#55636d;font-size:16px">${esc(range)}</p>
<h1 style="font-weight:500;font-size:34px;line-height:1.15;margin:6px 0 24px">This week in the family</h1>
${potw && potwUrl ? `<a href="${siteUrl}/photos" style="display:block;margin:0 0 6px"><img src="${potwUrl}" alt="${esc(potw.title ?? "")}" style="display:block;max-width:100%;max-height:340px;border:1px solid #c9cfc9;background:#fff"></a>
<p style="margin:0 0 28px;font-size:16px;color:#55636d">${esc(potw.title ?? "From the album")}${potw.date ? `, ${esc(fmtDate(potw.date))}` : ""}${potwPeople.length ? `. ${potwPeople.map((p) => `<a href="${siteUrl}/person/${p!.id}" style="color:#2f6a86">${esc(p!.name)}</a>`).join(", ")}` : ""}</p>` : ""}
${items.length ? items.map((it) => {
  const l = line(it);
  const face = faceUrl.get(it.person.id);
  const text = `<span style="color:#55636d;font-size:16px">${esc(fmtDay(it.day))} ${it.year}</span><br>
<a href="${siteUrl}/person/${it.person.id}" style="color:#2f6a86">${esc(l.who)}</a> ${esc(l.what)}${esc(l.where)}.<br>
<span style="font-size:16px;color:#55636d">${esc(l.rel)}${l.ago}.</span>`;
  return face
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="vertical-align:top;padding-right:14px"><img src="${face}" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border:1px solid #c9cfc9;background:#fff"></td><td style="vertical-align:top">${text}</td></tr></table>`
    : `<p style="margin:0 0 18px">${text}</p>`;
}).join("\n") : `<p>Nothing in the records falls in this week. That is unusual, so the tree may have gained a fact or two by next Monday.</p>`}
${gap ? `<hr style="border:none;border-top:1px solid #c9cfc9;margin:28px 0">
<h2 style="font-weight:500;font-size:24px;margin:0 0 8px">One to chase this week</h2>
<p style="margin:0"><a href="${siteUrl}/person/${gap.person.id}" style="color:#2f6a86">${esc(gap.person.name)}</a>, ${esc(gap.gen !== null ? `${ROOT_SHORT_NAME}'s ${ancestorLabel(gap.gen, gap.person.sex)}` : "")}${gap.person.birth?.date ? `, born ${esc(fmtDate(gap.person.birth.date))}` : ""}${gap.person.birth?.place ? ` in ${esc(gap.person.birth.place)}` : ""}. No parents recorded. ${gap.person.ancestryUrl ? `<a href="${gap.person.ancestryUrl}" style="color:#2f6a86">Open on Ancestry</a>.` : ""}</p>` : ""}
<p style="margin:32px 0 0;font-size:15px;color:#55636d">From <a href="${siteUrl}" style="color:#2f6a86">the family tree</a>. Sent every Monday. Reply to this email to reach ${OWNER_NAME}.</p>
</div></body></html>`;

  const text = [
    `This week in the family (${range})`,
    "",
    ...items.map((it) => { const l = line(it); return `${fmtDay(it.day)} ${it.year}: ${l.who} ${l.what}${l.where}. ${l.rel}${it.yearsAgo} years ago. ${siteUrl}/person/${it.person.id}`; }),
    ...(gap ? ["", `One to chase this week: ${gap.person.name}, no parents recorded. ${siteUrl}/person/${gap.person.id}`] : []),
    "",
    `From the family tree: ${siteUrl}`,
  ].join("\n");

  return { subject, html, text, count: items.length };
}
