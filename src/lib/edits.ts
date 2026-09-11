/** Family decisions about the tree, kept in Supabase tree_edits and applied to the in-memory tree. */
import { createClient } from "@supabase/supabase-js";
import { DATABASE } from "./features";

export type Edit = {
  id: string;
  kind: "merge" | "not-duplicate";
  keep_id: string;
  drop_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  applied_at: string | null;
  undone_at: string | null;
  undone_by: string | null;
};

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

let cache: { at: number; edits: Edit[] } | null = null;
const TTL = 15_000;

/** All edits, newest first, cached briefly per server process. */
export async function fetchEdits(force = false): Promise<Edit[]> {
  if (!DATABASE) return [];
  if (!force && cache && Date.now() - cache.at < TTL) return cache.edits;
  try {
    const { data, error } = await admin().from("tree_edits").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    cache = { at: Date.now(), edits: data as Edit[] };
  } catch (err) {
    console.error("tree_edits read failed (table missing?)", err);
    cache = { at: Date.now(), edits: [] };
  }
  return cache.edits;
}

export const activeEdits = (edits: Edit[]) => edits.filter((e) => !e.undone_at);

export async function addEdit(kind: Edit["kind"], keepId: string, dropId: string, note: string, by: string | null) {
  const { error } = await admin().from("tree_edits").insert({ kind, keep_id: keepId, drop_id: dropId, note, created_by: by });
  if (error) throw error;
  cache = null;
}

export async function undoEdit(id: string, by: string | null) {
  const { error } = await admin().from("tree_edits").update({ undone_at: new Date().toISOString(), undone_by: by }).eq("id", id);
  if (error) throw error;
  cache = null;
}

export async function markEditApplied(id: string, applied: boolean) {
  const { error } = await admin().from("tree_edits").update({ applied_at: applied ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw error;
  cache = null;
}
