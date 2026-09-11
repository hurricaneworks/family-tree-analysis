import Link from "next/link";
import { getImports } from "@/lib/data";

export default function ChangesPage() {
  const imports = getImports();
  return (
    <>
      <h1>What changed</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">One entry per import of a fresh Ancestry export, newest first.</p>
      {imports.map((imp) => (
        <section key={imp.importedAt} className="mt-12 max-w-3xl">
          <h2>
            Export of {imp.gedcomExportDate} <span className="data text-ink-soft">imported {new Date(imp.importedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
          </h2>
          <p className="mt-1 data text-ink-soft">
            {imp.counts.people.toLocaleString("en-GB")} people, {imp.counts.citations.toLocaleString("en-GB")} citations.
          </p>
          {!imp.diff ? (
            <p className="mt-3">First import, nothing to compare against.</p>
          ) : (
            <>
              <p className="mt-3">
                {imp.diff.summary.added} added, {imp.diff.summary.removed} removed, {imp.diff.summary.changed} changed.
              </p>
              {(["added", "removed"] as const).map((k) =>
                imp.diff![k].length ? (
                  <div key={k} className="mt-4">
                    <h3 className="capitalize">{k}</h3>
                    <ul className="mt-1">
                      {imp.diff![k].map((x) => (
                        <li key={x.id}>{k === "removed" ? x.name : <Link href={`/person/${x.id}`}>{x.name}</Link>}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
              {imp.diff.changed.length > 0 && (
                <div className="mt-4">
                  <h3>Changed</h3>
                  <ul className="mt-1">
                    {imp.diff.changed.map((x) => (
                      <li key={x.id}>
                        <Link href={`/person/${x.id}`}>{x.name}</Link> <span className="data text-ink-soft">{x.fields.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      ))}
    </>
  );
}
