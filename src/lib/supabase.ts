import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { DATABASE } from "./features";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Comma-separated list in ALLOWED_EMAILS; the only people who may sign in. */
export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Cookie-backed Supabase client for server components, route handlers and server actions. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          for (const { name, value, options } of all) store.set(name, value, options);
        } catch {
          // called from a server component: cookies are refreshed by proxy.ts instead
        }
      },
    },
  });
}

/** Local-only escape hatch for screenshots and curl checks: never active in a production build. */
export const devBypass = () => process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

/**
 * The signed-in, allowlisted user, or null. Verifies the session token's signature locally against
 * the project's public keys (cached), so it costs no network round trip; falls back to the auth
 * server only if that is not possible. Deduplicated per request, so layout, page and every face
 * on the page share one check.
 */
export const currentUser = cache(async (): Promise<{ email?: string } | null> => {
  // no sign-in configured: whoever reaches the site is the reader
  if (!DATABASE) return { email: undefined };
  if (devBypass()) return { email: process.env.ALLOWED_EMAILS?.split(",")[0]?.trim() };
  const supabase = await supabaseServer();
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims) {
      const email = typeof data.claims.email === "string" ? data.claims.email : undefined;
      return isAllowed(email) ? { email } : null;
    }
  } catch { /* fall through */ }
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return user && isAllowed(user.email) ? { email: user.email } : null;
});
