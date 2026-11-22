import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Camera info on export (Night 11-21, 231, ADR-108): Keep all · Remove
// location · Remove all, in Download, Download All and recipes, remembered;
// and Batch › Strip info on the stored copies.
//
// The photos are REAL decodable JPEGs (e2e/fixtures/dupes) with a camera
// EXIF block spliced in after SOI: the oracle's source_a.tiff, which carries
// GPS N 37°46'30.5" W 122°25'10", "TestCam" / "Model X" and a capture date.
test.setTimeout(180_000);

const REPO = join(__dirname, "..");
const TIFF = readFileSync(join(REPO, "tests/fixtures/exif/source_a.tiff"));
// The latitude triple 37/1 46/1 3050/100, little-endian: present only while
// the coordinates are.
const LAT = Buffer.from([0x25, 0, 0, 0, 1, 0, 0, 0, 0x2e, 0, 0, 0, 1, 0, 0, 0]);
const EXIF_ID = Buffer.from("Exif\0\0", "latin1");

function withExif(jpeg: Buffer, tiff: Buffer): Buffer {
  const len = 2 + EXIF_ID.length + tiff.length;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]), EXIF_ID, tiff]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

const dir = mkdtempSync(join(tmpdir(), "camera-info-"));
const PHOTOS = ["lake-640.jpg", "pier-wide.jpg"].map((name) => {
  const out = join(dir, name);
  writeFileSync(out, withExif(readFileSync(join(__dirname, "fixtures", "dupes", name)), TIFF));
  return out;
});

const has = (b: Buffer, needle: Buffer | string) => b.includes(typeof needle === "string" ? Buffer.from(needle, "latin1") : needle);

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
}

async function boot(page: Page, files: string[]) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator(".photo-thumb")).toHaveCount(files.length, { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function openExport(page: Page, pane: "Selected" | "All") {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // With one photo the dialog skips the Selected / All choice.
  const tile = dialog.getByText(pane === "All" ? /^Download All Images/ : /^Download Selected Image/);
  if (pane === "All" || (await tile.count()) > 0) await tile.click();
  return dialog;
}

async function chooseCameraInfo(dialog: ReturnType<Page["getByRole"]>, label: "Keep all" | "Remove location" | "Remove all") {
  await dialog.getByRole("radio", { name: label, exact: true }).click();
  await expect(dialog.getByRole("radio", { name: label, exact: true })).toHaveAttribute("aria-checked", "true");
}

async function downloadSelectedJpeg(page: Page, dialog: ReturnType<Page["getByRole"]>): Promise<Buffer> {
  await dialog.locator('[title^="JPEG"]').first().click();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    dialog.getByRole("button", { name: /^Download JPEG/ }).click(),
  ]);
  return readFileSync((await dl.path())!);
}

test("Download: each Camera info choice writes what it says, and the choice is remembered", async ({ page }) => {
  await boot(page, PHOTOS.slice(0, 1));
  const results: Record<string, Buffer> = {};
  for (const choice of ["Remove location", "Remove all", "Keep all"] as const) {
    const dialog = await openExport(page, "Selected");
    await chooseCameraInfo(dialog, choice);
    results[choice] = await downloadSelectedJpeg(page, dialog);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  // Remove location: no coordinates, the camera and the date survive.
  expect(has(results["Remove location"], LAT)).toBe(false);
  expect(has(results["Remove location"], "TestCam")).toBe(true);
  expect(has(results["Remove location"], "2026:09:25 01:02:03")).toBe(true);
  // Remove all: no EXIF block at all.
  expect(has(results["Remove all"], EXIF_ID)).toBe(false);
  expect(has(results["Remove all"], "TestCam")).toBe(false);
  // Keep all: everything, coordinates included.
  expect(has(results["Keep all"], LAT)).toBe(true);
  expect(has(results["Keep all"], "TestCam")).toBe(true);

  // Remembered: a reload opens on the last choice (Keep all).
  await page.reload();
  await page.getByRole("button", { name: "Resume editing" }).click();
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  const again = await openExport(page, "Selected");
  await expect(again.getByRole("radio", { name: "Keep all", exact: true })).toHaveAttribute("aria-checked", "true");
});

test("Download with EXIF in Rust (Beta): Remove location cross-checks without a mismatch", async ({ page }) => {
  const lines: string[] = [];
  page.on("console", (m) => lines.push(m.text()));
  await page.addInitScript(() => localStorage.setItem("ih_exif_rust", "1"));
  await boot(page, PHOTOS.slice(0, 1));
  await expect.poll(() => lines.some((l) => l.includes("EXIF in Rust: engine functions loaded")), { timeout: 30_000 }).toBe(true);
  const dialog = await openExport(page, "Selected");
  await chooseCameraInfo(dialog, "Remove location");
  const out = await downloadSelectedJpeg(page, dialog);
  expect(has(out, LAT)).toBe(false);
  expect(has(out, "TestCam")).toBe(true);
  await page.waitForTimeout(500);
  expect(lines.filter((l) => /EXIF in Rust: .*(MISMATCH|threw)/.test(l))).toEqual([]);
});

test("Download All with a recipe: the recipe carries the Camera info it was saved with", async ({ page }) => {
  await boot(page, PHOTOS);
  const dialog = await openExport(page, "All");
  // Save a recipe while the dialog says Remove location.
  await chooseCameraInfo(dialog, "Remove location");
  await dialog.locator('[title^="JPEG"]').first().click();
  await dialog.getByRole("button", { name: "Save current as recipe…" }).click();
  await dialog.getByLabel("Recipe name").fill("No GPS");
  await dialog.getByRole("button", { name: "Save recipe" }).click();
  await expect(dialog.getByText(/camera info Remove location/)).toBeVisible();
  // The picker shows the recipe's choice, locked.
  await expect(dialog.getByRole("radio", { name: "Remove location", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("radio", { name: "Keep all", exact: true })).toBeDisabled();
  // Turn the dialog's own choice to Keep all (no recipe), then pick the recipe again.
  await dialog.getByLabel("Recipe").selectOption("");
  await chooseCameraInfo(dialog, "Keep all");
  await dialog.getByLabel("Recipe").selectOption({ label: "No GPS" });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    dialog.getByRole("button", { name: /^Download 2 as No GPS/ }).click(),
  ]);
  const zip = readFileSync((await dl.path())!);
  // JSZip stores without compression, so each JPEG's bytes sit in the zip.
  expect(has(zip, "TestCam")).toBe(true);
  expect(has(zip, LAT)).toBe(false);
  await expect(page.getByText(/Camera info: Remove location/)).toBeVisible({ timeout: 15_000 });
});

test("Batch › Strip info asks first, then removes location from every stored file", async ({ page }) => {
  await boot(page, PHOTOS);
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.getByRole("button", { name: "Strip info", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Tool options" }).getByText("Strip info", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove location from All Images" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove camera info?" });
  await expect(confirm).toContainText("This removes location from 2 photos. It can't be undone.");
  await confirm.getByRole("button", { name: "Remove" }).click();
  const rows = page.getByRole("list", { name: "Strip info results" }).locator("li");
  await expect(rows).toHaveCount(2, { timeout: 30_000 });
  await expect(rows.and(page.locator('[data-status="stripped"]'))).toHaveCount(2);
  await page.waitForTimeout(1500); // the gallery autosave

  // Every stored original (and upload original) is now GPS-free with its
  // camera kept: read the blobs straight out of IndexedDB.
  const stored = await page.evaluate(async () => {
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
    return Promise.all(recs.map(async (x) => Array.from(new Uint8Array(await x.blob.arrayBuffer()))));
  });
  expect(stored.length).toBeGreaterThanOrEqual(2);
  for (const bytes of stored) {
    const b = Buffer.from(bytes);
    expect(has(b, LAT)).toBe(false);
    expect(has(b, "TestCam")).toBe(true);
  }
  // And a Keep all export cannot bring it back.
  const dialog = await openExport(page, "Selected");
  await chooseCameraInfo(dialog, "Keep all");
  const out = await downloadSelectedJpeg(page, dialog);
  expect(has(out, LAT)).toBe(false);
  expect(has(out, "TestCam")).toBe(true);
});
