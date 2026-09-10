import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Resize and Compress are ONE tile since v8.71 (#89), with a single adaptive
// Apply whose label says what it will commit:
//
//   nothing changed          "Apply Compression & Resize", disabled
//   dimensions only          "Apply Resize"
//   format / quality only    "Apply Compression"
//   both                     "Apply Compression & Resize"
//
// This spec used to pin the OLD shape — two tiles, and "Apply Resize" hidden
// under Compress — and had been failing since the tiles merged. What it still
// needs to pin is the part that matters to a user: the button never offers a
// resize when nothing has been resized, and it says "Apply Resize" the moment
// a dimension changes. A future refactor that made the label static would
// pass every other gate.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return route.continue();
    }
    return route.abort();
  });
}

async function importFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(1000);
}

test("the Resize & Compress Apply says what it will commit", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);

  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Resize & Compress", exact: true }).first().click();
  await page.waitForTimeout(900);

  const applyResize = page.getByRole("button", { name: /^Apply Resize$/ });
  const applyBoth = page.getByRole("button", { name: /^Apply Compression & Resize$/ });

  // ── At rest: the commit-everything label, disabled, and NO resize offered.
  expect(await applyResize.count(), "Apply Resize must not render before a dimension changes").toBe(0);
  await expect(applyBoth, "the at-rest label is Apply Compression & Resize").toHaveCount(1);
  await expect(applyBoth.first(), "nothing to commit yet, so it is disabled").toBeDisabled();

  // ── Change a dimension: the same button now reads Apply Resize and is live.
  // `width` is a real <label> since #114, so the field is reachable by name.
  const width = page.getByLabel("width", { exact: true });
  const current = Number(await width.inputValue());
  expect(current, "the width field carries the photo's width").toBeGreaterThan(0);
  await width.fill(String(Math.max(1, Math.round(current / 2))));
  await page.waitForTimeout(400);

  await expect(applyResize, "dimensions changed → Apply Resize").toHaveCount(1);
  await expect(applyResize.first()).toBeEnabled();
  expect(await applyBoth.count(), "and the combined label steps aside").toBe(0);

  // ── Still full-width: gating the label must not collapse the footer button.
  const w = await applyResize.first().evaluate((b) => Math.round(b.getBoundingClientRect().width));
  console.log(`[placement] Apply Resize width ${w}px`);
  expect(w, "Apply Resize is full-width").toBeGreaterThan(100);
});
