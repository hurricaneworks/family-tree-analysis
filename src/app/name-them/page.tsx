import Link from "next/link";
import { getMedia, hasImage, type Media } from "@/lib/media";
import { getNotes } from "@/lib/notes";
import { getTree, searchPeople, syncEdits } from "@/lib/data";
import { fmtDate, lifespan } from "@/lib/format";
import { saveMediaNote } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { DATABASE, OffNotice } from "@/lib/features";

/** Titles that are really filenames or scanner names tell us the picture was never labelled. */
const unlabelled = (m: Media) => !m.title || /^(img|scan|dsc|image|photo|untitled)?[\s_-]*\d+([_-][0-9a-f-]+)*$|\.(jpe?g|png|tiff?)$/i.test(m.title.trim());

import { Comments } from "@/components/Comments";
export default async function NameThemPage({ searchParams }: { searchParams: Promise<{ media?: string; after?: string; q?: string }> }) {
  if (!DATABASE) return <OffNotice title="Who is this?" line={"Notes on pictures nobody has named, kept between visits. " + "Needs a Supabase project: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY in .env.local."} />;
  await syncEdits();
  const { media: wanted, after, q } = await searchParams;
  const { media } = getMedia();
  const notes = await getNotes();
  const tree = getTree();

  // the queue: pictures with nobody attached, or a filename for a title, that nobody has annotated yet
  const queue = media.filter(hasImage).filter((m) => m.type !== "document").filter((m) => m.people.length === 0 || unlabelled(m)).filter((m) => !notes.get(m.id)?.note && !(notes.get(m.id)?.people.length));
  const done = media.filter((m) => notes.get(m.id)?.note || notes.get(m.id)?.people.length).length;

  let current: Media | undefined = wanted ? media.find((m) => m.id === wanted) : undefined;
  if (!current) {
    const idx = after ? queue.findIndex((m) => m.id === after) + 1 : 0;
    current = queue[idx] ?? queue[0];
  }
  const note = current ? notes.get(current.id) : undefined;
  const attached = current ? [...current.people, ...(note?.people ?? [])].map((id) => tree.byId.get(id)).filter(Boolean) : [];
  const hits = q ? searchPeople(tree, q, 12) : [];

  return (
    <>
      <h1>Who is this?</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Pictures the export could not label: {queue.length} to look at, {done} named so far. Say who is in it, when, where, anything you remember. Notes stay here in the app and go on <Link href="/list">My list</Link> for copying across.
      </p>
      {!current ? (
        <p className="mt-8">Nothing left to name. <Link href="/photos">Back to the pictures</Link>.</p>
      ) : (
        <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <a href={`/api/photo/${current.id}`} target="_blank" rel="noreferrer" className="block border border-rule bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photo/${current.id}`} alt="" className="block max-h-[70vh] w-full object-contain" />
            </a>
            <p className="mt-2 data text-ink-soft">
              Ancestry title: {current.title || "none"}{current.date ? `, ${fmtDate(current.date)}` : ""}{current.place ? `, ${current.place}` : ""}
              {current.transcription ? <span className="block whitespace-pre-line">{current.transcription}</span> : null}
            </p>
          </div>
          <div>
            <form action={saveMediaNote} className="flex flex-col gap-4">
              <input type="hidden" name="mediaId" value={current.id} />
              <label className="flex flex-col gap-1 text-lg">
                Your note
                <textarea name="note" defaultValue={note?.note ?? ""} rows={5} className="border border-ink bg-white px-3 py-2 text-lg" placeholder="Who, when, where, the story" />
              </label>
              <div className="flex gap-3">
                <SubmitButton name="next" value="stay" pendingText="Saving…">Save</SubmitButton>
                <SubmitButton name="next" value="next" className="border border-ink px-5 py-2 text-lg disabled:opacity-60" pendingText="Saving…">Save and next</SubmitButton>
              </div>
            </form>

            <h3 className="mt-8">People in the picture</h3>
            {attached.length ? (
              <ul className="mt-2">
                {attached.map((p) => (
                  <li key={p!.id} className="flex items-baseline justify-between gap-3 py-1">
                    <span><Link href={`/person/${p!.id}`}>{p!.name}</Link> <span className="data text-ink-soft">{lifespan(p!)}</span></span>
                    {note?.people.includes(p!.id) && (
                      <form action={saveMediaNote}>
                        <input type="hidden" name="mediaId" value={current.id} />
                        <input type="hidden" name="note" value={note?.note ?? ""} />
                        <input type="hidden" name="removePerson" value={p!.id} />
                        <button type="submit" className="data text-ink-soft underline">remove</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="data text-ink-soft">Nobody attached yet.</p>
            )}
            <form action="/name-them" className="mt-3 flex gap-2">
              <input type="hidden" name="media" value={current.id} />
              <input name="q" defaultValue={q ?? ""} placeholder="Find a person to attach" className="w-full border border-ink bg-white px-3 py-1.5" />
              <button type="submit" className="border border-ink px-3 py-1.5">Find</button>
            </form>
            {hits.length > 0 && (
              <ul className="mt-2 divide-y divide-rule">
                {hits.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span>{p.name} <span className="data text-ink-soft">{lifespan(p)}{p.birth?.place ? `, ${p.birth.place}` : ""}</span></span>
                    <form action={saveMediaNote}>
                      <input type="hidden" name="mediaId" value={current.id} />
                      <input type="hidden" name="note" value={note?.note ?? ""} />
                      <input type="hidden" name="addPerson" value={p.id} />
                      <button type="submit" className="data underline">attach</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-8 data">
              <Link href={`/name-them?after=${current.id}`}>Skip this one</Link>
            </p>
          </div>
        </div>
      )}
      <Comments page="/name-them" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
