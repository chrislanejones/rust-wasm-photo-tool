import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Text centered in its box (ADR-104, op log v16).
//
// Align: Center in the Text panel, a two-line text in a box dragged to about
// 300 px: each line's ink is centered in the box within 1 px, the commit is
// ONE undo step, and a reload (by the op log, and by the archive with the log
// retired) brings back the same pixels, still centered. "H" has equal side
// bearings, so the check is about the layout, not the glyph.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const AT = { x: 300, y: 250 };
const BOX_W = 300;

type Text = {
  id: number; x: number; y: number; align: number; wrap_width: number;
  tile_w: number; tile_h: number; tile_offset_x: number; tile_offset_y: number;
};

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
}

const texts = (page: Page): Promise<Text[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_text_annotations()));
const undoCount = (page: Page): Promise<number> =>
  page.evaluate(async () => await window.__annotationTool.undo_count());
const composite = (page: Page): Promise<number[]> =>
  page.evaluate(async () => Array.from(await window.__annotationTool.get_image_data()));

/** Ink columns per line inside the text's tile: the pixels that changed from
 *  `blank`, split into bands at the empty rows between the lines. */
async function lineInk(page: Page, blank: number[], t: Text) {
  const now = await composite(page);
  const W = 1200;
  const x0 = t.x + t.tile_offset_x;
  const y0 = t.y + t.tile_offset_y;
  const rows: Array<[number, number] | null> = [];
  for (let y = y0; y < y0 + t.tile_h; y++) {
    let lo = Infinity, hi = -Infinity;
    for (let x = x0; x < x0 + t.tile_w; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(now[i] - blank[i]) + Math.abs(now[i + 1] - blank[i + 1]) + Math.abs(now[i + 2] - blank[i + 2]) > 60) {
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    }
    rows.push(lo <= hi ? [lo, hi] : null);
  }
  const bands: Array<[number, number]> = [];
  let cur: [number, number] | null = null;
  for (const r of rows) {
    if (r) cur = cur ? [Math.min(cur[0], r[0]), Math.max(cur[1], r[1])] : [...r];
    else if (cur) { bands.push(cur); cur = null; }
  }
  if (cur) bands.push(cur);
  return { bands, center: x0 + t.tile_w / 2 };
}

async function reloadAndResume(page: Page, retireLog: boolean) {
  await page.waitForTimeout(7000);
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
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
}

async function placeCentered(page: Page): Promise<{ blank: number[]; steps: number }> {
  const blank = await composite(page);
  const steps = await undoCount(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  const align = page.getByRole("radiogroup", { name: "Align" });
  await align.getByRole("radio", { name: "Center", exact: true }).click();
  await expect(align.getByRole("radio", { name: "Center", exact: true })).toBeChecked();

  const at = await screenPoint(page, AT.x, AT.y);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill("HHHHHHHH\nHH");
  await expect(input, "the preview centers too").toHaveCSS("text-align", "center");

  // Drag the box's right edge out to BOX_W canvas px.
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + BOX_W * scale, se.y + se.height / 2, { steps: 10 });
  await page.mouse.up();

  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  return { blank, steps };
}

async function expectCentered(page: Page, blank: number[]) {
  const [t] = await texts(page);
  expect(t.align, "stored as center").toBe(1);
  expect(Math.abs(t.wrap_width - BOX_W), `box ${t.wrap_width}`).toBeLessThanOrEqual(4);
  const { bands, center } = await lineInk(page, blank, t);
  expect(bands, "two lines of ink").toHaveLength(2);
  for (const [lo, hi] of bands) {
    const mid = (lo + hi + 1) / 2;
    expect(Math.abs(mid - center), `ink ${lo}..${hi}, mid ${mid}, box center ${center}`).toBeLessThanOrEqual(1);
  }
  expect(bands[1][1] - bands[1][0], "the short line really is shorter").toBeLessThan(bands[0][1] - bands[0][0]);
}

test("Align Center: each line centered in the box, one undo step", async ({ page }) => {
  await open(page);
  const { blank, steps } = await placeCentered(page);
  await expectCentered(page, blank);
  expect(await undoCount(page), "the commit is ONE step").toBe(steps + 1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await texts(page)).length, "one undo takes it all").toBe(0);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  await expectCentered(page, blank);
});

for (const retireLog of [false, true]) {
  test(`centered text survives a reload by the ${retireLog ? "archive" : "op log"}`, async ({ page }) => {
    await open(page);
    const { blank } = await placeCentered(page);
    const before = await composite(page);
    await reloadAndResume(page, retireLog);
    await expectCentered(page, blank);
    expect((await composite(page)).join(",") === before.join(","), "the same pixels").toBe(true);
  });
}
