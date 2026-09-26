import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { readPsd } from "../app/src/lib/plugins/psd/read";

// ─────────────────────────────────────────────────────────────────────────────
// Plugins, end to end, on the production build:
//   1. a fresh device has no plugin on — the Download dialog offers no PSD
//   2. Settings → Plugins: Allow plugins On, Photoshop PSD On — PSD appears
//   3. Download PSD writes a file this app's own reader opens, at the canvas
//      size, with the layer stack and a merged image
//   4. Settings → Import / Export → Import .psd brings it back as a NEW photo
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256

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
  return dialog;
}

async function openSettingsTab(page: Page, tab: string) {
  await page.getByRole("button", { name: "Settings", exact: true }).first().click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Settings" }).first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: tab, exact: true }).click();
  return dialog;
}

/** The On / Off radio in the named group — `ToggleButtonGroup` in select mode
 *  is a radiogroup labelled by the section's heading (Night 2). */
function pluginSwitch(dialog: ReturnType<Page["getByRole"]>, group: RegExp, which: "On" | "Off") {
  return dialog.getByRole("radiogroup", { name: group }).getByRole("radio", { name: which, exact: true });
}

test("PSD is a plugin: off by default, on from Settings, round-trips through the app", async ({
  page,
}) => {
  // 1. Nothing on: the picker has no PSD.
  let dialog = await openExportDialog(page);
  await expect(dialog.getByText("ORA", { exact: true })).toBeVisible();
  await expect(dialog.getByText("PSD", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // 2. Turn it on.
  const settings = await openSettingsTab(page, "Plugins");
  await expect(settings.getByRole("heading", { name: "Allow plugins" })).toBeVisible();
  await pluginSwitch(settings, /^Allow plugins$/, "On").check();
  await pluginSwitch(settings, /^Photoshop PSD/, "On").check();
  await settings.screenshot({ path: "test-results/plugins-pane.png" });
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();

  // 3. Download as PSD, then open the file with the app's own reader.
  dialog = await openExportDialog(page);
  await dialog.getByText("PSD", { exact: true }).click();
  await expect(dialog.getByLabel("File name")).toBeVisible();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    dialog.getByRole("button", { name: /^Download PSD/ }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe("checker-revised.psd");
  const psdPath = await dl.path();
  const psd = readPsd(new Uint8Array(readFileSync(psdPath)));
  // The canvas, not the fixture: the default "Canvas + photo" import pads the
  // 256×256 checker with the artboard border, and the file must match the canvas.
  const canvas = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return { w: c.width, h: c.height };
  });
  expect(psd.width).toBe(canvas.w);
  expect(psd.height).toBe(canvas.h);
  expect(psd.layers.length).toBeGreaterThanOrEqual(1);
  expect(psd.composite).toHaveLength(canvas.w * canvas.h * 4);
  for (const layer of psd.layers) expect(layer.rgba).toHaveLength(canvas.w * canvas.h * 4);
  expect(psd.notes).toEqual([]);
  await expect(page.getByText("Exported .psd")).toBeVisible({ timeout: 10_000 });

  // 4. Import it back as a new photo from Settings → Import / Export.
  const io = await openSettingsTab(page, "Import / Export");
  const importButton = io.getByRole("button", { name: "Import .psd", exact: true });
  await expect(importButton).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10_000 }),
    importButton.click(),
  ]);
  await chooser.setFiles(psdPath);
  await expect(page.getByText("Imported .psd as a new photo")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Restored \d+ layer/)).toBeVisible();
});
