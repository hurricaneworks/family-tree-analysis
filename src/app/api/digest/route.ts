import { syncEdits } from "@/lib/data";
/**
 * Weekly digest sender. POST only (never acts on GET), guarded by the x-cron-secret header.
 * Called by Supabase pg_cron on Monday mornings; deduped per week in the digest_runs table.
 *
 *   ?preview=1        return the HTML instead of sending (still needs the secret)
 *   ?to=a@b,c@d       send to these addresses instead of DIGEST_TO (pilot sends); skips the dedupe record
 *   ?force=1          send even if this week's run is already recorded
 */
import { createClient } from "@supabase/supabase-js";
import { renderDigest } from "@/lib/digest";
import { MAIL_FROM, OWNER_EMAIL } from "@/lib/config";
import { DATABASE, EMAIL } from "@/lib/features";

export const dynamic = "force-dynamic";

function mondayOf(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - shift);
  return d;
}

export async function POST(req: Request) {
  if (!DATABASE || !EMAIL) return new Response("The digest needs a database and RESEND_API_KEY.", { status: 503 });
  await syncEdits();
  const secret = process.env.DIGEST_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const siteUrl = process.env.SITE_URL ?? url.origin;
  const start = mondayOf(new Date());
  const digest = await renderDigest(start, siteUrl);

  if (url.searchParams.get("preview")) return new Response(digest.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const override = url.searchParams.get("to");
  const to = (override ?? process.env.DIGEST_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) return Response.json({ error: "No recipients" }, { status: 400 });

  const weekKey = start.toISOString().slice(0, 10);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

  // dedupe: one recorded run per week, claimed atomically before sending
  if (!override && !url.searchParams.get("force")) {
    const { data, error } = await admin.from("digest_runs").upsert({ week_start: weekKey, recipients: to }, { onConflict: "week_start", ignoreDuplicates: true }).select("week_start");
    if (error) return Response.json({ error: `dedupe table: ${error.message}` }, { status: 500 });
    if (!data?.length) return Response.json({ skipped: true, reason: `week ${weekKey} already sent` });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to,
      reply_to: OWNER_EMAIL,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("digest send failed", res.status, body);
    return Response.json({ error: `Resend ${res.status}`, detail: body }, { status: 502 });
  }
  if (!override) await admin.from("digest_runs").update({ sent_at: new Date().toISOString(), email_id: body.id ?? null }).eq("week_start", weekKey);
  return Response.json({ sent: true, to, subject: digest.subject, items: digest.count, id: body.id });
}
