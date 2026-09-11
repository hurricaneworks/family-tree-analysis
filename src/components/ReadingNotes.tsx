import type { Reading } from "@/lib/readings";
import { addPaperTask } from "@/app/list/actions";

const LABEL: Record<string, string> = { agrees: "agrees", differs: "differs", new: "not in the tree", unreadable: "unreadable" };

/** What Claude read on a document and how it compares with the tree. */
export function ReadingNotes({ r, compact = false, addable = false }: { r: Reading; compact?: boolean; addable?: boolean }) {
  const shown = compact ? r.checks.filter((c) => c.status !== "agrees") : r.checks;
  return (
    <div className="data">
      <p className="text-ink-soft">{r.documentType}{r.dateOnDocument ? `, ${r.dateOnDocument}` : ""}</p>
      <p className="mt-1">{r.summary}</p>
      {shown.length > 0 && (
        <ul className="mt-2 divide-y divide-rule">
          {shown.map((c) => { const i = r.checks.indexOf(c); return (
            <li key={i} className="py-1.5">
              <span className={c.status === "differs" ? "text-kelp" : c.status === "new" ? "text-heather" : "text-ink-soft"}>{LABEL[c.status]}</span>
              {": "}
              <span>{c.person}, {c.fact}. </span>
              {c.status === "differs" ? <span>Paper says {c.document}; tree has {c.tree}. </span> : c.status === "new" ? <span>{c.document}. </span> : null}
              {c.note && <span className="text-ink-soft">{c.note}</span>}
              {addable && (c.status === "differs" || c.status === "new") && (
                <form action={addPaperTask} className="mt-1"><input type="hidden" name="mediaId" value={r.mediaId} /><input type="hidden" name="index" value={i} /><input type="hidden" name="back" value="/papers" /><button type="submit" className="border border-ink px-2 py-0.5">Add to my list</button></form>
              )}
            </li>
          ); })}
        </ul>
      )}
      {!compact && (
        <details className="mt-2">
          <summary className="cursor-pointer text-ink-soft">Full transcription</summary>
          <p className="mt-1 whitespace-pre-line">{r.transcription}</p>
        </details>
      )}
    </div>
  );
}
