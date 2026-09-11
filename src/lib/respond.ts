/**
 * The app's own first reply to a new comment: Claude with the lookup tools and the page's record in
 * front of it. It answers what the records can answer, sorts the comment into a kind, and says
 * whether the site itself needs changing (which the hourly routine then picks up).
 */
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, treeOverview } from "./tools";
import { getTree } from "./data";
import { ROOT_SHORT_NAME } from "./config";
import { lifespan } from "./format";
import { getPersonTool } from "./tools";


export type Triage = { reply: string; kind: "question" | "correction" | "idea" | "problem" | "other"; needsWork: boolean; needsReply: boolean; correction: string | null };

const SYSTEM = `You are the family-history assistant inside a private website built from a GEDCOM export of ${ROOT_SHORT_NAME}'s family tree. Someone in the family (often ${ROOT_SHORT_NAME}) has left a comment on a page. Reply to them there.

The tree:
${treeOverview()}

How to reply:
- Warm, plain, short. British English, no dashes. You are talking to a family historian, possibly elderly, who knows these people; you know the records.
- Look things up with the tools before stating any fact. Link people as [Full Name](/person/ID) on first mention.
- If the comment corrects a fact (a date, a place, a name, who is in a picture, a relationship), thank them, say exactly what the tree currently records, and explain that the change has been noted for Ancestry (the website cannot change Ancestry; My list holds what to change by hand). Do not claim the website's data is now changed.
- If the comment reports something wrong with the website itself (a broken page, a wrong picture shown as a face, a view that misleads), say that it has been passed to whoever runs the site, and a reply will come in this thread.
- If you cannot tell what is meant, ask one clear question.
- Never invent records. Say when the tree does not have something.

After your reply text, end your message with one line exactly like this, on its own line:
TRIAGE: {"kind":"question|correction|idea|problem|other","needsWork":true|false,"needsReply":true|false,"correction":"one-line summary of the change to make on Ancestry, or null"}
needsWork is true only when the website (code, a view, a picture assignment, a rule) must change. needsReply is true when you asked the family member a question.`;

export async function respond(page: string, personId: string | null, mediaId: string | null, body: string, author: string | null): Promise<Triage> {
  const tree = getTree();
  const person = personId ? tree.byId.get(personId) : null;
  // hand over the page's record up front so most replies need no tool call at all
  const record = person ? await getPersonTool.run({ id: person.id }) : null;
  const context = person
    ? `The comment was left on the page for ${person.name} (id ${person.id}, ${lifespan(person)}${person.birth?.place ? `, born ${person.birth.place}` : ""}).\nTheir full record:\n${record}`
    : `The comment was left on the page ${page}.${mediaId ? ` It concerns media item ${mediaId}.` : ""}`;

  // Low effort and the record supplied up front: measured at 12 to 27 s on Opus. The route streams
  // keep-alive bytes meanwhile so Netlify does not cut the connection.
  const runner = new Anthropic().beta.messages.toolRunner({
    model: "claude-opus-5",
    max_tokens: 1500,
    output_config: { effort: "low" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: TOOLS,
    messages: [{ role: "user", content: `${context}\n\nComment from ${author ?? "a family member"}:\n${body}` }],
    max_iterations: 4,
  });
  const final = await runner.runUntilDone();
  const text = final.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const m = /TRIAGE:\s*(\{[\s\S]*\})\s*$/.exec(text);
  let triage: Partial<Triage> = {};
  try { if (m) triage = JSON.parse(m[1]); } catch { /* keep defaults */ }
  const reply = m ? text.slice(0, m.index).trim() : text;
  return {
    reply: reply || "Thank you. I have noted this and it has been passed on.",
    kind: (["question", "correction", "idea", "problem", "other"] as const).includes(triage.kind as Triage["kind"]) ? (triage.kind as Triage["kind"]) : "other",
    needsWork: Boolean(triage.needsWork),
    needsReply: Boolean(triage.needsReply),
    correction: typeof triage.correction === "string" && triage.correction && triage.correction !== "null" ? triage.correction : null,
  };
}
