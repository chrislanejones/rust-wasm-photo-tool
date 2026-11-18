import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Batch › Masonry: the open photo fills its tile like every other photo
// (qc-1113, docs/qc/qc-1113.md). It used to sit inset in its tile: the live
// canvas kept the editor's 32px canvas margin, and a photo smaller than its
// tile stayed at its own size, while every other tile's thumbnail filled.
// The orange ring that marks the open photo stays.
//
// What is measured, with getBoundingClientRect: each photo's image box (the
// <canvas> or <img> element) against its tile's box inside any border. Within
// 0.5 px = filled. For the open photo the DRAWN box (the pixels after
// object-fit: contain) must fill the tile too, so a canvas that fills its tile
// but letterboxes the photo inside it does not pass. (A thumbnail's drawn box
// can sit up to ~0.7 px in from its tile: the tile is the photo's shape
// OUTSIDE a 1px border, so the inside is a hair off that shape. Not this bug.)
//
// The Grid is checked too: its cells are fixed shapes, so a thumbnail is
// contained in its cell rather than filling it, and that is unchanged, as is
// the open photo (the 2 × 2 corner) keeping its 32px canvas margin.
//
// Fixtures are synthetic: sky-building.png 1200×800, paper-1200x900.png,
// checker.png 256×256 (smaller than a Masonry tile at 1280 wide).
// SHOTS=<dir> SHOT_TAG=<before|after> writes the open tile at 1280 wide.

const FIXTURES = ["sky-building.png", "paper-1200x900.png", "checker.png"].map((f) => join(__dirname, "fixtures", f));

type Box = { left: number; top: number; width: number; height: number };
type Measured = { name: string; tile: Box; image: Box; drawn: Box };

async function openBatch(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  // No artboard, so the canvas is the photo itself (the artboard is part of
  // the document, and would sit inside the canvas).
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURES);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(3);
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await expect(page.getByTestId("batch-grid-bar")).toBeVisible();
}

async function openPhoto(page: Page, name: string, width: number): Promise<void> {
  await page.locator(`[aria-label="Select photo ${name}"]`).first().click();
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), { timeout: 30_000 })
    .toBe(width);
}

async function setLayout(page: Page, layout: "Grid" | "Masonry"): Promise<void> {
  const button = page.getByTestId("batch-grid-bar").getByRole("button", { name: `${layout} view` });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

/** Every photo on the Batch canvas: its tile's box (inside the border) and
 *  the box its pixels are drawn in. */
async function measure(page: Page): Promise<Measured[]> {
  return page.locator(".canvas-grid-host").evaluate((host) => {
    const r = (b: DOMRect) => ({ left: b.left, top: b.top, width: b.width, height: b.height });
    const inner = (el: Element) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const bl = parseFloat(s.borderLeftWidth);
      const bt = parseFloat(s.borderTopWidth);
      return {
        left: b.left + bl,
        top: b.top + bt,
        width: b.width - bl - parseFloat(s.borderRightWidth),
        height: b.height - bt - parseFloat(s.borderBottomWidth),
      };
    };
    // object-fit: contain draws inside the element's box at the natural shape.
    const drawn = (el: HTMLCanvasElement | HTMLImageElement) => {
      const b = r(el.getBoundingClientRect());
      const nw = el instanceof HTMLCanvasElement ? el.width : el.naturalWidth;
      const nh = el instanceof HTMLCanvasElement ? el.height : el.naturalHeight;
      if (getComputedStyle(el).objectFit !== "contain" || !nw || !nh) return b;
      const s = Math.min(b.width / nw, b.height / nh);
      const w = nw * s;
      const h = nh * s;
      return { left: b.left + (b.width - w) / 2, top: b.top + (b.height - h) / 2, width: w, height: h };
    };
    const out: { name: string; tile: Box; image: Box; drawn: Box }[] = [];
    const hero = host.querySelector(".canvas-grid-hero")!;
    const canvas = hero.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    out.push({ name: "(open photo)", tile: inner(hero), image: r(canvas.getBoundingClientRect()), drawn: drawn(canvas) });
    for (const img of host.querySelectorAll<HTMLImageElement>("button[aria-label] img")) {
      const tile = img.closest("button")!.parentElement!;
      out.push({ name: img.alt, tile: inner(tile), image: r(img.getBoundingClientRect()), drawn: drawn(img) });
    }
    return out;
  });
}

/** The largest gap between a tile's edge and its image's edge, in px. */
function inset(m: Measured, which: "image" | "drawn" = "image"): number {
  const { tile: t, [which]: i } = m;
  return Math.max(
    Math.abs(i.left - t.left),
    Math.abs(i.top - t.top),
    Math.abs(i.left + i.width - (t.left + t.width)),
    Math.abs(i.top + i.height - (t.top + t.height)),
  );
}

const thumbsDecoded = (page: Page) =>
  page.locator(".canvas-grid-host button[aria-label] img").evaluateAll((imgs) =>
    imgs.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length);

async function shoot(page: Page, name: string): Promise<void> {
  const dir = process.env.SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const tag = process.env.SHOT_TAG ?? "shot";
  await page.screenshot({ path: join(dir, `${name}-${tag}.png`) });
  await page.locator(".canvas-grid-hero").screenshot({ path: join(dir, `${name}-tile-${tag}.png`) });
}

test("Masonry: the open photo fills its tile like the others, and keeps its ring", async ({ page }) => {
  await openBatch(page);
  await setLayout(page, "Masonry");
  for (const [name, width, aspect] of [["sky-building", 1200, 1.5], ["checker", 256, 1]] as const) {
    await openPhoto(page, name, width);
    await expect.poll(() => thumbsDecoded(page)).toBe(2);
    // Let the open tile settle at its photo's shape (aspect-ratio) first.
    await expect
      .poll(async () => { const t = (await measure(page))[0].tile; return Math.round((t.width / t.height) * 100) / 100; })
      .toBe(aspect);
    if (name === "sky-building") await shoot(page, "masonry-open-1280");

    const all = await measure(page);
    console.log(`masonry, ${name} open: inset px (box/drawn) ${all.map((m) => `${m.name}=${inset(m).toFixed(2)}/${inset(m, "drawn").toFixed(2)}`).join(", ")}`);
    expect(all).toHaveLength(3);
    for (const m of all) {
      expect.soft(inset(m), `${name} open: ${m.name} image ${JSON.stringify(m.image)} in tile ${JSON.stringify(m.tile)}`)
        .toBeLessThan(0.5);
    }
    expect.soft(inset(all[0], "drawn"), `${name} open: drawn ${JSON.stringify(all[0].drawn)}`).toBeLessThan(0.5);

    // The ring stays: a 2px orange ring around the open photo's tile.
    const hero = page.locator(".canvas-grid-hero");
    await expect(hero).toHaveClass(/\bring-2\b/);
    expect(await hero.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/0px 0px 0px 2px/);
    await expect(hero.getByText("Selected", { exact: true })).toBeVisible();
  }
});

test("Grid: the tiles fill theirs, and the open photo keeps its canvas margin", async ({ page }) => {
  await openBatch(page);
  await setLayout(page, "Grid");
  await openPhoto(page, "sky-building", 1200);
  await expect.poll(() => thumbsDecoded(page)).toBe(2);
  const [hero, ...tiles] = await measure(page);
  expect(tiles).toHaveLength(2);
  for (const m of tiles) {
    // The <img> fills its cell and draws the photo contained in it.
    expect(inset(m), `${m.name} image ${JSON.stringify(m.image)} in tile ${JSON.stringify(m.tile)}`).toBeLessThan(0.5);
    const { tile: t, drawn: d } = m;
    expect(Math.min(t.width - d.width, t.height - d.height), `${m.name} contained`).toBeLessThan(0.5);
  }
  // Unchanged: the 2 × 2 corner draws the photo inside the 32px canvas margin.
  const pad = await page.locator(".canvas-grid-hero .canvas-wrapper").evaluate((el) => getComputedStyle(el).paddingTop);
  expect(pad).toBe("32px");
  console.log(`grid: inset px (box/drawn) ${[hero, ...tiles].map((m) => `${m.name}=${inset(m).toFixed(2)}/${inset(m, "drawn").toFixed(2)}`).join(", ")}`);
  expect(inset(hero)).toBeGreaterThan(31.5);
});
