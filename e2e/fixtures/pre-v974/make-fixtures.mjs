// Makes `v973-stamp.json`: a project saved by v9.73 (3f56626), the last
// release that burned a stamp into the pixels (ADR-109 made stamps texts in
// v9.74). QC 11-26 listed opening such a project as "Not covered".
//
// HOW IT WAS MADE (11-28-2026, Claude Code cloud):
//   git worktree add /tmp/v973 3f56626 && cd /tmp/v973
//   pnpm install --frozen-lockfile && pnpm run build:wasm
//   <the demo env from playwright.config.ts> pnpm run build
//   pnpm --filter stamp-tool exec vite preview --port 4330 --strictPort &
//   CHROMIUM=/opt/pw-browsers/chromium \
//     node <this repo>/e2e/fixtures/pre-v974/make-fixtures.mjs http://localhost:4330
//   (run from this repo's root so `@playwright/test` resolves; CHROMIUM only
//   where the pinned Playwright's own browser isn't installed)
//
// It drives the v9.73 UI as a person would: upload the paper fixture, open
// Stamps › Red, pick APPROVED, click the middle of the photo (one undo step,
// burned in by `commit_red_stamp`), wait for the autosave, then dumps the
// three IndexedDB databases the resume reads. Bytes are base64 (see
// idb-dump.ts, which the spec uses to write them back).
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://localhost:4330";
const PAPER = join(HERE, "..", "paper-1200x900.png");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.route("**/*", (r) => {
  const u = new URL(r.request().url());
  return ["localhost", "127.0.0.1"].includes(u.hostname) || ["blob:", "data:"].includes(u.protocol) ? r.continue() : r.abort();
});
await page.addInitScript(() => localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
await page.goto(BASE + "/");
await page.locator('input[type="file"]').first().setInputFiles(PAPER);
await page.waitForFunction(() => document.querySelector("canvas.main-canvas")?.width === 1200, null, { timeout: 60_000 });

// Stamps › Red, the APPROVED preset, then one click in the middle.
await page.evaluate(() => { location.hash = "#/tool/stamps/red"; });
await page.getByRole("radio", { name: /APPROVED/ }).first().click();
const box = await page.locator("canvas.main-canvas").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

// The stamp landed: Undo is enabled.
await page.getByRole("button", { name: "Undo", exact: true }).first().waitFor({ state: "visible" });
await page.waitForFunction(() => !document.querySelector('button[aria-label="Undo"]')?.hasAttribute("disabled"), null, { timeout: 30_000 });

// The autosave: an edit record with the stamp's one undo step. Checked
// WITHOUT creating the database (opening a missing one creates it empty, and
// then the app's own open at version 1 never gets its upgrade, so it has no
// store to save into), and polled from here so a Promise is never mistaken
// for a truthy answer.
const saved = () =>
  page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "image-horse-edits")) return false;
    return new Promise((res) => {
      const r = indexedDB.open("image-horse-edits");
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("edits")) { db.close(); return res(false); }
        const g = db.transaction("edits").objectStore("edits").getAll();
        g.onsuccess = () => { db.close(); res(g.result.some((e) => e.undoStack?.length === 1)); };
      };
      r.onerror = () => res(false);
    });
  });
for (let i = 0; !(await saved()); i++) {
  if (i > 120) throw new Error("no autosave with one undo step after 60 s");
  await new Promise((r) => setTimeout(r, 500));
}

// The same dump as idb-dump.ts `dumpIdb`, in plain JS (this file runs in Node
// without a TypeScript step).
const dump = await page.evaluate(async (names) => {
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const enc = async (v) => {
    if (v instanceof Uint8Array) return { $u8: b64(v) };
    if (v instanceof Uint8ClampedArray) return { $u8c: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    if (v instanceof ArrayBuffer) return { $ab: b64(new Uint8Array(v)) };
    if (v instanceof Blob) return { $blob: b64(new Uint8Array(await v.arrayBuffer())), type: v.type };
    if (Array.isArray(v)) return Promise.all(v.map(enc));
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await enc(x); return o; }
    return v;
  };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = [];
  for (const name of names) {
    const db = await req(indexedDB.open(name));
    const stores = [];
    for (const sName of Array.from(db.objectStoreNames)) {
      const store = db.transaction(sName, "readonly").objectStore(sName);
      const keys = await req(store.getAllKeys());
      const values = await req(store.getAll());
      const indexes = Array.from(store.indexNames).map((i) => { const ix = store.index(i); return { name: i, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry }; });
      const rows = [];
      for (let i = 0; i < keys.length; i++) rows.push({ key: await enc(keys[i]), value: await enc(values[i]) });
      stores.push({ name: sName, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes, rows });
    }
    out.push({ name, version: db.version, stores });
    db.close();
  }
  return out;
}, ["image-horse-edits", "image-horse-gallery", "image-horse-dexie"]);
const meta = await page.evaluate(() => ({ userAgent: navigator.userAgent }));
writeFileSync(
  join(HERE, "v973-stamp.json"),
  JSON.stringify({ madeBy: "v9.73 (3f56626)", madeAt: new Date().toISOString(), ...meta, dbs: dump }) + "\n",
);
console.log("wrote v973-stamp.json");
await browser.close();
