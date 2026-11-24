import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// The Export dialog as ONE step that adapts to the task (Chris, 11-24-2026):
//   1. Selected image | All images (N)             — top bar style group
//   2. Selected: File Name (+ its extension)  ·  All: Recipe + Batch settings
//   3. Raster | Vector | With Layers (Selected only) — top bar style group
//   4. that kind's format tiles, named JPEG PNG…   — the Shapes picker's tiles
//   5. Privacy & metadata                          — a drop-down, shut
//   6. footer: what you'll get, Share link · Clipboard, ONE primary Download
//      (All: Share All · Soon (off), Download ZIP)
// A row that cannot apply is left out, not grayed. Alt+E opens it.

const FIXTURES = [join(__dirname, "fixtures", "checker.png"), join(__dirname, "fixtures", "sky-building.png")];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")
      ? route.continue()
      : route.abort();
  });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1000);
});

test("Alt+E opens Export, as the top bar's hint says", async ({ page }) => {
  await page.locator("canvas.main-canvas").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("Alt+e");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Export", exact: true })).toBeVisible();
});

test("one step: the rows, and how each scope adapts", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const what = dialog.getByRole("radiogroup", { name: "What to export" });
  const kind = dialog.getByRole("radiogroup", { name: "Kind of file" });
  const format = dialog.getByRole("radiogroup", { name: "Format" });
  await expect(what.getByRole("radio", { name: "Selected image" })).toHaveAttribute("aria-checked", "true");
  await expect(kind.getByRole("radio", { name: "Raster" })).toHaveAttribute("aria-checked", "true");
  // The tiles are named for their format.
  for (const name of ["JPEG", "PNG", "WebP", "AVIF"]) {
    await expect(format.getByRole("radio", { name, exact: true }), name).toBeVisible();
  }
  await expect(format.getByRole("radio")).toHaveCount(4);
  await expect(dialog.getByTestId("export-format-says")).toHaveText(/^(JPEG|PNG|WebP|AVIF) — /);

  // Selected: the name with its extension, no recipe, one primary.
  await expect(dialog.getByLabel("File Name")).toBeEnabled();
  await expect(dialog.locator("#export-file-ext")).toHaveText(/^\.\w+$/);
  await expect(dialog.getByLabel("Recipe")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Share link" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clipboard" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Download (JPEG|PNG|WebP|AVIF)$/ })).toBeEnabled();
  await expect(dialog.locator("#export-summary")).toContainText("1 image");
  // No SVG open: Vector is off.
  await expect(kind.getByRole("radio", { name: "Vector" })).toBeDisabled();

  // Privacy & metadata: shut, its choice on the right; opens to Camera Info.
  const privacy = dialog.getByRole("button", { name: /^Privacy & metadata/ });
  await expect(privacy).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("radiogroup", { name: "Camera Info" })).toBeHidden();
  await privacy.click();
  await expect(dialog.getByRole("radiogroup", { name: "Camera Info" })).toBeVisible();

  // With Layers: ORA, and the PSD placeholder.
  await kind.getByRole("radio", { name: "With Layers" }).click();
  await expect(format.getByRole("radio", { name: "ORA", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(format.getByRole("radio", { name: "PSD", exact: true })).toBeDisabled();
  await expect(dialog.getByTestId("export-format-says")).toContainText("PSD plugin");
  await expect(dialog.getByRole("button", { name: "Download ORA" })).toBeVisible();

  // Raster is the default on every open: an ORA pick doesn't stick.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  await expect(kind.getByRole("radio", { name: "Raster" })).toHaveAttribute("aria-checked", "true");
  await kind.getByRole("radio", { name: "With Layers" }).click();

  // All: layered files can't go in a ZIP, so the kind falls back to Raster
  // and With Layers is left out; the recipe and its Batch settings come in,
  // the name field goes.
  await what.getByRole("radio", { name: /^All images/ }).click();
  await expect(kind.getByRole("radio", { name: "Raster" })).toHaveAttribute("aria-checked", "true");
  await expect(kind.getByRole("radio", { name: "With Layers" })).toHaveCount(0);
  await expect(dialog.getByLabel("Recipe")).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Save recipe" })).toBeEnabled();
  const batch = dialog.getByLabel("Batch settings");
  await expect(batch).toContainText("Original size");
  await expect(batch).toContainText("Original file names");
  await expect(batch).toContainText("ZIP archive");
  await expect(dialog.getByLabel("File Name")).toHaveCount(0);
  await expect(dialog.locator("#export-summary")).toContainText("2 images");
  await expect(dialog.getByRole("button", { name: "Download ZIP", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: /^Share All/ })).toBeDisabled();
});

test("the rows are radio groups: one Tab stop each, arrow keys move", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const kind = dialog.getByRole("radiogroup", { name: "Kind of file" });
  const raster = kind.getByRole("radio", { name: "Raster" });
  await raster.focus();
  await page.keyboard.press("ArrowRight"); // Vector is off: skipped
  await expect(kind.getByRole("radio", { name: "With Layers" })).toHaveAttribute("aria-checked", "true");
  const tabbable = await kind.getByRole("radio").evaluateAll((els) => els.filter((e) => e.getAttribute("tabindex") === "0").length);
  expect(tabbable).toBe(1);
});
