import { test, expect } from "./guard/test";
import { join } from "node:path";

test("Create Pins and Pen preserve edits through undo and rapid release", async ({ page }) => {
  await page.route("**/*", route => {
    const u = route.request().url();
    return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u) || /^(blob:|data:)/.test(u) ? route.continue() : route.abort();
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(join(__dirname, "fixtures", "sky-building.png"));
  const canvas = page.locator("canvas.main-canvas");
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * .25, y = box.y + box.height * .35;
  const pixels = () => canvas.evaluate((c: HTMLCanvasElement) => {
    const copy = document.createElement("canvas");
    copy.width = c.width; copy.height = c.height;
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(c, 0, 0);
    const bytes = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0; for (let i = 0; i < bytes.length; i++) sum = (Math.imul(sum, 31) + bytes[i]) | 0;
    return sum;
  });
  const original = await pixels();
  await page.mouse.click(x, y);
  await expect.poll(pixels).not.toBe(original);
  await page.keyboard.press("Control+z");
  await expect.poll(pixels).toBe(original);
  await page.getByRole("button", { name: "Pen", exact: true }).first().click();
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 20, y + 15, { steps: 20 }); await page.mouse.up();
  await page.mouse.move(x + 80, y + 80); await page.mouse.down();
  await page.mouse.move(x + 100, y + 95, { steps: 30 }); await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect.poll(pixels).not.toBe(original);
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
  await page.keyboard.press("Control+z");
  await expect.poll(pixels).toBe(original);
  await page.screenshot({ path: "test-results/state-v4-night3-pins.png" });
});
