import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Resize and Compress are ONE tile since v8.71 (#89), with a single adaptive
// Apply whose label says what it will commit:
//
//   nothing changed          "Apply", disabled
//   dimensions only          "Apply Resize"
//   format / quality only    "Apply Compression"
//   both                     "Apply Resize & Compression"
//
// (10-07: the at-rest label was "Apply Compression & Resize" — a long label,
// greyed out, naming a resize nobody asked for. And Method stopped counting
// as compression: choosing Catmull-Rom turned a PNG into a JPEG.)
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
  const applyRest = page.getByRole("button", { name: /^Apply$/ });
  const applyBoth = page.getByRole("button", { name: /^Apply Resize & Compression$/ });

  // ── At rest: plain "Apply", disabled, and NO resize offered.
  expect(await applyResize.count(), "Apply Resize must not render before a dimension changes").toBe(0);
  await expect(applyRest, "the at-rest label is just Apply").toHaveCount(1);
  await expect(applyRest.first(), "nothing to commit yet, so it is disabled").toBeDisabled();

  // ── Method alone is not a change: it is the kernel the next resize uses.
  await page.getByLabel("Method", { exact: true }).selectOption("nearest");
  await page.waitForTimeout(300);
  await expect(applyRest.first(), "Method alone leaves Apply disabled").toBeDisabled();

  // ── Change a dimension: the same button now reads Apply Resize and is live.
  // `width` is a real <label> since #114, so the field is reachable by name.
  const width = page.getByLabel("width", { exact: true });
  const current = Number(await width.inputValue());
  expect(current, "the width field carries the photo's width").toBeGreaterThan(0);
  const target = Math.max(1, Math.round(current / 2));
  await width.fill(String(target));
  await page.waitForTimeout(400);

  await expect(applyResize, "dimensions changed → Apply Resize").toHaveCount(1);
  await expect(applyResize.first()).toBeEnabled();
  expect(await applyBoth.count(), "no compression is pending, so the combined label steps aside").toBe(0);

  // ── Still full-width: gating the label must not collapse the footer button.
  const w = await applyResize.first().evaluate((b) => Math.round(b.getBoundingClientRect().width));
  console.log(`[placement] Apply Resize width ${w}px`);
  expect(w, "Apply Resize is full-width").toBeGreaterThan(100);

  // ── The photo lands on EXACTLY the typed width (10-07: 128 came out 118,
  // because the artboard border was scaled into the target).
  const heightField = page.getByLabel("height", { exact: true });
  const targetH = Number(await heightField.inputValue());
  await applyResize.first().click();
  await expect(page.getByText(`Photo: ${target}×${targetH}`), "the status bar reports the typed size").toBeVisible({ timeout: 15_000 });
  await expect(applyRest.first(), "nothing left pending").toBeDisabled();
});

test("compression drafts, applied quality and undo follow each photo", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles([FIXTURE_PNG, join(__dirname, 'fixtures', 'sky-building.png')]);
  await page.locator('canvas.main-canvas').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Enhance', exact: true }).first().click();
  await page.getByRole('button', { name: 'Resize & Compress', exact: true }).first().click();
  const quality = page.getByRole('slider', { name: 'Quality', exact: true });
  await expect(quality).toHaveAttribute('aria-valuetext', '75%');
  const choose = async (value: number) => {
    await quality.evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value === 70 ? 33 : 0);
  };
  await choose(70);
  await page.getByRole('button', { name: 'Apply Compression', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press('PageDown');
  await expect(page.getByLabel('width', { exact: true })).toHaveValue('1200');
  await expect(quality).toHaveAttribute('aria-valuetext', '75%');
  await choose(50);
  await page.getByRole('button', { name: 'Apply Compression', exact: true }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press('PageUp');
  await expect(page.getByLabel('width', { exact: true })).toHaveValue('256');
  await expect(quality).toHaveAttribute('aria-valuetext', '70%');
  await page.keyboard.press('Control+z');
  await expect(quality).toHaveAttribute('aria-valuetext', '75%');
  await page.keyboard.press('Control+Shift+z');
  await expect(quality).toHaveAttribute('aria-valuetext', '70%');
  await page.screenshot({ path: 'test-results/state-v4-night2-quality.png' });
});
