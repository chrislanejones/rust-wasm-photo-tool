import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Plan A §4.1 — "Gallery: selected vs loading."
//
//   Loaded:                        the ring.
//   Requested and still loading:   ring PLUS a ↻ StatusMark.
//   Normal:                        nothing.
//
// The ring alone cannot tell the first two apart, and on a slow switch the
// gallery lights a photo the canvas is not showing yet — which is the thing
// that reads as a bug rather than as waiting.
//
// ⚠️ G1 is the one that could go vacuously green: "the mark appears" is only
// meaningful if it is ABSENT the rest of the time. G0 pins the absence first,
// and G2 pins that it goes away again, so a mark that was always on screen
// fails two of the three.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

const canvasSize = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    return c ? `${c.width}x${c.height}` : "none";
  });

/** Every ↻ working-mark currently in the gallery strip. */
const marks = (page: Page) => page.locator('[data-id] [data-slot="status-mark"][data-status="working"]');

async function setup(page: Page) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect.poll(() => canvasSize(page), { timeout: 30_000 }).not.toBe("none");
  await page.waitForTimeout(1500);
}

async function pgDn(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("PageDown");
}

test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);

test("G0 at rest the gallery shows no working mark at all", async ({ page }) => {
  await setup(page);
  // The licence for G1: if a mark were always present, "it appeared" would
  // mean nothing.
  await expect(marks(page)).toHaveCount(0);
});

test("G1 the requested-but-not-loaded photo carries a ↻ mark, and only that one", async ({ page }) => {
  await setup(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 30 });
  await page.evaluate(() => {
    const audit = { observed: false, errors: [] as string[] };
    (window as unknown as { galleryAudit: typeof audit }).galleryAudit = audit;
    const observer = new MutationObserver(() => {
      const nodes = [...document.querySelectorAll('[data-id] [data-slot="status-mark"][data-status="working"]')];
      if (!nodes.length) return;
      audit.observed = true;
      if (nodes.length !== 1) audit.errors.push("multiple loading thumbnails");
      for (const node of nodes) {
        if (node.closest("[data-id]")?.getAttribute("aria-pressed") !== "true") audit.errors.push("loading thumbnail is not requested");
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await pgDn(page);
  // Record owner and pressed state together while the mark exists, including
  // a fast completion between Playwright calls. Status-bar marks are unrelated.
  await expect.poll(() => page.evaluate(() => (window as unknown as { galleryAudit: { observed: boolean } }).galleryAudit.observed)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { galleryAudit: { errors: string[] } }).galleryAudit.errors)).toEqual([]);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});

test("G2 once the pixels are in, the mark goes away and the ring stays", async ({ page }) => {
  await setup(page);
  await pgDn(page);
  await expect.poll(() => canvasSize(page), { timeout: 30_000 }).toBe("1220x820");
  await expect(marks(page)).toHaveCount(0, { timeout: 30_000 });
  // The ring is still there: being loaded is not the same as being deselected.
  const selected = await page.locator('[data-id][aria-pressed="true"]').count();
  expect(selected, "exactly one photo is still lit after the switch").toBe(1);
});

test("G3 the mark is not colour-only and says what it means", async ({ page }) => {
  await setup(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 30 });
  await pgDn(page);
  const mark = marks(page).first();
  await expect(mark).toHaveCount(1, { timeout: 60_000 });
  // A glyph, so it reads in greyscale, plus text for assistive tech.
  expect(await mark.locator("svg").count(), "there is a glyph, not just a tint").toBe(1);
  expect(await mark.locator(".sr-only").innerText(), "the meaning travels as text").toMatch(/^Loading /);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
