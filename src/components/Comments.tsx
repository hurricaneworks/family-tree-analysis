import Link from "next/link";
import { threadsForPage, type Message } from "@/lib/messages";
import { postComment, postFollowUp } from "@/app/messages/actions";
import { currentUser } from "@/lib/supabase";
import { PendingReply } from "./PendingReply";
import { SubmitButton } from "./SubmitButton";
import { DATABASE } from "@/lib/features";
import { OWNER_NAME } from "@/lib/config";

const WHO: Record<string, string> = { family: "", claude: "The tree", routine: `${OWNER_NAME}'s assistant`, owner: OWNER_NAME };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Light markdown for replies: paragraphs, bullets, person links, bold. */
export function Body({ text }: { text: string }) {
  const inline = (s: string) => {
    const out: (string | React.ReactElement)[] = [];
    const re = /\[([^\]]+)\]\((\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
    let last = 0, m: RegExpExecArray | null, k = 0;
    while ((m = re.exec(s))) { out.push(s.slice(last, m.index)); out.push(m[1] ? <Link key={k++} href={m[2]}>{m[1]}</Link> : <strong key={k++}>{m[3]}</strong>); last = m.index + m[0].length; }
    out.push(s.slice(last));
    return out;
  };
  return (
    <>
      {text.trim().split(/\n{2,}/).map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*] /.test(l))) return <ul key={i} className="mt-2 list-disc pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ""))}</li>)}</ul>;
        return <p key={i} className="mt-2 whitespace-pre-line">{inline(lines.join("\n"))}</p>;
      })}
    </>
  );
}

export function Thread({ root, replies, showPage = false }: { root: Message; replies: Message[]; showPage?: boolean }) {
  const label = (m: Message) => (m.role === "family" || m.role === "owner" ? (m.author ?? "family") : WHO[m.role]);
  return (
    <article id={`t-${root.id}`} className="scroll-mt-6 border-t border-rule py-5">
      {showPage && <p className="data"><Link href={root.page}>{root.page}</Link></p>}
      <p className="data text-ink-soft">{label(root)}, {fmt(root.created_at)}{root.kind ? ` · ${root.kind}` : ""}{root.status === "needs-work" ? " · being looked at" : root.status === "done" ? " · done" : ""}</p>
      <Body text={root.body} />
      {replies.map((r) => (
        <div key={r.id} className={`mt-4 border-l-4 pl-4 ${r.role === "claude" || r.role === "routine" ? "border-sea" : "border-heather"}`}>
          <p className="data text-ink-soft">{label(r)}, {fmt(r.created_at)}</p>
          <Body text={r.body} />
        </div>
      ))}
      {(() => { const last = replies[replies.length - 1] ?? root; return (last.role === "family" || last.role === "owner") && root.status !== "done" ? <PendingReply id={root.id} page={root.page} /> : null; })()}
      <form action={postFollowUp} className="mt-4 flex gap-3">
        <input type="hidden" name="threadId" value={root.id} />
        <input type="hidden" name="page" value={root.page} />
        <input name="body" placeholder="Reply" className="w-full border border-ink bg-white px-3 py-1.5" required />
        <SubmitButton className="border border-ink px-4 py-1.5 disabled:opacity-60" pendingText="Sending…">Send</SubmitButton>
      </form>
    </article>
  );
}

/** Comment box and threads for one page. */
export async function Comments({ page, personId, mediaId, threads: given }: { page: string; personId?: string; mediaId?: string; threads?: Awaited<ReturnType<typeof threadsForPage>> }) {
  if (!DATABASE) return null;
  const user = await currentUser();
  if (!user) return null;
  const threads = given ?? (await threadsForPage(page));
  return (
    <section className="mt-14 max-w-3xl">
      <h2>Comments</h2>
      <p className="mt-1 text-ink-soft">Ask a question, correct a fact, or say what you remember. The tree answers straight away, and anything it cannot do itself is passed on.</p>
      <form action={postComment} className="mt-4">
        <input type="hidden" name="page" value={page} />
        {personId && <input type="hidden" name="personId" value={personId} />}
        {mediaId && <input type="hidden" name="mediaId" value={mediaId} />}
        <textarea name="body" rows={3} required placeholder="Write here" className="w-full border border-ink bg-white px-3 py-2 text-lg" />
        <SubmitButton className="mt-2 border border-ink bg-ink px-5 py-2 text-lg text-paper disabled:opacity-60" pendingText="Saving…">Send</SubmitButton>
        <span className="data text-ink-soft ml-3">Your comment appears below once saved; the reply follows within about half a minute.</span>
      </form>
      <div className="mt-6">
        {threads.filter((t) => t.root.status !== "done").map((t) => <Thread key={t.root.id} root={t.root} replies={t.replies} />)}
        {threads.some((t) => t.root.status === "done") && (
          <details className="mt-4">
            <summary className="cursor-pointer data text-ink-soft">Earlier comments, marked done ({threads.filter((t) => t.root.status === "done").length})</summary>
            {threads.filter((t) => t.root.status === "done").map((t) => <Thread key={t.root.id} root={t.root} replies={t.replies} />)}
          </details>
        )}
      </div>
    </section>
  );
}
