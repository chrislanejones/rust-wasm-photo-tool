import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Batch › Crop: the
// preview carries a ratio-locked crop frame. Dragging it
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

// The other photos' thumbnails shade what the pass will cut — updated when the
// mouse is LET GO, not while dragging. Shift-drag breaks the ratio (the free
// shape becomes the custom ratio), and Enter crops everyone still in the bulk.
test("thumbnails shade on release, Shift-drag breaks the ratio, Enter crops all", async ({ page }) => {
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
  await page.getByRole("radio", { name: "1:1", exact: true }).click();

  // Any ratio: the Shift-drag below renames it ("Crop frame, 1.40:1").
  const frame = page.getByRole("group", { name: /^Crop frame, / });
  await expect(page.getByRole("group", { name: /^Crop frame, 1:1/ })).toBeVisible();
  // Only the OTHER photo carries a shade; the open one has the live frame.
  const shade = page.locator(".photo-thumb:not(.active) [data-testid=batch-crop-thumb-shade] path");
  await expect(shade).toHaveCount(1);
  await expect(page.locator(".photo-thumb.active [data-testid=batch-crop-thumb-shade]")).toHaveCount(0);
  // …and so does its tile in the canvas grid beside the open photo.
  const gridShade = page.getByRole("button", { name: "sky-building", exact: true })
    .locator("..")
    .getByTestId("batch-crop-thumb-shade")
    .locator("path");
  await expect(gridShade).toHaveCount(1);
  const gridD = () => gridShade.getAttribute("d");
  const gridBefore = await gridD();
  const shadeD = () => shade.getAttribute("d");
  const before = await shadeD();

  // Shrink the frame from its bottom-right corner. Mid-drag the thumbnail
  // must not move; on release it must.
  let box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 6 });
  expect(await shadeD(), "no shade change while the mouse is down").toBe(before);
  expect(await gridD(), "…in the canvas grid either").toBe(gridBefore);
  await page.mouse.up();
  await expect.poll(shadeD, { message: "the shade follows the frame on release" }).not.toBe(before);
  await expect.poll(gridD).not.toBe(gridBefore);
  const afterLocked = await shadeD();

  // Shift-drag the same corner sideways: the ratio breaks.
  box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1);
  await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 1.5, box.y + box.height * 0.8, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const free = (await frame.boundingBox())!;
  expect(Math.abs(free.width / free.height - 1), "the frame is no longer square").toBeGreaterThan(0.2);
  await expect(page.getByText(/^Custom .*from a Shift-drag/)).toBeVisible();
  await expect(frame).not.toHaveAccessibleName(/^Crop frame, 1:1/);
  await expect(page.getByRole("radio", { name: "1:1", exact: true })).toHaveAttribute("aria-checked", "false");
  await expect.poll(shadeD).not.toBe(afterLocked);

  // Enter: every photo is cropped to the custom shape at 1080 wide.
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Cropped 2 images/).first()).toBeVisible({ timeout: 30_000 });
  const ratio = free.width / free.height;
  const expectedH = Math.round(1080 / ratio);
  // Polled, not read once: the toast lands as soon as the pass ends, and the
  // status bar's size follows on the engine's next (async) state sync — read
  // once, it raced and saw 256 on PR #296's CI.
  await expect(page.getByText(/^Photo: 1080×\d+$/)).toBeVisible({ timeout: 15_000 });
  const photo = await page.getByText(/^Photo: \d+×\d+$/).textContent();
  const [, pw, ph] = photo!.match(/(\d+)×(\d+)/)!.map(Number);
  expect(pw).toBe(1080);
  expect(Math.abs(ph! - expectedH), `height ≈ ${expectedH}`).toBeLessThanOrEqual(3);
  // Both photos are cropped now — nothing left to shade.
  await expect(page.locator("[data-testid=batch-crop-thumb-shade]")).toHaveCount(0);
});
