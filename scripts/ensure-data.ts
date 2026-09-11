/**
 * Runs before `npm run dev` and `npm run build`. If nothing has been imported yet:
 *   - with TREE_GEDCOM_URL set, downloads that export and imports it (this is how a hosted build
 *     gets your tree, since data/ and GEDCOM/ are never committed; TREE_GEOCODE_URL likewise
 *     supplies the coordinates the map needs);
 *   - otherwise loads the invented sample tree from samples/ so a fresh clone has something to show.
 * Once data/people.json exists this does nothing, so a local import is never overwritten.
 */
import { existsSync, copyFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const peoplePath = join(root, "data", "people.json");
if (existsSync(peoplePath)) process.exit(0);

async function download(url: string, to: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${new URL(url).host}`);
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

const remote = process.env.TREE_GEDCOM_URL;
if (remote) {
  const ged = join(root, "GEDCOM", "tree.ged");
  console.log("No tree imported yet: downloading the export named by TREE_GEDCOM_URL.");
  await download(remote, ged);
  execFileSync(process.execPath, [join(root, "scripts", "import.ts"), ged], { stdio: "inherit" });
  if (process.env.TREE_GEOCODE_URL) {
    await download(process.env.TREE_GEOCODE_URL, join(root, "data", "geocode.json"));
  } else {
    console.log("TREE_GEOCODE_URL not set: the map will have no pins until data/geocode.json is supplied.");
  }
  process.exit(0);
}

const sample = join(root, "samples", "thorne-family.ged");
console.log("No tree imported yet: loading the sample family from samples/thorne-family.ged.");
console.log('To use your own tree: npm run import -- "GEDCOM/your-export.ged"');
execFileSync(process.execPath, [join(root, "scripts", "import.ts"), sample], { stdio: "inherit" });
// the sample's places come with coordinates, so the map works without a geocoding run
copyFileSync(join(root, "samples", "geocode.json"), join(root, "data", "geocode.json"));
