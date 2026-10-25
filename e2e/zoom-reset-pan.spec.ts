import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Alt+0 puts the photo back home: 100% AND no pan (Night 10-24). It used to
// reset the zoom only, so a photo dragged aside with the hand (Space or H)
// stayed aside, half off the canvas area, with no key to bring it back. The
// pan was CanvasArea's local state and Alt+0's handler could not reach it.
//
// Real keys and a real mouse on the production build: zoom in with Alt+=,
// hold Space and drag, press Alt+0, and the canvas must sit exactly where it
// sat before any of it.

const PHOTO = join(__dirname, "fixtures", "paper-1200x900.png");

const canvas = (page: Page) => page.locator("canvas.main-canvas");
const box = async (page: Page) => (await canvas(page).boundingBox())!;

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  // No artboard margin, so the canvas is the photo's own 1200 px wide.
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
  await expect.poll(() => canvas(page).getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  // Panels slide in after an import, and the canvas shrinks and moves with
  // them. Home is where it comes to rest: the same box for a full second.
  let last = "";
  let same = 0;
  await expect.poll(async () => {
    const r = await box(page);
    const now = [r.x, r.y, r.width, r.height].map(Math.round).join(",");
    same = now === last ? same + 1 : 0;
    last = now;
    return same;
  }, { intervals: [250] }).toBeGreaterThanOrEqual(4);
}

/** Within a pixel of `home` on every side. */
async function expectAt(page: Page, home: { x: number; y: number; width: number; height: number }) {
  await expect.poll(async () => {
    const r = await box(page);
    return [r.x, r.y, r.width, r.height].map((v, i) => Math.abs(v - [home.x, home.y, home.width, home.height][i]) <= 1);
  }).toEqual([true, true, true, true]);
}

test("Alt+0 after a zoom and a Space-drag pan puts the photo back home at 100%", async ({ page }) => {
  await open(page);
  const home = await box(page);
  await expect(canvas(page)).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");

  await key(page, "Alt+Equal");
  await key(page, "Alt+Equal");
  await expect.poll(async () => (await box(page)).width).toBeGreaterThan(home.width * 1.2);
  const zoomed = await box(page);

  // The hand: hold Space, drag the photo up and to the left, let go.
  const [cx, cy] = [home.x + home.width / 2, home.y + home.height / 2];
  await page.keyboard.down("Space");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 180, cy - 120, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect.poll(async () => Math.round(zoomed.x - (await box(page)).x)).toBe(180);
  expect(Math.round(zoomed.y - (await box(page)).y)).toBe(120);

  await key(page, "Alt+0");
  await expectAt(page, home);
  await expect(canvas(page)).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
});

test("Alt+0 brings back a photo panned with a tapped H at 100% too", async ({ page }) => {
  await open(page);
  const home = await box(page);

  // Tap H: the hand stays on after the key comes up.
  await key(page, "h");
  const [cx, cy] = [home.x + home.width / 2, home.y + home.height / 2];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 90, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await box(page)).x - home.x)).toBe(140);
  await key(page, "h"); // second tap lets go of the hand

  await key(page, "Alt+0");
  await expectAt(page, home);
});
