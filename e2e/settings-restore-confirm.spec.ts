import { test, expect, type Page, type Locator } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// QC F1 (09-24-2026): Settings › Restore Settings asks "Restore settings?",
// and that confirm could not be backed out of. It opened UNDER the Settings
// modal (z 50 vs 60), so every click hit Settings' scrim: Cancel appeared to
// work only because a scrim click closes the confirm, and Restore never fired.
//
// jsdom has no layout, so only a real browser can see this. Pinned: each
// button is the topmost element at its own center, Cancel and Escape keep
// the unapplied change, and Restore actually restores.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** True when `loc` is what a pointer at its center would actually hit. */
function onTop(loc: Locator): Promise<boolean> {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el === hit || el.contains(hit);
  });
}

async function realClick(page: Page, loc: Locator): Promise<void> {
  const b = (await loc.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test("Restore settings: Cancel and Escape back out, Restore restores", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(0);

  await page.locator('button[aria-label="Settings"]').first().click();
  await page.getByRole("tab", { name: /Security/ }).or(page.getByRole("button", { name: /^Security/ })).first().click();

  const apply = page.getByRole("button", { name: "Apply", exact: true });
  const restoreSettings = page.getByRole("button", { name: "Restore Settings" });
  const confirm = page.getByRole("dialog", { name: /Restore settings/ });

  await page.getByRole("button", { name: "Keep EXIF" }).first().click(); // off the default
  await expect(apply).toBeEnabled();

  // Cancel
  await restoreSettings.click();
  const cancel = confirm.getByRole("button", { name: "Cancel" });
  // Polled: the dialog animates in (and a previous one fades out), so "on top"
  // is asked the way a pointer would find it, not in the first millisecond.
  await expect.poll(() => onTop(cancel), { message: "Cancel is not covered by the Settings modal" }).toBe(true);
  await realClick(page, cancel);
  await expect(confirm).toHaveCount(0);
  await expect(restoreSettings).toBeVisible();
  await expect(apply, "Cancel keeps the unapplied change").toBeEnabled();

  // Escape — focus must move INTO the confirm first (a dialog that leaves
  // focus behind it is its own accessibility bug), then Escape closes it.
  await restoreSettings.click();
  await expect(confirm).toHaveCount(1);
  await expect
    .poll(() => confirm.evaluate((el) => el.contains(document.activeElement)), {
      message: "focus moved into the confirm",
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(restoreSettings, "Escape closes the confirm, not Settings").toBeVisible();
  await expect(apply).toBeEnabled();

  // Restore
  await restoreSettings.click();
  const restore = confirm.getByRole("button", { name: "Restore", exact: true });
  await expect.poll(() => onTop(restore), { message: "Restore is not covered by the Settings modal" }).toBe(true);
  await realClick(page, restore);
  await expect(confirm).toHaveCount(0);
  await expect(apply, "Restore brought the draft back to the defaults").toBeDisabled();
  await expect(restoreSettings).toBeDisabled();
});
