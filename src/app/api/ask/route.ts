import { syncEdits } from "@/lib/data";
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, treeOverview } from "@/lib/tools";
import { ROOT_SHORT_NAME } from "@/lib/config";
import { currentUser } from "@/lib/supabase";
import { allow } from "@/lib/spend";
import { saveAsk } from "@/lib/asks";
import { CHAT } from "@/lib/features";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYSTEM = `You are the research assistant for one family's history, built from a GEDCOM export of ${ROOT_SHORT_NAME}'s family tree. You are talking to ${ROOT_SHORT_NAME} or their close family. They know the family; you know the records.

The tree:
${treeOverview()}

How to work:
- Always look things up with the tools before answering. Never guess a date, place or relationship. If the tree does not record something, say so plainly.
- Start with search_people to find ids, then get_person for detail. Use get_ancestors and get_descendants for lines, find_events for places and periods, list_gaps for what to research next.
- Every person you mention gets a link on first mention, written exactly as [Full Name](/person/ID). Do not link the same person twice in one answer.
- Give relationships to ${ROOT_SHORT_NAME} in words (their great-great-grandmother) rather than ids or generation numbers.
- Say where a fact comes from when it matters (a census, a parish register, an arrival list) and flag facts with no source.
- British English. No em dashes or en dashes; use commas or full stops. Plain words, short paragraphs, no headings unless the answer is long. Dates as 17 Oct 1944.
- Lines running back before about 1500 are usually copied from other trees and are of doubtful reliability; say so if asked about them.`;

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!CHAT) return new Response("Ask the tree is not switched on: it needs ANTHROPIC_API_KEY, and sign-in on a production build.", { status: 503 });
  await syncEdits();
  const user = await currentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const spend = await allow(user.email, "ask");
  if (!spend.ok) return new Response(`That is ${spend.ceiling} questions in an hour, which is more than anyone needs. Try again shortly.`, { status: 429 });
  const { messages } = (await req.json()) as { messages: Turn[] };
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) {
    return new Response("Bad request", { status: 400 });
  }
  const history: Anthropic.Beta.BetaMessageParam[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const runner = new Anthropic().beta.messages.toolRunner({
          model: "claude-opus-5",
          max_tokens: 8000,
          output_config: { effort: "medium" },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          tools: TOOLS,
          messages: history,
          max_iterations: 12,
          stream: true,
        });
        let sentText = false;
        let answer = "";
        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
              send({ t: "tool", name: event.content_block.name });
            } else if (event.type === "content_block_start" && event.content_block.type === "text") {
              // separate text blocks (before and after a tool call) into paragraphs
              if (sentText) send({ t: "text", d: "\n\n" });
              sentText = true;
            } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ t: "text", d: event.delta.text });
              answer += event.delta.text;
            }
          }
          const msg = await messageStream.finalMessage();
          if (msg.stop_reason === "refusal") send({ t: "error", d: "The model declined to answer that." });
          if (msg.stop_reason === "max_tokens") send({ t: "error", d: "The answer ran too long and was cut off." });
        }
        const question = [...history].reverse().find((m) => m.role === "user")?.content;
        const savedId = question && answer.trim() ? await saveAsk(user.email ?? null, String(question), answer.trim()) : null;
        send({ t: "done", id: savedId });
      } catch (err) {
        const msg = err instanceof Anthropic.APIError ? `API error ${err.status}: ${err.message}` : "Something went wrong.";
        console.error("ask route", err);
        send({ t: "error", d: msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
