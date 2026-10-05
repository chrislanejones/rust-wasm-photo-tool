import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Download All / ZIP through the async grammar (Plan C §3): the archive holds
// every photo, and the flow ends in a "Zipped N photos" toast instead of
// closing the dialog onto silence.
const FIX = [join(__dirname, "fixtures", "checker.png"), join(__dirname, "fixtures", "sky-building.png")];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
}

test("Download All makes a ZIP of every photo and says so", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIX);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByText(/^Download All Images/).click();
  const button = dialog.getByRole("button", { name: /^Download/ }).last();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), button.click()]);
  expect(dl.suggestedFilename()).toBe("photos.zip");
  const zip = readFileSync((await dl.path())!).toString("latin1");
  expect(zip).toContain("checker");
  expect(zip).toContain("sky-building");
  await expect(page.getByText(/^Zipped 2 photos$/)).toBeVisible({ timeout: 15_000 });
});
