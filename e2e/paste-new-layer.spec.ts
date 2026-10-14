import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Pasting onto an open photo (Chris, 10-14-2026):
//   1. the dialog offers Stack as layer and New gallery image, no Merge
//   2. the pasted box sits UNDER the Tools / Gallery / Review panels
//   3. dragging the box into a panel closes that panel
//   4. a Resize & Compress bar hangs under the box and shrinks the paste's
//      pixels, not just its box
//
// The paste is a synthetic ClipboardEvent carrying a PNG drawn in the page,
// twice the photo's size so it arrives fit-scaled (the 4K-screenshot case).
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

async function openEditor(page: Page): Promise<{ w: number; h: number }> {
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
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return { w: c.width, h: c.height };
  });
}

/** Paste a solid PNG of the given size, as Ctrl+V over the editor would. */
async function pasteBigPng(page: Page, w: number, h: number): Promise<void> {
  await page.evaluate(
    async ({ w, h }) => {
      const oc = new OffscreenCanvas(w, h);
      const ctx = oc.getContext("2d")!;
      ctx.fillStyle = "#d33";
      ctx.fillRect(0, 0, w, h);
      const blob = await oc.convertToBlob({ type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "image.png", { type: "image/png" }));
      window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    },
    { w, h },
  );
}

async function stackAsLayer(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Add this image" });
  await dialog.waitFor({ state: "visible" });
  await expect(dialog.getByRole("button", { name: /merge/i })).toHaveCount(0);
  await dialog.getByRole("button", { name: /Stack as layer/ }).click();
  await dialog.waitFor({ state: "hidden" });
}

const bar = (page: Page) => page.getByTestId("paste-actions");
const sizeText = async (page: Page) => (await bar(page).textContent())?.match(/(\d+) × (\d+)/)?.slice(1).map(Number);

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
});

test("Resize & Compress shrinks the pasted pixels to the box, then halves them", async ({ page }) => {
  const photo = await openEditor(page);
  await pasteBigPng(page, photo.w * 2, photo.h * 2);
  await stackAsLayer(page);

  await expect(bar(page)).toBeVisible();
  // Before: the bytes are the paste's own size, the box is fit to the photo.
  expect(await sizeText(page)).toEqual([photo.w * 2, photo.h * 2]);
  if (process.env.PASTE_SHOT) await page.screenshot({ path: process.env.PASTE_SHOT });

  await bar(page).getByRole("button", { name: /Resize & Compress/ }).click();
  await expect.poll(() => sizeText(page)).toEqual([photo.w, photo.h]);

  // Already 1:1 — the next click halves it.
  await bar(page).getByRole("button", { name: /Resize & Compress/ }).click();
  await expect.poll(() => sizeText(page)).toEqual([Math.round(photo.w / 2), Math.round(photo.h / 2)]);

  // Still a live placement: Enter places it, and the bar goes away.
  await page.keyboard.press("Enter");
  await expect(bar(page)).toHaveCount(0);
});

const tools = (page: Page) => page.locator('[data-paste-yields="tools"]');

/** Alt+T toggles Tools without a click, which would commit the paste. */
async function setTools(page: Page, open: boolean): Promise<void> {
  if (((await tools(page).count()) > 0) !== open) await page.keyboard.press("Alt+KeyT");
  await expect(tools(page)).toHaveCount(open ? 1 : 0);
}

async function dragBody(page: Page, to: { x: number; y: number }): Promise<void> {
  const b = (await page.locator("svg[data-paste-overlay] rect").first().boundingBox())!;
  // Grab the body's right third: the part furthest from the Tools panel.
  const start = { x: b.x + b.width * 0.8, y: b.y + b.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    await page.mouse.move(start.x + (to.x - start.x) * t, start.y + (to.y - start.y) * t);
  }
  await page.mouse.up();
}

test("the pasted box sits under the Tools panel", async ({ page }) => {
  const photo = await openEditor(page);
  await setTools(page, false);
  await pasteBigPng(page, photo.w * 2, photo.h * 2);
  await stackAsLayer(page);

  // Slide the box left, onto where Tools will open, then open Tools over it.
  const b = (await page.locator("svg[data-paste-overlay] rect").first().boundingBox())!;
  await dragBody(page, { x: 200 + b.width * 0.3, y: b.y + b.height / 2 });
  await setTools(page, true);
  // Where the box and the panel overlap, the browser must hit the PANEL.
  // Opening Tools slides the canvas (and the box) right while the panel slides
  // in, so wait for the two to settle into an overlap before asking.
  const probe = () => page.evaluate(() => {
    const body = document.querySelector("svg[data-paste-overlay] rect")!.getBoundingClientRect();
    const panel = document.querySelector('[data-paste-yields="tools"]')!.getBoundingClientRect();
    const l = Math.max(body.left, panel.left), r = Math.min(body.right, panel.right);
    const t = Math.max(body.top, panel.top), btm = Math.min(body.bottom, panel.bottom);
    if (l >= r || t >= btm) return { overlap: false, onPanel: false };
    const el = document.elementFromPoint((l + r) / 2, (t + btm) / 2);
    return { overlap: true, onPanel: !!el?.closest('[data-paste-yields="tools"]') };
  });
  await expect.poll(async () => (await probe()).overlap, { message: "the box should be partly under Tools" }).toBe(true);
  await page.waitForTimeout(500); // the panel's slide-in spring
  expect((await probe()).onPanel).toBe(true);
  // Opening a panel over it is not a commit.
  await expect(bar(page)).toBeVisible();
});

test("dragging the pasted box into the Tools panel closes it", async ({ page }) => {
  const photo = await openEditor(page);
  await setTools(page, true);
  await pasteBigPng(page, photo.w * 2, photo.h * 2);
  await stackAsLayer(page);
  await expect(bar(page)).toBeVisible();

  const p = (await tools(page).boundingBox())!;
  await dragBody(page, { x: p.x + p.width / 2, y: p.y + p.height / 2 });
  await expect(tools(page)).toHaveCount(0);
  // The paste is still live — closing a panel is not a commit.
  await expect(bar(page)).toBeVisible();
});
