import { currentUser } from "@/lib/supabase";
import { portraitFor } from "@/lib/media";
import { getTree, syncEdits } from "@/lib/data";

export const dynamic = "force-dynamic";

/** ?ids=I1,I2 -> { I1: { name, media } } for the people who have a portrait */
export async function GET(req: Request) {
  await syncEdits();
  if (!(await currentUser())) return new Response("Sign in required", { status: 401 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((s) => /^I\d+$/.test(s)).slice(0, 60);
  const tree = getTree();
  const out: Record<string, { name: string; media: string }> = {};
  for (const id of ids) {
    const m = portraitFor(id);
    const p = tree.byId.get(id);
    if (m && p) out[id] = { name: p.name, media: m.id };
  }
  return Response.json(out);
}
