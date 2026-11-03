import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// The narrow repro for photo-switch-state §0.5 ("bounce"), which failed about
// 1 run in 12 on master: edited A, click B, click A again, and the canvas ends
// on B's picture while A is the lit photo. Whatever you do next edits what you
// think is A while you are looking at B.
//
// The race: B's load gets past its last stale check (it is committed to
// replacing the document), and only THEN does the click back to A run. That
// click reads the ownership marker, which still says A because B's load has not
// claimed yet, so it decides "A is already loaded" and does nothing. B's load
// then lands. lib/testHold.ts ("load-committed") holds B's load at exactly that point, so the
// race happens every run here instead of now and then.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

type Print = { w: number; h: number; rgb: [number, number, number] };

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Size + mean color of the main canvas (same probe as photo-switch-state). */
const print = (page: Page): Promise<Print | null> =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c || c.width === 0) return null;
    const o = document.createElement("canvas");
    o.width = 16;
    o.height = 16;
    const ctx = o.getContext("2d")!;
    ctx.drawImage(c, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      s[0] += d[i]!;
      s[1] += d[i + 1]!;
      s[2] += d[i + 2]!;
    }
    const n = d.length / 4;
    return { w: c.width, h: c.height, rgb: [s[0] / n, s[1] / n, s[2] / n] as [number, number, number] };
  });

const same = (a: Print | null, b: Print | null, tol = 2) =>
  !!a && !!b && a.w === b.w && a.h === b.h && a.rgb.every((v, i) => Math.abs(v - b.rgb[i]!) <= tol);

const fmt = (p: Print | null) => (p ? `${p.w}x${p.h} rgb(${p.rgb.map((v) => v.toFixed(1)).join(",")})` : "none");

async function settled(page: Page): Promise<Print | null> {
  let last: Print | null = null;
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    await page.waitForTimeout(300);
    const p = await print(page);
    stable = same(p, last, 0.01) ? stable + 1 : 0;
    last = p;
  }
  return last;
}

async function key(page: Page, k: "PageDown" | "PageUp") {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(k);
}

const activeThumb = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[aria-label^="Select photo"]')].findIndex((t) => t.getAttribute("aria-pressed") === "true"),
  );

test.setTimeout(180_000);

test("B's load lands after the click back to A: A is still what you see", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  const a0 = await settled(page);
  await key(page, "PageDown");
  const b0 = await settled(page);
  await key(page, "PageUp");
  await settled(page);
  expect(a0 && b0 && (a0.w !== b0.w || a0.h !== b0.h), "the two fixtures are told apart by size").toBeTruthy();

  // Edit A, as §0.5 does, so the click to B has an outgoing save to make.
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Adjustments", exact: true }).first().click();
  await page.waitForTimeout(500);
  const s = page.getByRole("slider", { name: "Brightness", exact: true });
  const box = (await s.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 140) / 200, y, { steps: 8 });
  await page.mouse.up();
  const a1 = await settled(page);

  // Arm the hold, click B, and wait until B's load is committed and held.
  await page.evaluate(() => {
    window.__ihHolds = { "load-committed": { armed: true, reached: false } };
  });
  const thumbs = page.locator('[aria-label^="Select photo"]');
  await thumbs.nth(1).click();
  await expect.poll(() => page.evaluate(() => window.__ihHolds?.["load-committed"]?.reached === true), {
    message: "B's load reached the hold point",
    timeout: 30_000,
  }).toBe(true);

  // Back to A while B's load is held, give that click time to finish its own
  // work, then let B's load land.
  await thumbs.nth(0).click();
  await page.waitForTimeout(1_000);
  await page.evaluate(() => window.__ihHolds?.["load-committed"]?.release?.());

  const end = await settled(page);
  const lit = await activeThumb(page);
  console.log(`bounce-held: lit=${lit} end=${fmt(end)} A+40=${fmt(a1)} B=${fmt(b0)}`);
  expect(lit, "the lit thumbnail is A").toBe(0);
  expect(same(end, a1), `the canvas shows A with its +40 (${fmt(end)}; A+40 is ${fmt(a1)}, B is ${fmt(b0)})`).toBe(true);
});
