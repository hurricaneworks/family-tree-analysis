"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase";
import { saveNote, getNotes } from "@/lib/notes";

export async function saveMediaNote(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const existing = (await getNotes()).get(mediaId);
  let people = existing?.people ?? [];
  const add = String(formData.get("addPerson") ?? "");
  const remove = String(formData.get("removePerson") ?? "");
  if (/^I\d+$/.test(add) && !people.includes(add)) people = [...people, add];
  if (remove) people = people.filter((p) => p !== remove);
  await saveNote(mediaId, note, people, user.email ?? null);
  const next = String(formData.get("next") ?? "");
  redirect(next === "next" ? `/name-them?after=${mediaId}` : `/name-them?media=${mediaId}`);
}
