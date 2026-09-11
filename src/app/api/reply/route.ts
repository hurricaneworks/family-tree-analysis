/**
 * Produce the site's reply to a comment thread whose latest message is from the family.
 * Called by the page after the comment is saved, so the form never waits on the model.
 */
import { currentUser } from "@/lib/supabase";
import { allow } from "@/lib/spend";
import { syncEdits } from "@/lib/data";
import { threadsForPage, postReply, updateRoot } from "@/lib/messages";
import { respond } from "@/lib/respond";
import { sendMail } from "@/lib/notify";
import { SITE_URL } from "@/lib/config";
import { CHAT } from "@/lib/features";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!CHAT) return new Response("Replies are not switched on: they need ANTHROPIC_API_KEY and a database.", { status: 503 });
  const secretOk = Boolean(process.env.DIGEST_SECRET) && req.headers.get("x-cron-secret") === process.env.DIGEST_SECRET;
  const user = secretOk ? null : await currentUser();
  if (!secretOk && !user) return new Response("Sign in required", { status: 401 });
  if (!secretOk) {
    const spend = await allow(user?.email, "reply");
    if (!spend.ok) return new Response("Too many replies in an hour. Try again shortly.", { status: 429 });
  }
  await syncEdits();
  const { id, page } = (await req.json().catch(() => ({}))) as { id?: string; page?: string };
  if (!id || !/^[0-9a-f-]{36}$/.test(id) || !page?.startsWith("/")) return Response.json({ error: "bad request" }, { status: 400 });
  const thread = (await threadsForPage(page)).find((t) => t.root.id === id);
  if (!thread) return Response.json({ error: "no thread" }, { status: 404 });
  const last = thread.replies[thread.replies.length - 1] ?? thread.root;
  if (last.role !== "family" && last.role !== "owner") return Response.json({ skipped: true });

  const history = thread.replies.length
    ? [thread.root, ...thread.replies].map((m) => `${m.role === "family" || m.role === "owner" ? "Family" : m.role === "claude" ? "The site" : "The keeper's assistant"}: ${m.body}`).join("\n\n")
    : null;
  const prompt = history ? `Earlier in this thread:\n${history}\n\nReply to the latest family message.` : thread.root.body;

  // The reply is produced and saved whether or not the browser is still listening: a closed
  // connection must not lose the model's work. The stream only reports progress.
  const work = (async () => {
    try {
      const t = await respond(page, thread.root.person_id, thread.root.media_id, prompt, last.author);
      await postReply(id, "claude", "the tree", t.reply, page);
      await updateRoot(id, { kind: thread.root.kind ?? t.kind, status: t.needsWork ? "needs-work" : t.needsReply ? "needs-reply" : "answered", correction: t.correction ?? thread.root.correction });
      // tell whoever started the thread: they do not watch the site, and a reply unseen is a reply wasted
      if (thread.root.author && thread.root.role === "family") {
        const site = SITE_URL;
        await sendMail([thread.root.author], "A reply on the family tree",
          `You wrote on the family tree:\n\n"${thread.root.body.slice(0, 300)}"\n\nHere is the reply:\n\n${t.reply.replace(/\[([^\]]+)\]\(\/[^)]+\)/g, "$1")}\n\nRead it, and reply, here: ${site}${page}#t-${id}`).catch((e) => console.error("reply email failed", e));
      }
      return true;
    } catch (err) {
      console.error("reply failed", err);
      await postReply(id, "claude", "the tree", "Thank you. I could not answer straight away; it has been passed on and a reply will come here.", page).catch(() => {});
      await updateRoot(id, { status: "needs-work" }).catch(() => {});
      return false;
    }
  })();

  // a byte a second while the model works, then the result as the last line
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const push = (s: string) => { if (!open) return; try { controller.enqueue(encoder.encode(s)); } catch { open = false; } };
      const tick = setInterval(() => push(" "), 1000);
      const ok = await work;
      clearInterval(tick);
      push("\n" + JSON.stringify({ ok }));
      try { controller.close(); } catch { /* client gone */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
