import Link from "next/link";
import type { Gap } from "@/lib/gaps";
import { ancestorLabel, lifespan, place } from "@/lib/format";
import { Face } from "./Face";
import { addGapTask } from "@/app/list/actions";
import { DATABASE } from "@/lib/features";

export function Relationship({ gap }: { gap: Gap }) {
  if (gap.gen === 0) return <>home person</>;
  if (gap.gen !== null) return <>{ancestorLabel(gap.gen, gap.person.sex)}</>;
  if (gap.steps !== null) return <span className="text-ink-soft">{gap.steps} steps away</span>;
  return <span className="text-ink-soft">not connected</span>;
}

export function GapTable({ gaps, showKind = false, back = "/gaps" }: { gaps: Gap[]; showKind?: boolean; back?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="ledger">
        <thead>
          <tr>
            <th>Who</th>
            <th>Relationship</th>
            <th>{showKind ? "What is missing" : "Detail"}</th>
            <th>On Ancestry</th>
            {DATABASE && <th></th>}
          </tr>
        </thead>
        <tbody>
          {gaps.map((g, i) => (
            <tr key={`${g.person.id}-${g.kind}-${i}`}>
              <td>
                <div className="flex items-start gap-3">
                  <Face personId={g.person.id} placeholder={false} />
                  <div>
                    <Link href={`/person/${g.person.id}`}>{g.person.name}</Link>
                    <div className="data text-ink-soft">{lifespan(g.person)}{g.person.birth?.place ? `, ${place(g.person.birth.place)}` : ""}</div>
                  </div>
                </div>
              </td>
              <td className="data"><Relationship gap={g} /></td>
              <td className="data">
                {g.related ? (
                  <>
                    also recorded as <Link href={`/person/${g.related.id}`}>{g.related.name}</Link>{g.person.birth?.date?.year ? `, born ${g.person.birth.date.year}` : ""}.{" "}
                    <Link href={`/compare?a=${g.person.id}&b=${g.related.id}`}>Compare</Link>
                  </>
                ) : g.detail}
              </td>
              <td className="data">
                {g.person.ancestryUrl && (
                  <a href={g.person.ancestryUrl} target="_blank" rel="noreferrer">open</a>
                )}
              </td>
              {DATABASE && <td className="data">
                <form action={addGapTask}>
                  <input type="hidden" name="personId" value={g.person.id} /><input type="hidden" name="kind" value={g.kind} />{g.related && <input type="hidden" name="relatedId" value={g.related.id} />}<input type="hidden" name="back" value={back} />
                  <button type="submit" className="whitespace-nowrap border border-ink px-3 py-1 text-base">Add to my list</button>
                </form>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
