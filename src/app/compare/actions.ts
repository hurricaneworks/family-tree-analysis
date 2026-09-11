"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase";
import { addEdit, undoEdit } from "@/lib/edits";

const ID = /^I\d+$/;

/** Merge one record into another (app-side), or declare the pair different people. */
export async function decidePair(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const kind = String(formData.get("kind"));
  const keep = String(formData.get("keep") ?? "");
  const drop = String(formData.get("drop") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!ID.test(keep) || !ID.test(drop) || keep === drop || (kind !== "merge" && kind !== "not-duplicate")) return;
  await addEdit(kind, keep, drop, note, user.email ?? null);
  redirect(kind === "merge" ? `/person/${keep}` : `/compare?a=${keep}&b=${drop}`);
}

export async function undoDecision(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await undoEdit(id, user.email ?? null);
  const back = String(formData.get("back") ?? "/log");
  redirect(back.startsWith("/") ? back : "/log");
}
