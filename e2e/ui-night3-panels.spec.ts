import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// UI Night 3: the tool-panel grammar in a real browser. The unit tests
// (components/ui/tool-panel-grammar.test.ts) pin the slots, names and the
// reason wiring in jsdom; this spec pins what jsdom cannot see:
//
//   • the accessibility tree (what getByRole reads) exposes each preset row
//     and the color swatches as a named radio group — the swatch group sits
//     on a `display: contents` element, and only Chromium can say whether the
//     role survives that;
//   • each of those groups is ONE Tab stop in the real tab order;
//   • a range input paints the house focus ring on keyboard focus (it painted
//     only a 15%-alpha thumb halo before Night 3);
//   • Apply Crop, disabled, is described by the visible reason, and the reason
//     goes away once there is something to crop.
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

async function importImage(page: Page): Promise<void> {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles({ name: "checker.png", mimeType: "image/png", buffer: readFileSync(FIXTURE_PNG) });
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function openTool(page: Page, group: string, sub: string): Promise<void> {
  const opts = page.getByRole("region", { name: "Tool options" });
  await opts.getByRole("button", { name: group, exact: true }).first().click();
  await opts.getByRole("button", { name: sub, exact: true }).first().click();
}

/** The focused element's painted outline. */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      focusVisible: el.matches(":focus-visible"),
      style: cs.outlineStyle,
      width: parseFloat(cs.outlineWidth),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importImage(page);
});

test("Paint: preset rows and swatches are named radio groups, one Tab stop each", async ({ page }) => {
  await openTool(page, "Create", "Brush");
  const panel = page.getByRole("region", { name: "Tool options" });

  const opacity = panel.getByRole("radiogroup", { name: "Opacity presets" });
  await expect(opacity.getByRole("radio")).toHaveCount(4);
  const color = panel.getByRole("radiogroup", { name: "Color" });
  await expect(color.getByRole("radio", { checked: true })).toHaveCount(1);

  // Keyboard into the Opacity group: it lands on the checked preset, and ONE
  // Tab leaves the group for the Opacity slider.
  const checked = opacity.getByRole("radio", { checked: true });
  await checked.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(checked).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("slider", { name: "Opacity" })).toBeFocused();

  // Same for the swatches: one stop, then the "+" action.
  const swatch = color.getByRole("radio", { checked: true });
  await swatch.focus();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("button", { name: "Pick a custom color" })).toBeFocused();
});

test("A slider shows the house focus ring on keyboard focus", async ({ page }) => {
  await openTool(page, "Create", "Brush");
  const slider = page.getByRole("region", { name: "Tool options" }).getByRole("slider", { name: "Hardness" });
  // Keyboard focus, not .focus(): Shift+Tab back from the slider, then Tab.
  await slider.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(slider).toBeFocused();
  const r = await focusRing(page);
  expect(r.focusVisible).toBe(true);
  expect(r.style, "an outline is drawn, not only the thumb halo").not.toBe("none");
  expect(r.width).toBeGreaterThanOrEqual(2);
});

test("Eraser: the stabilizer is in Advanced, collapsed, and its summary says the level", async ({ page }) => {
  await openTool(page, "Create", "Eraser");
  const panel = page.getByRole("region", { name: "Tool options" });
  const advanced = panel.getByRole("button", { name: /^Advanced/ });
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await expect(advanced).toContainText("Stabilizer: Off");
  await expect(panel.getByRole("radiogroup", { name: "Stroke Stabilizer" })).toHaveCount(0);
  await advanced.click();
  await expect(panel.getByRole("radiogroup", { name: "Stroke Stabilizer" })).toBeVisible();
});

test("Crop: a disabled Apply Crop says why, and stops saying it once there is a crop", async ({ page }) => {
  await openTool(page, "Edit", "Crop");
  const apply = page.getByRole("button", { name: "Apply Crop" });
  await expect(apply).toBeDisabled();
  await expect(apply).toHaveAccessibleDescription("Drag a crop box on the canvas, or pick a ratio.");
  await expect(page.getByText("Drag a crop box on the canvas, or pick a ratio.")).toBeVisible();

  await page.getByRole("radiogroup", { name: "Ratio" }).getByRole("radio", { name: "1:1" }).click();
  await expect(apply).toBeEnabled();
  await expect(apply).toHaveAccessibleDescription("");
  await expect(page.getByText("Drag a crop box on the canvas, or pick a ratio.")).toHaveCount(0);
});
