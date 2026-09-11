import Link from "next/link";
import { notFound } from "next/navigation";
import { getTree, parentsOf, spouseFamilies, syncEdits, pairKey } from "@/lib/data";
import { fetchEdits, activeEdits } from "@/lib/edits";
import { decidePair, undoDecision } from "./actions";
import { fmtDate, eventLabel } from "@/lib/format";
import { Face } from "@/components/Face";
import type { Person } from "@/lib/types";
import { ROOT_SHORT_NAME } from "@/lib/config";
import { DATABASE } from "@/lib/features";

/** Two records side by side, for deciding which to keep when the tree has someone twice. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  await syncEdits();
  const tree = getTree();
  const A = a ? tree.byId.get(a) : undefined;
  const B = b ? tree.byId.get(b) : undefined;
  if (!A || !B) notFound();
  // an existing decision on this pair (either order)
  const decision = activeEdits(await fetchEdits()).find((e) => pairKey(e.keep_id, e.drop_id) === pairKey(a!, b!));
  const alreadyMerged = A.id === B.id;

  const rows: { label: string; of: (p: Person) => React.ReactNode }[] = [
    { label: "Name", of: (p) => [p.name, ...p.altNames].join("; ") },
    { label: "Sex", of: (p) => (p.sex === "F" ? "female" : p.sex === "M" ? "male" : "unknown") },
    { label: "Born", of: (p) => [fmtDate(p.birth?.date), p.birth?.place].filter(Boolean).join(", ") || "not recorded" },
    { label: "Died", of: (p) => [fmtDate(p.death?.date), p.death?.place].filter(Boolean).join(", ") || (p.death ? "marked deceased, no details" : "not recorded") },
    { label: "Parents", of: (p) => { const ps = parentsOf(tree, p.id); return ps.length ? ps.map((x, i) => <span key={x.id}>{i > 0 && "; "}<Link href={`/person/${x.id}`}>{x.name}</Link></span>) : "none recorded"; } },
    { label: "Spouses", of: (p) => { const ms = spouseFamilies(tree, p); return ms.length ? ms.map((m, i) => <span key={m.family.key}>{i > 0 && "; "}{m.spouse ? <Link href={`/person/${m.spouse.id}`}>{m.spouse.name}</Link> : "unnamed"}{m.family.events[0]?.date ? ` (m. ${fmtDate(m.family.events[0].date)})` : ""}</span>) : "none recorded"; } },
    { label: "Children", of: (p) => { const cs = spouseFamilies(tree, p).flatMap((m) => m.children); return cs.length ? cs.map((c, i) => <span key={c.id}>{i > 0 && "; "}<Link href={`/person/${c.id}`}>{c.name}</Link></span>) : "none recorded"; } },
    { label: "Facts recorded", of: (p) => p.events.map((e) => `${eventLabel(e.type)} ${fmtDate(e.date)}`.trim()).join("; ") },
    { label: "Citations", of: (p) => String(p.citationCount) },
    { label: "Pictures", of: (p) => String(p.mediaCount) },
    { label: "Relationship", of: (p) => { const g = tree.ancestorGen.get(p.id); const st = tree.steps.get(p.id); return g !== undefined ? `direct ancestor, ${g} generations up` : st !== undefined ? `${st} family links from ${ROOT_SHORT_NAME}` : `not connected to ${ROOT_SHORT_NAME}`; } },
  ];
  const score = (p: Person) => p.citationCount * 2 + p.events.length + p.mediaCount + (p.famc.length ? 3 : 0) + spouseFamilies(tree, p).flatMap((m) => m.children).length;
  const keep = score(A) >= score(B) ? A : B;
  const drop = keep === A ? B : A;

  return (
    <>
      <h1>Same person twice?</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Two records that look like one person. Decide here and the app shows one person at once; the decision goes in the <Link href="/log">log</Link> and, for merges, on <Link href="/list">My list</Link> until it is also done there (open the one to keep, Tools, Merge with duplicate). Every decision can be undone.
      </p>
      {!DATABASE ? (
        <p className="mt-6 max-w-2xl border-l-4 border-sea pl-4">Deciding here needs a database, so for now the two records simply sit side by side. Set the Supabase keys in .env.local to keep merge decisions.</p>
      ) : decision ? (
        <div className="mt-6 max-w-2xl border-l-4 border-heather pl-4">
          <p>
            {decision.kind === "merge" ? <>Merged in the app on {new Date(decision.created_at).toLocaleDateString("en-GB")}{decision.created_by ? ` by ${decision.created_by}` : ""}. {decision.applied_at ? "Done on Ancestry too." : "Still to do on Ancestry."}</> : <>Marked as two different people on {new Date(decision.created_at).toLocaleDateString("en-GB")}{decision.created_by ? ` by ${decision.created_by}` : ""}.</>}
            {decision.note && <span className="block text-ink-soft">{decision.note}</span>}
          </p>
          <form action={undoDecision} className="mt-2">
            <input type="hidden" name="id" value={decision.id} />
            <input type="hidden" name="back" value={`/compare?a=${a}&b=${b}`} />
            <button type="submit" className="data underline">Undo this decision</button>
          </form>
        </div>
      ) : alreadyMerged ? (
        <p className="mt-6 max-w-2xl">These two ids now point at the same merged record.</p>
      ) : (
        <form action={decidePair} className="mt-6 max-w-2xl border-l-4 border-sea pl-4">
          <p className="text-lg">Are these the same person?</p>
          <label className="mt-2 block data">
            Note (optional)
            <input name="note" className="mt-1 w-full border border-ink bg-white px-2 py-1" placeholder="e.g. same person, second copy came from cousin's tree" />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="submit" name="kind" value="merge" formAction={decidePair} className="border border-ink bg-ink px-4 py-1.5 text-paper" onClick={undefined}>
              Yes, keep <strong>{keep.name}</strong> and fold the other in
            </button>
            <input type="hidden" name="keep" value={keep.id} />
            <input type="hidden" name="drop" value={drop.id} />
          </div>
        </form>
      )}
      {DATABASE && !decision && !alreadyMerged && (
        <div className="mt-3 flex max-w-2xl flex-wrap gap-3 pl-4">
          <form action={decidePair}>
            <input type="hidden" name="kind" value="merge" />
            <input type="hidden" name="keep" value={drop.id} />
            <input type="hidden" name="drop" value={keep.id} />
            <button type="submit" className="border border-ink px-4 py-1.5">Yes, but keep <strong>{drop.name}</strong> instead</button>
          </form>
          <form action={decidePair}>
            <input type="hidden" name="kind" value="not-duplicate" />
            <input type="hidden" name="keep" value={A.id} />
            <input type="hidden" name="drop" value={B.id} />
            <button type="submit" className="border border-ink px-4 py-1.5">No, two different people</button>
          </form>
        </div>
      )}
      <p className="mt-4 max-w-2xl">
        Suggestion: keep <Link href={`/person/${keep.id}`}>{keep.name}</Link> (more facts, sources and family links) and merge <Link href={`/person/${drop.id}`}>{drop.name}</Link> into it. Check the parents and spouses rows first: if they differ, those may be duplicates too.
      </p>
      <div className="mt-8 overflow-x-auto">
        <table className="ledger">
          <thead>
            <tr>
              <th></th>
              {[A, B].map((p) => (
                <th key={p.id}>
                  <span className="inline-flex items-center gap-3 text-lg text-ink">
                    <Face personId={p.id} size={40} placeholder={false} />
                    <Link href={`/person/${p.id}`}>{p.name}</Link>
                  </span>
                  {p.ancestryUrl && <span className="block"><a href={p.ancestryUrl} target="_blank" rel="noreferrer">open on Ancestry</a></span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="data text-ink-soft whitespace-nowrap">{r.label}</td>
                <td>{r.of(A)}</td>
                <td>{r.of(B)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
