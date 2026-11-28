import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// #243 / ADR-112 §5–6: a photo keeps its fingerprints and its file date on its
// gallery row, so they survive a reload.
//
//   1. `{date}` after a reload is the FILE's date, not today's (red on master:
//      the date was remembered in memory only);
//   2. a heavily edited photo (Noir, pasted onto it with Paste look, which
//      rewrites its stored file and thumbnail) still groups with an untouched
//      copy of its original after a reload (red on master: only the current
//      thumbnail was hashed, and Noir moves its color past the limit);
//   3. a photo saved before ADR-112 (no new fields) still opens, renames with
//      today's `{date}`, and is hashed once (a guard: it can't be red).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "fixtures/dupes");
const FILE_DATE = Date.UTC(2019, 5, 15, 12, 0, 0);

async function offline(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
}

/** Import fixtures as Files carrying `lastModified` (Playwright's file
 *  payloads can't set it), through the gallery's own file input. */
async function importFiles(page: Page, names: string[], lastModified: number) {
  const files = names.map((n) => ({ name: `${n}.jpg`, b64: readFileSync(join(DIR, `${n}.jpg`)).toString("base64") }));
  await page.locator('input[type="file"]').first().waitFor({ state: "attached" });
  await page.evaluate(
    ({ files, lastModified }) => {
      const dt = new DataTransfer();
      for (const f of files) {
        const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
        dt.items.add(new File([bytes], f.name, { type: "image/jpeg", lastModified }));
      }
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { files, lastModified },
  );
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator('[aria-label^="Select photo"]')).toHaveCount(names.length, { timeout: 60_000 });
}

/** The gallery rows as stored in IndexedDB (the manifest the reload reads). */
const storedRows = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<
        { name: string; fileDate?: number; hasOriginal: boolean; hasCurrent: boolean; currentIsForThumb: boolean; thumbSize: number }[]
      >((resolve) => {
        const req = indexedDB.open("image-horse-gallery");
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction("manifest", "readonly").objectStore("manifest").get("current");
          get.onsuccess = () => {
            db.close();
            const photos = (get.result?.photos ?? []) as Record<string, unknown>[];
            resolve(
              photos.map((p) => ({
                name: p.name as string,
                fileDate: p.fileDate as number | undefined,
                hasOriginal: Boolean(p.fingerprintOriginal),
                hasCurrent: Boolean(p.fingerprintCurrent),
                currentIsForThumb: Boolean(p.fingerprintThumb) && p.fingerprintThumb === p.thumbBlob,
                thumbSize: (p.thumbBlob as Blob | undefined)?.size ?? 0,
              })),
            );
          };
        };
      }),
  );

/** Strip ADR-112's fields from every stored row: a gallery saved by v9.83. */
const makeRowsOld = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("image-horse-gallery");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("manifest", "readwrite");
          const store = tx.objectStore("manifest");
          const get = store.get("current");
          get.onsuccess = () => {
            const m = get.result;
            m.photos = m.photos.map((p: Record<string, unknown>) => {
              const { fingerprintOriginal: _o, fingerprintCurrent: _c, fingerprintThumb: _t, fileDate: _d, ...rest } = p;
              return rest;
            });
            store.put(m, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );

async function reloadAndResume(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function readZip(buf: Buffer): string[] {
  const names: string[] = [];
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    names.push(buf.toString("utf8", p + 30, p + 30 + nameLen));
    p = p + 30 + nameLen + extraLen + size;
  }
  return names.sort();
}

/** Export every photo as a ZIP named `{original}-{date:YYYY}`; the names. */
async function exportedNames(page: Page): Promise<string[]> {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("radio", { name: /^All images/ }).click();
  await dialog.getByRole("button", { name: "Save recipe" }).click();
  await dialog.getByLabel("Recipe name").fill("Year");
  await dialog.getByRole("radio", { name: "Keep", exact: true }).click();
  await dialog.getByLabel("Name pattern").fill("{original}-{date:YYYY}");
  await dialog.getByRole("button", { name: "Save recipe" }).click();
  await expect(dialog.getByLabel("Recipe")).toHaveValue(/^r-/);
  const button = dialog.getByRole("button", { name: "Download ZIP", exact: true });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), button.click()]);
  return readZip(readFileSync((await dl.path())!)).map((n) => n.replace(/\.\w+$/, ""));
}

/** Open Find duplicates and return its groups (photo names, sorted). */
async function duplicateGroups(page: Page, photos: number): Promise<string[][]> {
  await page.getByRole("button", { name: "Select by", exact: true }).click();
  await page.getByRole("menu", { name: "Select by" }).getByRole("menuitem", { name: "Find duplicates…" }).click();
  const dialog = page.getByRole("dialog", { name: "Find duplicates" });
  await expect(dialog.getByText(new RegExp(`among ${photos} photos`))).toBeVisible({ timeout: 30_000 });
  const groups: string[][] = [];
  for (const section of await dialog.locator("section").all()) {
    groups.push((await section.locator("li[data-photo]").evaluateAll((els) => els.map((e) => e.getAttribute("data-photo")!))).sort());
  }
  // With no groups the dialog has no Cancel; Escape closes it either way.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return groups;
}

test("{date} after a reload is the file's own date (ADR-112)", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await offline(page);
  await page.goto("/");
  await importFiles(page, ["lake-960", "beach-burst-1"], FILE_DATE);
  await expect.poll(async () => (await storedRows(page)).map((r) => r.fileDate)).toEqual([FILE_DATE, FILE_DATE]);
  await reloadAndResume(page);
  // The fixtures carry no EXIF date, so {date} is the file's: 2019, not today.
  expect(await exportedNames(page)).toEqual(["beach-burst-1-2019", "lake-960-2019"]);
});

test("a heavily edited photo still groups with a copy of its original after a reload (ADR-112)", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await offline(page);
  await page.goto("/");
  // beach-burst-1 opens in the editor. lake-960 gets the heavy edit, through
  // Paste look (the edit that rewrites a photo's stored file AND thumbnail);
  // lake-640 is the same picture, untouched.
  await importFiles(page, ["beach-burst-1", "lake-960", "lake-640"], FILE_DATE);
  await expect.poll(async () => (await storedRows(page)).every((r) => r.hasOriginal), { timeout: 30_000 }).toBe(true);
  expect(await duplicateGroups(page, 3), "before the edit").toEqual([["lake-640", "lake-960"]]);

  // Noir on the open photo, copy its look, paste it onto lake-960.
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await page.getByRole("button", { name: /^Apply Noir —/ }).first().click();
  await page.mouse.move(2, 2);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+Alt+c");
  await expect(page.getByText(/^Copied the look of beach-burst-1/).first()).toBeVisible();
  const thumbBefore = (await storedRows(page)).find((r) => r.name === "lake-960")!.thumbSize;
  await page.locator('[aria-label="Select image"]').nth(1).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+Alt+v");
  const paste = page.getByRole("dialog", { name: "Paste look" });
  await paste.getByRole("button", { name: "Paste to 1" }).click();
  await expect(paste).toBeHidden({ timeout: 60_000 });
  await expect
    .poll(async () => (await storedRows(page)).find((r) => r.name === "lake-960")!.thumbSize, { timeout: 30_000 })
    .not.toBe(thumbBefore);

  await reloadAndResume(page);
  expect(await duplicateGroups(page, 3), "after Noir pasted onto lake-960, and a reload").toEqual([["lake-640", "lake-960"]]);
});

test("a photo saved before ADR-112 opens, renames with today's {date}, and is hashed once (guard)", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await offline(page);
  await page.goto("/");
  await importFiles(page, ["lake-960", "beach-burst-1"], FILE_DATE);
  await expect.poll(async () => (await storedRows(page)).every((r) => r.hasOriginal), { timeout: 30_000 }).toBe(true);
  await makeRowsOld(page);
  await reloadAndResume(page);
  const rows = await storedRows(page);
  expect(rows.every((r) => !r.hasOriginal && !r.hasCurrent && r.fileDate === undefined), "the rows are v9.83 rows").toBe(true);

  const year = new Date().getFullYear();
  expect(await exportedNames(page)).toEqual([`beach-burst-1-${year}`, `lake-960-${year}`]);

  // Hashed once: Find duplicates stores each photo's fingerprint, for its
  // current thumbnail, with that as its original too (nothing to recover).
  await duplicateGroups(page, 2);
  await expect
    .poll(async () => (await storedRows(page)).every((r) => r.hasOriginal && r.hasCurrent && r.currentIsForThumb), { timeout: 15_000 })
    .toBe(true);
  // And after a reload they are still for the same thumbnail: nothing to redo.
  await reloadAndResume(page);
  expect((await storedRows(page)).every((r) => r.currentIsForThumb)).toBe(true);
});
