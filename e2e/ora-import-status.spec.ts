import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// .ora import on the async grammar (Plan C §3): an inline ✓ when it lands, and
// an Error that says what failed and offers Try again when it does not.
test.setTimeout(120_000);
const PNG = join(__dirname, "fixtures", "checker.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
}

async function openExportPane(page: Page) {
  await page.getByRole("button", { name: /^Settings/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Import / Export", exact: true }).click();
  return dialog;
}

test("a real .ora imports with a ✓; a broken one errors with Try again", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles([PNG]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(2000);

  const dialog = await openExportPane(page);
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    dialog.getByRole("button", { name: /Export .*\.ora/i }).click(),
  ]);
  const ora = join(tmpdir(), `ih-${Date.now()}.ora`);
  writeFileSync(ora, readFileSync((await dl.path())!));

  await dialog.locator('input[type="file"][accept=".ora"]').setInputFiles(ora);
  await expect(dialog.getByText(/^Imported as a new photo · \d+ layers?$/)).toBeVisible({ timeout: 30_000 });

  const broken = join(tmpdir(), `ih-broken-${Date.now()}.ora`);
  writeFileSync(broken, "this is not a zip");
  await dialog.locator('input[type="file"][accept=".ora"]').setInputFiles(broken);
  await expect(dialog.getByRole("alert")).toContainText("Couldn't import that .ora file.", { timeout: 30_000 });
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
});
