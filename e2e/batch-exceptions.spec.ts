import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Batch — Main and Exceptions. Tick a photo's gallery checkbox (or "Exception"
// on the canvas) and it moves to the Exceptions group. Crop keeps a crop per
// group and runs both; the other Batch tools run on the group that is showing.
//
// checker.png is 256×256 and sky-building.png is 1200×800, so the result is
// readable off the status bar: 1:1 at 1080 → 1080×1080, 16:9 at 1080 → 1080×608.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Two photos in, canvas up, Batch → `tool`. Returns once the switch is there. */
async function openBatch(page: Page, tool: string): Promise<void> {
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: tool, exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole("radiogroup", { name: "Which photos" })).toBeVisible();
}

const exceptionBoxes = (page: Page) => page.getByRole("button", { name: "Exception", exact: true });
const tab = (page: Page, name: RegExp) => page.getByRole("radio", { name });

test("Crop: an exception gets its own crop, Main gets the other", async ({ page }) => {
  await openBatch(page, "Crop");

  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Crop All Images to 1:1$/ })).toBeVisible();

  // Tick photo 2 in the gallery.
  await exceptionBoxes(page).nth(1).click();
  await expect(exceptionBoxes(page).nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(tab(page, /^Exceptions · 1$/)).toBeVisible();

  // Exceptions get 16:9. Main keeps its 1:1.
  await tab(page, /^Exceptions/).click();
  await page.getByRole("radio", { name: "16:9", exact: true }).click();
  const run = page.getByRole("button", { name: "Crop 1 to 1:1 · 1 to 16:9" });
  await expect(run).toBeVisible();

  await run.click();
  await expect(page.getByText(/Cropped 2 images/).first()).toBeVisible({ timeout: 30_000 });

  await page.locator('[aria-label^="Select photo"]').nth(0).click();
  await expect(page.getByText("Photo: 1080×1080")).toBeVisible({ timeout: 30_000 });
  await page.locator('[aria-label^="Select photo"]').nth(1).click();
  await expect(page.getByText("Photo: 1080×608")).toBeVisible({ timeout: 30_000 });
});

test("the canvas checkbox and the gallery checkbox are the same mark", async ({ page }) => {
  await openBatch(page, "Crop");
  const onCanvas = page.getByRole("checkbox", { name: "Exception", exact: true });
  await expect(onCanvas).not.toBeChecked();

  await onCanvas.check();
  // The photo on screen is an exception now: its gallery checkbox is pressed,
  // and the switch moves to Exceptions, because that is the crop its frame uses.
  await expect(page.locator('[aria-label="Exception"][aria-pressed="true"]')).toHaveCount(1);
  await expect(tab(page, /^Exceptions/)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("group", { name: /^Crop frame, 4:5/ })).toBeVisible();

  await onCanvas.uncheck();
  await expect(page.locator('[aria-label="Exception"][aria-pressed="true"]')).toHaveCount(0);
  await expect(tab(page, /^Main/)).toHaveAttribute("aria-checked", "true");
});

test("Rename runs on Main and leaves the exception's name alone", async ({ page }) => {
  await openBatch(page, "Rename");
  await exceptionBoxes(page).nth(1).click();
  await expect(tab(page, /^Main · 1$/)).toHaveAttribute("aria-checked", "true");

  await page.getByLabel("Name pattern").fill("slide-{n}");
  await page.getByRole("button", { name: "Rename 1 image" }).click();

  await expect(page.locator('[aria-label="Select photo slide-1"]')).toHaveCount(1);
  await expect(page.locator('[aria-label="Select photo sky-building"]')).toHaveCount(1);
});

test("every photo in the grid has its own Exception checkbox, and the bar under the grid counts them", async ({ page }) => {
  await openBatch(page, "Crop");
  // The tile's checkbox is named after its photo, so each one is reachable.
  const tileBox = page.getByRole("checkbox", { name: /^Exception: / });
  await expect(tileBox).toHaveCount(1);
  const bar = page.getByTestId("batch-grid-bar");
  await expect(bar).toContainText("2 photos");

  await tileBox.check();
  // Same mark as the gallery checkbox.
  await expect(page.locator('[aria-label="Exception"][aria-pressed="true"]')).toHaveCount(1);
  await expect(bar).toContainText("1 exception");
  // One page: nothing to step through.
  await expect(page.getByRole("button", { name: "Previous photos" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next photos" })).toBeDisabled();
});
