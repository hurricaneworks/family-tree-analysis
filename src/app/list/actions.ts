"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase";
import { addTask, setTaskDone, setTaskRank, listTasks, gapRef, gapTitle, importance, KIND_BASE } from "@/lib/tasks";
import { getTree, syncEdits } from "@/lib/data";
import { getGaps, type GapKind } from "@/lib/gaps";
import { getReadings } from "@/lib/readings";
import { getMedia } from "@/lib/media";
import { markEditApplied } from "@/lib/edits";
import { markApplied } from "@/lib/notes";
import { updateRoot } from "@/lib/messages";

const back = (formData: FormData, fallback = "/list") => { const b = String(formData.get("back") ?? fallback); return b.startsWith("/") ? b : fallback; };

/** "Add to my list" on a gap row. */
export async function addGapTask(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await syncEdits();
  const tree = getTree();
  const personId = String(formData.get("personId") ?? "");
  const kind = String(formData.get("kind") ?? "") as GapKind;
  const relatedId = String(formData.get("relatedId") ?? "") || undefined;
  const gap = getGaps(tree).find((g) => g.person.id === personId && g.kind === kind && (!relatedId || g.related?.id === relatedId));
  if (!gap) return;
  await addTask({
    title: gapTitle(gap.kind, gap.person.name, gap.gen, gap.person.sex, gap.detail),
    detail: gap.related ? `Compare the two on the site first: /compare?a=${gap.person.id}&b=${gap.related.id}` : gap.kind === "inconsistent" ? "" : gap.detail,
    kind: "gap", person_id: gap.person.id, media_id: null, source_ref: gapRef(gap.kind, gap.person.id, gap.related?.id),
    ancestry_url: gap.person.ancestryUrl, created_by: user.email ?? null, rank: importance(gap.person.id, KIND_BASE[gap.kind] ?? 2000),
  });
  redirect(back(formData));
}

/** "Add to my list" on a paper finding. */
export async function addPaperTask(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await syncEdits();
  const mediaId = String(formData.get("mediaId") ?? "");
  const idx = Number(formData.get("index"));
  const r = getReadings()[mediaId];
  const check = r?.checks[idx];
  if (!check) return;
  const media = getMedia().byId.get(mediaId);
  const tree = getTree();
  const person = tree.people.find((p) => p.name === check.person) ?? (media?.people[0] ? tree.byId.get(media.people[0]) : undefined);
  await addTask({
    title: check.status === "differs" ? `Check ${check.person}: ${check.fact} is ${check.document} on the paper, ${check.tree} in the tree` : `Add to ${check.person} from the paper: ${check.fact}, ${check.document}`,
    detail: `${r.documentType}. ${check.note}`.trim(),
    kind: "paper", person_id: person?.id ?? null, media_id: mediaId, source_ref: `paper:${mediaId}:${idx}`,
    ancestry_url: person?.ancestryUrl ?? null, created_by: user.email ?? null,
  });
  redirect(back(formData, "/papers"));
}

/** The reader's own task. */
export async function addOwnTask(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await syncEdits();
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  if (!title) return;
  const detail = String(formData.get("detail") ?? "").trim().slice(0, 2000);
  const personId = String(formData.get("personId") ?? "") || null;
  const person = personId ? getTree().byId.get(personId) : null;
  await addTask({ title, detail, kind: "own", person_id: person?.id ?? null, media_id: null, source_ref: null, ancestry_url: person?.ancestryUrl ?? null, created_by: user.email ?? null, rank: importance(person?.id ?? null, 0) });
  redirect("/list");
}

export async function finishTask(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "1";
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await setTaskDone(id, done, user.email ?? null);
  // keep the older per-feature ticks in step
  const ref = String(formData.get("sourceRef") ?? "");
  if (ref.startsWith("merge:")) await markEditApplied(ref.slice(6), done).catch(() => {});
  if (ref.startsWith("note:")) await markApplied(ref.slice(5), done).catch(() => {});
  if (ref.startsWith("correction:")) await updateRoot(ref.slice(11), { correction_done_at: done ? new Date().toISOString() : null }).catch(() => {});
  redirect(back(formData));
}

/** Move a task one place up or down, or to the top. */
export async function moveTask(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const tasks = await listTasks(false);
  const i = tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  if (dir === "top") await setTaskRank(id, (tasks[0]?.rank ?? 0) - 1);
  else if (dir === "up" && i > 0) await setTaskRank(id, tasks[i - 1].rank - 0.5 + (i > 1 ? 0 : 0));
  else if (dir === "down" && i < tasks.length - 1) await setTaskRank(id, tasks[i + 1].rank + 0.5);
  redirect("/list");
}
