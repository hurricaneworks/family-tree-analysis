/**
 * A ceiling on the endpoints that call Claude. Sign-in alone is not a spending limit: a stolen
 * session, or a browser tab retrying in a loop, would otherwise run without bound.
 */
import { createClient } from "@supabase/supabase-js";
import { DATABASE } from "./features";

export type Kind = "ask" | "reply" | "world";

/** Calls allowed per person per hour. Generous for a person, useless for a runaway. */
const CEILING: Record<Kind, number> = { ask: 60, reply: 60, world: 300 };

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

/** Count this call. Returns false when the caller is over their hourly ceiling. */
export async function allow(who: string | null | undefined, kind: Kind): Promise<{ ok: boolean; calls: number; ceiling: number }> {
  const ceiling = CEILING[kind];
  if (!DATABASE) return { ok: true, calls: 0, ceiling };
  try {
    const { data, error } = await admin().rpc("note_spend", { p_who: (who ?? "anonymous").slice(0, 200), p_kind: kind });
    if (error) throw error;
    const calls = Number(data ?? 0);
    return { ok: calls <= ceiling, calls, ceiling };
  } catch (err) {
    // a counter that is broken must not take the site down with it
    console.error("spend check failed", err);
    return { ok: true, calls: 0, ceiling };
  }
}
