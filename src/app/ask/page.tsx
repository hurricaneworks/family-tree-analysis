import { Ask } from "./Ask";
import { listAsks } from "@/lib/asks";
import { syncEdits } from "@/lib/data";
import { CHAT, AI_KEY, OffNotice } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!CHAT) return <OffNotice title="Ask the tree" line={AI_KEY ? "It is off on a production build until sign-in is set up, so that a public site cannot spend your key." : "A question in plain words, answered from the records with a link to everyone named. It needs ANTHROPIC_API_KEY in .env.local; a question costs a few pence."} />;
  await syncEdits();
  const { q } = await searchParams;
  const history = await listAsks();
  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="lg:order-first">
        <h2 className="text-xl">Asked before</h2>
        <p className="data text-ink-soft">Every question and its answer is kept. Click one to read it again.</p>
        <AskHistory history={history} />
      </aside>
      <div>
        <h1>Ask the tree</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Ask in plain words. The assistant looks people up in the records before it answers and links everyone it names, so you can check each one.
        </p>
        <Ask initialQuestion={q} />
      </div>
    </div>
  );
}

import { AskHistory } from "./AskHistory";
