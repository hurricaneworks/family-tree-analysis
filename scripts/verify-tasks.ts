/**
 * After a fresh import: re-test every task marked done on Ancestry against the new data.
 *   gap tasks     the gap must be gone (parents now recorded, a birth date present, sources attached...)
 *   merge tasks   the dropped record must no longer exist in the export
 *   others        cannot be checked automatically; left as done, marked "not checkable"
 * Verified tasks get verified_at; failures are reopened with a note so they return to My list.
 *
 * Usage:  node --env-file=.env.local scripts/verify-tasks.ts [--dry-run]
 * Run it after `npm run import`, before deploying.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Person = { id: string; famc: string[]; birth: { date: { year: number | null } | null } | null; death: { date: { year: number | null } | null; place: string | null } | null; events: { type: string }[]; citationCount: number };
const DATA = join(import.meta.dirname, "..", "data");
const people: Person[] = JSON.parse(readFileSync(join(DATA, "people.json"), "utf8"));
const meta = JSON.parse(readFileSync(join(DATA, "meta.json"), "utf8")) as { gedcomExportDate: string | null };
const byId = new Map(people.map((p) => [p.id, p]));
const dry = process.argv.includes("--dry-run");
const exportDate = meta.gedcomExportDate ?? new Date().toISOString().slice(0, 10);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data: tasks, error } = await admin.from("tasks").select("*").not("done_at", "is", null).is("verified_at", null);
if (error) throw error;
console.log(`${tasks.length} done tasks to check against the export of ${exportDate}`);

/** true = the gap is gone; false = still there; null = cannot tell */
function gapGone(kind: string, personId: string): boolean | null {
  const p = byId.get(personId);
  if (!p) return null; // the person vanished (merged away on Ancestry): treat as not checkable
  switch (kind) {
    case "line-stops": return p.famc.length > 0;
    case "no-birth": return Boolean(p.birth?.date?.year);
    case "no-death": return Boolean(p.death?.date?.year || p.death?.place || p.events.some((e) => e.type === "BURI"));
    case "no-sources": return p.citationCount > 0;
    default: return null; // inconsistent and duplicate need a human eye
  }
}

let verified = 0, reopened = 0, unchecked = 0;
for (const t of tasks) {
  let result: boolean | null = null;
  let why = "";
  if (t.source_ref?.startsWith("gap:")) {
    const [, kind, ids] = t.source_ref.split(":");
    const personId = ids.split("|")[0];
    result = gapGone(kind, personId);
    why = result === false ? `The export of ${exportDate} still shows this gap.` : "";
  } else if (t.source_ref?.startsWith("merge:")) {
    // the dropped record should be gone from the export; find it from the edit
    const { data: edit } = await admin.from("tree_edits").select("drop_id").eq("id", t.source_ref.slice(6)).single();
    if (edit) { result = !byId.has(edit.drop_id); why = result ? "" : `The export of ${exportDate} still has both records.`; }
  }
  if (result === true) {
    verified++;
    if (!dry) await admin.from("tasks").update({ verified_at: new Date().toISOString(), verified_export: exportDate }).eq("id", t.id);
    console.log(`  verified  ${t.title}`);
  } else if (result === false) {
    reopened++;
    if (!dry) await admin.from("tasks").update({ done_at: null, done_by: null, reopened_note: why }).eq("id", t.id);
    console.log(`  REOPENED  ${t.title}  (${why})`);
  } else {
    unchecked++;
    if (!dry) await admin.from("tasks").update({ verified_export: exportDate, reopened_note: t.reopened_note ?? "Not checkable automatically; taken as done." }).eq("id", t.id);
  }
}
console.log(`${dry ? "dry run: " : ""}${verified} verified, ${reopened} reopened, ${unchecked} not checkable`);
