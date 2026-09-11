import Link from "next/link";
import { getMedia, hasImage, kindOf, TYPE_LABELS } from "@/lib/media";
import { getNotes } from "@/lib/notes";
import { readingFor } from "@/lib/readings";
import { getTree, syncEdits } from "@/lib/data";
import { Comments } from "@/components/Comments";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** First line of whatever is written about a picture, for the tile. */
function excerpt(text: string | null | undefined, max = 90): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).replace(/[,;:]?\s+\S*$/, "")}…` : t;
}

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await syncEdits();
  const { type } = await searchParams;
  const { media } = getMedia();
  const notes = await getNotes();
  const tree = getTree();
  const shown = media.filter(hasImage);
  const kind = (m: (typeof shown)[number]) => kindOf(m) ?? m.type ?? "other";
  const counts = new Map<string, number>();
  for (const m of shown) counts.set(kind(m), (counts.get(kind(m)) ?? 0) + 1);
  const kinds = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const list = (type ? shown.filter((m) => kind(m) === type) : shown).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));

  return (
    <>
      <h1>Pictures and papers</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {shown.length} items from the Ancestry gallery. Click any one to see it full size with everything written about it. Some have no names: <Link href="/name-them">help name them</Link>.
      </p>
      <p className="mt-4 data flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/photos" className={type ? "" : "font-bold text-ink no-underline"}>All {shown.length}</Link>
        {kinds.map(([k, n]) => (
          <Link key={k} href={`/photos?type=${k}`} className={type === k ? "font-bold text-ink no-underline" : ""}>{TYPE_LABELS[k] ?? k} {n}</Link>
        ))}
      </p>

      <ul className="tile-grid mt-8">
        {list.map((m) => {
          const note = notes.get(m.id);
          const reading = readingFor(m);
          const words = excerpt(note?.note) ?? excerpt(m.transcription) ?? excerpt(reading?.summary);
          const who = [...new Set([...m.people, ...(note?.people ?? [])])].map((id) => tree.byId.get(id)?.name).filter(Boolean);
          const findings = reading ? reading.checks.filter((c) => c.status === "differs" || c.status === "new").length : 0;
          return (
            <li key={m.id} className="tile">
              <Link href={`/picture/${m.id}`} className="tile-link">
                <span className="tile-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photo/${m.id}`} alt="" loading="lazy" />
                </span>
                <span className="tile-title">{m.title || "Untitled"}</span>
                <span className="tile-meta">
                  {m.date ? fmtDate(m.date) : ""}
                  {who.length > 0 && <>{m.date ? " · " : ""}{who.slice(0, 2).join(", ")}{who.length > 2 ? ` and ${who.length - 2} more` : ""}</>}
                </span>
                {words && <span className="tile-words">{words}</span>}
                {findings > 0 && <span className="tile-flag">{findings} to check</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <Comments page="/photos" />
    </>
  );
}
