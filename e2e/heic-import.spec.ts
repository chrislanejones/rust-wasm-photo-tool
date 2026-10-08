import { test, expect } from "./guard/test";
import type { Page, Request } from "@playwright/test";
import { join } from "node:path";

// Beta "HEIC import" (ADR-087), against the PRODUCTION build in logged-out
// demo mode.
//
// OFF is master's behavior, and the part of it that matters most is a request
// that never happens: libheif is ~2 MB, and a session without the Beta must
// never fetch it. ON, a .heic opens as a photo at its own size, stored as a
// WebP original that still carries the camera's EXIF.
//
// The fixture was made from sky-building.png (600×400, ImageMagick + libheif
// + x265) with an EXIF block whose Make is "ImageHorseTest" — never from a
// personal photo. lib/heicCodec.test.ts decodes the same file in Node.

test.setTimeout(120_000);
const HEIC = join(__dirname, "fixtures", "sky-building-600x400.heic");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Every request whose URL names libheif — from the page AND its workers. */
function watchLibheif(page: Page): string[] {
  const hits: string[] = [];
  const onRequest = (r: Request) => {
    if (/libheif/i.test(r.url())) hits.push(r.url());
  };
  page.context().on("request", onRequest);
  return hits;
}

async function boot(page: Page, heicOn: boolean): Promise<void> {
  if (heicOn) await page.addInitScript(() => localStorage.setItem("ih_heic_import", "1"));
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().waitFor({ state: "attached", timeout: 30_000 });
}

/** The stored originals, read straight out of IndexedDB. */
async function storedOriginals(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Array<{ mimeType: string; name: string; width: number; height: number; head: string; exifChunk: boolean; make: boolean }>>(
        (resolve, reject) => {
          const open = indexedDB.open("image-horse-dexie");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains("originals")) return resolve([]);
            const all = db.transaction("originals").objectStore("originals").getAll();
            all.onerror = () => reject(all.error);
            all.onsuccess = async () => {
              const rows = all.result as Array<{ mimeType: string; name: string; width: number; height: number; blob: Blob }>;
              resolve(
                await Promise.all(
                  rows.map(async (r) => {
                    // latin1 so the EXIF bytes survive as characters.
                    const text = Array.from(new Uint8Array(await r.blob.arrayBuffer()), (b) => String.fromCharCode(b)).join("");
                    return {
                      mimeType: r.mimeType,
                      name: r.name,
                      width: r.width,
                      height: r.height,
                      head: text.slice(0, 4),
                      exifChunk: text.includes("EXIF"), // the WebP chunk
                      make: text.includes("ImageHorseTest"), // the camera's Make
                    };
                  }),
                ),
              );
            };
          };
        },
      ),
  );
}

test("HEIC import OFF: a .heic is not opened, and libheif is never requested", async ({ page }) => {
  const libheif = watchLibheif(page);
  await boot(page, false);
  // The picker is master's, byte for byte.
  await expect(page.locator('input[type="file"]').first()).toHaveAttribute("accept", "image/*,.svg");
  await page.locator('input[type="file"]').first().setInputFiles([HEIC]);
  // Master: Chromium cannot decode a HEIC, so the import fails with the
  // generic toast and no photo lands.
  await expect(page.getByText("Couldn't open sky-building-600x400.heic.")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await storedOriginals(page)).toEqual([]);
  expect(libheif).toEqual([]);
});

test("HEIC import ON: a .heic opens as a 600×400 photo, stored as WebP with its EXIF", async ({ page }) => {
  const libheif = watchLibheif(page);
  await boot(page, true);
  await expect(page.locator('input[type="file"]').first()).toHaveAttribute("accept", "image/*,.svg,.heic,.heif,.hif");
  // Nothing fetched until a HEIC actually arrives.
  expect(libheif).toEqual([]);

  await page.locator('input[type="file"]').first().setInputFiles([HEIC]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect.poll(() => storedOriginals(page).then((r) => r.length), { timeout: 60_000 }).toBe(1);

  const [orig] = await storedOriginals(page);
  expect(orig.mimeType).toBe("image/webp");
  expect(orig.name).toBe("sky-building-600x400.webp");
  expect([orig.width, orig.height]).toEqual([600, 400]);
  expect(orig.head).toBe("RIFF");
  expect(orig.exifChunk).toBe(true);
  expect(orig.make).toBe(true); // carried over from the HEIC

  // Decoded by libheif, in the worker, from its own chunk.
  expect(libheif.some((u) => /\/assets\/libheif-bundle-[\w-]+\.js$/.test(u))).toBe(true);
  await expect(page.getByText(/Couldn't open|Couldn't read/)).toHaveCount(0);
});
