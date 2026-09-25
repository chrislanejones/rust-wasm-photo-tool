// The harness that produced the fixtures in this folder — committed so the
// provenance in README.md is reproducible rather than a claim.
//
//   node tests/fixtures/oplog/capture-harness.mjs                  # live prod
//   IH_BASE=http://127.0.0.1:<port> node .../capture-harness.mjs   # a local build
//
// Run it from the repo root (it resolves @playwright/test out of the root
// node_modules). It imports e2e/fixtures/checker.png through the real Browse
// Files path, adds a text in a non-default face, drags the text box narrower,
// draws a shape and sets its sloppiness, printing the op-log contents after
// each step, then dumps every IndexedDB database to dump.json.
//
// Two things it knows that cost time to learn:
//   • ENTER commits a text (useTextTool.ts:768). Clicking "away" only commits
//     OUTSIDE [data-text-overlay]; inside it, the following Escape throws the
//     whole edit away and the session records nothing.
//   • BIND-TEST THE PORT FIRST when pointing IH_BASE at a local preview. The
//     first v7 capture attempt ran against somebody else's server on a port
//     vite had failed to take, and produced v8 bytes in a folder called v7.
//     The version byte in the frames is what caught it.
//
// Paths below are absolute on purpose: it was run from a worktree.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.IH_BASE ?? "https://edit.imagehorse.app";
const OUT = process.env.IH_OUT ?? "/tmp/claude-1000/-home-clj-repo-rust-wasm-photo-tool/d3f6b801-2f93-43de-8e52-ec728067f011/scratchpad/capture3";
const SHOT = join(OUT, "shots");
const FIXTURE_PNG = "/home/clj/ai-repo/oplog-fixtures/e2e/fixtures/checker.png";
mkdirSync(SHOT, { recursive: true });
const log = (...a) => console.log("[cap3]", ...a);
const NAMES = ["Stroke","FillRegion","Blur","Levels","Crop","TextAdd","TextEdit","TextRemove","ShapeAdd","ShapeRemove","LayerMove","ShapeEdit","TextWrap","TextBoxHeight","TextPerspective","PerspectiveWarp","ShapePerspective","ShapeSloppiness","TextFont"];

const READ_OPS = async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("image-horse-dexie"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = (s) => new Promise((res) => { const rq = db.transaction(s, "readonly").objectStore(s).getAll(); rq.onsuccess = () => res(rq.result); rq.onerror = () => res([]); });
  const chunks = await get("opLogs");
  const mans = await get("oplogManifests");
  db.close();
  const out = [];
  for (const c of chunks.sort((a, b) => a.chunkSeq - b.chunkSeq)) {
    const b = new Uint8Array(c.bytes);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let off = 0;
    while (off + 4 <= b.length) { const ln = dv.getUint32(off, true); off += 4; out.push([b[off], b[off + 1]]); off += ln; }
  }
  return { ops: out, manifest: mans[0] ? { opCount: mans[0].opCount, chunkCount: mans[0].chunkCount, cursor: mans[0].cursor, stale: mans[0].stale, formatVersion: mans[0].formatVersion } : null };
};
const DUMP = async () => {
  const b64 = (buf) => { const bytes = new Uint8Array(buf); let s = ""; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); };
  const enc = async (v) => {
    if (v instanceof Uint8Array) return { __u8: b64(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)), n: v.byteLength };
    if (v instanceof ArrayBuffer) return { __ab: b64(v), n: v.byteLength };
    if (typeof Blob !== "undefined" && v instanceof Blob) { const ab = await v.arrayBuffer(); return { __blob: v.size > 6e6 ? null : b64(ab), size: v.size, type: v.type }; }
    if (Array.isArray(v)) { const o = []; for (const x of v) o.push(await enc(x)); return o; }
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = await enc(v[k]); return o; }
    return v;
  };
  const names = (await indexedDB.databases()).map((d) => d.name).filter(Boolean);
  const out = {};
  for (const name of names) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = {};
    for (const s of Array.from(db.objectStoreNames)) rows[s] = await new Promise((res) => { const rq = db.transaction(s, "readonly").objectStore(s).getAll(); rq.onsuccess = () => res(rq.result); rq.onerror = () => res([]); });
    out[name] = { version: db.version, stores: await enc(rows) };
    db.close();
  }
  return out;
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 140)));

const showOps = async (tag) => {
  await page.waitForTimeout(2800);
  const r = await page.evaluate(READ_OPS);
  log(tag, "→", r.ops.map(([v, k]) => `v${v}:${NAMES[k] ?? k}`).join(", ") || "(none)", "| manifest", JSON.stringify(r.manifest));
  return r;
};
async function pickTool(page, group, sub) {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: sub, exact: true }).first().click();
  await page.waitForTimeout(600);
}
async function commitText(page) {
  // Enter (no Shift) commits — useTextTool.ts:768. Clicking "away" only
  // commits OUTSIDE [data-text-overlay]; inside it, Escape then throws the
  // edit away. Enter is the unambiguous one.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  if (await page.locator("textarea").first().isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
}

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  const fi = page.locator('input[type="file"]').first();
  await fi.waitFor({ state: "attached", timeout: 30_000 });
  await fi.setInputFiles(FIXTURE_PNG);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(3000);
  const box = await page.locator("canvas.main-canvas").boundingBox();
  const px = (f) => box.x + box.width * f;
  const py = (f) => box.y + box.height * f;
  log("canvas box", JSON.stringify(box));

  // ── Text A: liberation-serif ──────────────────────────────────────────
  await pickTool(page, "Create", "Text");
  const selects = page.locator("select");
  for (let i = 0; i < (await selects.count()); i++) {
    const vals = await selects.nth(i).locator("option").evaluateAll((os) => os.map((o) => o.value));
    if (vals.includes("liberation-serif")) { await selects.nth(i).selectOption("liberation-serif"); log("font = liberation-serif"); break; }
  }
  await page.waitForTimeout(500);
  await page.mouse.click(px(0.43), py(0.4));
  const ta = page.locator("textarea").first();
  await ta.waitFor({ state: "visible", timeout: 15_000 });
  await ta.fill("Serif v8");
  await page.waitForTimeout(700);
  await commitText(page);
  await page.screenshot({ path: join(SHOT, "10-textA.png") });
  await showOps("after text A (serif)");

  // ── Text B: long text, box narrowed by dragging the e handle ──────────
  await pickTool(page, "Create", "Text");
  await page.mouse.click(px(0.43), py(0.5));
  const tb = page.locator("textarea").first();
  await tb.waitFor({ state: "visible", timeout: 15_000 });
  await tb.fill("wrap me across several lines please");
  await page.waitForTimeout(800);
  const handles = page.locator('rect[style*="ew-resize"]');
  if ((await handles.count()) >= 2) {
    const hb = await handles.nth(1).boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(hb.x + hb.width / 2 - 8 * i, hb.y + hb.height / 2, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    log("dragged the e handle 64 px left");
  }
  await page.screenshot({ path: join(SHOT, "11-textB-dragged.png") });
  await commitText(page);
  await page.screenshot({ path: join(SHOT, "12-textB-committed.png") });
  await showOps("after text B (wrapped)");

  // ── Shape A: rect, then sloppiness 50% ────────────────────────────────
  await pickTool(page, "Create", "Shapes");
  await page.mouse.move(px(0.43), py(0.56));
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(px(0.43 + 0.008 * i), py(0.56 + 0.012 * i), { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const slop = page.getByRole("button", { name: "Sloppiness 50%", exact: true }).first();
  if ((await slop.count()) > 0) { await slop.click(); await page.waitForTimeout(1000); log("sloppiness 50%"); }
  await page.screenshot({ path: join(SHOT, "13-shapeA.png") });
  await showOps("after shape A + sloppiness");

  // ── Shape B: a circle somewhere else ──────────────────────────────────
  const circle = page.getByRole("button", { name: "Circle", exact: true }).first();
  if ((await circle.count()) > 0) { await circle.click(); await page.waitForTimeout(600); }
  await page.mouse.move(px(0.52), py(0.42));
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(px(0.52 + 0.007 * i), py(0.42 + 0.011 * i), { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOT, "14-shapeB.png") });
  const final = await showOps("after shape B (circle)");

  await page.waitForTimeout(4000);
  const dump = await page.evaluate(DUMP);
  writeFileSync(join(OUT, "dump.json"), JSON.stringify(dump, null, 1));
  const png = await page.evaluate(() => document.querySelector("canvas.main-canvas")?.toDataURL("image/png") ?? "");
  writeFileSync(join(OUT, "canvas.png"), Buffer.from(png.split(",")[1] ?? "", "base64"));
  log("FINAL ops:", final.ops.map(([v, k]) => `v${v}:${NAMES[k] ?? k}`).join(", "));
  log("console errors:", JSON.stringify(errors.slice(0, 5)));
} catch (e) {
  console.error("[cap3] FAILED:", e.message);
  await page.screenshot({ path: join(SHOT, "99-failure.png") }).catch(() => {});
  console.error("[cap3] errors:", JSON.stringify(errors.slice(0, 8)));
  process.exitCode = 1;
} finally { await b.close(); }
