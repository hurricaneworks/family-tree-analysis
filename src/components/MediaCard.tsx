import Link from "next/link";
import type { Media } from "@/lib/media";
import { getTree } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import type { MediaNote } from "@/lib/notes";
import { readingFor } from "@/lib/readings";
import { ReadingNotes } from "./ReadingNotes";

export function MediaCard({ m, showPeople = true, note }: { m: Media; showPeople?: boolean; note?: MediaNote }) {
  const tree = getTree();
  const people = [...new Set([...m.people, ...(note?.people ?? [])])].map((id) => tree.byId.get(id)).filter(Boolean);
  const ratio = m.width && m.height ? m.width / m.height : 1;
  return (
    <figure className="m-0">
      <Link href={`/picture/${m.id}`} className="block border border-rule bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photo/${m.id}`} alt={m.title ?? ""} loading="lazy" className="block w-full object-contain" style={{ aspectRatio: ratio, maxHeight: "22rem" }} />
      </Link>
      <figcaption className="mt-2">
        <span>{m.title}</span>
        {(m.date || m.place) && <span className="data text-ink-soft block">{[fmtDate(m.date), m.place].filter(Boolean).join(", ")}</span>}
        {showPeople && people.length > 0 && (
          <span className="data block">
            {people.map((p, i) => (
              <span key={p!.id}>{i > 0 && ", "}<Link href={`/person/${p!.id}`}>{p!.name}</Link></span>
            ))}
          </span>
        )}
        {m.transcription && <span className="data text-ink-soft mt-1 block whitespace-pre-line">{m.transcription}</span>}
        {note?.note && <span className="mt-1 block whitespace-pre-line border-l-2 border-heather pl-2">{note.note}</span>}
        {readingFor(m) && <span className="mt-2 block"><ReadingNotes r={readingFor(m)} compact /></span>}
      </figcaption>
    </figure>
  );
}
