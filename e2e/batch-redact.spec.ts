import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

// Batch › Redact (Night 11-21, 230, ADR-108). Three screenshots of one screen
// at three sizes — 1440 × 900, its 2x 2880 × 1800, and a 1200 × 750 — each
// with a fake email in the nav bar and a fake account number lower down, at
// the same FRACTIONS of the picture (which is what a set of screenshots of one
// screen at different densities is). Two boxes are drawn on the open photo;
// Redact must land them on the same text in every photo, really hide it, skip
// the Exception, be one undo step on the open photo, and survive a reload.
test.setTimeout(240_000);

/** Where the text sits, as fractions of the screenshot. */
const EMAIL = { fx: 0.7, fy: 0.02, fw: 0.15, fh: 12 / 900 };
const ACCOUNT = { fx: 0.1, fy: 0.5, fw: 0.2, fh: 12 / 900 };
/** The box a person drags: the text plus a small margin. */
const pad = (r: typeof EMAIL) => ({ fx: r.fx - 0.004, fy: r.fy - 0.004, fw: r.fw + 0.008, fh: r.fh + 0.008 });

const CROPS = join(__dirname, "..", "test-results", "redact-crops");

/** A white screenshot with a gray nav bar and two runs of 1-2 px glyph ink. */
function screenshot(w: number, h: number, seed: number): Buffer {
  const s = h / 900; // glyph cell scale: the 1x shot draws 12 px text
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h, 255);
  const ink = (r: typeof EMAIL, x: number, y: number) => {
    const tx = Math.round(r.fx * w);
    const ty = Math.round(r.fy * h);
    const tw = Math.round(r.fw * w);
    const th = Math.round(r.fh * h);
    if (x < tx || y < ty || x >= tx + tw || y >= ty + th) return false;
    const col = Math.floor((x - tx) / s);
    const rw = Math.floor((y - ty) / s);
    const letter = col % 9;
    return letter < 7 && (letter === 0 || letter === 6 || rw === 0 || rw === 11 || rw === 5 || (col * 7 + rw * 3) % 11 === 0);
  };
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0;
    const nav = y < Math.round(0.06 * h);
    for (let x = 0; x < w; x++) {
      const p = y * row + 1 + x * 3;
      if (ink(EMAIL, x, y) || ink(ACCOUNT, x, y)) {
        raw[p] = raw[p + 1] = raw[p + 2] = 0;
      } else if (nav) {
        raw[p] = raw[p + 1] = 235;
        raw[p + 2] = 235 - seed; // a different file each time: the store dedupes bytes
      }
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SHOTS = [
  { name: "shot-1440.png", w: 1440, h: 900 },
  { name: "shot-2880.png", w: 2880, h: 1800 },
  { name: "shot-1200.png", w: 1200, h: 750 },
].map((s, i) => ({ ...s, mimeType: "image/png", buffer: screenshot(s.w, s.h, i + 1) }));

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
}

interface Stats {
  min: number;
  sd: number;
}

/** Decode image bytes IN THE PAGE and measure the red channel over a region
 *  given as fractions; optionally return the region as a PNG crop at 100%. */
async function region(page: Page, bytes: number[], r: typeof EMAIL, crop = false): Promise<Stats & { png?: number[] }> {
  return page.evaluate(
    async ({ bytes, r, crop }) => {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const x = Math.round(r.fx * bmp.width);
      const y = Math.round(r.fy * bmp.height);
      const w = Math.max(1, Math.round(r.fw * bmp.width));
      const h = Math.max(1, Math.round(r.fh * bmp.height));
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, x, y, w, h, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let n = 0, sum = 0, sq = 0, min = 255;
      for (let i = 0; i < d.length; i += 4) {
        n++;
        sum += d[i]!;
        sq += d[i]! * d[i]!;
        min = Math.min(min, d[i]!);
      }
      const mean = sum / n;
      const out: { min: number; sd: number; png?: number[] } = { min, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
      if (crop) {
        // A wider crop for the desk: the box plus some page around it.
        const cx = Math.max(0, x - 24), cy = Math.max(0, y - 16);
        const cw = Math.min(bmp.width - cx, w + 48), ch = Math.min(bmp.height - cy, h + 32);
        const cc = new OffscreenCanvas(cw, ch);
        cc.getContext("2d")!.drawImage(bmp, cx, cy, cw, ch, 0, 0, cw, ch);
        out.png = Array.from(new Uint8Array(await (await cc.convertToBlob({ type: "image/png" })).arrayBuffer()));
      }
      return out;
    },
    { bytes, r, crop },
  );
}

/** Every stored original by file name, straight out of IndexedDB. */
async function storedByName(page: Page): Promise<Record<string, number[]>> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const q = indexedDB.open("image-horse-dexie");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const recs: Array<{ name: string; blob: Blob; createdAt: number }> = await new Promise((res, rej) => {
      const q = db.transaction("originals").objectStore("originals").getAll();
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const out: Record<string, number[]> = {};
    // Newest wins when a name was written twice.
    for (const r of recs.sort((a, b) => a.createdAt - b.createdAt)) {
      out[r.name] = Array.from(new Uint8Array(await r.blob.arrayBuffer()));
    }
    return out;
  });
}

async function exportOpenPng(page: Page): Promise<number[]> {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const selected = dialog.getByText(/^Download Selected Image/);
  if (await selected.count()) await selected.click();
  await dialog.locator('[title^="PNG"]').first().click();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    dialog.getByRole("button", { name: /^Download PNG/ }).click(),
  ]);
  const { readFileSync } = await import("node:fs");
  const bytes = Array.from(readFileSync((await dl.path())!));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return bytes;
}

async function drag(page: Page, r: ReturnType<typeof pad>) {
  const area = page.getByTestId("batch-redact-draw-area");
  const b = (await area.boundingBox())!;
  const x0 = b.x + r.fx * b.width;
  const y0 = b.y + r.fy * b.height;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + (r.fw * b.width) / 2, y0 + (r.fh * b.height) / 2, { steps: 4 });
  await page.mouse.move(x0 + r.fw * b.width, y0 + r.fh * b.height, { steps: 4 });
  await page.mouse.up();
}

const hidden = (s: Stats, before: Stats) => {
  expect(s.min, "a glyph pixel survived").toBeGreaterThan(96);
  expect(s.sd, "the box is not near-flat").toBeLessThan(before.sd / 4);
};
const visible = (s: Stats) => expect(s.min, "the text should be there").toBeLessThan(40);

test("Redact: two boxes land on the same text in every size, hide it, skip the Exception, undo as one step, survive a reload", async ({ page }) => {
  mkdirSync(CROPS, { recursive: true });
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(SHOTS.map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator(".photo-thumb")).toHaveCount(3, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  // The 1440 shot is the one on the canvas.
  await expect(page.getByText("Photo: 1440×900")).toBeVisible({ timeout: 20_000 });

  const before = await region(page, Array.from(SHOTS[0]!.buffer), EMAIL, true);
  writeFileSync(join(CROPS, "email-1440-before.png"), Buffer.from(before.png!));
  visible(before);

  // Batch › Redact, two boxes.
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.getByRole("button", { name: "Redact", exact: true }).first().click();
  await expect(page.getByTestId("batch-redact-draw-area")).toBeVisible();
  await drag(page, pad(EMAIL));
  await drag(page, pad(ACCOUNT));
  await expect(page.getByTestId("batch-redact-box")).toHaveCount(2);
  await expect(page.getByTestId("redact-box-count")).toHaveText("2 of 10 boxes");

  // The 1200 shot is an Exception: its group has no boxes, so it is skipped.
  const third = page.locator(".photo-thumb").nth(2);
  await third.hover();
  await third.getByRole("button", { name: "Exception" }).click();
  await expect(page.getByTestId("redact-no-undo")).toContainText("(1 here)");

  await page.getByRole("button", { name: /^Pixelate 2 boxes on 2$/ }).click();
  const rows = page.getByRole("list", { name: "Redact results" }).locator("li");
  await expect(rows).toHaveCount(3, { timeout: 60_000 });
  await expect(page.locator('li[data-status="redacted"]')).toHaveCount(2);
  await expect(page.locator('li[data-status="skipped"]')).toHaveCount(1);
  await page.waitForTimeout(1500);

  // The stored 2x shot: both texts hidden, in the right (scaled) place.
  const stored = await storedByName(page);
  const big = await region(page, stored["shot-2880.png"]!, EMAIL, true);
  writeFileSync(join(CROPS, "email-2880-after.png"), Buffer.from(big.png!));
  hidden(big, before);
  hidden(await region(page, stored["shot-2880.png"]!, ACCOUNT), before);
  // The Exception is untouched.
  visible(await region(page, stored["shot-1200.png"]!, EMAIL));

  // The open photo: redacted in its export.
  const openAfter = await region(page, await exportOpenPng(page), EMAIL, true);
  writeFileSync(join(CROPS, "email-1440-after.png"), Buffer.from(openAfter.png!));
  hidden(openAfter, before);

  // ONE undo step brings BOTH boxes back off the open photo.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await exportOpenPng(page);
  visible(await region(page, undone, EMAIL));
  visible(await region(page, undone, ACCOUNT));
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  hidden(await region(page, await exportOpenPng(page), ACCOUNT), before);

  // Reload: still redacted, open photo and stored ones alike.
  await page.waitForTimeout(2500); // the edit autosave
  await page.reload();
  await page.getByRole("button", { name: "Resume editing" }).click();
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.getByText("Photo: 1440×900")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  hidden(await region(page, await exportOpenPng(page), EMAIL), before);
  const again = await storedByName(page);
  hidden(await region(page, again["shot-2880.png"]!, EMAIL), before);
});

for (const style of ["Blur", "Solid"] as const) {
  test(`Redact › ${style} hides the email on the open photo too`, async ({ page }) => {
    mkdirSync(CROPS, { recursive: true });
    await blockExternalNetwork(page);
    await page.goto("/");
    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached" });
    await input.setInputFiles(SHOTS.slice(0, 2).map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));
    await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
    await expect(page.locator(".photo-thumb")).toHaveCount(2, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Batch", exact: true }).first().click();
    await page.getByRole("button", { name: "Redact", exact: true }).first().click();
    await page.getByRole("radio", { name: style, exact: true }).click();
    await drag(page, pad(EMAIL));
    await page.getByRole("button", { name: new RegExp(`^${style} 1 box on All Images$`) }).click();
    await expect(page.locator('li[data-status="redacted"]')).toHaveCount(2, { timeout: 60_000 });
    const before = await region(page, Array.from(SHOTS[0]!.buffer), EMAIL);
    const after = await region(page, await exportOpenPng(page), EMAIL, true);
    writeFileSync(join(CROPS, `email-1440-${style.toLowerCase()}.png`), Buffer.from(after.png!));
    await page.waitForTimeout(1000);
    const stored = await region(page, (await storedByName(page))["shot-2880.png"]!, EMAIL);
    if (style === "Solid") {
      // Black ink under a black fill: the proof is that the box is one flat color.
      expect(after.sd).toBeLessThan(1);
      expect(stored.sd).toBeLessThan(1);
    } else {
      hidden(after, before);
      hidden(stored, before);
    }
  });
}
