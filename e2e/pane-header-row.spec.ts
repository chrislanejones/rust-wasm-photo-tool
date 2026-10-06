import { test, expect } from "./guard/test";
import type { Page, Locator } from "@playwright/test";
import { join } from "node:path";

// Every sub-pane header is one row (Chris, 10-05-2026): [<] Back on the left,
// the title centered, [X] close on the right — Back the same size as the X,
// and only ONE close in the dialog.

const FIXTURES = [join(__dirname, "fixtures", "checker.png"), join(__dirname, "fixtures", "sky-building.png")];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

const page_ = (l: Locator) => l.page();

async function expectRow(dialog: Locator, title: string, shot: string) {
  const back = dialog.getByRole("button", { name: "Back", exact: true });
  const closes = dialog.getByRole("button", { name: "Close", exact: true });
  const heading = dialog.getByRole("heading", { name: title, exact: true });
  await expect(back).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(closes, "one close in the dialog, in the header row").toHaveCount(1);

  // The pane slides in (PaneSwap); measure once it has stopped moving, and
  // take every box in ONE read so nothing moves between them.
  await page_(dialog).waitForTimeout(450);
  const m = await heading.evaluate((el) => {
    const row = el.parentElement!;
    const box = (e: Element) => e.getBoundingClientRect();
    const back = row.querySelector('[aria-label="Back"]')!;
    const close = row.querySelector('[aria-label="Close"]')!;
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    const [b, x, r, h] = [box(back), box(close), box(row), box(el)];
    return {
      backW: b.width, backH: b.height, closeW: x.width, closeH: x.height,
      backMidY: b.y + b.height / 2, closeMidY: x.y + x.height / 2,
      backX: b.x, closeX: x.x, titleLeft: h.x, titleRight: h.x + h.width,
      textCenter: t.x + t.width / 2, rowCenter: r.x + r.width / 2,
    };
  });
  expect(Math.round(m.backW), "Back is as wide as the close").toBe(Math.round(m.closeW));
  expect(Math.round(m.backH), "Back is as tall as the close").toBe(Math.round(m.closeH));
  expect(Math.abs(m.backMidY - m.closeMidY), "Back and close on one line").toBeLessThan(2);
  expect(m.backX, "Back on the left").toBeLessThan(m.titleLeft);
  expect(m.closeX, "close on the right").toBeGreaterThanOrEqual(m.titleRight - 1);
  expect(Math.abs(m.textCenter - m.rowCenter), "title centered on the row").toBeLessThan(1.5);
  await dialog.screenshot({ path: `test-results/${shot}.png` });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  // Two photos, so Export opens on its Selected / All choice and has a Back.
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
});

test("New dialog: New Canvas and Create AI Image headers are [<] title [X]", async ({ page }) => {
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  console.log("NEW TILES: " + (await dialog.getByRole("button").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).join(" | "));
  await dialog.getByRole("button", { name: /canvas/i }).first().click();
  await expectRow(dialog, "New Canvas", "pane-header-new-canvas");
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Close", exact: true }), "the tile grid keeps its corner close").toHaveCount(1);

  // Logged out (every e2e build) the AI tile is off, so this pane is reached
  // only when it is there; the header is the same component either way.
  const ai = dialog.getByRole("button", { name: /Create AI Image/i });
  if ((await ai.count()) && (await ai.first().isEnabled())) {
    await ai.first().click();
    await expectRow(dialog, "Create AI Image", "pane-header-ai");
  }
});

test("Export dialog: Selected Image header is [<] title [X], one close", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Download Selected Image" }).click();
  await expectRow(dialog, "Selected Image", "pane-header-selected");
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Export", exact: true }), "the first pane keeps its Export header").toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toHaveCount(1);
  await dialog.getByRole("button", { name: /Download All Images/ }).click();
  await expectRow(dialog, "All Images", "pane-header-all");
});
