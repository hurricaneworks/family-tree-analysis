import Link from "next/link";
import { getTree, syncEdits } from "@/lib/data";
import { fetchEdits } from "@/lib/edits";
import { undoDecision } from "../compare/actions";
import { DATABASE, OffNotice } from "@/lib/features";

export default async function LogPage() {
  if (!DATABASE) return <OffNotice title="What we have changed" line={"Every merge and not-a-duplicate decision, with undo. " + "Needs a Supabase project: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY in .env.local."} />;
  await syncEdits();
  const tree = getTree();
  const edits = await fetchEdits(true);
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const name = (id: string) => tree.byId.get(id)?.name ?? id;

  return (
    <>
      <h1>What we have changed</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every decision made in the app about the tree, newest first. Merges change what the app shows straight away and stay on My list until done there. Nothing here touches Ancestry by itself. Undone decisions stay in the log, struck through.
      </p>
      {edits.length === 0 ? (
        <p className="mt-8">No decisions yet. They are made from a person&apos;s duplicate flag or the <Link href="/gaps#duplicate">duplicates list</Link>.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="ledger">
            <thead><tr><th>When</th><th>Decision</th><th>Note</th><th>By</th><th>Ancestry</th><th></th></tr></thead>
            <tbody>
              {edits.map((e) => (
                <tr key={e.id} className={e.undone_at ? "line-through text-ink-soft" : ""}>
                  <td className="data whitespace-nowrap">{fmt(e.created_at)}</td>
                  <td>
                    {e.kind === "merge" ? (
                      <>Merged <Link href={`/person/${e.drop_id}`}>{name(e.drop_id)}</Link> into <Link href={`/person/${e.keep_id}`}>{name(e.keep_id)}</Link></>
                    ) : (
                      <><Link href={`/person/${e.keep_id}`}>{name(e.keep_id)}</Link> and <Link href={`/person/${e.drop_id}`}>{name(e.drop_id)}</Link> are different people</>
                    )}
                    {e.undone_at && <span className="data block">undone {fmt(e.undone_at)}{e.undone_by ? ` by ${e.undone_by}` : ""}</span>}
                  </td>
                  <td className="data">{e.note}</td>
                  <td className="data">{e.created_by ?? ""}</td>
                  <td className="data">{e.kind === "merge" ? (e.applied_at ? `done ${fmt(e.applied_at)}` : e.undone_at ? "" : "to do") : "nothing to do"}</td>
                  <td className="data">
                    {!e.undone_at && (
                      <form action={undoDecision}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="back" value="/log" />
                        <button type="submit" className="underline">undo</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
