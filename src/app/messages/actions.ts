"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { currentUser } from "@/lib/supabase";
import { postRoot, postReply, updateRoot, threadsForPage, recentDuplicate, recentDuplicateReply } from "@/lib/messages";
import { sendMail } from "@/lib/notify";
import { getTree } from "@/lib/data";
import { OWNER_EMAIL, SITE_URL, OWNER_NAME } from "@/lib/config";

const SITE = () => SITE_URL;
const OWNER = OWNER_EMAIL;

/** A new comment on a page: store it and tell the owner; the page then asks /api/reply for the answer. */
export async function postComment(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const page = String(formData.get("page") ?? "/");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!body || !page.startsWith("/")) return;
  const personId = String(formData.get("personId") ?? "") || null;
  const mediaId = String(formData.get("mediaId") ?? "") || null;
  const author = user.email ?? null;
  const isOwner = author?.toLowerCase() === OWNER;
  // a second click on Send while the first is saving: go to the one already saved
  const dup = await recentDuplicate(page, author, body);
  if (dup) redirect(`${page}#t-${dup}`);
  const root = await postRoot({ page, person_id: personId, media_id: mediaId, author, body, role: isOwner ? "owner" : "family" });
  if (!isOwner) {
    const who = personId ? getTree().byId.get(personId)?.name : page;
    // send the email after the redirect has gone back, not while the family waits
    after(() => sendMail([OWNER], `A comment on ${who ?? page}`, `${author} wrote on ${SITE()}${page}:\n\n${body}\n\nThread: ${SITE()}/messages#t-${root.id}`));
  }
  redirect(`${page}#t-${root.id}`);
}

/** A follow-up in an existing thread, from the family or from the owner. */
export async function postFollowUp(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const threadId = String(formData.get("threadId") ?? "");
  const page = String(formData.get("page") ?? "/");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!/^[0-9a-f-]{36}$/.test(threadId) || !body) return;
  const author = user.email ?? null;
  const isOwner = author?.toLowerCase() === OWNER;
  // a second click on Send while the first is saving: the reply is already in the thread
  if (await recentDuplicateReply(threadId, author, body)) redirect(`${page}#t-${threadId}`);
  await postReply(threadId, isOwner ? "owner" : "family", author, body, page);
  const thread = (await threadsForPage(page)).find((t) => t.root.id === threadId);
  if (!isOwner) {
    await updateRoot(threadId, { status: "open" }); // the page will fetch a fresh reply
    after(() => sendMail([OWNER], `A reply in a thread on the family tree`, `${author} wrote on ${SITE()}${page}:\n\n${body}\n\nThread: ${SITE()}/messages#t-${threadId}`));
  } else if (thread?.root.author && thread.root.author.toLowerCase() !== OWNER) {
    await updateRoot(threadId, { status: "answered" });
    after(() => sendMail([thread.root.author!], "A reply on the family tree", `${OWNER_NAME} replied to your comment:\n\n${body}\n\nRead the thread: ${SITE()}${page}#t-${threadId}`));
  }
  redirect(`${page}#t-${threadId}`);
}

export async function setThreadStatus(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["open", "answered", "needs-work", "needs-reply", "done"].includes(status)) return;
  await updateRoot(id, { status: status as "open" });
  redirect("/messages");
}

export async function setCorrectionDone(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await updateRoot(id, { correction_done_at: formData.get("done") === "1" ? new Date().toISOString() : null });
  redirect(formData.get("showDone") === "1" ? "/list?done=1" : "/list");
}
