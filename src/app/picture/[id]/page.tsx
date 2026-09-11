import Link from "next/link";
import { notFound } from "next/navigation";
import { getTree, syncEdits } from "@/lib/data";
import { getMedia, hasImage, kindOf, TYPE_LABELS } from "@/lib/media";
import { getNotes } from "@/lib/notes";
import { readingFor } from "@/lib/readings";
import { ReadingNotes } from "@/components/ReadingNotes";
import { Comments } from "@/components/Comments";
import { Face } from "@/components/Face";
import { fmtDate, lifespan, place } from "@/lib/format";

export const dynamic = "force-dynamic";

/** One picture or paper in full: the image at its own size, everything written about it, and who is in it. */
export default async function PicturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await syncEdits();
  const tree = getTree();
  const { byId, media } = getMedia();
  const m = byId.get(id);
  if (!m || !hasImage(m)) notFound();
  const notes = await getNotes();
  const note = notes.get(m.id);
  const reading = readingFor(m);
  const people = [...new Set([...m.people, ...(note?.people ?? [])])].map((pid) => tree.byId.get(pid)).filter(Boolean);
  const kind = kindOf(m) ?? m.type ?? "other";
  const shown = media.filter(hasImage);
  const i = shown.findIndex((x) => x.id === m.id);
  const prev = i > 0 ? shown[i - 1] : null, next = i >= 0 && i < shown.length - 1 ? shown[i + 1] : null;

  return (
    <>
      <h1>{m.title || "Untitled picture"}</h1>
      <p className="mt-2 data text-ink-soft">
        {TYPE_LABELS[kind] ?? kind}
        {m.date && <> · {fmtDate(m.date)}</>}
        {m.place && <> · {place(m.place)}</>}
        {m.width && m.height && <> · {m.width} by {m.height}</>}
      </p>

      <a href={`/api/photo/${m.id}`} target="_blank" rel="noreferrer" className="mt-5 block border border-rule bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photo/${m.id}`} alt={m.title ?? ""} className="mx-auto block max-h-[75vh] w-auto max-w-full" />
      </a>
      <p className="mt-2 data text-ink-soft">Click the picture to open it on its own, and save it from there.</p>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="max-w-2xl">
          {m.transcription && (
            <section>
              <h2>Written on it</h2>
              <p className="mt-2 whitespace-pre-line">{m.transcription}</p>
            </section>
          )}
          {note?.note && (
            <section className="mt-8">
              <h2>What the family says</h2>
              <p className="mt-2 whitespace-pre-line border-l-4 border-heather pl-4">{note.note}</p>
              {note.updated_by && <p className="data text-ink-soft">{note.updated_by.split("@")[0]}, {new Date(note.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>}
            </section>
          )}
          {reading && (
            <section className="mt-8">
              <h2>What it says, read out</h2>
              <div className="mt-2"><ReadingNotes r={reading} addable /></div>
            </section>
          )}
          {!m.transcription && !note?.note && !reading && (
            <p className="text-ink-soft">Nothing is written about this one. If you know what it shows, say so below or on <Link href={`/name-them?media=${m.id}`}>Who is this?</Link></p>
          )}
        </div>

        <aside>
          <h2 className="text-xl">Who is in it</h2>
          {people.length ? (
            <ul className="mt-3 space-y-3">
              {people.map((p) => (
                <li key={p!.id} className="flex items-start gap-3">
                  <Face personId={p!.id} size={44} placeholder={false} />
                  <span>
                    <Link href={`/person/${p!.id}`}>{p!.name}</Link>
                    <span className="data block text-ink-soft">{lifespan(p!)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 data text-ink-soft">Nobody is attached to it yet. <Link href={`/name-them?media=${m.id}`}>Name them</Link>.</p>
          )}
          <p className="mt-6 data">
            <Link href="/photos">All the pictures</Link>
            {prev && <> · <Link href={`/picture/${prev.id}`}>previous</Link></>}
            {next && <> · <Link href={`/picture/${next.id}`}>next</Link></>}
          </p>
        </aside>
      </div>

      <Comments page={`/picture/${m.id}`} mediaId={m.id} />
    </>
  );
}
