import Link from "next/link";
import { getTree, syncEdits, searchPeople } from "@/lib/data";
import { listTasks, syncDerivedTasks, type Task } from "@/lib/tasks";
import { Face } from "@/components/Face";
import { Comments } from "@/components/Comments";
import { SubmitButton } from "@/components/SubmitButton";
import { addOwnTask, finishTask, moveTask } from "./actions";
import { lifespan } from "@/lib/format";
import { DATABASE, OffNotice } from "@/lib/features";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { gap: "a gap", paper: "from a paper", merge: "a merge", correction: "a correction", note: "a picture note", own: "your own", message: "from a message" };

export default async function ListPage({ searchParams }: { searchParams: Promise<{ done?: string; q?: string; person?: string }> }) {
  if (!DATABASE) return <OffNotice title="My list" line={`An ordered list of what to do on your genealogy site, kept between visits. Needs a Supabase project: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY in .env.local.`} />;
  await syncEdits();
  const { done, q, person: personParam } = await searchParams;
  await syncDerivedTasks();
  const tree = getTree();
  const showDone = done === "1";
  const all = await listTasks(true);
  const tasks = showDone ? all.filter((t) => t.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")) : all.filter((t) => !t.done_at);
  const hits = q ? searchPeople(tree, q, 8) : [];
  const chosen = personParam ? tree.byId.get(personParam) : undefined;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <h1>My list</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Everything to do on Ancestry, in order of importance: your direct line first, nearest generation first. Add gaps and paper findings from their pages, or write your own. Tick things off as you do them there; nothing on this site changes Ancestry by itself. When the next export is loaded, each ticked item is checked against it: confirmed if the export agrees, brought back with a note if it still shows the gap.
      </p>
      <p className="mt-2 data">
        {showDone ? <Link href="/list">Show what is still to do</Link> : <Link href="/list?done=1">Show what is done</Link>} · {all.filter((t) => !t.done_at).length} to do, {all.filter((t) => t.done_at).length} done
      </p>

      <details className="mt-6 max-w-2xl border-l-4 border-sea pl-4" open={Boolean(q || chosen)}>
        <summary className="cursor-pointer text-lg">Add something of your own</summary>
        <form action="/list" className="mt-3 flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="About whom? Find a person (optional)" className="w-full border border-ink bg-white px-3 py-1.5" />
          <button type="submit" className="border border-ink px-3 py-1.5">Find</button>
        </form>
        {hits.length > 0 && (
          <ul className="mt-2 divide-y divide-rule data">
            {hits.map((p) => <li key={p.id} className="py-1"><Link href={`/list?person=${p.id}`}>{p.name}</Link> <span className="text-ink-soft">{lifespan(p)}{p.birth?.place ? `, ${p.birth.place}` : ""}</span></li>)}
          </ul>
        )}
        <form action={addOwnTask} className="mt-3 flex flex-col gap-3">
          {chosen && <p className="data">About <Link href={`/person/${chosen.id}`}>{chosen.name}</Link><input type="hidden" name="personId" value={chosen.id} /></p>}
          <input name="title" required placeholder="What to do, in a few words" className="border border-ink bg-white px-3 py-2 text-lg" />
          <textarea name="detail" rows={2} placeholder="Any detail (optional)" className="border border-ink bg-white px-3 py-2" />
          <div><SubmitButton pendingText="Adding…">Add to my list</SubmitButton></div>
        </form>
      </details>

      {tasks.length === 0 ? (
        <p className="mt-10">{showDone ? "Nothing done yet." : "Nothing on the list. Add gaps from the Gaps page, findings from Papers, or write your own above."}</p>
      ) : (
        <ol className="mt-8 max-w-4xl">
          {tasks.map((t, i) => <TaskRow key={t.id} t={t} i={i} n={tasks.length} showDone={showDone} tree={tree} fmt={fmt} />)}
        </ol>
      )}
      <Comments page="/list" />
    </>
  );
}

function TaskRow({ t, i, n, showDone, tree, fmt }: { t: Task; i: number; n: number; showDone: boolean; tree: ReturnType<typeof getTree>; fmt: (s: string) => string }) {
  const person = t.person_id ? tree.byId.get(t.person_id) : undefined;
  const gen = person ? tree.ancestorGen.get(person.id) : undefined;
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-t border-rule py-4">
      <span className="data pt-1 text-ink-soft">{showDone ? "" : i + 1}</span>
      <div>
        <div className="flex items-start gap-3">
          {person && <Face personId={person.id} size={40} placeholder={false} />}
          <div>
            <p className="text-lg leading-snug">{t.title}</p>
            {t.detail && <p className="mt-1 whitespace-pre-line text-ink-soft">{t.detail.replace(/\/compare\?a=\S+/, "")}{t.detail.includes("/compare?") && <Link href={t.detail.match(/\/compare\?a=\S+/)![0]}>Compare the two</Link>}</p>}
            <p className="data mt-1 text-ink-soft">
              {KIND[t.kind]}{person && <> · <Link href={`/person/${person.id}`}>{person.name}</Link>{gen !== undefined && gen > 0 ? `, generation ${gen}` : ""}</>}
              {t.ancestry_url && <> · <a href={t.ancestry_url} target="_blank" rel="noreferrer">open on Ancestry</a></>}
              {t.media_id && <> · <Link href={`/name-them?media=${t.media_id}`}>the picture</Link></>}
              {t.done_at ? ` · done ${fmt(t.done_at)}${t.done_by ? ` by ${t.done_by.split("@")[0]}` : ""}` : ` · added ${fmt(t.created_at)}`}
              {t.verified_at && ` · confirmed by the export of ${t.verified_export}`}
              {t.done_at && !t.verified_at && t.reopened_note && ` · ${t.reopened_note}`}
            </p>
            {!t.done_at && t.reopened_note && <p className="mt-1 border-l-4 border-kelp pl-3 text-kelp data">Came back: {t.reopened_note}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-base">
          <form action={finishTask}>
            <input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.done_at ? "0" : "1"} /><input type="hidden" name="sourceRef" value={t.source_ref ?? ""} /><input type="hidden" name="back" value={showDone ? "/list?done=1" : "/list"} />
            <button type="submit" className={t.done_at ? "border border-ink px-4 py-1.5" : "border border-ink bg-ink px-4 py-1.5 text-paper"}>{t.done_at ? "Not done after all" : "Done on Ancestry"}</button>
          </form>
          {!showDone && (
            <>
              {i > 0 && <form action={moveTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="up" /><button type="submit" className="border border-ink px-4 py-1.5">Move up</button></form>}
              {i < n - 1 && <form action={moveTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="down" /><button type="submit" className="border border-ink px-4 py-1.5">Move down</button></form>}
              {i > 1 && <form action={moveTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="top" /><button type="submit" className="border border-ink px-4 py-1.5">To the top</button></form>}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
