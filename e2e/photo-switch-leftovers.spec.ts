import { test, expect, type Page, type Locator } from "@playwright/test";
import { join } from "node:path";

// Per-photo state must not survive a photo switch. Two photos; make a
// per-photo thing on A (a crop rectangle, a selection), switch to B, and the
// control that acts on it must not still be armed — or it acts on B with A's
// coordinates. Found by classifying every panel control (skeleton plan §1).

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

const canvasSize = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    return c ? `${c.width}x${c.height}` : "none";
  });

async function setup(page: Page) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect.poll(() => canvasSize(page), { timeout: 30_000 }).not.toBe("none");
  await page.waitForTimeout(1500);
}

/** Switch with PgDn and wait for the new document to be on the canvas. */
async function switchPhoto(page: Page) {
  const before = await canvasSize(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("PageDown");
  await expect.poll(() => canvasSize(page), { timeout: 30_000 }).not.toBe(before);
  await page.waitForTimeout(1200);
}

async function open(page: Page, group: string, tool: string) {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: tool, exact: true }).first().click();
  await page.waitForTimeout(500);
}

/** A tile in a ToolButtonGroup — a radio in value groups, a button otherwise. */
const tile = (page: Page, name: string): Locator =>
  page.getByRole("button", { name, exact: true }).or(page.getByRole("radio", { name, exact: true })).first();

test.setTimeout(120_000);

test("L1 a crop rectangle drawn on A is gone on B — Apply Crop is not armed", async ({ page }) => {
  await setup(page);
  await open(page, "Edit", "Crop");
  await tile(page, "1:1").click(); // picking a ratio drops a crop box
  const apply = page.getByRole("button", { name: "Apply Crop", exact: true });
  await expect(apply, "the ratio armed a crop on A").toBeEnabled();
  await switchPhoto(page);
  await expect(apply, "B has no crop box of its own, so Apply Crop is off").toBeDisabled();
});

test("L2 a selection made on A is gone on B — Deselect/Delete are not armed", async ({ page }) => {
  await setup(page);
  await open(page, "Select", "Rectangle");
  await tile(page, "All").click();
  const deselect = tile(page, "Deselect");
  await expect(deselect, "Select All armed a selection on A").toBeEnabled();
  await switchPhoto(page);
  await expect(deselect, "B has nothing selected, so Deselect is off").toBeDisabled();
});
