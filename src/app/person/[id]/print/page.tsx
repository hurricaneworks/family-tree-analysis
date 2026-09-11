import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTree, parentsOf, spouseFamilies, syncEdits } from "@/lib/data";
import { lifeEntries, sketch } from "@/lib/timeline";
import { portraitFor, getMedia, hasImage, isDocumentLike } from "@/lib/media";
import { getWorld, worldPossible } from "@/lib/world";
import { getReadings } from "@/lib/readings";
import { fmtDate, lifespan, place, ancestorLabel } from "@/lib/format";
import { ROOT_SHORT_NAME, TREE_NAME } from "@/lib/config";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/** Browsers name a saved PDF after the page title, so make it the person: Euphemia_Cameron_McGilvray_1883-1958. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  await syncEdits();
  const p = getTree().byId.get(id);
  if (!p) return { title: "Person" };
  const years = [p.birth?.date?.year, p.death?.date?.year].filter(Boolean).join("-");
  const name = `${p.name}${years ? ` ${years}` : ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "_");
  return { title: name || "Person" };
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A printable life: the page the reader presses Print on, and saves as a PDF to share. */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await syncEdits();
  const tree = getTree();
  const p = tree.byId.get(id);
  if (!p) notFound();

  const entries = lifeEntries(tree, p);
  const face = portraitFor(p.id);
  const world = worldPossible(p) ? await getWorld(p) : null;
  const readings = getReadings();
  const pictures = (getMedia().byPerson.get(p.id) ?? []).filter(hasImage);
  const photos = pictures.filter((m) => !isDocumentLike(m)).slice(0, 6);
  const papers = pictures.filter(isDocumentLike);
  const gen = tree.ancestorGen.get(p.id);
  const sources = [...new Set(p.events.flatMap((e) => e.citations.map((c) => (c.sourceId ? tree.sources.get(c.sourceId)?.title : null))).filter((t): t is string => Boolean(t)))];

  return (
    <article className="print-sheet">
      <div className="no-print mb-6 flex flex-wrap items-center gap-4">
        <PrintButton filename={`${p.name}${[p.birth?.date?.year, p.death?.date?.year].filter(Boolean).length ? ` ${[p.birth?.date?.year, p.death?.date?.year].filter(Boolean).join("-")}` : ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "_")} />
        <a href={`/person/${p.id}`} className="data">Back to {p.given?.split(" ")[0] ?? p.name}</a>
        <span className="data text-ink-soft">Choose &quot;Save as PDF&quot; in the print window to keep or send it.</span>
      </div>

      <header className="print-head">
        {face && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photo/${face.id}`} alt="" className="print-face" />
        )}
        <div>
          <h1>{p.name}</h1>
          <p className="print-years">{lifespan(p)}</p>
          {gen !== undefined && gen > 0 && <p className="data">{ROOT_SHORT_NAME}&apos;s {ancestorLabel(gen, p.sex)}</p>}
        </div>
      </header>

      <p className="print-sketch">{sketch(tree, p)}</p>

      <section className="print-block">
        <h2>Their life, year by year</h2>
        <ol className="tl">
          {entries.map((e, i) => (
            <li key={i} className="tl-item">
              <div className="tl-date">
                {e.date?.day && e.date.month ? <span className="tl-day">{e.date.day} {MON[e.date.month - 1]}</span> : e.date?.month ? <span className="tl-day">{MON[e.date.month - 1]}</span> : null}
                <span className="tl-year">{e.date?.year ?? ""}</span>
                {e.age !== null && <span className="tl-age">age {e.age}</span>}
              </div>
              <div className="tl-body">
                <h3>{e.title}</h3>
                <p>{e.text}</p>
                {(e.date || e.where) && <p className="tl-where">{[fmtDate(e.date), e.where].filter(Boolean).join(" · ")}</p>}
                {e.sources.length > 0 && <p className="tl-src">{e.sources.join("; ")}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {parentsOf(tree, p.id).length + spouseFamilies(tree, p).length > 0 && (
        <section className="print-block">
          <h2>Family</h2>
          {parentsOf(tree, p.id).length > 0 && (
            <p><strong>Parents.</strong> {parentsOf(tree, p.id).map((x) => `${x.name} (${lifespan(x)})`).join(", ")}</p>
          )}
          {spouseFamilies(tree, p).map((m) => (
            <p key={m.family.key} className="mt-2">
              <strong>{m.spouse ? `With ${m.spouse.name}` : "Children"}.</strong>{" "}
              {m.family.events.find((e) => e.type === "MARR")?.date ? `Married ${fmtDate(m.family.events.find((e) => e.type === "MARR")!.date)}. ` : ""}
              {m.children.length ? m.children.map((c) => `${c.name} (${c.birth?.date?.year ?? "?"})`).join(", ") : "No children recorded."}
            </p>
          ))}
        </section>
      )}

      {photos.length > 0 && (
        <section className="print-block">
          <h2>Pictures</h2>
          <div className="print-grid">
            {photos.map((m) => (
              <figure key={m.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photo/${m.id}`} alt="" />
                <figcaption className="data">{m.title}{m.date ? `, ${fmtDate(m.date)}` : ""}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {papers.length > 0 && (
        <section className="print-block">
          <h2>Papers</h2>
          {papers.map((m) => {
            const r = readings[m.id];
            return (
              <div key={m.id} className="print-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photo/${m.id}`} alt="" />
                <div>
                  <p><strong>{m.title}</strong></p>
                  {r && <p className="data">{r.documentType}{r.dateOnDocument ? `, ${r.dateOnDocument}` : ""}</p>}
                  {r && <p>{r.summary}</p>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {world?.passage && (
        <section className="print-block">
          <h2>Their world</h2>
          <p>{world.passage}</p>
          <p className="data">Background from Wikipedia&apos;s year pages, not family record.</p>
        </section>
      )}

      {sources.length > 0 && (
        <section className="print-block">
          <h2>Where this comes from</h2>
          <ul className="data">{sources.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      )}

      <footer className="print-foot data">
        From {TREE_NAME}, drawn from the export of {tree.meta.gedcomExportDate}. Printed {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
      </footer>
    </article>
  );
}
