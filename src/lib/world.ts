/**
 * "Their world": what was happening when a person was born and died, from Wikipedia's year pages and
 * on-this-day feed, plus a short grounded passage from Claude. Built once per person and cached.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Person } from "./types";
import { fmtDate, eventLabel } from "./format";
import { USER_AGENT } from "./config";
import { DATABASE } from "./features";

export type World = {
  born: { year: number; place: string | null; yearNotes: string[]; dayEvents: { year: number; text: string }[]; dayBirths: { year: number; text: string }[] } | null;
  died: { year: number; place: string | null; yearNotes: string[]; dayEvents: { year: number; text: string }[] } | null;
  passage: string;
  sources: string[];
};

const UA = USER_AGENT;
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

/** Which Wikipedia year page fits the place. */
function yearPage(year: number, place: string | null): string[] {
  const p = (place ?? "").toLowerCase();
  const country =
    /australia|victoria|queensland|new south wales|tasmania/.test(p) ? "Australia" :
    /canada|ontario|quebec|nova scotia|manitoba|alberta|british columbia/.test(p) ? "Canada" :
    /usa|united states|utah|illinois|new york|pennsylvania|massachusetts|california|ohio|michigan|new jersey/.test(p) ? "the_United_States" :
    /ireland|donegal|antrim|dublin|tyrone|derry/.test(p) ? "Ireland" :
    /wales|glamorgan|pembroke|dyfed/.test(p) ? "Wales" :
    /england|lincolnshire|yorkshire|lancashire|london|northumberland|durham|kent|surrey|devon|cheshire/.test(p) ? "England" :
    "Scotland";
  const pages = [`${year}_in_${country}`];
  if (country === "Scotland" || country === "England" || country === "Wales") pages.push(`${year}_in_the_United_Kingdom`);
  pages.push(`${year}`);
  return pages;
}

const strip = (w: string) =>
  w.replace(/\{\{[^}]*\}\}/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "").replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// many people share a year and a birthday: fetch each Wikipedia page once per process
const yearCache = new Map<string, { notes: string[]; source: string | null }>();
const dayCache = new Map<string, { events: { year: number; text: string }[]; births: { year: number; text: string }[] }>();

/** The Events section of a Wikipedia year page as plain lines. */
async function yearNotes(year: number, place: string | null): Promise<{ notes: string[]; source: string | null }> {
  const key = yearPage(year, place).join("|");
  const hit = yearCache.get(key);
  if (hit) return hit;
  const result = await yearNotesUncached(year, place);
  yearCache.set(key, result);
  return result;
}

async function yearNotesUncached(year: number, place: string | null): Promise<{ notes: string[]; source: string | null }> {
  for (const page of yearPage(year, place)) {
    try {
      const secRes = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=sections&format=json&redirects=1`, { headers: { "User-Agent": UA } });
      if (!secRes.ok) continue;
      const sec = (await secRes.json()) as { parse?: { sections: { line: string; index: string }[] } };
      const events = sec.parse?.sections.find((s) => /^events$/i.test(s.line)) ?? sec.parse?.sections[0];
      if (!events) continue;
      const res = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&section=${events.index}&format=json&redirects=1`, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const j = (await res.json()) as { parse?: { wikitext: { "*": string } } };
      const text = j.parse?.wikitext["*"] ?? "";
      const lines = text.split("\n").filter((l) => /^\*+\s*\S/.test(l)).map((l) => strip(l.replace(/^\*+\s*/, ""))).filter((l) => l.length > 20 && l.length < 260);
      if (lines.length >= 3) return { notes: lines.slice(0, 40), source: `https://en.wikipedia.org/wiki/${page}` };
    } catch { /* try the next page */ }
  }
  return { notes: [], source: null };
}

async function onThisDay(month: number, day: number): Promise<{ events: { year: number; text: string }[]; births: { year: number; text: string }[] }> {
  const key = `${month}-${day}`;
  const hit = dayCache.get(key);
  if (hit) return hit;
  const result = await onThisDayUncached(month, day);
  if (result.events.length || result.births.length) dayCache.set(key, result);
  return result;
}

async function onThisDayUncached(month: number, day: number): Promise<{ events: { year: number; text: string }[]; births: { year: number; text: string }[] }> {
  try {
    const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return { events: [], births: [] };
    const j = (await res.json()) as { events?: { year: number; text: string }[]; births?: { year: number; text: string }[] };
    return { events: (j.events ?? []).map((e) => ({ year: e.year, text: e.text })), births: (j.births ?? []).map((e) => ({ year: e.year, text: e.text })) };
  } catch { return { events: [], births: [] }; }
}

const near = <T extends { year: number }>(items: T[], year: number, span: number, n: number) =>
  items.filter((i) => Math.abs(i.year - year) <= span).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year)).slice(0, n).sort((a, b) => a.year - b.year);

export function factsKey(p: Person): string {
  return createHash("sha1").update(JSON.stringify([p.name, p.birth?.date?.raw, p.birth?.place, p.death?.date?.raw, p.death?.place])).digest("hex").slice(0, 16);
}

export async function getWorld(p: Person): Promise<World | null> {
  if (!DATABASE) return null;
  const { data } = await admin().from("world").select("facts_key, data").eq("person_id", p.id).maybeSingle();
  if (data && data.facts_key === factsKey(p)) return data.data as World;
  return null;
}

/** Can we say anything worthwhile? Needs a birth year from 1700 on. */
export const worldPossible = (p: Person) => Boolean(p.birth?.date?.year && p.birth.date.year >= 1700 && p.birth.date.year <= new Date().getFullYear() - 5);

export async function buildWorld(p: Person): Promise<World> {
  const b = p.birth?.date, d = p.death?.date;
  const sources: string[] = [];
  let born: World["born"] = null, died: World["died"] = null;
  if (b?.year) {
    const yn = await yearNotes(b.year, p.birth?.place ?? null);
    if (yn.source) sources.push(yn.source);
    const otd = b.month && b.day ? await onThisDay(b.month, b.day) : { events: [], births: [] };
    if (b.month && b.day) sources.push(`https://en.wikipedia.org/wiki/${["January","February","March","April","May","June","July","August","September","October","November","December"][b.month - 1]}_${b.day}`);
    born = { year: b.year, place: p.birth?.place ?? null, yearNotes: yn.notes.slice(0, 12), dayEvents: near(otd.events, b.year, 25, 4), dayBirths: near(otd.births, b.year, 12, 4) };
  }
  if (d?.year && d.year !== b?.year) {
    const yn = await yearNotes(d.year, p.death?.place ?? p.birth?.place ?? null);
    if (yn.source && !sources.includes(yn.source)) sources.push(yn.source);
    const otd = d.month && d.day ? await onThisDay(d.month, d.day) : { events: [], births: [] };
    died = { year: d.year, place: p.death?.place ?? null, yearNotes: yn.notes.slice(0, 8), dayEvents: near(otd.events, d.year, 25, 3) };
  }

  const facts = [
    `${p.name}, born ${fmtDate(b) || "date unknown"}${p.birth?.place ? ` in ${p.birth.place}` : ""}${d ? `, died ${fmtDate(d)}${p.death?.place ? ` in ${p.death.place}` : ""}` : ""}.`,
    ...p.events.filter((e) => ["OCCU", "RESI", "Arrival", "Departure", "EMIG", "Military Service", "_MILT"].includes(e.type) && (e.date?.year || e.place)).slice(0, 8).map((e) => `${eventLabel(e.type)}${e.value ? ` ${e.value}` : ""} ${fmtDate(e.date)}${e.place ? ` at ${e.place}` : ""}`.replace(/\s+/g, " ")),
  ].join("\n");
  const grounding = [
    born ? `The year ${born.year}${born.place ? ` (${born.place})` : ""}:\n${born.yearNotes.map((n) => `- ${n}`).join("\n")}` : "",
    born?.dayEvents.length ? `On the same day of the year:\n${born.dayEvents.map((e) => `- ${e.year}: ${e.text}`).join("\n")}` : "",
    died ? `The year ${died.year}:\n${died.yearNotes.map((n) => `- ${n}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  // Sonnet: a short grounded passage from supplied notes, written 5,600 times; Opus was 2.5x the cost
  // for no visible difference on this task (decided 10 Sep 2026).
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    output_config: { effort: "low" },
    system: "You write short background notes for a private family-history website read by a family historian who may be elderly. British English, no dashes, plain words, no headings, no bullet points, no flourish.",
    messages: [{ role: "user", content: `Write 120 to 170 words on the world this person was born into and, if they died, the world they left: what was going on in their country and town in those years, what daily life was like for ordinary people, and one or two things from the same-day list if they are striking. Use only the facts below and the notes from Wikipedia; do not invent local detail. Do not restate their birth and death dates. Refer to them by first name. Write as background, not as fact about them ("Glasgow that year was...").\n\nFacts about the person:\n${facts}\n\nNotes:\n${grounding || "(no notes found; write two or three careful sentences about the period in general)"}` }],
  });
  const passage = res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
  const world: World = { born, died, passage, sources };
  if (DATABASE) await admin().from("world").upsert({ person_id: p.id, facts_key: factsKey(p), data: world, generated_at: new Date().toISOString() });
  return world;
}
