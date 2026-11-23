import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";

// Paste SVG (Chris, 11-23-2026): the start screen is two rows of three tiles,
//   Browse Files · Paste · New Canvas
//   Sample Images · Create AI Image · Paste SVG
// with Create AI Image always shown and disabled while online features are
// off. Paste SVG opens a step like New Canvas: a big field for the code, Back
// at the top, width × height and background, and Create Canvas makes an image
// at exactly that size. (features/upload/PasteSvgPanel, lib/pastedSvg)

// An icon as copied out of a web page: no xmlns, which an <img> needs.
const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2"><path d="M4 4h16v16H4z"/></svg>';

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
      ? route.continue()
      : route.abort();
  });
}

/** Width × height of every stored original, decoded in the page. */
async function storedSizes(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("image-horse-dexie");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const recs: Array<{ blob: Blob }> = await new Promise((res, rej) => {
      const r = db.transaction("originals").objectStore("originals").getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return Promise.all(
      recs.map(async (x) => {
        const bmp = await createImageBitmap(x.blob);
        return `${bmp.width}x${bmp.height}`;
      }),
    );
  });
}

/** A tile by its label. The Pro key adds "Pro feature" in front of Create AI
 *  Image's name for a screen reader, so that one is matched on its end. */
const tile = (page: Page, name: string) =>
  name === "Create AI Image"
    ? page.getByRole("button", { name: /Create AI Image$/ })
    : page.getByRole("button", { name, exact: true });

const TILES = [
  "Browse Files",
  "Paste (Ctrl+V)",
  "New Canvas",
  "Sample Images",
  "Create AI Image",
  "Paste SVG",
];

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().waitFor({ state: "attached" });
});

test("the start screen is two rows of three, Create AI Image shown but off", async ({ page }) => {
  for (const name of TILES) await expect(tile(page, name), name).toBeVisible();
  // The start screen fades and slides in, so a single read can land mid-move
  // (it did, once). Poll the whole layout until it holds.
  const layout = async () => {
    const boxes = [];
    for (const name of TILES) boxes.push((await tile(page, name).boundingBox())!);
    const y = boxes.map((b) => Math.round(b.y));
    const x = boxes.map((b) => Math.round(b.x));
    return {
      rowOne: y[0] === y[1] && y[1] === y[2],
      rowTwo: y[3] === y[4] && y[4] === y[5],
      twoBelowOne: y[3]! > y[0]!,
      columns: x[0] === x[3] && x[1] === x[4] && x[2] === x[5] && x[0]! < x[1]! && x[1]! < x[2]!,
    };
  };
  await expect
    .poll(layout, { timeout: 5_000 })
    .toEqual({ rowOne: true, rowTwo: true, twoBelowOne: true, columns: true });
  // Logged out with the switch off (every e2e build): there, but disabled.
  await expect(tile(page, "Create AI Image")).toBeDisabled();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/paste-svg-start-grid.png" });
});

test("Paste SVG: Back at the top, Create Canvas makes an image at the chosen size", async ({ page }) => {
  await page.getByRole("button", { name: "Paste SVG", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paste SVG", exact: true })).toBeVisible();
  const code = page.getByRole("textbox", { name: "SVG code" });
  await expect(code).toBeFocused();
  const create = page.getByRole("button", { name: "Create Canvas", exact: true });
  await expect(create).toBeDisabled();

  // Back returns to the tiles, and the tiles take you back in.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Paste SVG", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Paste SVG", exact: true }).click();

  await code.fill("this is not svg");
  await expect(page.getByText(/isn't SVG code/)).toBeVisible();
  await expect(create).toBeDisabled();

  await code.fill(ICON);
  await expect(page.getByText(/Drawn at 24 × 24/)).toBeVisible();
  const width = page.getByRole("spinbutton", { name: "width" });
  const height = page.getByRole("spinbutton", { name: "height" });
  // A 24px icon starts at 1024, the same as a dropped one.
  await expect(width).toHaveValue("1024");
  await expect(height).toHaveValue("1024");
  // The shape is kept: typing one side sets the other.
  await width.fill("512");
  await expect(height).toHaveValue("512");

  await expect(create).toBeEnabled();
  await page.waitForTimeout(450);
  await page.screenshot({ path: "test-results/paste-svg-step.png" });
  await create.click();
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect(page.locator(".photo-thumb")).toHaveCount(1, { timeout: 30_000 });
  // Exactly the size typed, not scaled up to 1024 like a dropped file.
  await expect.poll(() => storedSizes(page), { timeout: 15_000 }).toEqual(["512x512"]);

  // It went in as an SVG, so it can go back out as one.
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const svgTile = dialog
    .getByRole("radio")
    .filter({ has: page.getByText("SVG", { exact: true }) });
  await expect(svgTile).toBeEnabled({ timeout: 10_000 });
});

test("the Paste tile opens Paste SVG when the clipboard holds SVG code", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((t) => navigator.clipboard.writeText(t), ICON);
  await page.getByRole("button", { name: "Paste (Ctrl+V)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paste SVG", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "SVG code" })).toHaveValue(ICON);
});

test("mid-session, the New dialog's Paste SVG reaches Create Canvas and adds a second image", async ({ page }) => {
  // The dialog card clips (overflow-hidden), so a step taller than the window
  // must scroll inside itself or its button is out of reach.
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.getByRole("button", { name: "Paste SVG", exact: true }).click();
  await page.getByRole("textbox", { name: "SVG code" }).fill(ICON);
  await page.getByRole("button", { name: "Create Canvas", exact: true }).click();
  await expect(page.locator(".photo-thumb")).toHaveCount(1, { timeout: 30_000 });

  await page.getByRole("button", { name: "New", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Paste SVG", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Paste SVG", exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "SVG code" }).fill(ICON.replace("red", "blue"));
  const create = dialog.getByRole("button", { name: "Create Canvas", exact: true });
  await create.scrollIntoViewIfNeeded();
  await expect(create).toBeInViewport();
  await create.click();
  await expect(page.locator(".photo-thumb")).toHaveCount(2, { timeout: 30_000 });
});

test("a late autofocus never pulls the caret out of a field you're typing in", async ({ page }) => {
  // CI on PR #509: the step's 50ms autofocus fired seconds late on a starved
  // runner, stole focus from the width box, and "512" landed at the end of the
  // SVG code. Make every 50ms timer that late, on purpose, and type anyway.
  await page.addInitScript(() => {
    const orig = window.setTimeout;
    // @ts-expect-error — deliberately widened to stretch one delay
    window.setTimeout = (fn: TimerHandler, ms?: number, ...rest: unknown[]) =>
      orig(fn, ms === 50 ? 2500 : ms, ...rest);
  });
  await page.reload();
  await page.locator('input[type="file"]').first().waitFor({ state: "attached" });
  await page.getByRole("button", { name: "Paste SVG", exact: true }).click();
  const code = page.getByRole("textbox", { name: "SVG code" });
  await code.fill(ICON);
  const width = page.getByRole("spinbutton", { name: "width" });
  await expect(width).toHaveValue("1024");
  await width.click();
  await page.waitForTimeout(2700); // the late timer fires while width has focus
  await page.keyboard.press("Control+A");
  await page.keyboard.type("512");
  await expect(page.getByRole("spinbutton", { name: "height" })).toHaveValue("512");
  await expect(code).toHaveValue(ICON);
});
