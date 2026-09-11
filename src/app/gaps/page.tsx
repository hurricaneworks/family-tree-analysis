import { getTree, syncEdits } from "@/lib/data";
import { getGaps, GAP_TITLES, type GapKind } from "@/lib/gaps";
import { GapTable } from "@/components/GapTable";

const PER_SECTION = 60;

import { Comments } from "@/components/Comments";
export default async function GapsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await syncEdits();
  const { all } = await searchParams;
  const tree = getTree();
  const gaps = getGaps(tree);
  const kinds = Object.keys(GAP_TITLES) as GapKind[];

  return (
    <>
      <h1>Gaps in the record</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Everything the tree is missing or gets wrong, grouped by kind. Within each group, direct ancestors come first, nearest generation first, then everyone else by how closely they connect.
        {all ? "" : ` Showing the first ${PER_SECTION} of each.`}
      </p>
      {!all && (
        <p className="mt-2 data">
          <a href="/gaps?all=1">Show every entry</a>
        </p>
      )}
      {kinds.map((kind) => {
        const list = gaps.filter((g) => g.kind === kind);
        const shown = all ? list : list.slice(0, PER_SECTION);
        return (
          <section key={kind} id={kind} className="mt-14 scroll-mt-6">
            <h2>
              {GAP_TITLES[kind].title} <span className="data text-ink-soft">{list.length.toLocaleString("en-GB")}</span>
            </h2>
            <p className="mt-1 max-w-2xl text-ink-soft">{GAP_TITLES[kind].blurb}</p>
            <div className="mt-5">
              {shown.length ? <GapTable gaps={shown} /> : <p className="data text-ink-soft">None.</p>}
            </div>
            {shown.length < list.length && (
              <p className="mt-3 data text-ink-soft">
                {list.length - shown.length} more. <a href="/gaps?all=1">Show every entry</a>
              </p>
            )}
          </section>
        );
      })}
      <Comments page="/gaps" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
