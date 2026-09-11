import Link from "next/link";
import { getTree, syncEdits } from "@/lib/data";
import { ROOT_SHORT_NAME } from "@/lib/config";
import { ahnentafel, lineOf } from "@/lib/ancestry";
import { portraitFor } from "@/lib/media";
import { lifespan } from "@/lib/format";
import { getGaps } from "@/lib/gaps";

/** The 16 great-great-grandparents (ahnentafel 16..31), grouped under the four grandparents. */
import { Comments } from "@/components/Comments";
export default async function SixteenPage() {
  await syncEdits();
  const tree = getTree();
  const a = ahnentafel(tree, tree.rootId, 4);
  const gaps = getGaps(tree);
  const groups = [4, 5, 6, 7].map((g) => ({
    grandparent: a.get(g),
    line: lineOf(g),
    members: [4 * g, 4 * g + 1, 4 * g + 2, 4 * g + 3].map((n) => ({ n, person: a.get(n) })),
  }));
  const known = [...a.keys()].filter((n) => n >= 16).length;

  return (
    <>
      <h1>The sixteen</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {ROOT_SHORT_NAME}&apos;s great-great-grandparents, the generation born around the 1820s and 1830s that every branch of the tree hangs from. {known} of 16 are known. Each group of four sits under the grandparent they lead to.
      </p>
      {groups.map(({ grandparent, line, members }) => (
        <section key={line} className="mt-12">
          <h2>
            Through {grandparent ? <Link href={`/person/${grandparent.id}`}>{grandparent.name}</Link> : "an unknown grandparent"}
            <span className="data text-ink-soft"> {line}</span>
          </h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {members.map(({ n, person }) => {
              const face = person ? portraitFor(person.id) : null;
              const stop = person && !person.famc.length;
              const personGaps = person ? gaps.filter((g) => g.person.id === person.id && g.kind !== "line-stops").length : 0;
              return (
                <div key={n} className={`border-t-4 ${n % 2 === 0 ? "border-sea" : "border-heather"} pt-3`}>
                  <div className="aspect-square w-full overflow-hidden border border-rule bg-paper-deep">
                    {face ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photo/${face.id}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center data text-ink-soft">{person ? "no picture" : "unknown"}</div>
                    )}
                  </div>
                  <p className="mt-3 text-lg leading-tight">
                    {person ? <Link href={`/person/${person.id}`}>{person.name}</Link> : <span className="text-ink-soft">Not yet found</span>}
                  </p>
                  <p className="data text-ink-soft">
                    {lineOf(n)}
                    {person && <><br />{lifespan(person)}{person.birth?.place ? <><br />{person.birth.place}</> : null}</>}
                  </p>
                  {person && (stop || personGaps > 0) && (
                    <p className="data mt-1 text-kelp">{stop ? "Parents unknown. " : ""}{personGaps ? `${personGaps} other gap${personGaps > 1 ? "s" : ""}.` : ""}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <Comments page="/sixteen" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
