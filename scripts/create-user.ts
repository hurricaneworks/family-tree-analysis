/**
 * Create (or reset the password of) an allowlisted login. Uses the secret key, so run it locally only.
 *
 * Usage:  USER_PASSWORD='...' node --env-file=.env.local scripts/create-user.ts you@example.com
 * The address must already be in ALLOWED_EMAILS, or the app will refuse the sign-in anyway.
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const password = process.env.USER_PASSWORD;
if (!email || !password) {
  console.error("Usage: USER_PASSWORD='...' node --env-file=.env.local scripts/create-user.ts <email>");
  process.exit(1);
}
const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());
if (!allowed.includes(email.toLowerCase())) {
  console.error(`${email} is not in ALLOWED_EMAILS; add it to .env.local (and Netlify) first.`);
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) throw error;
  console.log(`Password reset for ${email}`);
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log(`Created ${email}`);
}
