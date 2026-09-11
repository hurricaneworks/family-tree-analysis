/** My list: the ordered to-do list for Ancestry, fed by gaps, papers, merges, corrections, notes and the reader's own entries. */
import { createClient } from "@supabase/supabase-js";
import { getTree, pairKey } from "./data";
import { getGaps } from "./gaps";
import { fetchEdits, activeEdits } from "./edits";
import { getNotes, type MediaNote } from "./notes";
import { openCorrections } from "./messages";
import { getMedia } from "./media";
import { ancestorLabel } from "./format";
import { DATABASE } from "./features";

export type TaskKind = "gap" | "paper" | "merge" | "correction" | "note" | "own" | "message";
export type Task = {
  id: string; title: string; detail: string; kind: TaskKind; person_id: string | null; media_id: string | null;
  source_ref: string | null; ancestry_url: string | null; rank: number; created_by: string | null; created_at: string; done_at: string | null; done_by: string | null;
  verified_at: string | null; verified_export: string | null; reopened_note: string | null;
};

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
/** The provider's own page for a picture, when the export named the tree it came from. */
const mediaUrl = (id: string, sourceId: string | null) => { const treeId = getTree().meta.treeId; return treeId ? `https://www.ancestry.co.uk/mediaui-viewer/collection/1030/tree/${treeId}/media/${sourceId ?? id}` : null; };

/** Base weight by kind of task: what to do first when two people are equally close. */
export const KIND_BASE: Record<string, number> = { inconsistent: 0, correction: 0, own: 0, message: 0, merge: 500, "line-stops": 1000, duplicate: 1500, paper: 2000, "no-birth": 2000, "no-death": 3000, note: 3500, "no-sources": 4000 };

/** Importance: direct ancestors first, nearest generation first, then by how the tree connects. Lower is more important. */
export function importance(personId: string | null, base = 0): number {
  if (!personId) return 90000 + base;
  const tree = getTree();
  const gen = tree.ancestorGen.get(personId);
  const steps = tree.steps.get(personId);
  const closeness = gen !== undefined ? gen * 100 : steps !== undefined ? 10000 + steps * 100 : 80000;
  return closeness + base;
}

export async function listTasks(includeDone = false): Promise<Task[]> {
  if (!DATABASE) return [];
  let q = admin().from("tasks").select("*").order("rank", { ascending: true }).order("created_at", { ascending: true });
  if (!includeDone) q = q.is("done_at", null);
  const { data, error } = await q;
  if (error) { console.error("tasks read failed", error); return []; }
  return data as Task[];
}

export async function addTask(t: Omit<Task, "id" | "created_at" | "done_at" | "done_by" | "rank" | "verified_at" | "verified_export" | "reopened_note"> & { rank?: number }): Promise<string | null> {
  if (!DATABASE) return null;
  const row = { ...t, rank: t.rank ?? importance(t.person_id, KIND_BASE[t.kind] ?? 5000) };
  const { data, error } = t.source_ref
    ? await admin().from("tasks").upsert(row, { onConflict: "source_ref", ignoreDuplicates: true }).select("id")
    : await admin().from("tasks").insert(row).select("id");
  if (error) { console.error("task add failed", error); return null; }
  return data?.[0]?.id ?? null;
}

export async function setTaskDone(id: string, done: boolean, by: string | null) {
  const { error } = await admin().from("tasks").update({ done_at: done ? new Date().toISOString() : null, done_by: done ? by : null, verified_at: null, verified_export: null, reopened_note: null }).eq("id", id);
  if (error) throw error;
}

export async function setTaskRank(id: string, rank: number) {
  const { error } = await admin().from("tasks").update({ rank }).eq("id", id);
  if (error) throw error;
}

/**
 * Make sure every open merge, correction and picture note has a task, and that tasks whose source
 * was undone or ticked elsewhere are marked done. Idempotent; run when the list page loads.
 */
export async function syncDerivedTasks() {
  if (!DATABASE) return;
  const tree = getTree();
  const name = (id: string) => tree.byId.get(id)?.name ?? id;
  const url = (id: string) => tree.byId.get(id)?.ancestryUrl ?? null;
  const rows: Parameters<typeof addTask>[0][] = [];

  for (const e of activeEdits(await fetchEdits())) {
    if (e.kind !== "merge") continue;
    rows.push({ title: `Merge ${name(e.drop_id)} into ${name(e.keep_id)} on Ancestry`, detail: `Open the record to keep, Tools, Merge with duplicate, pick the other.${e.note ? ` ${e.note}` : ""}`, kind: "merge", person_id: tree.aliases.get(e.keep_id) ?? e.keep_id, media_id: null, source_ref: `merge:${e.id}`, ancestry_url: url(e.keep_id), created_by: e.created_by });
  }
  for (const c of await openCorrections()) {
    rows.push({ title: c.correction!, detail: `From a comment on ${c.page}.`, kind: "correction", person_id: c.person_id, media_id: c.media_id, source_ref: `correction:${c.id}`, ancestry_url: c.person_id ? url(c.person_id) : null, created_by: c.author });
  }
  const { byId } = getMedia();
  for (const n of (await getNotes()).values() as Iterable<MediaNote>) {
    if (n.applied_at || (!n.note && !n.people.length)) continue;
    const m = byId.get(n.media_id);
    const people = n.people.map(name).join(", ");
    rows.push({ title: `Add to the picture "${m?.title || "untitled"}" on Ancestry${people ? `: ${people}` : ""}`, detail: n.note, kind: "note", person_id: n.people[0] ?? null, media_id: n.media_id, source_ref: `note:${n.media_id}`, ancestry_url: m ? mediaUrl(m.id, m.sourceId) : null, created_by: n.updated_by });
  }
  for (const r of rows) await addTask(r);
}

/** A stable reference for a gap so it cannot be added twice. */
export const gapRef = (kind: string, personId: string, relatedId?: string) => `gap:${kind}:${relatedId ? pairKey(personId, relatedId) : personId}`;

export function gapTitle(kind: string, personName: string, gen: number | null, sex: "M" | "F" | "U", detail: string): string {
  const who = gen !== null && gen > 0 ? `${personName}, ${ancestorLabel(gen, sex)}` : personName;
  switch (kind) {
    case "line-stops": return `Find the parents of ${who}`;
    case "no-birth": return `Find a birth or baptism for ${who}`;
    case "no-death": return `Find the death of ${who}`;
    case "no-sources": return `Attach a source to ${who}`;
    case "inconsistent": return `Check the dates of ${who}: ${detail}`;
    case "duplicate": return `Decide whether ${who} is a duplicate`;
    default: return `${who}: ${detail}`;
  }
}

export { getGaps };
