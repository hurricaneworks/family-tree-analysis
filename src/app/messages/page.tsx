import Link from "next/link";
import { allThreads } from "@/lib/messages";
import { Thread } from "@/components/Comments";
import { setThreadStatus } from "./actions";
import { syncEdits } from "@/lib/data";
import { DATABASE, OffNotice } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  if (!DATABASE) return <OffNotice title="Messages" line={"Comments at the foot of every page, with their replies. " + "Needs a Supabase project: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY in .env.local."} />;
  await syncEdits();
  const { show } = await searchParams;
  const threads = await allThreads();
  const open = threads.filter((t) => t.root.status !== "done");
  const list = show === "all" ? threads : open;
  return (
    <>
      <h1>Messages</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every comment left anywhere on the site, newest first. The tree replies at once; anything that needs the site changed is passed to whoever runs it, and the answer comes back in the thread.
      </p>
      <p className="mt-2 data">
        {show === "all" ? <Link href="/messages">Show open only</Link> : <Link href="/messages?show=all">Show all, including done</Link>} · {open.length} open
      </p>
      {list.length === 0 && <p className="mt-8">No messages yet. Comment boxes are at the foot of every page.</p>}
      <div className="mt-6 max-w-3xl">
        {list.map((t) => (
          <div key={t.root.id}>
            <Thread root={t.root} replies={t.replies} showPage />
            <form action={setThreadStatus} className="data -mt-2 mb-2">
              <input type="hidden" name="id" value={t.root.id} />
              <input type="hidden" name="status" value={t.root.status === "done" ? "open" : "done"} />
              <button type="submit" className="underline text-ink-soft">{t.root.status === "done" ? "Reopen" : "Mark done"}</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
