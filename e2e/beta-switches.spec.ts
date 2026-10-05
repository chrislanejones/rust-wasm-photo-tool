import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// The two Beta switches added from PRs #240 and #289: each invite link turns
// its feature on for this device, and leaving it off keeps today's behavior.
test.setTimeout(120_000);
const PHOTO = join(__dirname, "fixtures", "sky-building.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
}

async function boot(page: Page, query = "") {
  await blockExternalNetwork(page);
  await page.goto(`/${query}`);
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles([PHOTO]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
}

async function openResize(page: Page) {
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Resize & Compress", exact: true }).first().click();
  await page.waitForTimeout(800);
}

test("the invite links turn each switch on for this device", async ({ page }) => {
  await blockExternalNetwork(page);
  for (const [id, key] of [["pagespeed-budget", "ih_web_budget"], ["exif-rust", "ih_exif_rust"]] as const) {
    await page.goto(`/?beta=${id}`);
    await page.locator('input[type="file"]').first().waitFor({ state: "attached" });
    expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe("1");
  }
});

test("PageSpeed budget OFF: the panel shows the old score", async ({ page }) => {
  await boot(page);
  await openResize(page);
  await expect(page.getByText("PageSpeed Insights Score").first()).toBeVisible();
  await expect(page.getByTestId("pagespeed-budget")).toHaveCount(0);
});

test("PageSpeed budget ON: the panel shows budget used", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ih_web_budget", "1"));
  await boot(page);
  await openResize(page);
  await expect(page.getByTestId("pagespeed-budget")).toBeVisible();
  await expect(page.getByText("PageSpeed budget used").first()).toBeVisible();
  await expect(page.getByText("PageSpeed Insights Score")).toHaveCount(0);
});

test("EXIF in Rust ON: the engine functions load and an export cross-checks without a mismatch", async ({ page }) => {
  const consoleLines: string[] = [];
  page.on("console", (m) => consoleLines.push(m.text()));
  await page.addInitScript(() => localStorage.setItem("ih_exif_rust", "1"));
  await boot(page);
  await expect.poll(() => consoleLines.some((l) => l.includes("EXIF in Rust: engine functions loaded")), { timeout: 30_000 }).toBe(true);
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  // With one photo the dialog skips the Selected / All choice.
  const selected = dialog.getByRole("button", { name: "Download Selected Image" });
  if (await selected.count()) await selected.click();
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: /^Download (PNG|JPEG|WebP|AVIF)/ }).click(),
  ]);
  expect(dl.suggestedFilename()).toBeTruthy();
  await page.waitForTimeout(1000);
  expect(consoleLines.filter((l) => /EXIF in Rust: .*(MISMATCH|threw)/.test(l))).toEqual([]);
});
