import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// The Export dialog as ONE step (Chris, 11-23-2026):
//   1. Download Selected | Download All (N)        — top bar style group
//   2. Raster | Vector | With Layers               — top bar style group
//   3. that kind's format tiles                    — the Shapes picker's tiles
//   4. Camera Info · 5. Recipe · 5.5 File Name
//   6. Selected: Download <format> · Share link · Clipboard
//      All:      Download ZIP (N as <format>) · Share All · Soon (off)
// Rows that don't apply are grayed out, not removed. Alt+E opens it.

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

test("one step: the rows, and what each scope greys out", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const what = dialog.getByRole("radiogroup", { name: "What to export" });
  const kind = dialog.getByRole("radiogroup", { name: "Kind of file" });
  const format = dialog.getByRole("radiogroup", { name: "Format" });
  await expect(what.getByRole("radio", { name: "Download Selected" })).toHaveAttribute("aria-checked", "true");
  await expect(kind.getByRole("radio", { name: "Raster" })).toHaveAttribute("aria-checked", "true");
  await expect(format.getByRole("radio")).toHaveCount(4); // JPEG PNG WebP AVIF
  for (const label of ["Camera Info", "Recipe", "File Name"]) {
    await expect(dialog.getByText(label, { exact: true }), label).toBeVisible();
  }
  await expect(dialog.getByText(/Every open image, each with its edits/)).toHaveCount(0);

  // Selected: the recipe is off, the name is live, three actions.
  await expect(dialog.getByLabel("Recipe")).toBeDisabled();
  await expect(dialog.getByLabel("File Name")).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Share link" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clipboard" })).toBeVisible();
  // No SVG open: Vector is off.
  await expect(kind.getByRole("radio", { name: "Vector" })).toBeDisabled();

  // With Layers: ORA, and the PSD placeholder.
  await kind.getByRole("radio", { name: "With Layers" }).click();
  await expect(format.getByRole("radio", { name: /Krita/ })).toHaveAttribute("aria-checked", "true");
  await expect(format.getByRole("radio", { name: "Activate with plugin" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Download ORA" })).toBeVisible();

  // Raster is the default on every open: an ORA pick doesn't stick.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  await expect(kind.getByRole("radio", { name: "Raster" })).toHaveAttribute("aria-checked", "true");
  await kind.getByRole("radio", { name: "With Layers" }).click();

  // All: layered files can't go in a ZIP, so the kind falls back to Raster
  // and With Layers is off; the recipe is live, the name is off.
  await what.getByRole("radio", { name: /^Download All/ }).click();
  await expect(kind.getByRole("radio", { name: "Raster" })).toHaveAttribute("aria-checked", "true");
  await expect(kind.getByRole("radio", { name: "With Layers" })).toBeDisabled();
  await expect(dialog.getByLabel("Recipe")).toBeEnabled();
  await expect(dialog.getByLabel("File Name")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: /^Download ZIP \(2 as / })).toBeEnabled();
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
