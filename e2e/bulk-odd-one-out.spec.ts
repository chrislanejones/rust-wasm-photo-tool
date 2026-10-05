import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Batch › Bulk — the odd ones out. Tick a photo's gallery checkbox (or "Odd
// one out" on the canvas) and it gets the Odd ones crop instead of the bulk's.
// One pass crops both groups.
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

/** Two photos in, canvas up, Batch → Bulk. Returns once the panel is there. */
async function openBulk(page: Page): Promise<void> {
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
  await page.getByRole("button", { name: "Bulk", exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole("tablist", { name: "Which crop you are editing" })).toBeVisible();
}

const oddBoxes = (page: Page) => page.getByRole("button", { name: "Odd one out", exact: true });

test("a ticked photo gets the odd crop, the rest get the bulk's", async ({ page }) => {
  await openBulk(page);

  // Bulk: 1:1. Nothing ticked yet, so the button still says All.
  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Crop All Images to 1:1$/ })).toBeVisible();

  // Tick photo 2 in the gallery. Its checkbox is the odd-one-out mark here.
  await oddBoxes(page).nth(1).click();
  await expect(oddBoxes(page).nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tab", { name: /Odd ones/ })).toContainText("1");

  // Give the odd ones 16:9. The bulk keeps its 1:1.
  await page.getByRole("tab", { name: /Odd ones/ }).click();
  await page.getByRole("radio", { name: "16:9", exact: true }).click();
  const run = page.getByRole("button", { name: "Crop 1 to 1:1 · 1 to 16:9" });
  await expect(run).toBeVisible();

  await run.click();
  await expect(page.getByText(/Cropped 2 images/).first()).toBeVisible({ timeout: 30_000 });

  // Photo 1 (bulk) is square; photo 2 (odd) is 16:9.
  await page.locator('[aria-label^="Select photo"]').nth(0).click();
  await expect(page.getByText("Photo: 1080×1080")).toBeVisible({ timeout: 30_000 });
  await page.locator('[aria-label^="Select photo"]').nth(1).click();
  await expect(page.getByText("Photo: 1080×608")).toBeVisible({ timeout: 30_000 });
});

test("the canvas checkbox and the gallery checkbox are the same mark", async ({ page }) => {
  await openBulk(page);
  const onCanvas = page.getByRole("checkbox", { name: "Odd one out" });
  await expect(onCanvas).not.toBeChecked();

  await onCanvas.check();
  // The photo on screen is now odd: one gallery checkbox is pressed, and the
  // panel shows the Odd ones tab, because that is the crop its frame uses.
  await expect(page.locator('[aria-label="Odd one out"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole("tab", { name: /Odd ones/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: /^Crop frame, 4:5/ })).toBeVisible();

  await onCanvas.uncheck();
  await expect(page.locator('[aria-label="Odd one out"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Bulk/ })).toHaveAttribute("aria-selected", "true");
});
