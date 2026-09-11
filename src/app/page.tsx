import Link from "next/link";
import { getTree, syncEdits } from "@/lib/data";
import { getGaps, GAP_TITLES, type GapKind } from "@/lib/gaps";
import { GapTable } from "@/components/GapTable";
import { plural } from "@/lib/format";
import { findings } from "@/lib/readings";
import { listTasks, syncDerivedTasks } from "@/lib/tasks";
import { CHAT, DATABASE, switchedOff } from "@/lib/features";
import { getReadings } from "@/lib/readings";

import { Comments } from "@/components/Comments";
export default async function Desk({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  await syncEdits();
  const tree = getTree();
  const gaps = getGaps(tree);
  const root = tree.byId.get(tree.rootId);
  await syncDerivedTasks();
  const top = (await listTasks(false)).slice(0, 5);

  // the five most useful things to look at next: direct-ancestor line stops and contradictions first
  const next = gaps.filter((g) => g.gen !== null && (g.kind === "line-stops" || g.kind === "inconsistent")).slice(0, 5);
  const counts = new Map<GapKind, number>();
  for (const g of gaps) counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1);

  const ancestors = tree.ancestorGen.size - 1;
  const deepest = Math.max(...tree.ancestorGen.values());
  const connected = tree.steps.size;

  return (
    <>
      {welcome && <p className="mb-6 max-w-3xl border-l-4 border-sea pl-4 text-lg">Your new password is saved and you are signed in.</p>}
      <p className="mb-6 max-w-3xl data"><Link href="/start">New here, or been away a while? Start here.</Link></p>
      <section className="max-w-3xl">
        <h1>Where the tree stands</h1>
        <p className="mt-4 text-xl">
          {plural(tree.people.length, "person", "people")} in {plural(tree.families.length, "family", "families")}, of whom {connected.toLocaleString("en-GB")} are connected to {root?.name ?? "the home person"}.
          Direct ancestors traced: {ancestors.toLocaleString("en-GB")}, the furthest {deepest} generations back.
        </p>
      </section>

      {CHAT && <section className="mt-10 max-w-3xl">
        <h2>Ask the tree</h2>
        <p className="mt-1 text-ink-soft">A question in plain words, as you would ask a person. It looks the answer up in the records before it says anything.</p>
        <form action="/ask" className="mt-3 flex gap-3">
          <input
            name="q"
            placeholder="Who was the first of the family to emigrate?"
            aria-label="Ask a question about the family"
            className="w-full border border-ink bg-white px-3 py-2 text-lg"
          />
          <button type="submit" className="border border-ink bg-ink px-5 py-2 text-lg text-paper">Ask</button>
        </form>
        <p className="mt-2 data text-ink-soft">
          Or try: {["Which of my great-grandparents do we know least about?", "Who in the family served in the war?"].map((s, i) => (
            <span key={s}>{i > 0 && " · "}<Link href={`/ask?q=${encodeURIComponent(s)}`}>{s}</Link></span>
          ))}
        </p>
      </section>}

      {DATABASE && <section className="mt-12 max-w-3xl">
        <h2>Top of your list</h2>
        {top.length ? (
          <ol className="mt-4 max-w-2xl list-decimal space-y-2 pl-6">
            {top.map((t) => (
              <li key={t.id}>
                <span>{t.title.length > 150 ? t.title.slice(0, 148).replace(/[,;:]?\s+\S*$/, "") + "…" : t.title}</span>
                {t.person_id && <Link href={`/person/${t.person_id}`} className="data ml-2 whitespace-nowrap">open</Link>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-ink-soft">Nothing on your list yet. Add a gap below with &quot;Add to my list&quot;.</p>
        )}
        <p className="mt-2 data"><Link href="/list">The whole list</Link></p>
      </section>}

      <section className="mt-12">
        <h2>Worth looking at next</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Direct lines that stop, and dates that contradict each other, nearest generations first.
        </p>
        <div className="mt-6">
          <GapTable gaps={next} showKind back="/" />
        </div>
        <p className="mt-4">
          <Link href="/gaps">All {gaps.length.toLocaleString("en-GB")} gaps</Link>
        </p>
      </section>

      {findings().length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2>What the papers say</h2>
          <p className="mt-2 text-ink-soft">
            {findings().reduce((a, x) => a + x.differs.length, 0)} facts on certificates and headstones differ from the tree, and {findings().reduce((a, x) => a + x.fresh.length, 0)} are not in it yet. <Link href="/papers">Read them</Link>.
          </p>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2>Gaps by kind</h2>
        <ul className="mt-4 divide-y divide-rule">
          {(Object.keys(GAP_TITLES) as GapKind[]).map((kind) => (
            <li key={kind} className="flex items-baseline justify-between gap-6 py-3">
              <span>
                <Link href={`/gaps#${kind}`}>{GAP_TITLES[kind].title}</Link>
                <span className="block text-ink-soft data">{GAP_TITLES[kind].blurb}</span>
              </span>
              <span className="data whitespace-nowrap">{(counts.get(kind) ?? 0).toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
      </section>

      {switchedOff(Object.keys(getReadings()).length > 0).length > 0 && (
        <section className="mt-14 max-w-3xl border-t border-ink pt-6">
          <h2>Not switched on</h2>
          <p className="mt-1 text-ink-soft">Parts of the site that need a key or a database. The tree, the gaps and every view work without them. Settings go in .env.local; .env.example lists them all.</p>
          <ul className="mt-4 divide-y divide-rule">
            {switchedOff(Object.keys(getReadings()).length > 0).map((f) => (
              <li key={f.title} className="py-3">
                <p className="text-lg">{f.title}</p>
                <p className="text-ink-soft">{f.line}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Comments page="/" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
