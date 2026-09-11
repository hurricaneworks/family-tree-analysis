/** Comment threads on pages: the family writes, the app's Claude answers at once, the owner follows up. */
import { createClient } from "@supabase/supabase-js";
import { DATABASE } from "./features";

export type Role = "family" | "claude" | "routine" | "owner";
export type Status = "open" | "answered" | "needs-work" | "needs-reply" | "done";
export type Message = {
  id: string;
  thread_id: string | null;
  page: string;
  person_id: string | null;
  media_id: string | null;
  role: Role;
  author: string | null;
  body: string;
  kind: string | null;
  status: Status;
  correction: string | null;
  correction_done_at: string | null;
  created_at: string;
  routine_seen_at: string | null;
};

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export async function threadsForPage(page: string): Promise<{ root: Message; replies: Message[] }[]> {
  if (!DATABASE) return [];
  const { data, error } = await admin().from("messages").select("*").eq("page", page).order("created_at", { ascending: true });
  if (error) { console.error("messages read failed", error); return []; }
  return group(data as Message[]);
}

export async function allThreads(): Promise<{ root: Message; replies: Message[] }[]> {
  if (!DATABASE) return [];
  const { data, error } = await admin().from("messages").select("*").order("created_at", { ascending: true });
  if (error) { console.error("messages read failed", error); return []; }
  return group(data as Message[]).sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
}

const lastAt = (t: { root: Message; replies: Message[] }) => t.replies[t.replies.length - 1]?.created_at ?? t.root.created_at;

function group(rows: Message[]) {
  const roots = rows.filter((m) => !m.thread_id);
  return roots.map((root) => ({ root, replies: rows.filter((m) => m.thread_id === root.id) }));
}

export async function postRoot(m: { page: string; person_id?: string | null; media_id?: string | null; author: string | null; body: string; role?: Role }): Promise<Message> {
  const { data, error } = await admin().from("messages").insert({ ...m, role: m.role ?? "family" }).select("*").single();
  if (error) throw error;
  return data as Message;
}

export async function postReply(threadId: string, role: Role, author: string | null, body: string, page: string): Promise<Message> {
  const { data, error } = await admin().from("messages").insert({ thread_id: threadId, role, author, body, page }).select("*").single();
  if (error) throw error;
  return data as Message;
}

export async function updateRoot(id: string, patch: Partial<Pick<Message, "kind" | "status" | "correction" | "correction_done_at" | "routine_seen_at">>) {
  const { error } = await admin().from("messages").update(patch).eq("id", id);
  if (error) throw error;
}

export async function openCorrections(): Promise<Message[]> {
  if (!DATABASE) return [];
  const { data, error } = await admin().from("messages").select("*").is("thread_id", null).not("correction", "is", null).is("correction_done_at", null).order("created_at", { ascending: false });
  if (error) { console.error("messages read failed", error); return []; }
  return data as Message[];
}

/** The id of an identical root comment by the same author in the last two minutes, if any. */
export async function recentDuplicate(page: string, author: string | null, body: string): Promise<string | null> {
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const q = admin().from("messages").select("id").is("thread_id", null).eq("page", page).eq("body", body).gte("created_at", since).limit(1);
  const { data } = await sameAuthor(q, author);
  return data?.[0]?.id ?? null;
}

/** Whether the same author has just posted this exact reply in this thread. */
export async function recentDuplicateReply(threadId: string, author: string | null, body: string): Promise<boolean> {
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const q = admin().from("messages").select("id").eq("thread_id", threadId).eq("body", body).gte("created_at", since).limit(1);
  const { data } = await sameAuthor(q, author);
  return Boolean(data?.[0]);
}

/** Narrow to one author; a null author is stored as null, which needs `is` rather than `eq`. */
function sameAuthor<T extends { is(c: string, v: null): T; eq(c: string, v: string): T }>(q: T, author: string | null): T {
  return author === null ? q.is("author", null) : q.eq("author", author);
}
