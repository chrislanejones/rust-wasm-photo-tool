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
  // Merged, not replaced: this runs on every load, and the reload test needs
  // what the app saved to still be there.
  await page.addInitScript(() => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, canvasArtboard: false }));
  });
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

/** Pick a cell of the Text panel's Text in Box grid, opening its section. */
async function pickCell(page: Page, cell: string) {
  const panel = page.getByRole("region", { name: "Tool options" });
  const grid = panel.getByRole("radiogroup", { name: "Text in Box" });
  if (!(await grid.isVisible())) await panel.getByRole("button", { name: /^Text in Box/ }).first().click();
  await grid.getByRole("radio", { name: cell, exact: true }).click();
  await expect(grid.getByRole("radio", { name: cell, exact: true })).toBeChecked();
}

async function placeCentered(page: Page): Promise<{ blank: number[]; steps: number }> {
  const blank = await composite(page);
  const steps = await undoCount(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, "Top center");

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

test("Bottom center: the text drops to the bottom of a taller box, preview and commit", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, "Bottom center");
  const blank = await composite(page);

  const at = await screenPoint(page, AT.x, AT.y);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill("HHHHHHHH\nHH");
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + BOX_W * scale, nw.y + nw.height / 2 + 240 * scale, { steps: 10 });
  await page.mouse.up();
  // The preview drops too: the box's spare height moves above the text.
  await expect.poll(async () => parseFloat(await input.evaluate((el) => getComputedStyle(el).paddingTop))).toBeGreaterThan(60);
  await expect(input).toHaveCSS("text-align", "center");

  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const [t] = await texts(page);
  expect(t.align, "stored as bottom center: row 2 * 3 + column 1").toBe(7);
  const bottom = await lineInk(page, blank, t);
  expect(bottom.bands).toHaveLength(2);

  // The same text at the top of the same box, and its height with no box:
  // the bottom cell must sit exactly the spare height lower.
  const inkTop = async () => {
    const now = await composite(page);
    for (let y = t.y; y < t.y + t.tile_h; y++)
      for (let x = t.x; x < t.x + t.tile_w; x++) {
        const i = (y * 1200 + x) * 4;
        if (Math.abs(now[i] - blank[i]) + Math.abs(now[i + 1] - blank[i + 1]) + Math.abs(now[i + 2] - blank[i + 2]) > 60) return y;
      }
    return -1;
  };
  const yBottom = await inkTop();
  const natural = await page.evaluate(async (id) => {
    const tool = window.__annotationTool;
    const box = JSON.parse(await tool.get_text_annotations())[0].box_height;
    await tool.set_text_box_height(id, 0);
    const h = JSON.parse(await tool.get_text_annotations())[0].tile_h;
    await tool.set_text_box_height(id, box);
    await tool.set_text_align(id, 1);
    await tool.recomposite();
    return h;
  }, t.id);
  const yTop = await inkTop();
  expect(yBottom - yTop, `spare ${t.box_height} - ${natural}`).toBe(t.box_height - natural);
});

/** A two-line text in a box dragged BOX_W wide and 240 px tall, at `cell`,
 *  committed. Returns the stored text. */
async function placeInTallBox(page: Page, cell: string): Promise<Text & { box_height: number }> {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, cell);
  const at = await screenPoint(page, AT.x, AT.y);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill("HHHHHHHH\nHH");
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + BOX_W * scale, nw.y + nw.height / 2 + 240 * scale, { steps: 10 });
  await page.mouse.up();
  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  return (await texts(page))[0] as Text & { box_height: number };
}

// Both axes through a reload (11-12 plan §1 A): the middle row AND the center
// column, in a box taller than the text, come back the same by either path.
for (const retireLog of [false, true]) {
  test(`Center (middle row) in a tall box survives a reload by the ${retireLog ? "archive" : "op log"}`, async ({ page }) => {
    await open(page);
    const placed = await placeInTallBox(page, "Center");
    expect(placed.align, "middle center: row 1 * 3 + column 1").toBe(4);
    expect(placed.box_height, "a box taller than two lines").toBeGreaterThan(150);
    const before = await composite(page);
    await reloadAndResume(page, retireLog);
    const [back] = await texts(page);
    const { id: _a, ...was } = placed;
    const { id: _b, ...now } = back;
    expect(now, "every field but the id (the archive gives a fresh one)").toEqual(was);
    expect((await composite(page)).join(",") === before.join(","), "the same pixels").toBe(true);
  });
}

test("the Text in Box choice is kept after a reload", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, "Bottom right");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}").textAlign)).toBe("bottom-right");

  await page.waitForTimeout(3000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  const panel = page.getByRole("region", { name: "Tool options" });
  const grid = panel.getByRole("radiogroup", { name: "Text in Box" });
  if (!(await grid.isVisible())) await panel.getByRole("button", { name: /^Text in Box/ }).first().click();
  await expect(grid.getByRole("radio", { name: "Bottom right", exact: true })).toBeChecked();
});

/** Open a text in the Text tool by clicking it, then commit it unchanged. */
async function reopenAndCommit(page: Page, t: Text) {
  const at = await screenPoint(page, t.x + t.tile_offset_x + t.tile_w / 2, t.y + t.tile_offset_y + t.tile_h / 2);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator("textarea").first()).toBeVisible();
}

async function commitAway(page: Page) {
  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

/** The preview box's NW and SE corners, canvas px. */
async function previewBox(page: Page) {
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  return page.evaluate(([a, b]) => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    return { x0: (a.x + a.width / 2 - r.left) * k, x1: (b.x + b.width / 2 - r.left) * k };
  }, [nw, se] as const);
}

test("re-editing a text keeps ITS cell, then the panel goes back to the saved one", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, "Bottom center");
  const at = await screenPoint(page, AT.x, AT.y);
  await page.mouse.click(at.x, at.y);
  await page.locator("textarea").first().fill("HHHHHHHH\nHH");
  await commitAway(page);
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const [placed] = await texts(page);
  expect(placed.align).toBe(7);

  // The saved choice moves on; the text keeps its own.
  await pickCell(page, "Top left");
  await reopenAndCommit(page, placed);
  const grid = page.getByRole("region", { name: "Tool options" }).getByRole("radiogroup", { name: "Text in Box" });
  await expect(grid.getByRole("radio", { name: "Bottom center", exact: true }), "the panel shows this text's cell").toBeChecked();
  await commitAway(page);
  const [after] = await texts(page);
  expect(after.align, "committed unchanged, it stays bottom center").toBe(7);
  await expect(grid.getByRole("radio", { name: "Top left", exact: true }), "and the saved choice is back").toBeChecked();
});

test("a centered boxed text lands where its preview box was, and a re-edit doesn't move it", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  // A big size, where the old left-anchored mapping was furthest off.
  const size = page.getByRole("region", { name: "Tool options" }).getByRole("slider", { name: "Font Size" });
  await size.focus();
  for (let i = 0; i < 24; i++) await page.keyboard.press("ArrowRight");
  await pickCell(page, "Top center");
  const blank = await composite(page);
  const at = await screenPoint(page, AT.x, AT.y);
  await page.mouse.click(at.x, at.y);
  await page.locator("textarea").first().fill("HHHH\nHH");
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + 420 * scale, se.y + se.height / 2, { steps: 10 });
  await page.mouse.up();
  const box = await previewBox(page);
  await commitAway(page);
  const [t] = await texts(page);
  expect(t.align).toBe(1);
  const { bands } = await lineInk(page, blank, t);
  const mid = (bands[0][0] + bands[0][1] + 1) / 2;
  const boxMid = (box.x0 + box.x1) / 2;
  expect(Math.abs(mid - boxMid), `ink center ${mid} vs preview box center ${boxMid}`).toBeLessThanOrEqual(2);

  // Open it and commit unchanged: the inverse mapping puts it back exactly.
  await reopenAndCommit(page, t);
  await commitAway(page);
  expect((await texts(page))[0].x, "no drift on re-edit").toBe(t.x);
});

const savedCell = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}").textAlign);

/** Type a new text at canvas (x, y) with the Text tool and commit it. */
async function placeText(page: Page, x: number, y: number, body: string) {
  const at = await screenPoint(page, x, y);
  await page.mouse.click(at.x, at.y);
  await page.locator("textarea").first().fill(body);
  await commitAway(page);
}

test("re-aligning an old text doesn't change where the next new one starts (11-10 Q2)", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, "Top center");
  await placeText(page, 200, 150, "FIRST\nA");
  await placeText(page, 200, 500, "SECOND\nB");
  await expect.poll(async () => (await texts(page)).length).toBe(2);
  const [first, second] = (await texts(page)).sort((a, b) => a.y - b.y);
  expect(first.align, "Top center is cell 1").toBe(1);
  expect(second.align, "the second text starts where the first did").toBe(1);

  // Back to Left on the FIRST text only.
  await reopenAndCommit(page, first);
  await pickCell(page, "Top left");
  await commitAway(page);
  const grid = page.getByRole("region", { name: "Tool options" }).getByRole("radiogroup", { name: "Text in Box" });
  await expect.poll(async () => (await texts(page)).find((t) => t.y === first.y)?.align, "the edited text is Left now").toBe(0);
  expect(await savedCell(page), "the saved choice is untouched").toBe("top-center");
  await expect(grid.getByRole("radio", { name: "Top center", exact: true }), "the panel is back on it").toBeChecked();

  await placeText(page, 750, 150, "THIRD\nC");
  await expect.poll(async () => (await texts(page)).length).toBe(3);
  const third = (await texts(page)).find((t) => t.id !== first.id && t.id !== second.id && t.x > 600)!;
  expect(third.align, "the next new text still starts Center").toBe(1);
});

test("a new callout label starts centered, whatever Text in Box remembers (11-10 Q3)", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await pickCell(page, "Bottom right");

  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const p = await screenPoint(page, 300, 450);
  await page.mouse.click(p.x, p.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await expect(input).toBeFocused();
  await input.fill("Label");
  await input.press("Enter");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const [label] = await texts(page);
  expect(label.align, "middle center is cell 4").toBe(4);
  expect(await savedCell(page), "the Text tool's choice is untouched").toBe("bottom-right");

  // It can still be set to anything afterwards.
  await page.getByRole("radio", { name: "Pin", exact: true }).click();
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await reopenAndCommit(page, label);
  await pickCell(page, "Top left");
  await commitAway(page);
  await expect.poll(async () => (await texts(page))[0]?.align).toBe(0);
});

/** The preview's ink per line, as [lo, hi] canvas columns: a screenshot of the
 *  textarea (the overlay's frame and handles hidden, no caret) diffed against
 *  `before`, the same page before the text tool was clicked. */
async function previewInk(page: Page, before: Buffer): Promise<Array<[number, number]>> {
  const hide = await page.addStyleTag({ content: "svg[data-text-overlay]{visibility:hidden!important} textarea{caret-color:transparent!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const after = await page.screenshot();
  await hide.evaluate((el) => el.remove());
  return page.evaluate(async ([a, b]) => {
    const read = async (b64: string) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type: "image/png" }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height);
    };
    const [p, q] = [await read(a), await read(b)];
    const ta = document.querySelector("textarea")!.getBoundingClientRect();
    const cv = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    const r = cv.getBoundingClientRect();
    const k = cv.width / r.width;
    const bands: Array<[number, number]> = [];
    let cur: [number, number] | null = null;
    for (let y = Math.floor(ta.top); y < Math.ceil(ta.bottom); y++) {
      let lo = Infinity, hi = -Infinity;
      for (let x = Math.floor(ta.left); x < Math.ceil(ta.right); x++) {
        const i = (y * p.width + x) * 4;
        if (Math.abs(p.data[i] - q.data[i]) + Math.abs(p.data[i + 1] - q.data[i + 1]) + Math.abs(p.data[i + 2] - q.data[i + 2]) > 60) {
          lo = Math.min(lo, x); hi = Math.max(hi, x);
        }
      }
      if (lo <= hi) cur = cur ? [Math.min(cur[0], lo), Math.max(cur[1], hi)] : [lo, hi];
      else if (cur) { bands.push(cur); cur = null; }
    }
    if (cur) bands.push(cur);
    return bands.map(([lo, hi]) => [(lo - r.left) * k, (hi + 1 - r.left) * k] as [number, number]);
  }, [before.toString("base64"), after.toString("base64")] as const);
}

for (const [cell, align] of [["Top center", 1], ["Top right", 2]] as const) {
  test(`${cell} with no box: the committed lines land on the preview's, before and after a reload (11-11)`, async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Create", exact: true }).first().click();
    await page.getByRole("button", { name: "Text", exact: true }).first().click();
    // A big size: the drift grew with it (0.3 em at center, 0.6 em at right).
    const size = page.getByRole("region", { name: "Tool options" }).getByRole("slider", { name: "Font Size" });
    await size.focus();
    for (let i = 0; i < 24; i++) await page.keyboard.press("ArrowRight");
    await pickCell(page, cell);
    const blank = await composite(page);
    const before = await page.screenshot();
    const at = await screenPoint(page, AT.x, AT.y);
    await page.mouse.click(at.x, at.y);
    const input = page.locator("textarea").first();
    await input.fill("HHHHHHHH\nHH");
    await expect(input).toHaveCSS("text-align", align === 1 ? "center" : "right");
    const preview = await previewInk(page, before);
    expect(preview, "two preview lines").toHaveLength(2);

    await commitAway(page);
    await expect.poll(async () => (await texts(page)).length).toBe(1);
    const [t] = await texts(page);
    expect(t.align).toBe(align);
    expect(t.wrap_width, "no box").toBe(0);
    // The anchor the alignment keeps: a centered line's middle, a right
    // line's right edge. (The engine draws glyphs ~10% narrower than the
    // browser at the same size, PARKING_LOT 11-14, so a line's other edge
    // can't match until that is fixed.)
    // Right lands within 0.1 px. Center: the engine's block lands on the
    // textarea's content center within 0.5 px, but Chrome draws the centered
    // preview's ink ~1 px right of that center (measured 11-14: content
    // center 452.5, preview ink 453.5), so center gets the same 2 px the
    // boxed center test above allows. Before the fix both were ~17 px off.
    const tolerance = align === 1 ? 2 : 1;
    const mids = (bands: Array<[number, number]>) => bands.map(([lo, hi]) => (align === 1 ? (lo + hi) / 2 : hi));
    const want = mids(preview);
    const check = async (when: string) => {
      const { bands } = await lineInk(page, blank, (await texts(page))[0]);
      expect(bands, `two committed lines ${when}`).toHaveLength(2);
      const got = mids(bands.map(([lo, hi]) => [lo, hi + 1] as [number, number]));
      for (let i = 0; i < 2; i++)
        expect(Math.abs(got[i] - want[i]), `line ${i + 1} ${when}: ink ${align === 1 ? "middle" : "right edge"} ${got[i]} vs preview ${want[i].toFixed(1)}`).toBeLessThanOrEqual(tolerance);
    };
    await check("after the commit");
    await reloadAndResume(page, false);
    await check("after a reload");
  });
}
