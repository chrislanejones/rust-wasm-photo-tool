import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The export dialog's "File name" field renames the single-image Download.
//   1. untouched → the `<name>-revised` default, unchanged from before
//   2. typed name → downloads under it, extension from the chosen format
//   3. a typed image extension is dropped, so `bob.jpeg` is not `bob.jpeg.png`
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
      ? route.continue()
      : route.abort();
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PNG);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
});

async function openExportDialog(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // PNG, so the expected extension does not depend on a persisted preference.
  await dialog.getByText("PNG", { exact: true }).click();
  return dialog;
}

async function download(page: Page, act: () => Promise<void>): Promise<string> {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), act()]);
  return dl.suggestedFilename();
}

test("untouched field keeps the -revised default", async ({ page }) => {
  const dialog = await openExportDialog(page);
  const field = dialog.getByLabel("File name");
  await expect(field).toHaveValue("checker-revised");
  const name = await download(page, () =>
    dialog.getByRole("button", { name: /^Download PNG/ }).click(),
  );
  expect(name).toBe("checker-revised.png");
});

test("a typed name is used, and Enter downloads", async ({ page }) => {
  const dialog = await openExportDialog(page);
  const field = dialog.getByLabel("File name");
  await field.fill("bobbob.jpeg");
  await dialog.screenshot({ path: "test-results/export-file-name-dialog.png" });
  const name = await download(page, () => field.press("Enter"));
  expect(name).toBe("bobbob.png");
});

test("reopening the dialog resets the name", async ({ page }) => {
  let dialog = await openExportDialog(page);
  await dialog.getByLabel("File name").fill("temporary");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  dialog = await openExportDialog(page);
  await expect(dialog.getByLabel("File name")).toHaveValue("checker-revised");
});
