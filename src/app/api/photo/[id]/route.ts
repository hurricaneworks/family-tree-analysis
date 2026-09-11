/** Serves one media image to a signed-in user: from data/images when present locally, else a signed Storage URL. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { currentUser } from "@/lib/supabase";
import { getMedia } from "@/lib/media";
import { DATABASE } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Bad id", { status: 400 });
  const stored = getMedia().photos[id];
  if (!stored) return new Response("No image", { status: 404 });

  const local = join(process.cwd(), "data", "images", stored.file);
  if (existsSync(local)) {
    return new Response(readFileSync(local), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  }
  if (!DATABASE) return new Response("No image", { status: 404 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.storage.from("photos").createSignedUrl(`${id}.jpg`, 3600);
  if (error || !data) return new Response("No image", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "private, max-age=3000" } });
}
