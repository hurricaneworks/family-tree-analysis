import Link from "next/link";
import { getTree, syncEdits } from "@/lib/data";
import { ROOT_SHORT_NAME } from "@/lib/config";
import { ahnentafel, genOf, paternal, ancestorsInGen } from "@/lib/ancestry";
import { portraitFor } from "@/lib/media";
import { lifespan } from "@/lib/format";
import { FanChart, type Wedge } from "./FanChart";

const GENS = 7; // rings beyond the centre: 2, 4, 8 ... 128 wedges

import { Comments } from "@/components/Comments";
export default async function FanPage({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  await syncEdits();
  const { root: rootParam } = await searchParams;
  const tree = getTree();
  const rootId = rootParam && tree.byId.has(rootParam) ? rootParam : tree.rootId;
  const root = tree.byId.get(rootId)!;
  const a = ahnentafel(tree, rootId, GENS);

  const wedges: Wedge[] = [];
  let stops = 0, known = 0;
  for (let n = 2; n < 2 ** (GENS + 1); n++) {
    const p = a.get(n);
    const parentKnown = a.has(Math.floor(n / 2));
    if (!p && !parentKnown) continue; // nothing to draw beyond a stopped line
    if (p) known++; else stops++;
    wedges.push({
      n,
      gen: genOf(n),
      paternal: paternal(n),
      id: p?.id ?? null,
      name: p?.name ?? null,
      surname: p?.surname ?? null,
      years: p ? lifespan(p) : null,
      place: p?.birth?.place ?? null,
      face: p ? portraitFor(p.id)?.id ?? null : null,
    });
  }
  const rootFace = portraitFor(rootId)?.id ?? null;
  const parents = ancestorsInGen(a, 1);

  return (
    <>
      <h1>{rootId === tree.rootId ? `${ROOT_SHORT_NAME}'s fan` : `${root.name}'s fan`}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {known} ancestors across {GENS} generations, father&apos;s side on the left, mother&apos;s on the right. Empty wedges are the {stops} lines that stop. Click a wedge to open the person; click a name below the chart to re-centre the fan on them and go further back.
      </p>
      <div className="mt-6">
        <FanChart wedges={wedges} rootName={root.name} rootFace={rootFace} rootId={rootId} />
      </div>
      <p className="mt-4 data">
        Re-centre on{" "}
        {parents.map(({ n, person }) => person ? <span key={n}>{n > 2 && " or "}<Link href={`/fan?root=${person.id}`}>{person.name}</Link></span> : null)}
        {rootId !== tree.rootId && <> · <Link href="/fan">Back to {ROOT_SHORT_NAME}</Link></>}
      </p>
      <Comments page="/fan" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
