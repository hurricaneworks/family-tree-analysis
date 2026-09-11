import Link from "next/link";
import { findings, getReadings } from "@/lib/readings";
import { getTree, syncEdits } from "@/lib/data";
import { ReadingNotes } from "@/components/ReadingNotes";
import { AI_KEY, OffNotice } from "@/lib/features";

import { Comments } from "@/components/Comments";
export default async function PapersPage() {
  await syncEdits();
  const all = Object.keys(getReadings()).length;
  if (all === 0) return <OffNotice title="What the papers say" line={`Every certificate, register page and headstone in the gallery read by the model and compared with the tree, fact by fact. Nothing has been read yet: ${AI_KEY ? "run scripts/read-documents.ts with the images in data/images" : "it needs ANTHROPIC_API_KEY, the images in data/images, and one run of scripts/read-documents.ts"}. About a minute and a few pence per document.`} />;
  const list = findings();
  const tree = getTree();
  const differs = list.reduce((a, x) => a + x.differs.length, 0);
  const fresh = list.reduce((a, x) => a + x.fresh.length, 0);
  return (
    <>
      <h1>What the papers say</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {all} certificates, registers and headstones read and compared with the tree: {differs} facts that differ, {fresh} facts the papers have and the tree does not. Readings are machine-made; check the image before changing anything on Ancestry.
      </p>
      {list.map(({ media, reading, differs, fresh }) => {
        const people = media.people.map((id) => tree.byId.get(id)).filter(Boolean);
        return (
          <section key={media.id} className="mt-12 grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
            <a href={`/api/photo/${media.id}`} target="_blank" rel="noreferrer" className="block border border-rule bg-white self-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photo/${media.id}`} alt="" loading="lazy" className="block w-full object-contain" style={{ maxHeight: "16rem" }} />
            </a>
            <div>
              <h2>{media.title}</h2>
              {people.length > 0 && (
                <p className="data">{people.map((p, i) => <span key={p!.id}>{i > 0 && ", "}<Link href={`/person/${p!.id}`}>{p!.name}</Link></span>)}</p>
              )}
              <p className="data text-ink-soft">{differs.length} differ, {fresh.length} new</p>
              <div className="mt-3"><ReadingNotes r={reading} compact addable /></div>
            </div>
          </section>
        );
      })}
      <Comments page="/papers" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
