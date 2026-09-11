import type { Person } from "@/lib/types";
import { getWorld, worldPossible, type World } from "@/lib/world";
import { WorldPending } from "./WorldPending";
import { CHAT } from "@/lib/features";

/** The "Their world" section on a person page. */
export async function TheirWorld({ p, world }: { p: Person; world?: World | null }) {
  if (!worldPossible(p) || !CHAT) return null;
  const w = world !== undefined ? world : await getWorld(p);
  return (
    <section className="mt-12 max-w-3xl">
      <h2>Their world</h2>
      <p className="data text-ink-soft">Background from Wikipedia&apos;s year pages and on-this-day lists, with a short note written from them. Not family record.</p>
      {!w ? (
        <div className="mt-3"><WorldPending id={p.id} /></div>
      ) : (
        <>
          <p className="mt-4 whitespace-pre-line text-lg">{w.passage}</p>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            {w.born && (w.born.yearNotes.length > 0 || w.born.dayEvents.length > 0) && (
              <div>
                <h3>{w.born.year}, the year {p.given?.split(" ")[0] ?? p.name.split(" ")[0]} was born</h3>
                {w.born.yearNotes.length > 0 && <ul className="mt-2 list-disc pl-5 data">{w.born.yearNotes.slice(0, 7).map((n, i) => <li key={i}>{n}</li>)}</ul>}
                {w.born.dayEvents.length > 0 && (
                  <>
                    <p className="mt-4 data text-ink-soft">On the same day of the year</p>
                    <ul className="mt-1 list-disc pl-5 data">{w.born.dayEvents.map((e, i) => <li key={i}><span className="text-ink-soft">{e.year}</span> {e.text}</li>)}</ul>
                  </>
                )}
                {w.born.dayBirths.length > 0 && (
                  <>
                    <p className="mt-4 data text-ink-soft">Born the same day, near the same time</p>
                    <ul className="mt-1 list-disc pl-5 data">{w.born.dayBirths.map((e, i) => <li key={i}><span className="text-ink-soft">{e.year}</span> {e.text}</li>)}</ul>
                  </>
                )}
              </div>
            )}
            {w.died && (w.died.yearNotes.length > 0 || w.died.dayEvents.length > 0) && (
              <div>
                <h3>{w.died.year}, the year of {p.sex === "F" ? "her" : p.sex === "M" ? "his" : "their"} death</h3>
                {w.died.yearNotes.length > 0 && <ul className="mt-2 list-disc pl-5 data">{w.died.yearNotes.slice(0, 6).map((n, i) => <li key={i}>{n}</li>)}</ul>}
                {w.died.dayEvents.length > 0 && (
                  <>
                    <p className="mt-4 data text-ink-soft">On the same day of the year</p>
                    <ul className="mt-1 list-disc pl-5 data">{w.died.dayEvents.map((e, i) => <li key={i}><span className="text-ink-soft">{e.year}</span> {e.text}</li>)}</ul>
                  </>
                )}
              </div>
            )}
          </div>
          {w.sources.length > 0 && <p className="mt-4 data text-ink-soft">From {w.sources.map((s, i) => <span key={s}>{i > 0 && ", "}<a href={s} target="_blank" rel="noreferrer">{decodeURIComponent(s.split("/wiki/")[1]).replace(/_/g, " ")}</a></span>)}.</p>}
        </>
      )}
    </section>
  );
}
