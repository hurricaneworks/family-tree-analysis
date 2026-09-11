/*
 * Fetch every picture in the Ancestry media gallery, from YOUR signed-in browser.
 *
 * 1. Sign in to Ancestry, open the tree's gallery:
 *      https://www.ancestry.co.uk/family-tree/tree/<your tree id>/memories?sort=name
 *    and scroll to the very bottom so every item has loaded.
 * 2. Open DevTools (Cmd+Option+J), paste this whole file into the Console, press Enter.
 * 3. Chrome asks once whether the site may download multiple files: allow.
 * 4. Files land in Downloads as <media-id>.jpg, plus manifest.json (id, title, order).
 *    Move them into a folder and run:  node scripts/import-photos.ts ~/Downloads/<folder>
 *
 * It asks for a 2000px version first and falls back to the 500px thumbnail. One request at a time,
 * a short pause between each: a single pass over your own tree, not a crawler.
 */
(async () => {
  const items = [...document.querySelectorAll("a.mediaGalleryItemAction")].map((a) => {
    const bg = a.style.backgroundImage || "";
    const m = /media\/([0-9a-f-]{36})\.(jpg|jpeg|png|gif)/i.exec(bg);
    const title = (a.querySelector(".sr-only")?.textContent || a.closest("[title]")?.getAttribute("title") || "").trim();
    return m ? { id: m[1], ext: m[2].toLowerCase(), url: bg.replace(/^url\(["']?/, "").replace(/["']?\)$/, ""), title } : null;
  }).filter(Boolean);
  console.log(`${items.length} media items found`);
  if (!items.length) return console.warn("No gallery items on this page. Scroll to the bottom first, then run again.");

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const save = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  let ok = 0, failed = [];
  for (const [i, it] of items.entries()) {
    const big = it.url.replace(/MaxSide=\d+/, "MaxSide=2000");
    let res = await fetch(big, { credentials: "include" });
    if (!res.ok) res = await fetch(it.url, { credentials: "include" });
    if (res.ok) {
      save(await res.blob(), `${it.id}.${it.ext}`);
      ok++;
    } else {
      failed.push(it.id);
    }
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${items.length}`);
    await sleep(400);
  }
  save(new Blob([JSON.stringify({ fetched: new Date().toISOString(), items, failed }, null, 1)], { type: "application/json" }), "manifest.json");
  console.log(`Done: ${ok} saved, ${failed.length} failed`, failed);
})();
