import { test, expect } from "./guard/test";
import { join } from "node:path";

test("a failed archive remains visible, preserves edits, and clears only after retry succeeds", async ({ page }) => {
  await page.route("**/*", route => /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)[:/]|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    const flags = window as unknown as { failArchive: boolean };
    flags.failArchive = true;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === "edits" && flags.failArchive) throw new DOMException("Injected full disk", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([join(__dirname, "fixtures/checker.png"), join(__dirname, "fixtures/sky-building.png")]);
  const canvas = page.locator("canvas.main-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("button", { name: "Select photo checker", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await page.getByRole("button", { name: /^Apply Vivid —/ }).first().click();
  await canvas.hover({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await expect(page.getByTestId("status-save-failed")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Select photo sky-building", exact: true }).click();
  await expect(page.getByText(/The outgoing edits couldn't be saved/).first()).toBeVisible();
  await page.getByRole("button", { name: "Select photo checker", exact: true }).click();
  await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await expect(page.getByTestId("status-save-failed")).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).first().click();
  await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  await page.screenshot({ path: "test-results/state-v4-night5-save.png" });
  await page.evaluate(() => { (window as unknown as { failArchive: boolean }).failArchive = false; });
  await page.getByRole("button", { name: "Select photo sky-building", exact: true }).click();
  await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0);
  await expect(page.getByTestId("status-save-failed")).toHaveCount(0);
});
