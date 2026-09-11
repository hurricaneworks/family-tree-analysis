/** Family notes on pictures ("Who is this?"), stored in Supabase media_notes and merged into captions. */
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { DATABASE } from "./features";

export type MediaNote = { media_id: string; note: string; people: string[]; updated_by: string | null; updated_at: string; applied_at: string | null };

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export const getNotes = cache(async (): Promise<Map<string, MediaNote>> => {
  if (!DATABASE) return new Map();
  try {
    const { data, error } = await admin().from("media_notes").select("*");
    if (error) throw error;
    return new Map((data as MediaNote[]).map((n) => [n.media_id, n]));
  } catch (err) {
    console.error("media_notes read failed (table missing?)", err);
    return new Map();
  }
});

export async function saveNote(mediaId: string, note: string, people: string[], by: string | null) {
  // any edit re-opens the item on the "To add to Ancestry" list
  const { error } = await admin().from("media_notes").upsert({ media_id: mediaId, note, people, updated_by: by, updated_at: new Date().toISOString(), applied_at: null });
  if (error) throw error;
}

export async function markApplied(mediaId: string, applied: boolean) {
  const { error } = await admin().from("media_notes").update({ applied_at: applied ? new Date().toISOString() : null }).eq("media_id", mediaId);
  if (error) throw error;
}
