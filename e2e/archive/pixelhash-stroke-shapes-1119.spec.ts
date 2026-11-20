import { test, expect } from "../guard/test";
import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "../annotation-benchmark-harness";

// ONE-OFF (night 11-19, PR #492): draw the stroke-first things — an arrow, a
// diagram shape, a pin and a smart callout — through the real UI with the
// panel's DEFAULTS, then print a SHA-256 of the composite and the shape list.
// Run it against a master build and a #492 build; the two hashes must match.
// Kept under e2e/archive, outside the suite:
//   PW_PORT=<p> pnpm exec playwright test --config playwright.archive.config.ts ...
// or copy into e2e/ for one run.

const FIXTURE_PNG = join(__dirname, "..", "fixtures", "paper-1200x900.png");

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
}

async function tab(page: Page, name: string) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name, exact: true }).first().click();
}

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function drag(page: Page, x0: number, y0: number, x1: number, y1: number) {
  const a = await screenPoint(page, x0, y0);
  const b = await screenPoint(page, x1, y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

const count = (page: Page) =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()).length);

test("stroke-first shapes drawn with defaults: composite + shape-list hash", async ({ page }) => {
  await open(page);

  // 1. Arrow, the Arrows tab's default.
  await tab(page, "Arrows & Diagram Shapes");
  await drag(page, 100, 100, 400, 220);
  await key(page, "Enter");
  await expect.poll(() => count(page)).toBe(1);

  // 2. A diagram shape (Database: it has a detail stroke, the lid).
  await page.getByRole("radiogroup", { name: "Flowchart" }).getByRole("radio", { name: /Database/ }).click();
  await drag(page, 500, 100, 700, 300);
  await key(page, "Enter");
  await expect.poll(() => count(page)).toBe(2);

  // 3. A pin.
  await tab(page, "Pins");
  const pin = await screenPoint(page, 900, 200);
  await page.mouse.click(pin.x, pin.y);
  await key(page, "Enter");
  await expect.poll(() => count(page)).toBe(3);

  // 4. A smart callout: pin + leader + label.
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const c = await screenPoint(page, 300, 600);
  await page.mouse.click(c.x, c.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await expect(input).toBeFocused();
  await input.fill("Hash me");
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect.poll(() => count(page)).toBeGreaterThanOrEqual(5);
  await page.waitForTimeout(500);

  const { px, shapes } = await page.evaluate(async () => ({
    px: Array.from(await window.__annotationTool.get_image_data()),
    shapes: await window.__annotationTool.get_shape_annotations(),
  }));
  const pxHash = createHash("sha256").update(Buffer.from(px)).digest("hex");
  // Ids aside, the shape list must match too.
  const list = JSON.parse(shapes).map((s: Record<string, unknown>) => ({ ...s, id: 0 }));
  const listHash = createHash("sha256").update(JSON.stringify(list)).digest("hex");
  console.log(`PIXELHASH ${pxHash} LISTHASH ${listHash} SHAPES ${list.length}`);
  console.log(`LIST ${JSON.stringify(list)}`);
});
