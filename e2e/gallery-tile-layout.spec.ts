import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { blockExternalNetwork } from "./gallery-skeleton-harness";

// Night 10-07 §1.2 + §1.3 — two gallery defects a person sees (PARKING_LOT
// 10-06-2026, found during the gallery skeleton work, both on master too).
//
// §1.2 The docked vertical gallery's tiles OVERLAPPED with 12 photos at
//      1000×800: the grid lives in a height-constrained column, its tiles are
//      overflow-hidden (automatic minimum 0), so the `auto` rows were squeezed
//      to fit the column (~61px rows for ~87px tiles) instead of scrolling.
// §1.3 Hovering the BAR showed every tile's Remove and Select: `group-hover:`
//      matches ANY `.group` ancestor, and the bar's wrapper was one.

test.setTimeout(180_000);

const fx = (p: string) => join(__dirname, "fixtures", p);
const TWELVE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  .map((n) => fx(`phone/p${n}.png`))
  .concat([fx("sky-building.png"), fx("checker.png"), fx("paper-1200x900.png")]);

async function dismissNotices(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const ok = page.getByRole("dialog").getByRole("button", { name: /^(Got it|Continue)$/ });
    if (!(await ok.isVisible().catch(() => false))) {
      if (i > 0) return;
      await page.waitForTimeout(300);
      continue;
    }
    await ok.click();
    await page.waitForTimeout(300);
  }
}

/** Reachable gallery tiles (not inert, rendered). */
const tileBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-skeleton-skip] [data-id]")]
      .filter((t) => !t.closest("[inert]") && t.offsetParent !== null)
      .map((t) => {
        const r = t.getBoundingClientRect();
        return { id: t.dataset.id!, l: r.left, t: r.top, r: r.right, b: r.bottom };
      }),
  );

async function importTwelve(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(TWELVE);
  await dismissNotices(page);
  if (width <= 1000 && width >= 600) {
    for (let i = 0; i < 4; i++) {
      const visible = await page.locator("[data-gallery-card]:visible").count();
      if (visible) break;
      await dismissNotices(page);
      await page.getByRole("button", { name: "Gallery", exact: true }).first().click({ timeout: 5_000 }).catch(() => {});
    }
  }
  await expect.poll(async () => (await tileBoxes(page)).length, { timeout: 60_000 }).toBe(12);
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll("[data-skeleton-skip] [data-id] img").length), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(12);
}

for (const shape of [
  { width: 1000, height: 800 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`no two gallery tiles overlap at ${shape.width}×${shape.height}`, async ({ page }, testInfo) => {
    await importTwelve(page, shape.width, shape.height);
    await page.waitForTimeout(800); // enter animations settle; the boxes are layout, not paint
    for (const theme of ["light", "dark"]) {
      await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await page.screenshot({ path: testInfo.outputPath(`gallery-${theme}.png`), animations: "disabled" });
    }
    const boxes = await tileBoxes(page);
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ox > 0.5 && oy > 0.5) hits.push(`${i}×${j} (${ox.toFixed(1)}×${oy.toFixed(1)}px)`);
      }
    expect(hits, `overlapping tile pairs at ${shape.width}×${shape.height}`).toEqual([]);
  });
}

const shownTileButtons = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>('[data-skeleton-skip] button[aria-label="Remove image"], [data-skeleton-skip] button[aria-label="Select image"]')]
        .filter((b) => !b.closest("[inert]") && Number(getComputedStyle(b).opacity) > 0.01).length,
  );

test("hovering the bar reveals its close button and no tile's buttons", async ({ page }) => {
  await importTwelve(page, 1280, 800);
  const card = page.locator("[data-gallery-card]:visible").first();
  const box = (await card.boundingBox())!;
  // The card's bottom padding: inside the bar, outside every tile.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 4);
  await expect(page.getByRole("button", { name: "Close Gallery" })).toBeVisible();
  await page.waitForTimeout(400); // past the 150ms opacity transition
  expect(await shownTileButtons(page), "tile buttons shown while hovering the bar's padding").toBe(0);

  // One tile: that tile's buttons only (Remove + Select = 2).
  const first = (await tileBoxes(page))[0]!;
  await page.mouse.move((first.l + first.r) / 2, (first.t + first.b) / 2);
  await page.waitForTimeout(400);
  expect(await shownTileButtons(page), "hovering one tile shows that tile's two buttons").toBe(2);
});
