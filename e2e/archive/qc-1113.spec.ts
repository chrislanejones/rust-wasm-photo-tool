import { test, expect } from "../guard/test";
import type { Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "../annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — 11-13-2026, against master a794a3bd (v9.63).
//
// Runs against the PRODUCTION build in logged-out demo mode (placeholder
// Convex/Clerk keys, every off-localhost request blocked). Kept in archive/ as
// the record of the run; it is not part of the suite. Results are in
// docs/qc/qc-1113.md; screenshots went to /tmp/qc1113/shots (QC_SHOTS).
//
// It covers what the existing specs do NOT already pin for v9.55–v9.63:
//   • Text in Box: all nine cells on one photo, each one undo step, each cell's
//     ink where its cell says, and the same pixels after a reload by the op log
//     and by the archive,
//   • Copy look from a photo with a centered text: the text and its cell stay
//     home, and the other photo's own text keeps its cell,
//   • a photo switch right after an edit, then a reload: each photo keeps its
//     own edits (#447),
//   • Transfer (Beta) on, logged out: no Inbox, Send to computer says sign in,
//   • boot logged out with no console errors, file picker AND drag-drop,
//   • screenshots of the new surfaces in light and dark.
//
// Run (reuses a preview already serving the build on PW_PORT). archive/ is in
// the main config's testIgnore, so point a throwaway config at it, placed at
// the repo root so the relative globalSetup path still resolves:
//   // playwright.qc.config.ts
//   import base from "./playwright.config";
//   export default { ...base, testDir: "./e2e/archive", testIgnore: [], testMatch: /qc-1113\.spec\.ts$/ };
//   PW_PORT=<port> pnpm exec playwright test --config playwright.qc.config.ts
// ─────────────────────────────────────────────────────────────────────────────

const FIX = (n: string) => join(__dirname, "..", "fixtures", n);
const PAPER = FIX("paper-1200x900.png");
const SKY = FIX("sky-building.png");
const CHECKER = FIX("checker.png");
const SHOTS = process.env.QC_SHOTS ?? "/tmp/qc1113/shots";
mkdirSync(SHOTS, { recursive: true });

type Text = {
  id: number; x: number; y: number; align: number; wrap_width: number; box_height: number;
  tile_w: number; tile_h: number; tile_offset_x: number; tile_offset_y: number;
};

const CELLS = [
  "Top left", "Top center", "Top right",
  "Middle left", "Center", "Middle right",
  "Bottom left", "Bottom center", "Bottom right",
] as const;

async function blockExternal(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
}

async function prefs(page: Page, extra: Record<string, unknown>) {
  await page.addInitScript((e) => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, canvasArtboard: false, ...e }));
  }, extra);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, theme: t }));
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(250);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

const texts = (page: Page): Promise<Text[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_text_annotations()));
const undoCount = (page: Page): Promise<number> =>
  page.evaluate(async () => await window.__annotationTool.undo_count());
const composite = (page: Page): Promise<number[]> =>
  page.evaluate(async () => Array.from(await window.__annotationTool.get_image_data()));
const hash = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const d = await window.__annotationTool.get_image_data();
    const h = await crypto.subtle.digest("SHA-256", d);
    return Array.from(new Uint8Array(h)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  });

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function openText(page: Page) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
}

async function pickCell(page: Page, cell: string) {
  const panel = page.getByRole("region", { name: "Tool options" });
  const grid = panel.getByRole("radiogroup", { name: "Text in Box" });
  if (!(await grid.isVisible())) await panel.getByRole("button", { name: /^Text in Box/ }).first().click();
  await grid.getByRole("radio", { name: cell, exact: true }).click();
  await expect(grid.getByRole("radio", { name: cell, exact: true })).toBeChecked();
}

async function commitAway(page: Page, away: { x: number; y: number }) {
  const p = await screenPoint(page, away.x, away.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

/** Type a two-line text at (x, y) in `cell`, drag its box to w × h canvas px, commit. */
async function placeBoxed(page: Page, cell: string, x: number, y: number, w: number, h: number, away: { x: number; y: number }) {
  await pickCell(page, cell);
  const at = await screenPoint(page, x, y);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill("HHHHHH\nHH");
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + w * scale, nw.y + nw.height / 2 + h * scale, { steps: 10 });
  await page.mouse.up();
  await commitAway(page, away);
}

/** Absolute ink bbox near a text (its tile grown by 300 px), canvas px. */
function inkAbs(now: number[], blank: number[], W: number, H: number, t: Text) {
  const x0 = Math.max(0, t.x - 20), y0 = Math.max(0, t.y - 20);
  const x1 = Math.min(W, t.x + Math.max(t.tile_w, t.wrap_width) + 40), y1 = Math.min(H, t.y + Math.max(t.tile_h, t.box_height) + 40);
  let l = Infinity, r = -Infinity, top = Infinity, bot = -Infinity;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(now[i] - blank[i]) + Math.abs(now[i + 1] - blank[i + 1]) + Math.abs(now[i + 2] - blank[i + 2]) > 60) {
        l = Math.min(l, x); r = Math.max(r, x); top = Math.min(top, y); bot = Math.max(bot, y);
      }
    }
  return { l, r, top, bot };
}

async function waitAndReload(page: Page, retireLog: boolean, width: string) {
  await page.waitForTimeout(8000);
  if (retireLog) {
    await page.evaluate(() => new Promise<void>((resolve) => {
      const req = indexedDB.open("image-horse-dexie");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("oplogManifests", "readwrite");
        const store = tx.objectStore("oplogManifests");
        const all = store.getAll();
        all.onsuccess = () => { for (const m of all.result) store.put({ ...m, stale: true }); };
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    }));
  }
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe(width);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
}

// ── Q1 boot ──────────────────────────────────────────────────────────────────

test("Q1 boot logged out: no console errors, engine loads, file picker and drag-drop both import", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`Q1 HTTP ${r.status()} ${r.url()}`); });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await expect(page.locator('input[type="file"]').first()).toBeAttached();
  await page.waitForTimeout(1500);
  await setTheme(page, "light");
  await shot(page, "q1-empty-light");
  await setTheme(page, "dark");
  await shot(page, "q1-empty-dark");

  await page.locator('input[type="file"]').first().setInputFiles(PAPER);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  // Drag-drop a second photo onto the window (AppShell's window "drop").
  const bytes = readFileSync(CHECKER).toString("base64");
  await page.evaluate((b64) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([arr], "dropped-checker.png", { type: "image/png" }));
    for (const type of ["dragenter", "dragover", "drop"])
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, bytes);
  // One dropped file asks: new layer, or a new photo in the gallery.
  const ask = page.getByRole("dialog", { name: "Add this image" });
  await expect(ask).toBeVisible();
  await shot(page, "q1-drop-asks-dark");
  await ask.getByRole("button", { name: /Add Image to Gallery/ }).click();
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2, { timeout: 30_000 });
  await page.waitForTimeout(800);
  await shot(page, "q1-two-photos-dark");
  await setTheme(page, "light");
  await shot(page, "q1-two-photos-light");

  const real = errors.filter((e) => !/ERR_FAILED|net::|smoke-placeholder|clerk\.smoke\.invalid|Failed to load resource/i.test(e));
  console.log(`Q1 console errors (all ${errors.length}):\n${errors.join("\n")}`);
  expect(real, "console errors beyond the blocked placeholder backend").toEqual([]);
});

// ── Q2 Text in Box, all nine cells ───────────────────────────────────────────

test("Q2 Text in Box: all nine cells, one step each, ink where the cell says, same pixels after op-log and archive reloads", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(PAPER);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  await installAnnotationProbe(page);
  await openText(page);
  const blank = await composite(page);

  const W = 260, H = 200;
  const AWAY = { x: 400, y: 320 }; // the gap between the boxes
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    const before = await undoCount(page);
    await placeBoxed(page, CELLS[i], 80 + c * 380, 80 + r * 280, W, H, AWAY);
    await expect.poll(async () => (await texts(page)).length, `${CELLS[i]} placed`).toBe(i + 1);
    expect(await undoCount(page), `${CELLS[i]} is one undo step`).toBe(before + 1);
  }
  const placed = (await texts(page)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const now = await composite(page);
  // Measured against the dragged BOX (x, y, wrap_width, box_height): a Left
  // text's tile is only as wide as its ink ("Left lays out exactly as before").
  const report: string[] = [];
  const gaps = placed.map((t, i) => {
    expect(t.align, `${CELLS[i]} stored as row*3+col`).toBe(i);
    expect(t.wrap_width, `${CELLS[i]} box width`).toBe(W);
    expect(t.box_height, `${CELLS[i]} box height`).toBe(H);
    const ink = inkAbs(now, blank, 1200, 900, t);
    const g = { L: ink.l - t.x, R: t.x + t.wrap_width - 1 - ink.r, T: ink.top - t.y, B: t.y + t.box_height - 1 - ink.bot };
    report.push(`${CELLS[i]}: align=${t.align} box=${t.wrap_width}x${t.box_height} gaps L${g.L} R${g.R} T${g.T} B${g.B}`);
    return g;
  });
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3), c = i % 3, g = gaps[i];
    if (c === 0) expect(g.L, `${CELLS[i]} left`).toBeLessThan(g.R - 100);
    if (c === 1) expect(Math.abs(g.L - g.R), `${CELLS[i]} centered`).toBeLessThanOrEqual(2);
    if (c === 2) expect(g.R, `${CELLS[i]} right`).toBeLessThan(g.L - 100);
    if (r === 0) expect(g.T, `${CELLS[i]} top`).toBeLessThan(g.B - 100);
    if (r === 1) expect(Math.abs(g.T - (gaps[c].T + gaps[6 + c].T) / 2), `${CELLS[i]} halfway between top and bottom`).toBeLessThanOrEqual(2);
    if (r === 2) expect(g.B, `${CELLS[i]} bottom`).toBeLessThan(g.T - 100);
  }
  console.log(`Q2 cells:\n${report.join("\n")}`);
  await blur(page);
  await shot(page, "q2-nine-cells-dark");
  await setTheme(page, "light");
  await shot(page, "q2-nine-cells-light");
  // The panel's grid itself, open, in light.
  await pickCell(page, "Center");
  await page.getByRole("region", { name: "Tool options" }).screenshot({ path: join(SHOTS, "q2-panel-grid-light.png") });
  await setTheme(page, "dark");
  await page.getByRole("region", { name: "Tool options" }).screenshot({ path: join(SHOTS, "q2-panel-grid-dark.png") });

  const before = await hash(page);
  const aligns = placed.map((t) => t.align).join(",");
  await waitAndReload(page, false, "1200");
  expect(await hash(page), "op-log resume: the same pixels").toBe(before);
  expect((await texts(page)).sort((a, b) => (a.y - b.y) || (a.x - b.x)).map((t) => t.align).join(","), "op-log resume: the same cells").toBe(aligns);

  // Undo after resume takes exactly the last text (Bottom right).
  await blur(page);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await texts(page)).length, "one Ctrl+Z after resume removes one text").toBe(8);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await texts(page)).length).toBe(9);
  expect(await hash(page), "redo is byte-exact").toBe(before);

  await waitAndReload(page, true, "1200");
  expect(await hash(page), "archive resume: the same pixels").toBe(before);
  expect((await texts(page)).sort((a, b) => (a.y - b.y) || (a.x - b.x)).map((t) => t.align).join(","), "archive resume: the same cells").toBe(aligns);
  // Undo after this archive resume is NOT asserted: this archive was written
  // after an op-log resume, and such an archive carries no undo history (undo
  // 0). Same on v9.55 (Q2d/Q2e), so it predates this release; parked.
  console.log(`Q2 undo_count after archive resume (written after an op-log resume): ${await undoCount(page)}`);
  await blur(page);
  await shot(page, "q2-after-archive-resume-dark");
});

// ── Q3 callout label ─────────────────────────────────────────────────────────

test("Q3 callout: new label is centered, survives a reload, and Text in Box can re-cell it", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(PAPER);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  await installAnnotationProbe(page);
  await openText(page);
  await pickCell(page, "Top right");
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const steps = await undoCount(page);
  const p = await screenPoint(page, 300, 450);
  await page.mouse.click(p.x, p.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await expect(input).toBeFocused();
  await input.fill("Two line\nlabel");
  await input.press("Enter");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  expect((await texts(page))[0].align, "new callout label: middle center").toBe(4);
  console.log(`Q3 callout undo steps: ${steps} -> ${await undoCount(page)}`);
  await blur(page);
  await shot(page, "q3-callout-dark");
  const before = await hash(page);
  await waitAndReload(page, false, "1200");
  expect(await hash(page), "callout after op-log resume: same pixels").toBe(before);
  expect((await texts(page))[0].align).toBe(4);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await texts(page)).length, "one Ctrl+Z removes the callout label").toBe(0);
  await setTheme(page, "light");
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  await shot(page, "q3-callout-light");
});

// ── Q4 Copy look ─────────────────────────────────────────────────────────────

test("Q4 Copy look from a photo with a centered text: the text stays home, the other photo's text keeps its cell", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([PAPER, SKY]);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2);
  const tileA = page.locator('[aria-label="Select photo paper-1200x900"]:visible');
  const tileB = page.locator('[aria-label="Select photo sky-building"]:visible');

  // B first: a Top left text.
  await tileB.click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  await installAnnotationProbe(page);
  await openText(page);
  await pickCell(page, "Top left");
  const pb = await screenPoint(page, 200, 200);
  await page.mouse.click(pb.x, pb.y);
  await page.locator("textarea").first().fill("BBBB\nB");
  await commitAway(page, { x: 900, y: 600 });
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const bText = (await texts(page))[0];
  expect(bText.align).toBe(0);
  await page.waitForTimeout(6000);

  // A: a Center text and a Levels edit.
  await tileA.click();
  await expect.poll(async () => { await installAnnotationProbe(page); return (await texts(page)).length; }, { timeout: 30_000 }).toBe(0);
  await openText(page);
  await pickCell(page, "Center");
  const pa = await screenPoint(page, 300, 300);
  await page.mouse.click(pa.x, pa.y);
  await page.locator("textarea").first().fill("AAAA\nA");
  await commitAway(page, { x: 900, y: 700 });
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Levels", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[type="range"][aria-label="Black point"]').evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(el, "48");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForTimeout(1500);

  await blur(page);
  await page.keyboard.press("Control+Alt+c");
  const toast = page.getByText(/Copied the look of|to copy|Open a photo to copy/).first();
  await expect(toast).toBeVisible();
  const said = await toast.textContent();
  console.log(`Q4 copy toast: ${said}`);
  expect(said, "Copy look names only tonal edits").not.toMatch(/text|align/i);

  // Paste to B with B OPEN: a closed photo with edits of its own is skipped
  // by design ("open it and paste there").
  await tileB.click();
  await expect.poll(async () => { await installAnnotationProbe(page); return (await texts(page)).length; }, { timeout: 30_000 }).toBe(1);
  await page.waitForTimeout(1500);
  const bBefore = await hash(page);
  const bSteps = await undoCount(page);
  await page.locator('[aria-label="Select image"]').nth(1).click();
  await blur(page);
  await page.keyboard.press("Control+Alt+v");
  const dialog = page.getByRole("dialog", { name: "Paste look" });
  await expect(dialog).toBeVisible();
  const boxes = await dialog.getByRole("checkbox").allTextContents();
  const labels = await dialog.getByRole("checkbox").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? ""));
  console.log(`Q4 paste dialog checkboxes: ${JSON.stringify(labels)} ${JSON.stringify(boxes)}`);
  await shot(page, "q4-paste-look-dialog-dark");
  await dialog.getByRole("button", { name: /^Paste to 1/ }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(4000);

  await installAnnotationProbe(page);
  await expect.poll(async () => hash(page), { timeout: 30_000 }).not.toBe(bBefore);
  expect((await texts(page)).length, "A's text did not travel").toBe(1);
  const bAfter = (await texts(page))[0];
  expect(bAfter.align, "B's own text keeps Top left").toBe(0);
  expect(bAfter.x).toBe(bText.x);
  console.log(`Q4 B undo steps ${bSteps} -> ${await undoCount(page)}`);
  expect(await undoCount(page), "the paste is one step on the open photo").toBe(bSteps + 1);
  await blur(page);
  await shot(page, "q4-b-after-paste-dark");
  await page.keyboard.press("Control+z");
  await expect.poll(async () => hash(page), { timeout: 15_000 }).toBe(bBefore);
  expect((await texts(page))[0].align).toBe(0);
});

// ── Q5 photo switch right after an edit (#447) ───────────────────────────────

test("Q5 a switch right after an edit, then a reload: each photo keeps its own edits", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([PAPER, SKY]);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2);
  const tileA = page.locator('[aria-label="Select photo paper-1200x900"]:visible');
  const tileB = page.locator('[aria-label="Select photo sky-building"]:visible');

  await tileA.click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("height"), { timeout: 30_000 }).toBe("900");
  await installAnnotationProbe(page);
  await openText(page);
  const pa = await screenPoint(page, 300, 300);
  await page.mouse.click(pa.x, pa.y);
  await page.locator("textarea").first().fill("ONLY A");
  // Commit with no fixed waits, then switch at once: the op-log save is
  // debounced 2,000 ms (oplogPersistence.ts DEBOUNCE_MS), so the switch must
  // land inside that window to race the pending save (#447). The gap is logged.
  const away = await screenPoint(page, 900, 700);
  await page.mouse.click(away.x, away.y);
  const committedAt = Date.now();
  await expect.poll(async () => (await texts(page)).length, { intervals: [25] }).toBe(1);
  await page.keyboard.press("Escape");
  const aHash = await hash(page);
  const gap = Date.now() - committedAt;
  console.log(`Q5 commit-to-switch gap: ${gap} ms (save debounce 2000 ms)`);
  expect(gap, "the switch lands inside the save debounce").toBeLessThan(1500);
  await tileB.click();
  await expect.poll(async () => page.locator("canvas.main-canvas").getAttribute("height"), { timeout: 30_000 }).not.toBe("900");
  await installAnnotationProbe(page);
  expect((await texts(page)).length, "B opens with no text").toBe(0);
  const pb = await screenPoint(page, 200, 200);
  await page.mouse.click(pb.x, pb.y);
  await page.locator("textarea").first().fill("ONLY B");
  await commitAway(page, { x: 900, y: 600 });
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const bHash = await hash(page);
  await page.waitForTimeout(9000);

  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  // Resume opens photo 0 (A) by design (useImageSession: "auto-selects photo 0").
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("height"), { timeout: 30_000 }).toBe("900");
  await installAnnotationProbe(page);
  await expect.poll(async () => (await texts(page)).length, { timeout: 30_000 }).toBe(1);
  const resumedA = await hash(page);
  await blur(page);
  await shot(page, "q5-photo-a-after-reload-dark");
  await page.locator('[aria-label="Select photo sky-building"]:visible').click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("height"), { timeout: 30_000 }).not.toBe("900");
  await page.waitForTimeout(2500);
  await installAnnotationProbe(page);
  await expect.poll(async () => (await texts(page)).length, { timeout: 30_000 }).toBe(1);
  const reopenedB = await hash(page);
  console.log(`Q5 A ${aHash} B ${bHash} | after reload A ${resumedA} B ${reopenedB}`);
  expect(resumedA, "A has exactly A's pixels").toBe(aHash);
  expect(reopenedB, "B has exactly B's pixels").toBe(bHash);
  await blur(page);
  await shot(page, "q5-photo-b-after-reload-dark");
});

// ── Q6 compare + batch, screenshots in both themes ───────────────────────────

test("Q6 compare line in the gallery bar and Batch Grid/Masonry, light and dark", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([SKY, CHECKER, PAPER]);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(3);
  await page.locator('[aria-label="Select photo sky-building"]:visible').click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");

  const compareMode = page.getByRole("button", { name: "Compare two photos" });
  await compareMode.click();
  const status = page.getByTestId("compare-status");
  await expect(status.getByRole("status")).toContainText("0 of 2");
  await shot(page, "q6-compare-line-dark");
  await setTheme(page, "light");
  await shot(page, "q6-compare-line-light");
  const pick = (n: string) => page.locator(`[aria-label="Select photo ${n}"]:visible`).getByRole("button", { name: "Compare", exact: true });
  await pick("checker").click();
  await pick("paper-1200x900").click();
  await expect(page.getByTestId("compare-bar")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await shot(page, "q6-compare-pair-light");
  await setTheme(page, "dark");
  await shot(page, "q6-compare-pair-dark");
  await page.getByTestId("compare-bar").getByRole("button", { name: "Done", exact: true }).click().catch(() => page.keyboard.press("Escape"));
  await page.waitForTimeout(500);
  if (await status.count()) await status.getByRole("button", { name: "Stop comparing" }).click();
  await expect(status).toHaveCount(0);

  await page.locator('[aria-label="Select photo sky-building"]:visible').click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  const bar = page.getByTestId("batch-grid-bar");
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "Grid view" })).toContainText("Grid");
  await expect(bar.getByRole("button", { name: "Masonry view" })).toContainText("Masonry");
  await page.waitForTimeout(800);
  await shot(page, "q6-batch-grid-dark");
  await bar.getByRole("button", { name: "Masonry view" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "q6-batch-masonry-dark");
  await setTheme(page, "light");
  await shot(page, "q6-batch-masonry-light");
  await bar.getByRole("button", { name: "Grid view" }).click();
  await page.waitForTimeout(800);
  await shot(page, "q6-batch-grid-light");
  // Persisted per browser.
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 }).catch(() => {});
  expect(await page.evaluate(() => localStorage.getItem("image-horse-batch-view"))).toContain('"layout":"grid"');
});

// ── Q7 Transfer (Beta), logged out ───────────────────────────────────────────

test("Q7 Transfer on by ?beta=transfer, logged out: the switch is on, no Inbox, the phone says sign in", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/?beta=transfer");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ih_transfer"))).toBe("1");
  expect(page.url(), "the param takes itself out of the URL").not.toContain("beta=");
  await page.locator('input[type="file"]').first().setInputFiles([SKY]);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  await expect(page.getByRole("button", { name: /Inbox/ })).toHaveCount(0);
  await shot(page, "q7-transfer-desktop-logged-out-dark");

  // Phone: the Settings sheet's Send to computer.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Got it" }).click({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "q7-phone-home-dark");
  // The phone's own Settings (title "Theme and motion"); the desktop one sits behind the overlay.
  await page.locator('button[aria-label="Settings"][title="Theme and motion"]').click();
  await page.waitForTimeout(800);
  const section = page.getByTestId("send-to-computer");
  await expect(section.getByRole("heading", { name: "Send to computer" })).toBeVisible({ timeout: 30_000 });
  // Clerk is blocked here, so auth never settles: "Connecting…" or "Sign in…".
  await expect(section.getByText(/^(Sign in to send photos to your computer\.|Connecting to your account…)$/)).toBeVisible();
  await expect(page.getByTestId("send-to-computer-input"), "no picker logged out").toHaveCount(0);
  await section.scrollIntoViewIfNeeded();
  await shot(page, "q7-phone-send-to-computer-dark");
  await setTheme(page, "light");
  await shot(page, "q7-phone-send-to-computer-light");

  // ?beta=none clears it.
  await page.goto("/?beta=none");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ih_transfer"))).toBeNull();
  const real = errors.filter((e) => !/ERR_FAILED|net::|smoke-placeholder|clerk\.smoke\.invalid|Failed to load resource/i.test(e));
  console.log(`Q7 console errors (all ${errors.length}):\n${errors.join("\n")}`);
  expect(real).toEqual([]);
});

// ── Q2d diagnostic: undo after an ARCHIVE resume, with and without an earlier op-log resume ──

for (const chain of ["archive only", "op-log resume first"] as const) {
  test(`Q2d ${chain}: undo history after an archive resume`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 1100 });
    await blockExternal(page);
    await prefs(page, {});
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles(PAPER);
    await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
    await installAnnotationProbe(page);
    await openText(page);
    for (let i = 0; i < 3; i++) await placeBoxed(page, "Top left", 80 + i * 380, 80, 260, 200, { x: 400, y: 320 });
    await expect.poll(async () => (await texts(page)).length).toBe(3);
    const counts = async (tag: string) => {
      const c = await page.evaluate(async () => ({ undo: await window.__annotationTool.undo_count(), redo: await window.__annotationTool.redo_count?.() }));
      console.log(`Q2d [${chain}] ${tag}: texts ${(await texts(page)).length} undo ${c.undo} redo ${c.redo}`);
    };
    await counts("placed");
    if (chain === "op-log resume first") {
      await waitAndReload(page, false, "1200");
      await counts("after op-log resume");
    }
    await waitAndReload(page, true, "1200");
    await counts("after archive resume");
    await blur(page);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(2500);
    await counts("after one Ctrl+Z");
  });
}

// Q2e: the same, with plain texts (no Text in Box, no dragged box), so it runs on v9.55 too.
for (const chain of ["archive only", "op-log resume first"] as const) {
  test(`Q2e plain ${chain}: undo history after an archive resume`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 1100 });
    await blockExternal(page);
    await prefs(page, {});
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles(PAPER);
    await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
    await installAnnotationProbe(page);
    await openText(page);
    for (let i = 0; i < 3; i++) {
      const at = await screenPoint(page, 150 + i * 350, 200);
      await page.mouse.click(at.x, at.y);
      await page.locator("textarea").first().fill(`PLAIN ${i}`);
      await commitAway(page, { x: 600, y: 700 });
    }
    await expect.poll(async () => (await texts(page)).length).toBe(3);
    const counts = async (tag: string) => {
      const undo = await page.evaluate(async () => await window.__annotationTool.undo_count());
      console.log(`Q2e [${chain}] ${tag}: texts ${(await texts(page)).length} undo ${undo}`);
    };
    await counts("placed");
    if (chain === "op-log resume first") {
      await waitAndReload(page, false, "1200");
      await counts("after op-log resume");
    }
    await waitAndReload(page, true, "1200");
    await counts("after archive resume");
    await blur(page);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(2500);
    await counts("after one Ctrl+Z");
  });
}
