import { MAIL_FROM, OWNER_EMAIL } from "./config";
import { EMAIL } from "./features";
/** One-off emails from the app via Resend: a comment for the owner, a reply link for the reader. */
export async function sendMail(to: string[], subject: string, text: string) {
  if (!EMAIL) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to, reply_to: OWNER_EMAIL, subject, text }),
  });
  if (!res.ok) console.error("mail failed", res.status, await res.text().catch(() => ""));
}
