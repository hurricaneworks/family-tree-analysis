/**
 * Runs before `npm run dev` and `npm run build`. If nothing has been imported yet, loads the
 * invented sample tree from samples/ so a fresh clone has something to show. Once you import
 * your own export (`npm run import -- GEDCOM/your-file.ged`) this does nothing.
 */
import { existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const peoplePath = join(root, "data", "people.json");
if (existsSync(peoplePath)) process.exit(0);

const sample = join(root, "samples", "thorne-family.ged");
console.log("No tree imported yet: loading the sample family from samples/thorne-family.ged.");
console.log('To use your own tree: npm run import -- "GEDCOM/your-export.ged"');
execFileSync(process.execPath, [join(root, "scripts", "import.ts"), sample], { stdio: "inherit" });
// the sample's places come with coordinates, so the map works without a geocoding run
copyFileSync(join(root, "samples", "geocode.json"), join(root, "data", "geocode.json"));
