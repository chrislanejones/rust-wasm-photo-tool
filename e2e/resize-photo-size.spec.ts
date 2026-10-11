import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Ask for 800, get 800 (PARKING_LOT 09-28-2026, Night 10-07 §1.1).
//
// The Resize panel's width field shows the PHOTO's width (#81), but Apply used
// to hand that number to the engine as the ARTBOARD's width — photo plus the
// 10px Canvas border each side. 1600 → 800 stored 790×590; a 256px PNG set to
// 200 stored 186×186. The status bar's "Photo:" reads the engine's photo
// bounds, which is what "Photo only" export and the persisted file crop to.
// ─────────────────────────────────────────────────────────────────────────────

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

const photoReadout = (page: Page) =>
  page.locator(".status-zoom", { hasText: "Photo:" }).first().innerText();

async function resizePhoto(page: Page, fixture: string, from: string, typed: number, expected: string) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(join(__dirname, "fixtures", fixture));
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect.poll(() => photoReadout(page), { timeout: 30_000 }).toBe(`Photo: ${from}`);

  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Resize & Compress", exact: true }).first().click();
  const width = page.getByLabel("width", { exact: true });
  await expect(width).toHaveValue(from.split("×")[0]!);
  await width.fill(String(typed));
  const apply = page.getByRole("button", { name: /^Apply Resize$/ });
  await expect(apply).toBeEnabled();
  await apply.click();

  await expect
    .poll(() => photoReadout(page), { timeout: 15_000, message: `typed ${typed}, the photo must be exactly that` })
    .toBe(`Photo: ${expected}`);

  await page.keyboard.press("Control+z");
  await expect.poll(() => photoReadout(page)).toBe(`Photo: ${from}`);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => photoReadout(page)).toBe(`Photo: ${expected}`);
}

test("1600×1200 set to 800 is exactly 800×600", async ({ page }) => {
  await resizePhoto(page, "resize-1600x1200.png", "1600×1200", 800, "800×600");
});

test("a 256px PNG set to 200 is exactly 200×200", async ({ page }) => {
  await resizePhoto(page, "resize-256.png", "256×256", 200, "200×200");
});
