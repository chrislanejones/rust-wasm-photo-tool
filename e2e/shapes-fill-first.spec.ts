import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Shapes are FILL FIRST (ADR-107, 11-19-2026), through the real UI and a real
// mouse, on the production build:
//
//   1. a new rectangle is filled with the palette's first color and has NO
//      stroke — in the annotation, and in the pixels (no outline ring);
//   2. the Fill Color palette is the panel's first control and recolors it;
//   3. the Stroke dropdown is shut at "None", and picking a Stroke Color
//      turns the stroke on;
//   4. none of that is the arrow's stroke: the next arrow is still drawn;
//   5. an outline-only shape from before this (seeded straight into the
//      engine, since no panel can make one now) reselects with its own style,
//      and picking a Fill Color fills it without touching its stroke;
//   6. a strokeless shape is one undo step and survives a reload as one.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const W = 1200;

type Shape = {
  id: number; kind: number; x0: number; y0: number; x1: number; y1: number;
  r: number; g: number; b: number; stroke_width: number;
  fill_kind: number; fill_r: number; fill_g: number; fill_b: number;
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
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe(String(W));
  await installAnnotationProbe(page);
}

const shapes = (page: Page): Promise<Shape[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()));

/** The composite's RGB at each canvas point — what the canvas shows. */
const pixels = (page: Page, points: [number, number][]): Promise<number[][]> =>
  page.evaluate(async ([pts, w]) => {
    const px = await window.__annotationTool.get_image_data();
    return (pts as [number, number][]).map(([x, y]) => {
      const i = (y * (w as number) + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    });
  }, [points, W] as const);

async function shapesTab(page: Page, tab: "Shapes" | "Arrows & Diagram Shapes" = "Shapes") {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: tab, exact: true }).first().click();
}

async function drag(page: Page, x0: number, y0: number, x1: number, y1: number) {
  const a = await screenPoint(page, x0, y0);
  const b = await screenPoint(page, x1, y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

/** The edit box of the shape in hand (the action bar carries the marker too).
 *
 *  NOT `data-settling`: a commit leaves a click-through copy of the box on
 *  screen, with the same `data-draw-overlay` marker, until the engine has drawn
 *  the shape, so the old locator could pass before the click's (asynchronous)
 *  reselect had finished. Tightened 11-21-2026. It was not the cause of the
 *  CI failures of these tests; that was an app race, pinned by the last test
 *  in this file. */
const editBox = (page: Page) => page.locator("svg[data-draw-overlay]:not([data-settling])").first();
const swatch = (page: Page, group: string, n: number) =>
  page.getByRole("radiogroup", { name: group, exact: true }).getByRole("radio").nth(n);
const strokeHeader = (page: Page) => page.locator('[data-slot="collapsible"] > div > button', { hasText: "Stroke" });

/** The panel's control-row labels that are on screen, top to bottom. */
const visibleRows = (page: Page) =>
  page.locator('[data-draw-panel] [data-slot="control-row"] [data-slot="label"]')
    .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.textContent?.trim()));

// The box every test draws, and where it is sampled: its middle, the pixel
// row and column a stroke would sit on, and bare paper 12 px outside.
const BOX = [300, 250, 620, 470] as const;
const MIDDLE: [number, number] = [460, 360];
const ON_EDGE: [number, number][] = [[460, 251], [301, 360], [460, 469], [619, 360]];
const OUTSIDE: [number, number][] = [[460, 238], [288, 360], [460, 482], [632, 360]];

test("a new rectangle is its Fill Color and nothing else: no stroke, one undo, and a reload keeps it", async ({ page }) => {
  await open(page);
  await shapesTab(page);

  // Palette first; Stroke shut at None.
  expect(await visibleRows(page)).toEqual(["Fill Color", "Corner Radius", "Sloppiness"]);
  await expect(strokeHeader(page)).toHaveAttribute("aria-expanded", "false");
  await expect(strokeHeader(page)).toContainText("None");
  // The palette's second color, red, is the one checked — not white, which a
  // blank canvas would swallow.
  await expect(swatch(page, "Fill Color", 1)).toBeChecked();

  const paper = await pixels(page, OUTSIDE);
  await drag(page, ...BOX);
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(1);
  const [red] = await shapes(page);
  expect(red).toMatchObject({ kind: 0, stroke_width: 0, fill_kind: 1, fill_r: 0xef, fill_g: 0x44, fill_b: 0x44 });
  // Filled edge to edge with the fill, and no ink outside the box.
  expect(await pixels(page, [MIDDLE, ...ON_EDGE])).toEqual(Array(5).fill([0xef, 0x44, 0x44]));
  expect(await pixels(page, OUTSIDE)).toEqual(paper);

  // One undo step, and it comes back as it was.
  await key(page, "Control+z");
  await expect.poll(async () => (await shapes(page)).length).toBe(0);
  await key(page, "Control+Shift+z");
  await expect.poll(() => shapes(page)).toEqual([red]);

  // Reselect it (its middle is the shape now) and recolor it from the palette.
  const mid = await screenPoint(page, ...MIDDLE);
  await page.mouse.click(mid.x, mid.y);
  await expect(editBox(page)).toBeAttached();
  await swatch(page, "Fill Color", 4).click(); // green, #22c55e
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page))[0]?.fill_r).toBe(0x22);
  const [green] = await shapes(page);
  expect(green).toMatchObject({ id: red.id, stroke_width: 0, fill_kind: 1, fill_r: 0x22, fill_g: 0xc5, fill_b: 0x5e });
  expect(await pixels(page, [MIDDLE, ...ON_EDGE])).toEqual(Array(5).fill([0x22, 0xc5, 0x5e]));
  expect(await pixels(page, OUTSIDE)).toEqual(paper);

  // Past the autosave, a reload resumes the same strokeless shape.
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe(String(W));
  await installAnnotationProbe(page);
  await expect.poll(() => shapes(page)).toEqual([green]);
  expect(await pixels(page, [MIDDLE, ...ON_EDGE])).toEqual(Array(5).fill([0x22, 0xc5, 0x5e]));
  expect(await pixels(page, OUTSIDE)).toEqual(paper);
});

test("Stroke opens to Stroke Color then Stroke Width; a color turns it on; the arrow's stroke is its own", async ({ page }) => {
  await open(page);
  await shapesTab(page);
  await strokeHeader(page).click();
  expect(await visibleRows(page)).toEqual([
    "Fill Color", "Corner Radius", "Sloppiness", "Stroke Color", "Stroke Width",
  ]);
  await expect(page.getByRole("slider", { name: "Stroke Width" })).toHaveAttribute("aria-valuetext", "None");

  // Blue (#3b82f6), the sixth swatch: the stroke goes from None to 2 px.
  await swatch(page, "Stroke Color", 5).click();
  await expect(page.getByRole("slider", { name: "Stroke Width" })).toHaveAttribute("aria-valuetext", "2");
  await page.getByRole("radio", { name: "Stroke Width 8" }).click();

  await drag(page, ...BOX);
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(1);
  const [boxed] = await shapes(page);
  expect(boxed).toMatchObject({
    kind: 0, stroke_width: 8, r: 0x3b, g: 0x82, b: 0xf6, fill_kind: 1, fill_r: 0xef, fill_g: 0x44, fill_b: 0x44,
  });
  // The stroke is drawn, over the (default red) fill.
  expect(await pixels(page, [MIDDLE, [460, 250], [300, 360]])).toEqual([
    [0xef, 0x44, 0x44], [0x3b, 0x82, 0xf6], [0x3b, 0x82, 0xf6],
  ]);

  // Shut, the header says what is on.
  await strokeHeader(page).click();
  await expect(strokeHeader(page)).toContainText("8 px");

  // The Arrows tab leads with Stroke Color, then Stroke Width — and it is a
  // different stroke: still the default red 3, not the square's blue 8, and
  // never None.
  await shapesTab(page, "Arrows & Diagram Shapes");
  const rows = await visibleRows(page);
  expect(rows.slice(rows.indexOf("Stroke Color"), rows.indexOf("Stroke Color") + 2))
    .toEqual(["Stroke Color", "Stroke Width"]);
  await drag(page, 700, 600, 1000, 760);
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(2);
  const arrow = (await shapes(page)).find((s) => s.kind === 4)!;
  expect(arrow).toMatchObject({ stroke_width: 3, r: 0xef, g: 0x44, b: 0x44, fill_kind: 0 });
});

test("an outline-only shape from before keeps its style, and a Fill Color fills it", async ({ page }) => {
  await open(page);
  // What every rectangle drawn before today is: no fill, a red 4 px stroke.
  const id = await page.evaluate(async ([x0, y0, x1, y1]) => {
    const t = window.__annotationTool;
    const id = await t.add_shape_annotation(0, x0, y0, x1, y1, "#e02020", 4, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4));
    await t.recomposite();
    return id;
  }, BOX);
  await shapesTab(page);

  // Its empty middle is not the shape; its outline is.
  const edge = await screenPoint(page, BOX[0], MIDDLE[1]);
  await page.mouse.click(edge.x, edge.y);
  await expect(editBox(page)).toBeAttached();
  // The panel shows ITS style: no fill — the transparent swatch is the one
  // checked — and a 4 px stroke.
  const lit = page.getByRole("radiogroup", { name: "Fill Color", exact: true }).locator('[aria-checked="true"]');
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAttribute("aria-label", "Transparent (checkerboard)");
  await expect(strokeHeader(page)).toContainText("4 px");
  // Committing it untouched changes nothing.
  await key(page, "Enter");
  expect((await shapes(page))[0]).toMatchObject({ id, stroke_width: 4, fill_kind: 0 });

  // Reselect, pick a Fill Color: it is filled, and its stroke is still its own.
  await page.mouse.click(edge.x, edge.y);
  await expect(editBox(page)).toBeAttached();
  await swatch(page, "Fill Color", 3).click(); // yellow, #eab308
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page))[0]?.fill_kind).toBe(1);
  expect((await shapes(page))[0]).toMatchObject({
    id, stroke_width: 4, r: 0xe0, g: 0x20, b: 0x20, fill_kind: 1, fill_r: 0xea, fill_g: 0xb3, fill_b: 0x08,
  });
  expect(await pixels(page, [MIDDLE])).toEqual([[0xea, 0xb3, 0x08]]);
});

test("a Fill Color picked with nothing in hand is the next square's fill, and the one after", async ({ page }) => {
  await open(page);
  await shapesTab(page);
  // Nothing drawn yet: pick green (not the red default).
  await swatch(page, "Fill Color", 4).click(); // green, #22c55e
  await drag(page, ...BOX);
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(1);
  // A second square, away from the first, keeps the pick.
  await drag(page, 700, 250, 900, 420);
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(2);
  for (const s of await shapes(page)) {
    expect(s).toMatchObject({ stroke_width: 0, fill_kind: 1, fill_r: 0x22, fill_g: 0xc5, fill_b: 0x5e });
  }
});

// A Fill Color pick on a reselected shape, with Enter arriving before React has
// rendered the pick. The restyle effect delivers a panel change on the next
// render; Enter is a window listener, and on a loaded CI runner Chrome ran it
// first, so the shape kept its old fill while the panel showed the new one
// (CI 11-20 and 11-21-2026). The swatch click and the Enter keydown fire in ONE
// task here, which makes that order certain: 3 of 3 failed before the fix.
test("a Fill Color picked and Enter pressed in the same moment still recolors the reselected shape", async ({ page }) => {
  await open(page);
  await shapesTab(page);
  await drag(page, ...BOX);
  await key(page, "Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(1);
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
  const mid = await screenPoint(page, ...MIDDLE);
  await page.mouse.click(mid.x, mid.y);
  await expect(page.locator("svg[data-draw-overlay]:not([data-settling])").first()).toBeAttached();
  const green = await swatch(page, "Fill Color", 4).elementHandle(); // not the red default
  await green!.evaluate((el) => {
    (el as HTMLElement).click();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await expect.poll(async () => (await shapes(page))[0]?.fill_r).toBe(0x22);
  expect((await shapes(page))[0]).toMatchObject({ stroke_width: 0, fill_kind: 1, fill_r: 0x22, fill_g: 0xc5, fill_b: 0x5e });
});
