import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// The text preview is the committed text (ADR-106).
//
// The engine sizes type by the face's ascent-to-descent HEIGHT (ab_glyph's
// `PxScale`), CSS by its em. Until ADR-106 the textarea used the tool's size as
// its CSS font-size, so its glyphs were ~10% wider than the ones the engine
// commits (Liberation Sans: HHHHHHHH at 48 was 268.6 px in the preview and
// 241 px committed), lines broke in different places in a box, and the text
// jumped up a few px on commit. The fix is on the PREVIEW side: the engine's
// drawing, and every saved text, is untouched.
//
// Every number here is measured, not computed: the preview's ink comes from a
// screenshot of the open textarea (its frame and handles hidden, no caret),
// the committed ink from the engine's composite. The viewport is wide enough
// that the canvas shows at exactly 1:1, so the two are on the same pixel grid
// and "within 1 px" means one screen pixel and one canvas pixel.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");

type Text = {
  id: number; x: number; y: number; align: number; wrap_width: number; box_height: number;
  tile_w: number; tile_h: number; tile_offset_x: number; tile_offset_y: number; font_size: number;
};
/** One line of ink: [left, right) columns and [top, bottom) rows, canvas px. */
type Band = [number, number, number, number];

async function open(page: Page) {
  // 2200 wide: the 1200 px canvas fits at exactly 1:1 (measured), so screen
  // and canvas pixels coincide.
  await page.setViewportSize({ width: 2200, height: 1400 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, canvasArtboard: false }));
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  expect(scale, "the canvas shows at 1:1").toBe(1);
}

async function textTool(page: Page) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
}

const panel = (page: Page) => page.getByRole("region", { name: "Tool options" });

/** Choose a face in the Text panel. Waits for it to be offered, which only
 *  happens once the engine has its bytes (`availableFaces`). */
async function pickFace(page: Page, label: string) {
  const select = panel(page).getByRole("combobox", { name: "Font Family" });
  await expect(select.locator("option", { hasText: label })).toHaveCount(1);
  await select.selectOption({ label });
}

/** The Font Size slider steps by 1 from its 24 default. */
async function setSize(page: Page, size: number) {
  const slider = panel(page).getByRole("slider", { name: "Font Size" });
  await slider.focus();
  for (let i = 24; i < size; i++) await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", new RegExp(`^${size}`));
}

async function pickCell(page: Page, cell: string) {
  const grid = panel(page).getByRole("radiogroup", { name: "Text in Box" });
  if (!(await grid.isVisible())) await panel(page).getByRole("button", { name: /^Text in Box/ }).first().click();
  await grid.getByRole("radio", { name: cell, exact: true }).click();
  await expect(grid.getByRole("radio", { name: cell, exact: true })).toBeChecked();
}

const texts = (page: Page): Promise<Text[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_text_annotations()));
const composite = (page: Page): Promise<number[]> =>
  page.evaluate(async () => Array.from(await window.__annotationTool.get_image_data()));
const compositeHash = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const px = await window.__annotationTool.get_image_data();
    const d = await crypto.subtle.digest("SHA-256", new Uint8Array(px));
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
  });

/** Bands of rows with ink, scanning columns [x0, x1) and rows [y0, y1). */
function bandsOf(changed: (x: number, y: number) => boolean, x0: number, x1: number, y0: number, y1: number): Band[] {
  const bands: Band[] = [];
  let cur: Band | null = null;
  for (let y = y0; y < y1; y++) {
    let lo = Infinity, hi = -Infinity;
    for (let x = x0; x < x1; x++) if (changed(x, y)) { lo = Math.min(lo, x); hi = Math.max(hi, x + 1); }
    if (lo < hi) cur = cur ? [Math.min(cur[0], lo), Math.max(cur[1], hi), cur[2], y + 1] : [lo, hi, y, y + 1];
    else if (cur) { bands.push(cur); cur = null; }
  }
  if (cur) bands.push(cur);
  return bands;
}

/** The committed ink of `t`, one band per line, from the engine's composite. */
async function committedInk(page: Page, blank: number[], t: Text): Promise<Band[]> {
  const now = await composite(page);
  const changed = (x: number, y: number) => {
    const i = (y * 1200 + x) * 4;
    return Math.abs(now[i] - blank[i]) + Math.abs(now[i + 1] - blank[i + 1]) + Math.abs(now[i + 2] - blank[i + 2]) > 60;
  };
  const x0 = t.x + t.tile_offset_x;
  const y0 = t.y + t.tile_offset_y;
  return bandsOf(changed, Math.max(0, x0), Math.min(1200, x0 + t.tile_w), Math.max(0, y0), Math.min(900, y0 + t.tile_h));
}

/** The preview's ink, one band per line, canvas px: a screenshot of the open
 *  textarea (every SVG overlay hidden, no caret) against `before`, the
 *  same page before the text was there. Scans `margin` px around the
 *  textarea, so a preview that is drawn outside its own element still counts. */
async function previewInk(page: Page, before: Buffer, margin = 40): Promise<Band[]> {
  // Over empty canvas, so the Text tool's hover outline (a dashed div around
  // the text under the pointer) is gone.
  const empty = await screenPoint(page, 1150, 870);
  await page.mouse.move(empty.x, empty.y, { steps: 4 });
  // Every SVG overlay hidden, not just the text's own frame: opening a text
  // also makes it the Align target, whose dashed outline would read as ink.
  const hide = await page.addStyleTag({ content: "svg{visibility:hidden!important} textarea{caret-color:transparent!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const after = await page.screenshot();
  await hide.evaluate((el) => el.remove());
  return page.evaluate(async ([a, b, m]) => {
    const read = async (b64: string) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type: "image/png" }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, bmp.width, bmp.height);
    };
    const [p, q] = [await read(a as string), await read(b as string)];
    const ta = document.querySelector("textarea")!.getBoundingClientRect();
    const r = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!.getBoundingClientRect();
    const out: Array<[number, number, number, number]> = [];
    let cur: [number, number, number, number] | null = null;
    const top = Math.max(Math.floor(ta.top) - (m as number), Math.ceil(r.top));
    const bottom = Math.min(Math.ceil(ta.bottom) + (m as number), Math.floor(r.bottom));
    const left = Math.max(Math.floor(ta.left) - (m as number), Math.ceil(r.left));
    const right = Math.min(Math.ceil(ta.right) + (m as number), Math.floor(r.right));
    for (let y = top; y < bottom; y++) {
      let lo = Infinity, hi = -Infinity;
      for (let x = left; x < right; x++) {
        const i = (y * p.width + x) * 4;
        if (Math.abs(p.data[i] - q.data[i]) + Math.abs(p.data[i + 1] - q.data[i + 1]) + Math.abs(p.data[i + 2] - q.data[i + 2]) > 60) {
          lo = Math.min(lo, x); hi = Math.max(hi, x + 1);
        }
      }
      if (lo < hi) cur = cur ? [Math.min(cur[0], lo), Math.max(cur[1], hi), cur[2], y + 1] : [lo, hi, y, y + 1];
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    // The canvas is at 1:1 (checked in `open`), so this is a translation.
    return out.map(([x0, x1, y0, y1]) => [x0 - r.left, x1 - r.left, y0 - r.top, y1 - r.top]);
  }, [after.toString("base64"), before.toString("base64"), margin] as const) as Promise<Band[]>;
}

/** Commit whatever is open by clicking empty canvas, then close the fresh
 *  input that click opens. */
async function commitAway(page: Page) {
  const away = await screenPoint(page, 1150, 870);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

const fmt = (b: Band) => `x ${b[0]}..${b[1]} (w ${b[1] - b[0]}), y ${b[2]}..${b[3]}`;

/** Every line's four ink edges, preview against committed, within `tol` px. */
function expectSameInk(preview: Band[], committed: Band[], what: string, tol = 1) {
  expect.soft(preview.length, `${what}: preview lines ${preview.map(fmt).join(" | ")} vs committed ${committed.map(fmt).join(" | ")}`).toBe(committed.length);
  for (let i = 0; i < Math.min(preview.length, committed.length); i++) {
    const [p, c] = [preview[i], committed[i]];
    const say = `${what}, line ${i + 1}: preview ${fmt(p)} vs committed ${fmt(c)}`;
    expect.soft(Math.abs(p[0] - c[0]), `${say} — left edge`).toBeLessThanOrEqual(tol);
    expect.soft(Math.abs(p[1] - c[1]), `${say} — right edge`).toBeLessThanOrEqual(tol);
    expect.soft(Math.abs(p[2] - c[2]), `${say} — top`).toBeLessThanOrEqual(tol);
    expect.soft(Math.abs(p[3] - c[3]), `${say} — bottom`).toBeLessThanOrEqual(tol);
  }
}

const FACES = [
  { id: "", label: "Liberation Sans" },
  { id: "liberation-serif", label: "Liberation Serif" },
  { id: "liberation-mono", label: "Liberation Mono" },
] as const;

// Each size on its own band of the canvas, far enough apart that one text's
// preview window never reaches another text.
const SIZES = [
  { size: 24, y: 60 },
  { size: 48, y: 200 },
  { size: 96, y: 430 },
] as const;

for (const face of FACES) {
  test(`HHHHHHHH in ${face.label} at 24, 48 and 96: the preview's ink is the committed ink, and re-editing moves nothing`, async ({ page }) => {
    await open(page);
    await textTool(page);
    await pickFace(page, face.label);
    const blank = await composite(page);
    const before = await page.screenshot();
    // Committed straight through the engine, so 96 (past the panel's 72) is
    // reachable; opening each one is then the re-edit path.
    const ids = await page.evaluate(async ([fid, sizes]) => {
      const tool = window.__annotationTool;
      const out: number[] = [];
      for (const { size, y } of sizes as Array<{ size: number; y: number }>)
        out.push(await tool.add_text_annotation("HHHHHHHH", size, 0, 0, 0, false, 60, y, 0, 0, 255, 255, 255, 255, 8, 8, 135, fid as string));
      await tool.recomposite();
      return out;
    }, [face.id, SIZES] as const);

    for (let n = 0; n < SIZES.length; n++) {
      const { size } = SIZES[n];
      const t = (await texts(page)).find((a) => a.id === ids[n])!;
      const committed = await committedInk(page, blank, t);
      expect(committed, "one line committed").toHaveLength(1);
      const hash = await compositeHash(page);

      const at = await screenPoint(page, t.x + t.tile_w / 2, t.y + t.tile_h / 2);
      await page.mouse.click(at.x, at.y);
      await expect(page.locator("textarea").first()).toHaveValue("HHHHHHHH");
      const preview = await previewInk(page, before);
      console.log(`[text-preview-size] ${JSON.stringify({ face: face.label, size, preview, committed })}`);
      expectSameInk(preview, committed, `${face.label} ${size}`);
      if (preview.length === 1)
        expect.soft(Math.abs((preview[0][1] - preview[0][0]) - (committed[0][1] - committed[0][0])), `${face.label} ${size}: ink width`).toBeLessThanOrEqual(1);

      // Commit it unchanged: the same place, the same pixels.
      await commitAway(page);
      const back = (await texts(page)).find((a) => a.id === ids[n])!;
      expect.soft([back.x, back.y, back.font_size], `${face.label} ${size}: re-edit moved it`).toEqual([t.x, t.y, t.font_size]);
      expect.soft(await compositeHash(page), `${face.label} ${size}: re-edit changed the pixels`).toBe(hash);
    }
  });
}

const AT = { x: 300, y: 250 };
const CELLS = [
  "Top left", "Top center", "Top right",
  "Middle left", "Center", "Middle right",
  "Bottom left", "Bottom center", "Bottom right",
] as const;

// One test per cell: a single test looping all nine ran past its 4 min budget
// on the CI runner (every cell's edges passed; the clean-up after the last did not).
for (const boxed of [false, true]) {
  for (const cell of CELLS) {
    test(`Liberation Sans 48, Text in Box ${cell}${boxed ? ", in a 300 x 240 box" : ", no box"}: the commit lands on the preview`, async ({ page }) => {
      test.setTimeout(90_000);
      await open(page);
      await textTool(page);
      await setSize(page, 48);
      await pickCell(page, cell);
      const blank = await composite(page);
      const before = await page.screenshot();
      const at = await screenPoint(page, AT.x, AT.y);
      await page.mouse.click(at.x, at.y);
      const input = page.locator("textarea").first();
      await input.fill("HHHHHHHH\nHH");
      if (boxed) {
        const corners = page.locator('rect[style*="nwse-resize"]');
        const nw = (await corners.nth(0).boundingBox())!;
        const se = (await corners.nth(1).boundingBox())!;
        await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
        await page.mouse.down();
        await page.mouse.move(nw.x + nw.width / 2 + 300, nw.y + nw.height / 2 + 240, { steps: 10 });
        await page.mouse.up();
      }
      const preview = await previewInk(page, before);
      await commitAway(page);
      await expect.poll(async () => (await texts(page)).length).toBe(1);
      const [t] = await texts(page);
      expect(t.wrap_width > 0, "boxed or not, as set up").toBe(boxed);
      const committed = await committedInk(page, blank, t);
      console.log(`[text-preview-size] ${JSON.stringify({ cell, boxed, preview, committed })}`);
      expectSameInk(preview, committed, `${cell}${boxed ? " boxed" : ""}`);
    });
  }
}

test("a paragraph in a 300 px box breaks into the same lines in the preview and the commit", async ({ page }) => {
  await open(page);
  await textTool(page);
  await setSize(page, 32);
  const blank = await composite(page);
  const before = await page.screenshot();
  const at = await screenPoint(page, 200, 200);
  await page.mouse.click(at.x, at.y);
  // Short first, so the box's corner is on screen to drag; then the paragraph.
  const input = page.locator("textarea").first();
  await input.fill("The quick");
  const corners = page.locator('rect[style*="nwse-resize"]');
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + 300, se.y + se.height / 2, { steps: 10 });
  await page.mouse.up();
  await input.fill(
    "The quick brown fox jumps over the lazy dog while five boxing wizards jump quickly and Jim fixes the tired jukebox.",
  );
  const preview = await previewInk(page, before);
  await commitAway(page);
  const [t] = await texts(page);
  expect(Math.abs(t.wrap_width - 300), `box ${t.wrap_width}`).toBeLessThanOrEqual(1);
  const committed = await committedInk(page, blank, t);
  console.log(`[text-preview-size] ${JSON.stringify({ paragraph: true, preview, committed })}`);
  expect(committed.length, "the paragraph wraps").toBeGreaterThan(3);
  // The same breaks: the same number of lines, and each line the same width
  // at the same place. A word moved to another line changes both.
  expectSameInk(preview, committed, "paragraph");
});

test("a rotated text opens on its committed pixels", async ({ page }) => {
  await open(page);
  await textTool(page);
  const blank = await composite(page);
  const before = await page.screenshot();
  const id = await page.evaluate(async () => {
    const tool = window.__annotationTool;
    const n = await tool.add_text_annotation("HHHHHHHH", 48, 0, 0, 0, false, 300, 300, 30, 0, 255, 255, 255, 255, 8, 8, 135, "");
    await tool.recomposite();
    return n;
  });
  const t = (await texts(page)).find((a) => a.id === id)!;
  const committed = await committedInk(page, blank, t);
  const at = await screenPoint(page, t.x + t.tile_offset_x + t.tile_w / 2, t.y + t.tile_offset_y + t.tile_h / 2);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator("textarea").first()).toHaveValue("HHHHHHHH");
  const preview = await previewInk(page, before, 120);
  console.log(`[text-preview-size] ${JSON.stringify({ rotated: 30, preview, committed })}`);
  // A rotated line is one band from its top corner to its bottom one: its
  // extents are the four edges of the rotated ink.
  const extent = (b: Band[]): Band => [
    Math.min(...b.map((x) => x[0])), Math.max(...b.map((x) => x[1])),
    Math.min(...b.map((x) => x[2])), Math.max(...b.map((x) => x[3])),
  ];
  expectSameInk([extent(preview)], [extent(committed)], "rotated 30°");
});
