import { test, expect } from "../guard/test";
import type { Page } from "@playwright/test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — 11-22-2026, against master a35705a4
// (v9.68 + #495 Batch › Redact + #496 Camera info / Strip info), so it covers
// everything since v9.66: #493, #494, #495, #496.
//
// Production build, logged-out demo mode (placeholder Convex/Clerk, every
// off-localhost request blocked). Kept in archive/ as the record of the run,
// not part of the suite. Results: docs/qc/qc-1122.md. Screenshots go to
// QC_SHOTS (default /tmp/qc1122/shots).
//
// What the suite's own specs (batch-redact, camera-info, shapes-fill-first)
// do NOT already pin, and this adds:
//   • boot logged out with no console errors, file picker AND drag-drop,
//   • Redact by keyboard: the apply button is off with no boxes, a box takes
//     focus, the arrow keys move it, Delete removes it; the panel in light
//     and dark,
//   • Strip info's confirm: Cancel and Esc change no stored file,
//   • the Camera info radios answer the keyboard.
//
// Run: copy playwright.config.ts to a throwaway playwright.qc.config.ts at the
// repo root that spreads the base config with
//   testDir: "./e2e/archive", testIgnore: [], testMatch: /qc-1122\.spec\.ts$/
// then PW_PORT=<port> pnpm exec playwright test --config playwright.qc.config.ts
// ─────────────────────────────────────────────────────────────────────────────
test.setTimeout(180_000);

const REPO = join(__dirname, "..", "..");
const SHOTS = process.env.QC_SHOTS ?? "/tmp/qc1122/shots";
mkdirSync(SHOTS, { recursive: true });

// The camera-info fixtures: real JPEGs with the oracle's GPS-bearing TIFF.
const TIFF = readFileSync(join(REPO, "tests/fixtures/exif/source_a.tiff"));
const LAT = Buffer.from([0x25, 0, 0, 0, 1, 0, 0, 0, 0x2e, 0, 0, 0, 1, 0, 0, 0]);
const EXIF_ID = Buffer.from("Exif\0\0", "latin1");
function withExif(jpeg: Buffer): Buffer {
  const len = 2 + EXIF_ID.length + TIFF.length;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]), EXIF_ID, TIFF]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
const dir = mkdtempSync(join(tmpdir(), "qc1122-"));
const PHOTOS = ["lake-640.jpg", "pier-wide.jpg"].map((name) => {
  const out = join(dir, name);
  writeFileSync(out, withExif(readFileSync(join(REPO, "e2e", "fixtures", "dupes", name))));
  return out;
});

async function blockExternal(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
}

async function boot(page: Page, files: string[]) {
  await blockExternal(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator(".photo-thumb")).toHaveCount(files.length, { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function storedHaveGps(page: Page): Promise<boolean[]> {
  return page.evaluate(async (lat) => {
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
    const needle = new Uint8Array(lat);
    return Promise.all(
      recs.map(async (x) => {
        const b = new Uint8Array(await x.blob.arrayBuffer());
        outer: for (let i = 0; i + needle.length <= b.length; i++) {
          for (let j = 0; j < needle.length; j++) if (b[i + j] !== needle[j]) continue outer;
          return true;
        }
        return false;
      }),
    );
  }, Array.from(LAT));
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(250);
}

test("Q1 boot: logged out, no console errors, file picker and drag-drop both import", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await boot(page, PHOTOS.slice(0, 1));
  // Drag-drop the second photo onto the window (AppShell's window "drop").
  const b64 = readFileSync(PHOTOS[1]!).toString("base64");
  await page.evaluate((data) => {
    const bin = atob(data);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([arr], "pier-wide.jpg", { type: "image/jpeg" }));
    for (const type of ["dragenter", "dragover", "drop"])
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  // One dropped file asks: new layer, or a new photo in the gallery.
  const ask = page.getByRole("dialog", { name: "Add this image" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: /Add Image to Gallery/ }).click();
  await expect(page.locator(".photo-thumb")).toHaveCount(2, { timeout: 30_000 });
  // Blocked outside requests (the placeholder backend, /_vercel/insights) are
  // the only errors a logged-out local build may log.
  const real = errors.filter((e) => !/Failed to load resource|net::ERR_FAILED|_vercel\/insights|ERR_BLOCKED/i.test(e));
  expect(real).toEqual([]);
});

test("Q2 Redact by keyboard: off with no boxes, a box takes focus, arrows move it, Delete removes it", async ({ page }) => {
  await boot(page, PHOTOS);
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.getByRole("button", { name: "Redact", exact: true }).first().click();
  const options = page.getByRole("region", { name: "Tool options" });
  const apply = options.getByRole("button", { name: /^(Pixelate|Blur|Solid) \d+ box|^Draw a box on the photo first$/ });
  await expect(page.getByTestId("redact-box-count")).toHaveText(/No boxes yet/);
  await expect(apply).toBeDisabled();

  const area = page.getByTestId("batch-redact-draw-area");
  const b = (await area.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.4, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("redact-box-count")).toHaveText(/^1 of 10 boxes/);
  await expect(apply).toBeEnabled();
  await expect(page.getByTestId("redact-no-undo")).toBeVisible();

  const box = page.getByTestId("batch-redact-box").first();
  await box.focus();
  await expect(box).toBeFocused();
  const before = (await box.boundingBox())!;
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(async () => (await box.boundingBox())!.x).toBeGreaterThan(before.x);
  expect((await box.boundingBox())!.y).toBeGreaterThan(before.y);

  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await options.screenshot({ path: join(SHOTS, `q2-redact-panel-${theme}.png`) });
  }

  await box.focus();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("batch-redact-box")).toHaveCount(0);
  await expect(page.getByTestId("redact-box-count")).toHaveText(/No boxes yet/);
  await expect(apply).toBeDisabled();
});

test("Q3 Strip info: Cancel and Esc on the confirm change no stored file", async ({ page }) => {
  await boot(page, PHOTOS);
  expect(await storedHaveGps(page)).toEqual(expect.arrayContaining([true, true]));
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.getByRole("button", { name: "Strip info", exact: true }).first().click();
  const go = page.getByRole("button", { name: "Remove location from All Images" });
  const confirm = page.getByRole("dialog", { name: "Remove camera info?" });

  await go.click();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);

  await go.click();
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);

  await page.waitForTimeout(1500);
  await expect(page.getByRole("list", { name: "Strip info results" })).toHaveCount(0);
  const gps = await storedHaveGps(page);
  expect(gps.length).toBeGreaterThanOrEqual(2);
  expect(gps.every(Boolean)).toBe(true);
});

test("Q4 Camera info radios answer the keyboard", async ({ page }) => {
  await boot(page, PHOTOS.slice(0, 1));
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const selected = dialog.getByText(/^Download Selected Image/);
  if (await selected.count()) await selected.click();
  for (const label of ["Remove location", "Keep all", "Remove all"] as const) {
    const radio = dialog.getByRole("radio", { name: label, exact: true });
    await radio.focus();
    await expect(radio).toBeFocused();
    await page.keyboard.press("Space");
    await expect(radio).toHaveAttribute("aria-checked", "true");
  }
  await expect(dialog.getByTestId("camera-info-says")).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await dialog.screenshot({ path: join(SHOTS, `q4-download-camera-info-${theme}.png`) });
  }
});
