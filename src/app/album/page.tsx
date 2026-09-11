import { getMedia, hasImage, isDocumentLike, type Media } from "@/lib/media";
import { getReadings } from "@/lib/readings";
import { getTree, syncEdits } from "@/lib/data";
import { MediaCard } from "@/components/MediaCard";

/** Best guess at the year a picture shows: its own date, the paper's date, else the attached people's prime. */
function yearOf(m: Media, readingYear: number | null, birthYears: number[]): { year: number; sure: boolean } | null {
  if (m.date?.year) return { year: m.date.year, sure: true };
  if (readingYear) return { year: readingYear, sure: true };
  if (birthYears.length) {
    const avg = birthYears.reduce((a, b) => a + b, 0) / birthYears.length;
    return { year: Math.round(avg + 35), sure: false };
  }
  return null;
}

import { Comments } from "@/components/Comments";
export default async function AlbumPage() {
  await syncEdits();
  const { media } = getMedia();
  const tree = getTree();
  const readings = getReadings();
  const dated = media.filter(hasImage).map((m) => {
    const r = readings[m.id];
    const ry = r?.dateOnDocument ? Number(/(1[5-9]\d\d|20\d\d)/.exec(r.dateOnDocument)?.[1]) || null : null;
    const births = m.people.map((id) => tree.byId.get(id)?.birth?.date?.year).filter((y): y is number => Boolean(y));
    const y = yearOf(m, ry, births);
    return y ? { m, ...y } : null;
  }).filter((x): x is { m: Media; year: number; sure: boolean } => Boolean(x) && x!.year >= 1700 && x!.year <= new Date().getFullYear());
  const decades = new Map<number, typeof dated>();
  for (const d of dated) { const k = Math.floor(d.year / 10) * 10; if (!decades.has(k)) decades.set(k, []); decades.get(k)!.push(d); }
  const keys = [...decades.keys()].sort((a, b) => a - b);
  const undated = media.filter(hasImage).length - dated.length;

  return (
    <>
      <h1>The album, decade by decade</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every picture placed in its decade: papers by the date on them, photographs by the age of the people in them where no date is known (marked &quot;about&quot;). {undated} pictures have nothing to date them by and are left out.
      </p>
      <nav className="data mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {keys.map((k) => <a key={k} href={`#d${k}`}>{k}s</a>)}
      </nav>
      {keys.map((k) => {
        const items = decades.get(k)!.sort((a, b) => a.year - b.year);
        const photos = items.filter((x) => !isDocumentLike(x.m));
        const papers = items.filter((x) => isDocumentLike(x.m));
        if (!photos.length) {
          // a decade with papers only: one compact, expandable line
          return (
            <details key={k} id={`d${k}`} className="mt-4 scroll-mt-6 border-t border-rule pt-3">
              <summary className="cursor-pointer"><span className="text-xl">{k}s</span> <span className="data text-ink-soft">{papers.length} paper{papers.length > 1 ? "s" : ""}, no photographs</span></summary>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {papers.map(({ m, year }) => (
                  <div key={m.id}><p className="data text-ink-soft">{year}</p><MediaCard m={m} /></div>
                ))}
              </div>
            </details>
          );
        }
        return (
          <section key={k} id={`d${k}`} className="mt-14 scroll-mt-6">
            <h2 className="sticky top-0 bg-paper py-2">{k}s <span className="data text-ink-soft">{photos.length} pictures, {papers.length} papers</span></h2>
            {photos.length > 0 && (
              <div className="mt-4 columns-2 gap-6 md:columns-3 lg:columns-4 [&>*]:mb-6 [&>*]:break-inside-avoid">
                {photos.map(({ m, year, sure }) => (
                  <div key={m.id}>
                    <p className="data text-ink-soft">{sure ? year : `about ${year}`}</p>
                    <MediaCard m={m} />
                  </div>
                ))}
              </div>
            )}
            {papers.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer data">{papers.length} papers from the {k}s</summary>
                <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {papers.map(({ m, year }) => (
                    <div key={m.id}><p className="data text-ink-soft">{year}</p><MediaCard m={m} /></div>
                  ))}
                </div>
              </details>
            )}
          </section>
        );
      })}
      <Comments page="/album" />
    </>
  );
}

/** reads the family's decisions on every request; never prerender */
export const dynamic = "force-dynamic";
