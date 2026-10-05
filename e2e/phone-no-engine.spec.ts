import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Plan C §2 — a phone does not load the engine.
//
// Below BP_MOBILE (600px) at boot the ~830 KB WASM engine is never requested:
// MobileShell permits no editing, and the one value it needs from Rust
// (`photo_limit`) is mirrored in lib/tiers.ts. Widening past 600px loads the
// engine and the editor then. These specs count the engine's network requests;
// they deliberately do NOT measure bytes (measured on real hardware instead).

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

/** Offline + deterministic, like the other specs: nothing leaves localhost. */
async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Every request for the engine: its JS glue chunk or the .wasm itself. */
function watchEngine(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (/stamp_tool|\.wasm(\?|$)/.test(r.url())) seen.push(r.url());
  });
  return seen;
}

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

/** The "mobile version" notice is a modal; it covers the grid until dismissed. */
async function dismissNotice(page: Page) {
  await page.getByRole("button", { name: "Got it" }).click({ timeout: 30_000 });
}

async function addPhotos(page: Page, files: string[]) {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
}

test("below 600px the engine is never requested, and the phone works", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.setViewportSize(PHONE);
  const engine = watchEngine(page);
  await page.goto("/");
  await dismissNotice(page);

  // Upload → grid.
  await addPhotos(page, FIXTURES);
  await expect(page.getByRole("button", { name: /^View photo / })).toHaveCount(2, { timeout: 30_000 });

  // Viewer + Download (the saved file keeps its type: the extension comes back
  // from the stored mime) + Delete.
  await page.getByRole("button", { name: "View photo checker" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download image" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("checker.png");

  await page.getByRole("button", { name: "Delete image" }).click();
  await page.getByRole("button", { name: "Delete image" }).last().click();
  await expect(page.getByRole("button", { name: /^View photo / })).toHaveCount(1);

  // Nothing above — boot, upload, thumbnails, viewer, delete — touched the engine.
  expect(engine).toEqual([]);
});

test("above 600px the editor boots as it always has", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.setViewportSize(DESKTOP);
  const engine = watchEngine(page);
  await page.goto("/");
  await addPhotos(page, FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  // Polled, not read once: a visible canvas does not mean the engine request
  // has gone out yet (the race that turned PR #294's CI red next door).
  await expect.poll(() => engine.length, { timeout: 30_000 }).toBeGreaterThan(0);
});

test("widening 390 → 1280 loads the engine and puts the photo in the editor", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.setViewportSize(PHONE);
  const engine = watchEngine(page);
  await page.goto("/");
  await dismissNotice(page);
  await addPhotos(page, FIXTURES);
  await expect(page.getByRole("button", { name: /^View photo / })).toHaveCount(2, { timeout: 30_000 });
  expect(engine).toEqual([]);

  await page.setViewportSize(DESKTOP);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  // Wait for the engine REQUEST, not a canvas size: an unsized <canvas> is
  // 300×150 by default, so "width × height > 0" passed before the engine was
  // even asked for and the assertion after it raced (red on PR #294's CI).
  await expect.poll(() => engine.length, { timeout: 30_000 }).toBeGreaterThan(0);
  // …and the photo really is in the editor: a canvas sized to it, not 300×150.
  await expect
    .poll(() => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
      return c ? `${c.width}x${c.height}` : "none";
    }), { timeout: 30_000 })
    .not.toMatch(/^(none|300x150|0x0)$/);
});

test("demo mode (logged out) boots at both widths", async ({ page }) => {
  await blockExternalNetwork(page);
  for (const size of [PHONE, DESKTOP]) {
    await page.setViewportSize(size);
    await page.goto("/");
    // Not "#root is non-empty": index.html ships a static boot shell inside
    // #root, so that would pass on a crashed app. The upload input exists
    // only once React has mounted the real surface.
    await expect(page.locator('input[type="file"]').first()).toBeAttached({ timeout: 30_000 });
    await expect(page.getByText("Could not find")).toHaveCount(0);
  }
});
