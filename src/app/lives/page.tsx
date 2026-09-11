import { getTree, syncEdits } from "@/lib/data";
import { ROOT_SHORT_NAME } from "@/lib/config";
import { ahnentafel, genOf, paternal } from "@/lib/ancestry";
import { portraitFor } from "@/lib/media";
import { Lives, type Life } from "./Lives";

const GENS = 6;

import { Comments } from "@/components/Comments";
export default async function LivesPage() {
  await syncEdits();
  const tree = getTree();
  const a = ahnentafel(tree, tree.rootId, GENS);
  const thisYear = new Date().getFullYear();
  const lives: Life[] = [];
  for (const [n, p] of a) {
    const b = p.birth?.date?.year ?? null;
    const d = p.death?.date?.year ?? null;
    if (!b && !d) continue;
    const start = b ?? (d ? d - 70 : null);
    const end = d ?? (p.living ? thisYear : b ? Math.min(b + 75, thisYear) : null);
    if (start === null || end === null) continue;
    lives.push({ id: p.id, n, gen: genOf(n), paternal: paternal(n), name: p.name, start, end, estimatedStart: !b, estimatedEnd: !d && !p.living, face: portraitFor(p.id)?.id ?? null, place: p.birth?.place ?? null });
  }
  lives.sort((x, y) => x.gen - y.gen || x.n - y.n);
  return (
    <>
      <h1>Lives, side by side</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {ROOT_SHORT_NAME} and their direct ancestors for six generations, each life a bar from birth to death. Faint bars are estimates where a date is missing. The vertical lines are the census nights and the wars, the moments the records come from. Hover a bar to see who it is; click to open them.
      </p>
      <Lives lives={lives} />
      <Comments page="/lives" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
