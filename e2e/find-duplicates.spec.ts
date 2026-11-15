import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Gallery › Select ▾ › Find duplicates (ticket 232), through the real UI.
//
// Nine drawn photos (e2e/fixtures/dupes, never real ones): one lake photo five
// ways (960, 640 and 320 px wide, a q 0.55 re-save, a 1-px crop), a burst pair
// on a beach, and two different shots of a pier.
//
// Find duplicates must find two groups, mark the largest (then heaviest) photo
// Keep, tick the rest, and leave the pier shots alone. Ticking only selects:
// nothing is deleted until the gallery's own Delete Selected is confirmed.
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "fixtures/dupes");
const NAMES = [
  "lake-960",
  "lake-640",
  "lake-320",
  "lake-resave",
  "lake-crop",
  "beach-burst-1",
  "beach-burst-2",
  "pier-wide",
  "pier-close",
];
const EXTRAS = ["beach-burst-1", "lake-320", "lake-640", "lake-crop", "lake-resave"];
const KEPT = ["beach-burst-2", "lake-960", "pier-close", "pier-wide"];

async function offline(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
}

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await offline(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(
    NAMES.map((n) => ({ name: `${n}.jpg`, mimeType: "image/jpeg", buffer: readFileSync(join(DIR, `${n}.jpg`)) })),
  );
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator('[aria-label^="Select photo"]')).toHaveCount(NAMES.length, { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

async function photosLeft(page: Page): Promise<string[]> {
  const names = await page
    .locator('[aria-label^="Select photo"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")!.replace("Select photo ", "")));
  return names.sort();
}

/** The photos whose gallery tick is on (as in bulk-night.spec.ts). */
async function ticked(page: Page): Promise<string[]> {
  const names = await page.locator('[aria-label^="Select photo"]').evaluateAll((els) =>
    els
      .filter((el) => el.querySelector('button[aria-pressed="true"]'))
      .map((el) => el.getAttribute("aria-label")!.replace("Select photo ", "")),
  );
  return names.sort();
}

async function findDuplicates(page: Page) {
  await page.getByRole("button", { name: "Select by", exact: true }).click();
  await page.getByRole("menu", { name: "Select by" }).getByRole("menuitem", { name: "Find duplicates…" }).click();
  const dialog = page.getByRole("dialog", { name: "Find duplicates" });
  await expect(dialog.getByText(/2 groups of look-alikes among 9 photos/)).toBeVisible({ timeout: 30_000 });
  const ms = Number(await dialog.locator("[data-ms]").getAttribute("data-ms"));
  return { dialog, ms };
}

test("Find duplicates groups look-alikes, ticks the extras, and deletes only through Delete Selected", async ({ page }) => {
  await open(page);
  expect(await ticked(page)).toEqual([]);

  const cold = await findDuplicates(page);
  const { dialog } = cold;

  // Two groups, side by side: the five lakes and the burst pair. The pier
  // shots are in neither.
  const groups = dialog.locator("section");
  await expect(groups).toHaveCount(2);
  const inGroup = async (i: number) =>
    (await groups.nth(i).locator("li[data-photo]").evaluateAll((els) => els.map((e) => e.getAttribute("data-photo")!))).sort();
  expect(await inGroup(0)).toEqual(["lake-320", "lake-640", "lake-960", "lake-crop", "lake-resave"]);
  expect(await inGroup(1)).toEqual(["beach-burst-1", "beach-burst-2"]);
  await expect(dialog.locator("li[data-photo^='pier']")).toHaveCount(0);

  // Keep: the largest resolution, then the larger file.
  const keeps = await dialog.locator("li[data-keep]").evaluateAll((els) => els.map((e) => e.getAttribute("data-photo")!));
  expect(keeps.sort()).toEqual(["beach-burst-2", "lake-960"]);

  // Each card says its size, dimensions and edit state.
  const lake = dialog.locator("li[data-photo='lake-960']");
  await expect(lake).toContainText("960 × 720");
  await expect(lake).toContainText(/\d+ KB/);
  await expect(lake).toContainText("Not edited");

  // Pre-ticked: everything but Keep. Nothing has touched the gallery yet.
  for (const n of EXTRAS) await expect(dialog.getByRole("checkbox", { name: `Tick ${n}` })).toBeChecked();
  for (const n of ["lake-960", "beach-burst-2"]) await expect(dialog.getByRole("checkbox", { name: `Tick ${n}` })).not.toBeChecked();
  expect(await ticked(page)).toEqual([]);

  // Keyboard: the tick boxes are reachable and the apply button is a button.
  await dialog.getByRole("checkbox", { name: "Tick lake-320" }).focus();
  await page.keyboard.press("Space");
  await expect(dialog.getByRole("checkbox", { name: "Tick lake-320" })).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(dialog.getByRole("checkbox", { name: "Tick lake-320" })).toBeChecked();

  await dialog.getByRole("button", { name: `Tick ${EXTRAS.length} in gallery` }).click();
  await expect(dialog).toBeHidden();
  expect(await ticked(page)).toEqual(EXTRAS);
  expect(await photosLeft(page)).toHaveLength(NAMES.length);

  // Warm run: the fingerprints are cached, so this is grouping only.
  const warm = await findDuplicates(page);
  await warm.dialog.getByRole("button", { name: "Cancel" }).click();
  console.info(`Find duplicates, 9 photos: cold ${cold.ms} ms (decode + engine hash + group), warm ${warm.ms} ms`);
  // Cancel left the ticks alone.
  expect(await ticked(page)).toEqual(EXTRAS);

  // Delete goes through the gallery's confirmation. Cancel deletes nothing.
  await page.getByRole("button", { name: "Delete Selected", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete selected images?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(`removes the ${EXTRAS.length} selected images`);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  expect(await photosLeft(page)).toHaveLength(NAMES.length);

  await page.getByRole("button", { name: "Delete Selected", exact: true }).click();
  await confirm.getByRole("button", { name: "Delete selected", exact: true }).click();
  await expect(page.locator('[aria-label^="Select photo"]')).toHaveCount(KEPT.length, { timeout: 30_000 });
  expect(await photosLeft(page)).toEqual(KEPT);
});

test("200 thumbnails decode in the browser well inside the 1 s budget", async ({ page }) => {
  // The gallery caps at 100 photos, so 200 cannot be imported. This times the
  // half of Find duplicates the vitest run cannot: the browser decoding 200
  // gallery-sized WebP thumbnails (256 x 192, the app's recipe) to RGBA, six
  // at a time, as photoFingerprints.ts does. The engine hash + grouping of 200
  // is timed in app/src/lib/duplicates.fixtures.test.ts.
  await offline(page);
  await page.goto("/");
  const ms = await page.evaluate(async () => {
    const thumbs: Blob[] = [];
    for (let i = 0; i < 200; i++) {
      const c = new OffscreenCanvas(256, 192);
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, 256, 192);
      g.addColorStop(0, `hsl(${(i * 37) % 360} 60% 40%)`);
      g.addColorStop(1, `hsl(${(i * 71) % 360} 60% 70%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 192);
      ctx.fillStyle = "#222";
      ctx.fillRect((i * 13) % 200, (i * 7) % 150, 40, 30);
      thumbs.push(await c.convertToBlob({ type: "image/webp", quality: 0.78 }));
    }
    const t0 = performance.now();
    let next = 0;
    let bytes = 0;
    const worker = async () => {
      while (next < thumbs.length) {
        const bmp = await createImageBitmap(thumbs[next++]!);
        const oc = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = oc.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        bytes += ctx.getImageData(0, 0, bmp.width, bmp.height).data.length;
        bmp.close();
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (bytes !== 200 * 256 * 192 * 4) throw new Error(`decoded ${bytes} bytes`);
    return performance.now() - t0;
  });
  console.info(`200 thumbnails decoded to RGBA in ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThan(1000);
});
