import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// UI Night 8, PR 2 — the parts of finishing Night 7 that only a browser sees.
//
//   • §3 the color picker's SAVED swatches are a named radio group: the lit
//     one is announced as checked. They were the one swatch row in the app
//     that said nothing.
//   • §7 the edited dot on Levels, Resize & Compress and Canvas Size shows only
//     while a per-photo value is off its default, and Reset puts it back.
//   • §4 the panel grammar, measured: every converted panel has the ToolPanel
//     frame, its header at the top, 16px between rows and 8px from a label to
//     its control (docs/UI_CONSISTENCY.md §8).
// ─────────────────────────────────────────────────────────────────────────────

const FIX = join(__dirname, "fixtures");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

async function importImages(page: Page): Promise<void> {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles([
    { name: "paper.png", mimeType: "image/png", buffer: readFileSync(join(FIX, "paper-1200x900.png")) },
    { name: "checker.png", mimeType: "image/png", buffer: readFileSync(join(FIX, "checker.png")) },
  ]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function openTool(page: Page, group: string, sub: string): Promise<void> {
  const opts = page.getByRole("region", { name: "Tool options" });
  await opts.getByRole("button", { name: group, exact: true }).first().click();
  await opts.getByRole("button", { name: sub, exact: true }).first().click();
  await page.waitForTimeout(600);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await blockExternalNetwork(page);
  await page.goto("/");
  await importImages(page);
});

test("§3 the color picker's saved swatches are a named radio group that says which is lit", async ({ page }) => {
  await openTool(page, "Create", "Brush");
  await page.getByRole("region", { name: "Tool options" }).getByRole("button", { name: "Pick a custom color" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Save to palette" }).click();

  const palette = dialog.getByRole("radiogroup", { name: "Palette" });
  await expect(palette).toBeVisible();
  // The color just saved IS the current color, so it is the checked one.
  await expect(palette.getByRole("radio")).toHaveCount(1);
  await expect(palette.getByRole("radio", { checked: true })).toHaveCount(1);
});

// ── §7 the edited dot ───────────────────────────────────────────────────────

const dot = (page: Page, label: string) =>
  page.getByRole("region", { name: "Tool options" }).getByRole("img", { name: `${label} changed on this photo` });
const reset = (page: Page, label: string) =>
  page.getByRole("region", { name: "Tool options" }).getByRole("button", { name: `Reset ${label}` });

test("§7 Levels: no dot at the identity curve; a moved point shows one; Reset returns to identity", async ({ page }) => {
  await openTool(page, "Enhance", "Levels");
  const panel = page.getByRole("region", { name: "Tool options" });
  await expect(dot(page, "Curve")).toHaveCount(0);
  const black = panel.getByRole("slider", { name: "Black point" });
  await black.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await expect(dot(page, "Curve")).toHaveCount(1);
  await reset(page, "Curve").click();
  await expect(dot(page, "Curve")).toHaveCount(0);
  await expect(black).toHaveValue("0");
});

test("§7 Resize: no dot at the photo's own size; a new width shows one; Reset returns to it", async ({ page }) => {
  await openTool(page, "Enhance", "Resize & Compress");
  const panel = page.getByRole("region", { name: "Tool options" });
  await expect(dot(page, "Scale")).toHaveCount(0);
  const width = panel.getByRole("spinbutton", { name: /width/i }).first();
  await width.fill("600");
  await width.press("Tab");
  await expect(dot(page, "Scale")).toHaveCount(1);
  await reset(page, "Scale").click();
  await expect(dot(page, "Scale")).toHaveCount(0);
  await expect(width).toHaveValue("1200");
});

test("§7 Canvas Size: no dot at the original canvas; a new width shows one; Reset returns to it", async ({ page }) => {
  await openTool(page, "Edit", "Canvas Size");
  const panel = page.getByRole("region", { name: "Tool options" });
  await expect(dot(page, "Scale")).toHaveCount(0);
  const width = panel.getByRole("spinbutton", { name: /width/i }).first();
  await width.fill("1500");
  await width.press("Tab");
  await expect(dot(page, "Scale")).toHaveCount(1);
  await reset(page, "Scale").click();
  await expect(dot(page, "Scale")).toHaveCount(0);
  await expect(width).toHaveValue("1200");
});

// ── §4 Stamp: the preset highlight must not outlive the armed stamp ─────────
// docs/PARKING_LOT.md (09-22-2026): switching Stamps › Clone Stamp › Stamps
// disarms the stamp (useStampTeardown) but the panel kept its own highlight,
// so a stamp looked picked while clicks no longer placed it.
const litStamps = (page: Page) =>
  page.getByRole("region", { name: "Tool options" }).locator("button").evaluateAll(
    (els) => els.filter((e) => (e as HTMLElement).style.borderStyle === "solid").length,
  );

test("§4 Stamp: a picked preset is not still lit after Stamps › Clone Stamp › Stamps", async ({ page }) => {
  await openTool(page, "Create", "Stamps");
  await page.getByRole("region", { name: "Tool options" }).getByText("[APPROVED]").click();
  await expect.poll(() => litStamps(page)).toBe(1);
  await openTool(page, "Create", "Clone Stamp");
  await openTool(page, "Create", "Stamps");
  await expect.poll(() => litStamps(page)).toBe(0);
  // And through the other sibling sub-tool.
  await page.getByRole("region", { name: "Tool options" }).getByText("[DRAFT]").click();
  await expect.poll(() => litStamps(page)).toBe(1);
  await openTool(page, "Create", "Emoji");
  await openTool(page, "Create", "Stamps");
  await expect.poll(() => litStamps(page)).toBe(0);
});

// ── §4 the panel grammar, measured ──────────────────────────────────────────
// docs/UI_CONSISTENCY.md §8: the ToolPanel frame; its first row at the top of
// the scrolling body (no -mt-2 tuck); 16px between the frame's rows; 8px from
// a ControlRow's label to its control. Measured in one evaluate so nothing
// moves between reads.
async function grammar(page: Page) {
  return page.evaluate(() => {
    const region = document.querySelector('[role="region"][aria-label="Tool options"]')!;
    const body = region.querySelector<HTMLElement>(".overflow-y-auto")!;
    const r = (el: Element) => el.getBoundingClientRect();
    const vis = (el: Element) => r(el).width > 0 && r(el).height > 0;
    const bodyTop = r(body).top + parseFloat(getComputedStyle(body).paddingTop) - body.scrollTop;
    const frame = body.querySelector('[data-slot="tool-panel"]');
    const kids = frame ? [...frame.children].filter(vis) : [];
    const gaps = kids.slice(1).map((k, i) => Math.round(r(k).top - r(kids[i]).bottom));
    const rows = [...body.querySelectorAll('[data-slot="control-row"]')].filter(vis).map((row) => {
      const ctl = row.querySelector('[data-slot="control"]')!;
      return Math.round(r(ctl).top - r(row.firstElementChild!).bottom);
    });
    return {
      frame: !!frame,
      firstRow: kids[0] ? Math.round(r(kids[0]).top - bodyTop) : null,
      gaps: [...new Set(gaps)],
      labelToControl: [...new Set(rows)],
    };
  });
}

const GRAMMAR_PANELS: [string, string][] = [
  ["Enhance", "Adjustments"],
  ["Enhance", "Levels"],
  ["Enhance", "Presets"],
  ["Edit", "Layers"],
  ["Edit", "Canvas Size"],
  ["Edit", "Guides"],
  ["Select", "Magic Wand"],
  ["Edit", "Perspective"],
  ["Create", "Stamps"],
  ["Create", "Text"],
  ["Create", "Shapes"],
  ["Batch", "Logo"],
  ["Batch", "Text"],
  ["Batch", "Crop"],
];

test("§4 every converted panel measures on the grammar: frame, first row at 0, 16px rows, 8px label → control", async ({ page }) => {
  const off: string[] = [];
  for (const [g, s] of GRAMMAR_PANELS) {
    await openTool(page, g, s);
    const m = await grammar(page);
    const ok =
      m.frame &&
      m.firstRow === 0 &&
      m.gaps.every((x) => x === 16) &&
      m.labelToControl.every((x) => x === 8);
    if (!ok) off.push(`${g} › ${s}: ${JSON.stringify(m)}`);
  }
  expect(off, off.join("\n")).toEqual([]);
});
