import Link from "next/link";
import { getTree, searchPeople, syncEdits } from "@/lib/data";
import { Face } from "@/components/Face";
import { Comments } from "@/components/Comments";
import { ancestorLabel, lifespan, place } from "@/lib/format";
import { ROOT_SHORT_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

/** One row in a list of people: face, name, dates, where they were born, how they relate. */
function PersonRow({ id }: { id: string }) {
  const tree = getTree();
  const p = tree.byId.get(id);
  if (!p) return null;
  const gen = tree.ancestorGen.get(p.id);
  const steps = tree.steps.get(p.id);
  const relation = gen === 0 ? "the home person" : gen !== undefined ? `${ROOT_SHORT_NAME}'s ${ancestorLabel(gen, p.sex)}` : steps !== undefined && steps <= 4 ? `${steps} family links away` : null;
  return (
    <li className="flex items-start gap-4 border-t border-rule py-3 first:border-t-0">
      <Link href={`/person/${p.id}`} className="shrink-0" aria-hidden tabIndex={-1}>
        <Face personId={p.id} size={56} />
      </Link>
      <div className="min-w-0">
        <p className="text-lg leading-tight">
          <Link href={`/person/${p.id}`}>{p.name}</Link>
        </p>
        <p className="data text-ink-soft">
          {lifespan(p)}
          {p.birth?.place && <>, born {place(p.birth.place)}</>}
          {relation && <>, {relation}</>}
        </p>
      </div>
    </li>
  );
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await syncEdits();
  const { q = "" } = await searchParams;
  const tree = getTree();
  const hits = q ? searchPeople(tree, q) : [];

  return (
    <>
      <h1>Find a person</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Type any part of a name, a place or a year. Every word has to match, so &quot;smith york&quot; finds the Smiths of York. Closest relations come first.
      </p>

      <form className="mt-6 flex max-w-xl gap-3" action="/people">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, place or year"
          autoFocus
          aria-label="Search for a person"
          className="w-full border border-ink bg-white px-3 py-2 text-lg"
        />
        <button className="border border-ink bg-ink px-5 py-2 text-lg text-paper" type="submit">Search</button>
      </form>

      {q && (
        <section className="mt-10 max-w-3xl">
          <h2>
            {hits.length === 0 ? "Nobody found" : hits.length === 100 ? "First 100 matches" : `${hits.length} ${hits.length === 1 ? "match" : "matches"}`}
            <span className="data text-ink-soft"> for “{q}”</span>
          </h2>
          {hits.length === 0 ? (
            <p className="mt-3">Try fewer words, or a surname on its own. Spelling in the old records varies, so “Macdonald” and “McDonald” are different people to the search.</p>
          ) : (
            <ul className="mt-4">{hits.map((p) => <PersonRow key={p.id} id={p.id} />)}</ul>
          )}
        </section>
      )}

      {!q && (
        <section className="mt-12 max-w-3xl">
          <h2>If you are not sure who to look for</h2>
          <ul className="mt-3 divide-y divide-rule">
            <li className="py-2"><Link href="/sixteen">The sixteen</Link> <span className="data text-ink-soft">your great-great-grandparents, on one page</span></li>
            <li className="py-2"><Link href="/fan">The fan</Link> <span className="data text-ink-soft">seven generations at a glance</span></li>
            <li className="py-2"><Link href="/ask">Ask the tree</Link> <span className="data text-ink-soft">describe who you mean and it will find them</span></li>
          </ul>
        </section>
      )}

      <Comments page="/people" />
    </>
  );
}
