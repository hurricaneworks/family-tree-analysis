"use client";

import { useEffect, useRef, useState } from "react";

export type Chapter = {
  gen: number;
  title: string;
  possible: number;
  known: number;
  stops: number;
  yearFrom: number | null;
  yearTo: number | null;
  places: string[];
  people: { id: string; n: number; name: string; paternal: boolean; born: number | null; place: string | null; face: string | null; stop: boolean }[];
  events: { year: number; text: string; weight: number; personId: string }[];
};

/**
 * A walk backwards through the generations. The year in the backdrop runs back as you scroll,
 * the ground darkens with depth, and each generation's faces rise into view. Only the family's own
 * records are on screen; nothing here is decoration for its own sake.
 */
export function Journey({ chapters, total, deepest }: { chapters: Chapter[]; total: number; deepest: number }) {
  const [active, setActive] = useState(0);
  const [year, setYear] = useState<number>(chapters[0]?.yearFrom ?? 1944);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const raf = useRef<number | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.gen));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of refs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  // count the backdrop year down (or up) to the active chapter's midpoint
  useEffect(() => {
    const c = chapters[active];
    const target = c?.yearFrom && c.yearTo ? Math.round((c.yearFrom + c.yearTo) / 2) : c?.yearFrom ?? year;
    if (reduced) { setYear(target); return; }
    const start = year, delta = target - start, t0 = performance.now(), dur = 900;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      setYear(Math.round(start + delta * ease));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const depth = active / Math.max(1, chapters.length - 1); // 0 now .. 1 deepest

  return (
    <div className="journey" style={{ ["--depth" as string]: depth }}>
      <div className="journey-backdrop" aria-hidden>
        <div className="journey-year">{year}</div>
        <div className="journey-gen">{chapters[active]?.gen === 0 ? "today" : `${chapters[active]?.gen} generation${chapters[active]?.gen === 1 ? "" : "s"} back`}</div>
      </div>

      <header className="journey-intro">
        <h1>The long walk back</h1>
        <p>Scroll down, and the years run back. Each stop is one generation of the home person&apos;s direct ancestors: who they were, where they were born, and one or two things the records say happened to them. Where a wedge is empty, that is where the tree stops and the searching begins.</p>
        <p className="data">{total.toLocaleString("en-GB")} direct ancestors are traced in all, the furthest {deepest} generations back. The walk stops at eight.</p>
      </header>

      {chapters.map((c, i) => (
        <section key={c.gen} id={`gen-${c.gen}`} data-gen={c.gen} ref={(el) => { refs.current[i] = el; }} className={`journey-chapter ${active === c.gen ? "is-active" : ""}`}>
          <div className="journey-chapter-inner">
            <p className="data journey-kicker">
              {c.gen === 0 ? "Where the walk starts" : `Generation ${c.gen}`}
              {c.yearFrom && c.yearTo && c.gen > 0 && <> · born {c.yearFrom === c.yearTo ? c.yearFrom : `${c.yearFrom} to ${c.yearTo}`}</>}
            </p>
            <h2>{c.title}</h2>
            <p className="journey-summary">
              {c.gen === 0 ? (
                <>Born {c.yearFrom} in {c.places[0]}.</>
              ) : (
                <>
                  {c.known} of {c.possible} known{c.stops > 0 && <>, {c.stops} line{c.stops > 1 ? "s" : ""} stop{c.stops === 1 ? "s" : ""} here</>}.
                  {c.places.length > 0 && <> Born in {c.places.join(", ")}.</>}
                </>
              )}
            </p>
            <div className="journey-faces" style={{ ["--n" as string]: c.possible }}>
              {c.people.map((p, k) => (
                <a key={p.id + p.n} href={`/person/${p.id}`} className={`journey-face ${p.paternal ? "paternal" : "maternal"} ${p.stop ? "stop" : ""}`} style={{ ["--i" as string]: k }} title={`${p.name}${p.born ? `, born ${p.born}` : ""}${p.place ? `, ${p.place}` : ""}`}>
                  {p.face ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/photo/${p.face}`} alt="" loading="lazy" />
                  ) : (
                    <span className="journey-initials">{p.name.split(" ").filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join("")}</span>
                  )}
                  {c.possible <= 16 && <span className="journey-name">{p.name}{p.born ? <span> {p.born}</span> : null}</span>}
                </a>
              ))}
              {Array.from({ length: c.possible - c.known }).slice(0, c.possible <= 64 ? undefined : 0).map((_, k) => (
                <span key={`gap-${k}`} className="journey-face gap" aria-hidden />
              ))}
            </div>
            {c.events.length > 0 && (
              <ul className="journey-events">
                {c.events.map((e, k) => (
                  <li key={k}><span className="data journey-eyear">{e.year}</span> <a href={`/person/${e.personId}`} className="journey-elink">{e.text}</a></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      <footer className="journey-end">
        <h2>And further back</h2>
        <p>The walk stops here, but the tree does not: {total.toLocaleString("en-GB")} direct ancestors are recorded, some of them {deepest} generations up, into the kings and earls that so many old trees eventually claim. Follow any wedge on the <a href="/fan">fan</a>, or ask the tree a question.</p>
      </footer>
    </div>
  );
}
