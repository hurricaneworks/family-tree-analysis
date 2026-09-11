/**
 * Match downloaded gallery images to the export's media records. Writes data/photos.json (media id
 * -> file details), which is what makes a picture appear in the app.
 *
 * Usage:  node scripts/import-photos.ts data/images --local                          # match only: the app serves the local files
 *         node --env-file=.env.local scripts/import-photos.ts data/images            # match and upload to Supabase Storage, for a deployed site
 *
 * Files are named <gallery-id>.jpg (with " (1)" suffixes for repeats; the largest copy wins). The
 * gallery id is either the media's own id or, for items copied from another tree, its source id.
 * Local files stay in data/images (gitignored); the app streams them from there when present and
 * from the private Storage bucket "photos" otherwise. --dry-run is the same as --local.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Media = { id: string; sourceId: string | null; title: string | null; type: string | null; people: string[] };
type Stored = { file: string; bytes: number; width: number | null; height: number | null; uploaded: string | null };

const dir = resolve(process.argv[2] ?? "data/images");
const dry = process.argv.includes("--dry-run") || process.argv.includes("--local");
const dataDir = join(import.meta.dirname, "..", "data");
const media: Media[] = JSON.parse(readFileSync(join(dataDir, "media.json"), "utf8"));
const photosPath = join(dataDir, "photos.json");
let photos: Record<string, Stored> = {};
try { photos = JSON.parse(readFileSync(photosPath, "utf8")); } catch { /* first run */ }

// gallery id -> largest local file
const files = new Map<string, { name: string; bytes: number }>();
for (const name of readdirSync(dir)) {
  const m = /^([0-9a-f-]{36})(?: \(\d+\))?\.(jpe?g|png|gif)$/i.exec(name);
  if (!m) continue;
  const bytes = statSync(join(dir, name)).size;
  const cur = files.get(m[1]);
  if (!cur || bytes > cur.bytes) files.set(m[1], { name, bytes });
}

function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

const matched: { m: Media; file: string; bytes: number }[] = [];
const unmatchedMedia: Media[] = [];
const usedFiles = new Set<string>();
for (const m of media) {
  const hit = files.get(m.id) ?? (m.sourceId ? files.get(m.sourceId) : undefined);
  if (hit) { matched.push({ m, file: hit.name, bytes: hit.bytes }); usedFiles.add(hit.name); }
  else unmatchedMedia.push(m);
}
const strayFiles = [...files.values()].filter((f) => !usedFiles.has(f.name));
console.log(`${files.size} image ids on disk, ${media.length} media records: ${matched.length} matched, ${unmatchedMedia.length} records without a file, ${strayFiles.length} files not in the export`);
if (unmatchedMedia.length) console.log("  no file:", unmatchedMedia.slice(0, 8).map((m) => `${m.title} [${m.type}]`).join("; "), unmatchedMedia.length > 8 ? "..." : "");

const admin = dry ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
if (admin) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "photos")) {
    const { error } = await admin.storage.createBucket("photos", { public: false, fileSizeLimit: 20 * 1024 * 1024 });
    if (error) throw error;
    console.log("created private bucket: photos");
  }
}

let uploaded = 0, skipped = 0;
for (const { m, file, bytes } of matched) {
  const buf = readFileSync(join(dir, file));
  const size = jpegSize(buf);
  const key = `${m.id}.jpg`;
  const prev = photos[m.id];
  if (prev && prev.bytes === bytes && prev.uploaded) { skipped++; continue; }
  let uploadedAt: string | null = prev?.uploaded ?? null;
  if (admin) {
    const { error } = await admin.storage.from("photos").upload(key, buf, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`${key}: ${error.message}`);
    uploadedAt = new Date().toISOString();
    uploaded++;
  }
  photos[m.id] = { file, bytes, width: size?.width ?? null, height: size?.height ?? null, uploaded: uploadedAt };
}
writeFileSync(photosPath, JSON.stringify(photos, null, 1) + "\n");
console.log(dry ? `photos.json written for ${matched.length} items, nothing uploaded; the app will serve them from ${dir}` : `uploaded ${uploaded}, unchanged ${skipped}`);
