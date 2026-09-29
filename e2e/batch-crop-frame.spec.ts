import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Batch › Crop: the preview carries a ratio-locked crop frame. Dragging it
// records a hand framing for THAT photo (the panel counts it), and Crop All
// then lands the active photo on the chosen output size. A refactor that
// dropped the overlay mount from renderOverlay would pass every unit test.

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

const canvasSize = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    return c ? `${c.width}x${c.height}` : "none";
  });

test("the batch preview frame can be dragged, and Crop All uses it", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect.poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Crop", exact: true }).first().click();
  await page.waitForTimeout(800);

  // 4:5 on the square checker fixture leaves the frame room to slide sideways.
  await page.getByRole("radio", { name: "4:5", exact: true }).click();
  const frame = page.getByRole("group", { name: /^Crop frame, 4:5/ });
  await expect(frame, "the crop frame is on the preview").toBeVisible();
  await expect(page.getByText(/framed by hand/)).toHaveCount(0);

  // Drag the frame left; the clamp keeps it on the photo.
  const box = (await frame.boundingBox())!;
  const before = box;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const after = (await frame.boundingBox())!;
  expect(
    Math.abs(after.x - before.x) + Math.abs(after.y - before.y),
    "the frame moved with the drag",
  ).toBeGreaterThan(5);
  await expect(page.getByText(/1 of 2 framed by hand/)).toBeVisible();

  // Keyboard path: focus + "0" resets the hand framing.
  await frame.focus();
  await page.keyboard.press("0");
  await expect(page.getByText(/framed by hand/)).toHaveCount(0);

  await page.getByRole("button", { name: /^Crop All Images to 4:5$/ }).click();
  await expect(page.getByText(/Cropped 2 images/).first()).toBeVisible({ timeout: 30_000 });
  // The document is the photo plus any Canvas padding, so check the photo
  // size the status bar reports rather than the raw canvas.
  await expect(page.getByText("Photo: 1080×1350")).toBeVisible();
  expect(await canvasSize(page)).not.toBe("none");
  // Once the crop is baked in, the frame steps off the preview.
  await expect(frame).toHaveCount(0);
});
