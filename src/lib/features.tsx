/**
 * Which optional parts of the app are switched on, read from the environment.
 *
 * A fresh clone has none of them. The tree, the gap report and every visual view work
 * regardless; each feature below hides its own entry point when its key is missing, and
 * the home page says in one line what switching it on would do.
 */
const set = (k: string) => Boolean(process.env[k]);

/** A Supabase project: sign-in, comments, My list, merge decisions, picture notes, saved questions. */
export const DATABASE = set("NEXT_PUBLIC_SUPABASE_URL") && set("NEXT_PUBLIC_SUPABASE_ANON_KEY") && set("SUPABASE_SECRET_KEY");

/** An Anthropic key: Ask the tree, Their world, replies to comments, and the document-reading script. */
export const AI_KEY = set("ANTHROPIC_API_KEY");

/**
 * Whether pages may call the model. Under `next dev` the key alone is enough. A production build
 * also needs sign-in, or a site on the open internet would let anyone spend the key.
 */
export const CHAT = AI_KEY && (DATABASE || process.env.NODE_ENV === "development");

/** Outgoing email: comment replies and the weekly digest. */
export const EMAIL = set("RESEND_API_KEY");

/** Navigation entries whose feature is off. The layout hides them. */
export function hiddenPages(hasReadings: boolean): string[] {
  const out: string[] = [];
  if (!DATABASE) out.push("/list", "/messages", "/log");
  if (!CHAT) out.push("/ask");
  if (!hasReadings && !AI_KEY) out.push("/papers");
  return out;
}

/** One line for each feature that is off: what it is, and what would switch it on. */
export function switchedOff(hasReadings: boolean): { title: string; line: string }[] {
  const out: { title: string; line: string }[] = [];
  if (!DATABASE) out.push({ title: "Sign-in, comments, My list and merge decisions", line: "Need a Supabase project: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY. Without them the site has no sign-in and nothing written on it is kept." });
  if (!AI_KEY) out.push({ title: "Ask the tree, Their world and replies to comments", line: "Need ANTHROPIC_API_KEY. A question costs a few pence; a person's background note about a penny." });
  else if (!CHAT) out.push({ title: "Ask the tree, Their world and replies to comments", line: "Off on a production build until sign-in is set up, so that a public site cannot spend your key." });
  if (!hasReadings) out.push({ title: "What the papers say", line: "Needs each certificate read once by scripts/read-documents.ts, with ANTHROPIC_API_KEY set and the images in data/images. About a minute and a few pence per document." });
  if (!EMAIL) out.push({ title: "Email", line: "Replies to comments and the weekly digest are emailed only when RESEND_API_KEY is set." });
  return out;
}

/** A short page body for a feature reached by its address while it is off. */
export function OffNotice({ title, line }: { title: string; line: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="mt-3 max-w-2xl text-lg">This part of the site is not switched on. {line}</p>
      <p className="mt-3 data text-ink-soft">See .env.example for every setting.</p>
    </>
  );
}
