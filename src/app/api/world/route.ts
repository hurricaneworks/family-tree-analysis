/** Build (or fetch) "Their world" for one person. The page calls this after loading so it never waits. */
import { currentUser } from "@/lib/supabase";
import { allow } from "@/lib/spend";
import { getTree, syncEdits } from "@/lib/data";
import { buildWorld, getWorld, worldPossible } from "@/lib/world";
import { CHAT } from "@/lib/features";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!CHAT) return Response.json({ error: "not switched on" }, { status: 503 });
  const user = await currentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const spend = await allow(user.email, "world");
  if (!spend.ok) return Response.json({ error: `That is ${spend.ceiling} in an hour, which is more than anyone needs. Try again shortly.` }, { status: 429 });
  await syncEdits();
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const p = id ? getTree().byId.get(id) : undefined;
  if (!p || !worldPossible(p)) return Response.json({ error: "nothing to build" }, { status: 400 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tick = setInterval(() => controller.enqueue(encoder.encode(" ")), 1000);
      try {
        const w = (await getWorld(p)) ?? (await buildWorld(p));
        controller.enqueue(encoder.encode("\n" + JSON.stringify({ ok: true, passage: w.passage.length })));
      } catch (err) {
        console.error("world failed", err);
        controller.enqueue(encoder.encode("\n" + JSON.stringify({ ok: false })));
      } finally { clearInterval(tick); controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
