import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// Plugins, end to end, on the production build, with the repo's own test
// plugin (fixtures/layered-json.plugin.js — a real format plugin, the
// smallest there is):
//   1. a fresh device has no plugin: the Download dialog shows PSD only as the
//      disabled "Activate with plugin" placeholder, and no IHL
//   2. Settings → Plugins → Add from file adds it; Allow plugins On
//   3. the IHL tile is live in the Download dialog; Download IHL writes a
//      file whose layers are the canvas
//   4. Settings → Import / Export → Import .ihl brings it back as a NEW photo
// The PSD plugin itself lives in its own repository and takes the same road.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256
const PLUGIN = process.env.IH_E2E_PLUGIN ?? join(__dirname, "fixtures", "layered-json.plugin.js");
const FORMAT = process.env.IH_E2E_PLUGIN ? { tile: /^PSD — /, ext: ".psd", label: "PSD" } : { tile: /^IHL — /, ext: ".ihl", label: "IHL" };

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

test("a plugin added from Settings adds its format to Download and Import / Export", async ({
  page,
}) => {
  // 1. Nothing added: PSD is a disabled placeholder, and there is no IHL.
  let dialog = await openExportDialog(page);
  const placeholder = dialog.getByTitle(/^PSD — layered Photoshop file/);
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toBeDisabled();
  // No LIVE tile for the format yet: with the PSD plugin the only PSD tile is
  // the disabled placeholder above; with the fixture there is no IHL at all.
  await expect(dialog.getByTitle(FORMAT.tile).and(dialog.locator(":enabled"))).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // 2. Add the plugin from a file, then allow plugins.
  const settings = await openSettingsTab(page, "Plugins");
  await expect(settings.getByRole("heading", { name: "Allow plugins" })).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10_000 }),
    settings.getByRole("button", { name: "Add from file", exact: true }).click(),
  ]);
  await chooser.setFiles(PLUGIN);
  await expect(page.getByText(/^Added .+ v\d/)).toBeVisible({ timeout: 15_000 });
  await expect(settings.getByText(`Import and export ${FORMAT.ext}`)).toBeVisible();
  await pluginSwitch(settings, /^Allow plugins$/, "On").check();
  await settings.screenshot({ path: "test-results/plugins-pane.png" });
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();

  // 3. The tile is live (and, for PSD, the placeholder has given way);
  // download through it and check the file.
  dialog = await openExportDialog(page);
  await expect(dialog.getByTitle(/^PSD — layered Photoshop file/)).toHaveCount(
    FORMAT.ext === ".psd" ? 0 : 1,
  );
  await dialog.getByTitle(FORMAT.tile).click();
  await expect(dialog.getByText(FORMAT.ext, { exact: true })).toBeVisible();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    dialog.getByRole("button", { name: `Download ${FORMAT.label}`, exact: true }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe(`checker-revised${FORMAT.ext}`);
  const path = await dl.path();
  const canvas = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return { w: c.width, h: c.height };
  });
  if (FORMAT.ext === ".ihl") {
    const ihl = JSON.parse(readFileSync(path, "utf8"));
    expect(ihl.format).toBe("ihl");
    expect(ihl.width).toBe(canvas.w);
    expect(ihl.height).toBe(canvas.h);
    expect(ihl.layers.length).toBeGreaterThanOrEqual(1);
  } else {
    const head = readFileSync(path).subarray(0, 4).toString("latin1");
    expect(head).toBe("8BPS");
  }
  await expect(page.getByText(`Exported ${FORMAT.ext}`)).toBeVisible({ timeout: 10_000 });

  // 4. Import it back as a new photo from Settings → Import / Export.
  const io = await openSettingsTab(page, "Import / Export");
  const importButton = io.getByRole("button", { name: `Import ${FORMAT.ext}`, exact: true });
  await expect(importButton).toBeVisible();
  const [importChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10_000 }),
    importButton.click(),
  ]);
  await importChooser.setFiles(path);
  await expect(page.getByText(`Imported ${FORMAT.ext} as a new photo`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Restored \d+ layer/)).toBeVisible();
});
