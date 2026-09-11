import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTree, parentsOf, spouseFamilies, syncEdits } from "@/lib/data";
import { getGaps, gapsFor, GAP_TITLES } from "@/lib/gaps";
import { PersonLink } from "@/components/PersonLink";
import { ancestorLabel, eventLabel, fmtDate, lifespan, place } from "@/lib/format";
import { hasImage, mediaForPerson } from "@/lib/media";
import { getNotes } from "@/lib/notes";
import { MediaCard } from "@/components/MediaCard";
import { Comments } from "@/components/Comments";
import { TheirWorld } from "@/components/TheirWorld";
import { getWorld } from "@/lib/world";
import { threadsForPage } from "@/lib/messages";
import { portraitFor } from "@/lib/media";
import { ROOT_SHORT_NAME } from "@/lib/config";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await syncEdits();
  const tree = getTree();
  if (tree.aliases.has(id)) redirect(`/person/${tree.aliases.get(id)}`);
  const p = tree.byId.get(id);
  if (!p) notFound();
  const mergedFrom = tree.mergedInto.get(p.id) ?? [];

  const gen = tree.ancestorGen.get(p.id);
  const steps = tree.steps.get(p.id);
  const parents = parentsOf(tree, p.id);
  const marriages = spouseFamilies(tree, p);
  const gaps = gapsFor(getGaps(tree), p.id);
  const [notes, world, threads] = await Promise.all([getNotes(), getWorld(p), threadsForPage(`/person/${p.id}`)]);
  const pictures = mediaForPerson(p.id, notes).filter(hasImage);
  const events = [...p.events, ...marriages.flatMap((m) => m.family.events)].sort(
    (a, b) => (a.date?.year ?? 9999) - (b.date?.year ?? 9999),
  );

  return (
    <>
      <p className="data text-ink-soft">
        {gen === 0 ? "Home person" : gen !== undefined ? `${ROOT_SHORT_NAME}'s ${ancestorLabel(gen, p.sex)}` : steps !== undefined ? `${steps} family links from ${ROOT_SHORT_NAME}` : `Not connected to ${ROOT_SHORT_NAME}'s line`}
      </p>
      <div className="mt-1 flex items-start gap-5">
        {portraitFor(p.id) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photo/${portraitFor(p.id)!.id}`} alt="" className="border border-rule bg-white object-cover" style={{ width: 120, height: 120, flex: "none" }} />
        )}
        <h1>{p.name}</h1>
      </div>
      <p className="mt-2 text-xl">
        {lifespan(p)}
        {p.birth?.place ? `, born in ${place(p.birth.place)}` : ""}
        {p.death?.place ? `, died in ${place(p.death.place)}` : ""}.
      </p>
      {p.altNames.length > 0 && <p className="data text-ink-soft">Also recorded as {p.altNames.join("; ")}</p>}
      {p.withheld && <p className="mt-3 max-w-2xl border-l-4 border-sea pl-4">This person may be living, so their dates, places, events, notes and pictures are not shown. Their place in the family is. The README explains the rule and how the tree's owner can switch it off.</p>}
      {p.ancestryUrl && (
        <p className="mt-3 data">
          <a href={p.ancestryUrl} target="_blank" rel="noreferrer">Open on Ancestry</a>
        </p>
      )}
      <p className="mt-3 data"><Link href={`/person/${p.id}/print`}>Print this life, or save it as a PDF to send</Link></p>
      <form action="/people" className="mt-4 flex max-w-md gap-2">
        <input name="q" placeholder="Find someone else" aria-label="Find someone else" className="w-full border border-ink bg-white px-3 py-1.5" />
        <button type="submit" className="border border-ink px-4 py-1.5">Find</button>
      </form>

      {mergedFrom.length > 0 && (
        <p className="mt-3 max-w-2xl border-l-4 border-heather pl-4 data">
          Shown as one person in the app: {mergedFrom.length} duplicate record{mergedFrom.length > 1 ? "s" : ""} merged in. See the <Link href="/log">log</Link>; still to be merged on Ancestry unless ticked on <Link href="/list">My list</Link>.
        </p>
      )}

      {gaps.length > 0 && (
        <section className="mt-8 max-w-2xl border-l-4 border-kelp pl-4">
          <h3>What is missing here</h3>
          <ul className="mt-2 list-disc pl-5">
            {gaps.map((g, i) => (
              <li key={i}>
                {GAP_TITLES[g.kind].title}:{" "}
                {g.related ? (
                  <span className="text-ink-soft">
                    the tree also has <Link href={`/person/${g.related.id}`}>{g.related.name}</Link>{g.related.birth?.date?.year ? `, born ${g.related.birth.date.year}` : ""}.{" "}
                    <Link href={`/compare?a=${p.id}&b=${g.related.id}`}>Compare the two</Link>
                  </span>
                ) : (
                  <span className="text-ink-soft">{g.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pictures.length > 0 && (
        <section className="mt-10">
          <h2>Pictures and papers</h2>
          <div className="mt-5 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {pictures.map((m) => <MediaCard key={m.id} m={m} showPeople={m.people.length > 1} note={notes.get(m.id)} />)}
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2>Family</h2>
          <h3 className="mt-5">Parents</h3>
          {parents.length ? (
            <ul className="mt-1">{parents.map((x) => <li key={x.id}><PersonLink person={x} /></li>)}</ul>
          ) : (
            <p className="text-ink-soft">None recorded.</p>
          )}
          {marriages.map((m) => (
            <div key={m.family.key} className="mt-5">
              <h3>{m.spouse ? <>With <PersonLink person={m.spouse} /></> : "Children"}</h3>
              {m.family.events.map((e, i) => (
                <p key={i} className="data text-ink-soft">{eventLabel(e.type)} {fmtDate(e.date)}{e.place ? `, ${e.place}` : ""}</p>
              ))}
              {m.children.length ? (
                <ul className="mt-1">{m.children.map((c) => <li key={c.id}><PersonLink person={c} /></li>)}</ul>
              ) : (
                <p className="text-ink-soft">No children recorded.</p>
              )}
            </div>
          ))}
          {p.notes.length > 0 && (
            <>
              <h3 className="mt-6">Notes</h3>
              {p.notes.map((n, i) => <p key={i} className="mt-1 whitespace-pre-line">{n}</p>)}
            </>
          )}
        </section>

        <section>
          <h2>Life in the records</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr><th>Event</th><th>When</th><th>Where</th><th>Sources</th></tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td>{eventLabel(e.type)}{e.value ? <span className="data text-ink-soft"> {e.value}</span> : null}</td>
                    <td className="data">{e.date ? fmtDate(e.date) : e.type === "DEAT" && !e.place ? <span className="text-ink-soft">recorded, no details</span> : ""}</td>
                    <td className="data">{place(e.place)}{e.note ? <div className="text-ink-soft">{e.note}</div> : null}</td>
                    <td className="data">
                      {e.citations.map((c, j) => {
                        const s = c.sourceId ? tree.sources.get(c.sourceId) : null;
                        return <div key={j} className="text-ink-soft">{s?.title ?? "untitled source"}</div>;
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <TheirWorld p={p} world={world} />
      <Comments page={`/person/${p.id}`} personId={p.id} threads={threads} />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
