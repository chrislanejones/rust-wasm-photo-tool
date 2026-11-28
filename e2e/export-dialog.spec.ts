import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// The Export dialog as ONE step that adapts to the task (Chris, 11-24-2026):
//   1. Selected image | All images (N)             — top bar style group
//   2. Selected: File Name (+ its extension), Recipe  ·  All: Recipe + Batch settings
//   3. ONE Format row, JPEG PNG WebP AVIF · SVG · ORA PSD — the Shapes
//      picker's tiles; a group that can't apply is left out (11-28-2026)
//   4. Privacy & Metadata                          — a drop-down, shut
//   5. footer: what you'll get (how compressed on the right), Share link · Clipboard, ONE primary Download
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
  const format = dialog.getByRole("radiogroup", { name: "Format" });
  const raster = format.getByRole("radio", { name: /^(JPEG|PNG|WebP|AVIF)$/ });
  await expect(what.getByRole("radio", { name: "Selected image" })).toHaveAttribute("aria-checked", "true");
  // ONE Format row, no Kind row (11-28-2026): JPEG PNG WebP AVIF · ORA PSD.
  await expect(dialog.getByRole("radiogroup", { name: "Kind of file" })).toHaveCount(0);
  for (const name of ["JPEG", "PNG", "WebP", "AVIF", "ORA", "PSD"]) {
    await expect(format.getByRole("radio", { name, exact: true }), name).toBeVisible();
  }
  await expect(format.getByRole("radio")).toHaveCount(6);
  // A raster format on every open.
  await expect(raster.and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
  await expect(dialog.getByTestId("export-format-says")).toHaveText(/^(JPEG|PNG|WebP|AVIF) — /);

  // Selected: the name with its extension, a recipe under it, one primary.
  await expect(dialog.getByLabel("File Name")).toBeEnabled();
  await expect(dialog.locator("#export-file-ext")).toHaveText(/^\.\w+$/);
  await expect(dialog.getByLabel("Recipe")).toBeEnabled();
  await expect(dialog.getByLabel("Image settings")).toContainText("Original size");
  await expect(dialog.getByRole("button", { name: "Share link" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clipboard" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Download (JPEG|PNG|WebP|AVIF)$/ })).toBeEnabled();
  await expect(dialog.locator("#export-summary")).toContainText("1 image");
  await expect(dialog.getByTestId("export-compressed")).toHaveText(/compressed|larger/i);
  // No SVG open: its group is left out of the row.
  await expect(format.getByRole("radio", { name: "SVG", exact: true })).toHaveCount(0);

  // Privacy & Metadata: shut, its choice on the right; opens to Camera Info.
  const privacy = dialog.getByRole("button", { name: /^Privacy & Metadata/ });
  await expect(privacy).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("radiogroup", { name: "Camera Info" })).toBeHidden();
  await privacy.click();
  await expect(dialog.getByRole("radiogroup", { name: "Camera Info" })).toBeVisible();

  // The layered group: ORA, and the PSD placeholder.
  await format.getByRole("radio", { name: "ORA", exact: true }).click();
  await expect(format.getByRole("radio", { name: "ORA", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(format.getByRole("radio", { name: "PSD", exact: true })).toBeDisabled();
  await expect(dialog.getByTestId("export-format-says")).toContainText("PSD plugin");
  await expect(dialog.getByRole("button", { name: "Download ORA" })).toBeVisible();

  // A raster format on every open: an ORA pick doesn't stick.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  await expect(raster.and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
  await format.getByRole("radio", { name: "ORA", exact: true }).click();

  // All: layered files can't go in a ZIP, so the pick falls back to a raster
  // format and the layered group is left out; the recipe and its Batch
  // settings come in, the name field goes.
  await what.getByRole("radio", { name: /^All images/ }).click();
  await expect(raster.and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
  await expect(format.getByRole("radio", { name: "ORA", exact: true })).toHaveCount(0);
  await expect(format.getByRole("radio")).toHaveCount(4);
  await expect(dialog.getByLabel("Recipe")).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Save recipe" })).toBeEnabled();
  const batch = dialog.getByLabel("Batch settings");
  await expect(batch).toContainText("Original size");
  await expect(batch).toContainText("Original file names");
  await expect(batch).not.toContainText("Packaging");
  await expect(dialog.getByTestId("export-compressed")).toHaveText(/^\d+ of 2 compressed$/);
  await expect(dialog.getByLabel("File Name")).toHaveCount(0);
  await expect(dialog.locator("#export-summary")).toContainText("2 images");
  await expect(dialog.getByRole("button", { name: "Download ZIP", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: /^Share All/ })).toBeDisabled();
});

test("the rows are radio groups: one Tab stop each, arrow keys move", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  // The Format row is ONE radio group across its groups: arrows run from the
  // raster group straight into the layered one.
  const format = dialog.getByRole("radiogroup", { name: "Format" });
  await format.getByRole("radio", { name: "AVIF", exact: true }).click();
  await format.getByRole("radio", { name: "AVIF", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(format.getByRole("radio", { name: "ORA", exact: true })).toHaveAttribute("aria-checked", "true");
  const tabbable = await format.getByRole("radio").evaluateAll((els) => els.filter((e) => e.getAttribute("tabindex") === "0").length);
  expect(tabbable).toBe(1);
});
