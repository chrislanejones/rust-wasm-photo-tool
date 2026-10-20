import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The Shapes edit box follows the paste box (Chris, 10-20-2026):
//   1. its dashed box and handles sit UNDER the Tools panel, never over it
//   2. dragging the shape into the Tools panel closes that panel, and the
//      shape is still pending — closing a panel is not a commit
//
// Same probes as e2e/paste-new-layer.spec.ts: where the box and the panel
// overlap, `elementFromPoint` must land on the panel.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256

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

async function openShapes(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
  await page.waitForTimeout(400);
}

const tools = (page: Page) => page.locator('[data-paste-yields="tools"]');
const overlay = (page: Page) => page.locator("svg[data-draw-overlay]");
/** The move stem's dot above the box. */
const moveDot = (page: Page) =>
  page.locator('svg[data-draw-overlay] g[style*="cursor: move"] circle').first();

/** Alt+T toggles Tools without a click, which would commit the shape. */
async function setTools(page: Page, open: boolean): Promise<void> {
  if (((await tools(page).count()) > 0) !== open) await page.keyboard.press("Alt+KeyT");
  await expect(tools(page)).toHaveCount(open ? 1 : 0);
}

/** Rubber-band a rect over the canvas's left part, CANVAS px. */
async function drawRect(page: Page): Promise<void> {
  const c = (await page.locator("canvas.main-canvas").boundingBox())!;
  const a = { x: c.x + c.width * 0.05, y: c.y + c.height * 0.3 };
  const b = { x: c.x + c.width * 0.45, y: c.y + c.height * 0.7 };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await expect(overlay(page)).toHaveCount(1);
}

async function dragMoveDot(page: Page, toX: number): Promise<void> {
  const d = (await moveDot(page).boundingBox())!;
  const start = { x: d.x + d.width / 2, y: d.y + d.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(start.x + (toX - start.x) * (i / 12), start.y);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await openShapes(page);
});

test("the shape's box sits under the Tools panel", async ({ page }) => {
  await setTools(page, false);
  await drawRect(page);
  // Slide the shape left, onto where Tools will open, then open Tools over it.
  // Opening Tools slides the canvas (and the shape) right, so go well in.
  await dragMoveDot(page, 120);
  await setTools(page, true);
  const probe = () =>
    page.evaluate(() => {
      const body = document.querySelector("svg[data-draw-overlay] rect[stroke-dasharray]")!.getBoundingClientRect();
      const panel = document.querySelector('[data-paste-yields="tools"]')!.getBoundingClientRect();
      const l = Math.max(body.left, panel.left), r = Math.min(body.right, panel.right);
      const t = Math.max(body.top, panel.top), btm = Math.min(body.bottom, panel.bottom);
      if (l >= r || t >= btm) return { overlap: false, onPanel: false, handleOnPanel: false };
      // The box's left edge — dashed line and its west handle — under the panel.
      const edge = document.elementFromPoint(body.left, (t + btm) / 2);
      const mid = document.elementFromPoint((l + r) / 2, (t + btm) / 2);
      return {
        overlap: true,
        onPanel: !!mid?.closest('[data-paste-yields="tools"]'),
        handleOnPanel: !!edge?.closest('[data-paste-yields="tools"]'),
      };
    });
  await expect.poll(async () => (await probe()).overlap, { message: "the box should be partly under Tools" }).toBe(true);
  await page.waitForTimeout(500); // the panel's slide-in spring
  const p = await probe();
  expect(p.onPanel).toBe(true);
  expect(p.handleOnPanel).toBe(true);
  if (process.env.SHAPE_SHOT) await page.screenshot({ path: process.env.SHAPE_SHOT });
  // Opening a panel over it is not a commit.
  await expect(overlay(page)).toHaveCount(1);
});

test("dragging the shape into the Tools panel closes it", async ({ page }) => {
  await setTools(page, true);
  await drawRect(page);
  const p = (await tools(page).boundingBox())!;
  await dragMoveDot(page, p.x + p.width / 2);
  await expect(tools(page)).toHaveCount(0);
  // The shape is still pending — closing a panel is not a commit.
  await expect(overlay(page)).toHaveCount(1);
});
