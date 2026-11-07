import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Batch's two layouts and its zoom (11-07-2026). The toggle sits at the left
// of the bar under the photos: Grid (the open photo 2 × 2, tiles around it)
// or Masonry (every photo at its own shape in columns, the open photo the same
// size as the rest). In the Grid, Alt + = / − zoom the open photo as before;
// in Masonry they change how big EVERY photo is — the column count.
//
// sky-building.png is 1200×800 (3:2); checker.png 256×256 (1:1). In Masonry
// the open photo's tile keeps that 3:2.

const FIXTURES = [
  join(__dirname, "fixtures", "sky-building.png"),
  join(__dirname, "fixtures", "checker.png"),
];

async function openBatch(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
  await page.setViewportSize({ width: 1600, height: 1100 });
  // No artboard margin, so the canvas is the photo's own 1200 wide.
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURES);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2);
  await page.locator('[aria-label="Select photo sky-building"]').first().click();
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), { timeout: 30_000 })
    .toBe(1200);
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await expect(page.getByTestId("batch-grid-bar")).toBeVisible();
}

const host = (page: Page) => page.locator(".canvas-grid-host");
const hero = (page: Page) => page.locator(".canvas-grid-hero");
const style = (page: Page, prop: string) =>
  host(page).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test("the layout toggle: Grid, then Masonry with the open photo at its own shape", async ({ page }) => {
  await openBatch(page);
  const bar = page.getByTestId("batch-grid-bar");
  const grid = bar.getByRole("button", { name: "Grid view" });
  const masonry = bar.getByRole("button", { name: "Masonry view" });
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await expect(bar).toContainText("2 photos");
  await expect.poll(() => style(page, "display")).toBe("grid");

  // The canvas element survives the switch: one container, restyled.
  await page.locator("canvas.main-canvas").evaluate((c) => ((c as HTMLCanvasElement).dataset.probe = "same"));
  await masonry.click();
  await expect(masonry).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => style(page, "column-count")).toBe("4");
  // Masonry scrolls instead of paging.
  await expect(bar.getByRole("button", { name: "Next photos" })).toHaveCount(0);
  await expect(page.locator("canvas.main-canvas")).toHaveAttribute("data-probe", "same");

  // Selected, not bigger: the open photo's tile is one column wide at 3:2.
  const box = await hero(page).boundingBox();
  const tile = await page.getByRole("button", { name: "checker", exact: true }).locator("..").boundingBox();
  expect(box && tile).toBeTruthy();
  expect(Math.abs(box!.width - tile!.width)).toBeLessThan(2);
  expect(box!.width / box!.height).toBeCloseTo(1.5, 1);
  await expect(page.getByText("Selected", { exact: true })).toBeVisible();

  // Remembered, in its own key.
  expect(await page.evaluate(() => localStorage.getItem("image-horse-batch-view"))).toContain('"layout":"masonry"');
});

test("Alt + = / −: the Grid zooms the open photo, Masonry sizes every photo", async ({ page }) => {
  await openBatch(page);
  const zoomShown = () => page.getByText(/^\d+%$/).first().textContent();
  const columns = async () => (await style(page, "grid-template-columns")).split(" ").length;

  // Grid, as it always was: 5 columns, and Alt + = zooms the open photo only.
  await expect.poll(columns).toBe(5);
  await expect.poll(zoomShown).toBe("100%");
  await page.keyboard.press("Alt+Equal");
  await expect.poll(zoomShown).not.toBe("100%");
  await expect.poll(columns).toBe(5);
  await page.keyboard.press("Alt+Digit0");
  await expect.poll(zoomShown).toBe("100%");

  // Masonry: fewer columns = bigger photos, and back with Alt + 0.
  await page.getByTestId("batch-grid-bar").getByRole("button", { name: "Masonry view" }).click();
  await expect.poll(() => style(page, "column-count")).toBe("4");
  await page.keyboard.press("Alt+Equal");
  await expect.poll(() => style(page, "column-count")).toBe("3");
  await page.keyboard.press("Alt+Minus");
  await page.keyboard.press("Alt+Minus");
  await expect.poll(() => style(page, "column-count")).toBe("5");
  await page.keyboard.press("Alt+Digit0");
  await expect.poll(() => style(page, "column-count")).toBe("4");
});
