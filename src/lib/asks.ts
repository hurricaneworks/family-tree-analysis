/** Saved questions and answers from the Ask page. */
import { createClient } from "@supabase/supabase-js";
import { DATABASE } from "./features";

export type Ask = { id: string; author: string | null; question: string; answer: string; people: string[]; created_at: string };

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export async function listAsks(limit = 200): Promise<Ask[]> {
  if (!DATABASE) return [];
  const { data, error } = await admin().from("asks").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) { console.error("asks read failed", error); return []; }
  return data as Ask[];
}

export async function saveAsk(author: string | null, question: string, answer: string): Promise<string | null> {
  if (!DATABASE) return null;
  const people = [...new Set([...answer.matchAll(/\/person\/(I\d+)/g)].map((m) => m[1]))];
  const { data, error } = await admin().from("asks").insert({ author, question, answer, people }).select("id").single();
  if (error) { console.error("asks write failed", error); return null; }
  return data.id;
}
