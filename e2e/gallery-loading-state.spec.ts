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
  await expect(page.locator("[data-id] img")).toHaveCount(2);
  await expect(marks(page)).toHaveCount(0);
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

// Observe the transient DOM state in the page. Driver polling can miss a
// complete switch, even under CPU throttling, or read two different frames.
async function watchSwitch(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector("[data-gallery-card]")!;
    const observer = new MutationObserver(() => {
      const marks = root.querySelectorAll('[data-id] [data-status="working"]');
      if (!marks.length) return;
      const mark = marks[0]!;
      const sample = {
        count: marks.length,
        selected: mark.closest("[data-id]")?.getAttribute("aria-pressed"),
        glyph: !!mark.querySelector("svg"),
        text: mark.textContent,
      };
      root.setAttribute("data-switch-sample", JSON.stringify(sample));
      observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true });
  });
}

async function switchSample(page: Page) {
  const root = page.locator("[data-gallery-card]").first();
  await expect(root).toHaveAttribute("data-switch-sample", /Loading/);
  return JSON.parse((await root.getAttribute("data-switch-sample"))!);
}

test("G1 the requested-but-not-loaded photo carries a ↻ mark, and only that one", async ({ page }) => {
  await setup(page);
  await watchSwitch(page);
  await pgDn(page);
  expect(await switchSample(page)).toMatchObject({ count: 1, selected: "true" });
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
  await watchSwitch(page);
  await pgDn(page);
  const sample = await switchSample(page);
  expect(sample.glyph).toBe(true);
  expect(sample.text).toMatch(/Loading /);
});

test("the atomic gallery observation also survives 30× CPU throttling", async ({ page }) => {
  await setup(page);
  await watchSwitch(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 30 });
    await pgDn(page);
    expect(await switchSample(page)).toMatchObject({ count: 1, selected: "true", glyph: true });
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  await expect(marks(page)).toHaveCount(0);
});
