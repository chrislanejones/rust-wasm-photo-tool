import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// The first bulk night (Night 10-28, §2), through the real UI:
//   233 · Gallery › Select ▾ ticks photos by a rule.
//   227 · Batch › Resize & Compress, from each stored original, never bigger.
//   229 · Export recipes in Download All; the gallery is not changed.
//
// The photos are drawn in the page (gradient + noise, so they weigh what a
// photo weighs) and handed to the file input as JPEG bytes — no large
// fixtures in the repo.
// ─────────────────────────────────────────────────────────────────────────────

type Spec = { name: string; w: number; h: number; q: number };

const LARGE: Spec[] = [
  { name: "wide-1", w: 3200, h: 2400, q: 0.95 },
  { name: "wide-2", w: 3000, h: 2000, q: 0.95 },
  { name: "wide-3", w: 2800, h: 2100, q: 0.95 },
  { name: "tall-1", w: 2400, h: 3200, q: 0.95 },
  { name: "tall-2", w: 2000, h: 3000, q: 0.95 },
  { name: "square-1", w: 2400, h: 2400, q: 0.95 },
];

async function makeJpegs(page: Page, specs: Spec[]) {
  const b64 = await page.evaluate(async (specs) => {
    const out: string[] = [];
    for (const s of specs) {
      const c = new OffscreenCanvas(s.w, s.h);
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, s.w, s.h);
      g.addColorStop(0, "#3a6ea5");
      g.addColorStop(1, "#f4c542");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s.w, s.h);
      const img = ctx.getImageData(0, 0, s.w, s.h);
      let seed = s.w * 31 + s.h;
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const n = (seed % 48) - 24;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      const blob = await c.convertToBlob({ type: "image/jpeg", quality: s.q });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out.push(btoa(bin));
    }
    return out;
  }, specs);
  return specs.map((s, i) => ({ name: `${s.name}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(b64[i]!, "base64") }));
}

async function open(page: Page, specs: Spec[]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
  await page.goto("/");
  const files = await makeJpegs(page, specs);
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator('[aria-label^="Select photo"]')).toHaveCount(specs.length, { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

/** The photos whose gallery tick is on. The tick is the thumb's inner
 *  toggle ("Select image", or "Exception" while Batch is open). */
async function ticked(page: Page): Promise<string[]> {
  const names = await page.locator('[aria-label^="Select photo"]').evaluateAll((els) =>
    els
      .filter((el) => el.querySelector('button[aria-pressed="true"]'))
      .map((el) => el.getAttribute("aria-label")!.replace("Select photo ", "")),
  );
  return names.sort();
}

async function selectBy(page: Page, item: string) {
  await page.getByRole("button", { name: "Select by", exact: true }).click();
  await page.getByRole("menu", { name: "Select by" }).getByRole("menuitem", { name: item, exact: true }).click();
}

async function openBatchResize(page: Page) {
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.getByRole("toolbar", { name: "Batch sub-tools" }).getByRole("button", { name: "Resize & Compress", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Which photos" })).toBeVisible();
}

type Row = { name: string; status: string; width: number; height: number; mime: string; text: string };

async function resultRows(page: Page): Promise<Row[]> {
  return page.getByRole("list", { name: "Resize results" }).locator("li").evaluateAll((lis) =>
    lis.map((li) => {
      const out = li.querySelector("[data-width]");
      return {
        name: li.querySelector("span span")?.textContent ?? "",
        status: li.getAttribute("data-status") ?? "",
        width: Number(out?.getAttribute("data-width") ?? 0),
        height: Number(out?.getAttribute("data-height") ?? 0),
        mime: out?.getAttribute("data-mime") ?? "",
        text: li.textContent ?? "",
      };
    }),
  );
}

/** Sample the JS heap while a run is going; returns a stop() with the peak. */
async function heapSampler(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __peak: number; __timer: number };
    const mem = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    w.__peak = mem();
    w.__timer = window.setInterval(() => (w.__peak = Math.max(w.__peak, mem())), 50);
  });
  return async () =>
    page.evaluate(() => {
      const w = window as unknown as { __peak: number; __timer: number };
      clearInterval(w.__timer);
      return w.__peak;
    });
}

// ── 233 · Select by ─────────────────────────────────────────────────────────

test("Select ▾ Portrait ticks exactly the portrait photos; Shift adds; Invert flips", async ({ page }) => {
  await open(page, LARGE.map((s) => ({ ...s, w: Math.round(s.w / 4), h: Math.round(s.h / 4) })));
  await selectBy(page, "Portrait");
  expect(await ticked(page)).toEqual(["tall-1", "tall-2"]);

  // Square REPLACES the ticks…
  await selectBy(page, "Square");
  expect(await ticked(page)).toEqual(["square-1"]);
  // …and Shift-click ADDS.
  await page.getByRole("button", { name: "Select by", exact: true }).click();
  await page.getByRole("menuitem", { name: "Portrait", exact: true }).click({ modifiers: ["Shift"] });
  expect(await ticked(page)).toEqual(["square-1", "tall-1", "tall-2"]);

  await selectBy(page, "Invert");
  expect(await ticked(page)).toEqual(["wide-1", "wide-2", "wide-3"]);

  // The ticks are Batch's Exceptions (ADR-079).
  await openBatchResize(page);
  await expect(page.getByRole("radio", { name: /^Exceptions · 3$/ })).toBeVisible();
});

// ── 227 · Batch › Resize & Compress ─────────────────────────────────────────

test("Batch Resize 1600 / WebP / under 300 KB on 6 large photos", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, LARGE);
  await openBatchResize(page);

  await page.getByRole("radio", { name: "1600", exact: true }).click();
  await page.getByRole("radio", { name: "WebP", exact: true }).click();
  await page.getByLabel("Under (KB, optional)").fill("300");

  const stop = await heapSampler(page);
  await page.getByRole("button", { name: /^Resize All Images/ }).click();
  await expect(page.getByRole("list", { name: "Resize results" }).locator("li")).toHaveCount(6, { timeout: 240_000 });
  const peak = await stop();
  console.log(`PEAK_JS_HEAP_MB ${(peak / 1024 / 1024).toFixed(1)}`);

  const rows = await resultRows(page);
  console.log("ROWS\n" + rows.map((r) => r.text).join("\n"));
  for (const r of rows) {
    expect(r.status, r.text).toBe("resized");
    expect(r.width, r.text).toBeLessThanOrEqual(1600);
    expect(r.mime, r.text).toBe("image/webp");
    const after = Number(/→ ([\d,]+) KB/.exec(r.text)![1]!.replace(/,/g, ""));
    expect(after, r.text).toBeLessThanOrEqual(300);
  }
  // From the ORIGINALS: the photos not on the canvas came out 1600 wide even
  // though the working copy is capped at 2048 — and none came out bigger.
  expect(rows.filter((r) => r.name.startsWith("wide")).every((r) => r.width === 1600)).toBe(true);
});

test("a photo that would grow is kept and reported", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, [
    { name: "tiny-q10", w: 400, h: 300, q: 0.1 },
    { name: "wide-1", w: 1200, h: 900, q: 0.9 },
  ]);
  await openBatchResize(page);
  await page.getByRole("radio", { name: "1600", exact: true }).click();
  // Re-encoding a q10 JPEG at q100 can only grow it.
  await page.getByRole("slider", { name: "Quality" }).fill("100");
  await page.getByRole("button", { name: /^Resize All Images/ }).click();
  await expect(page.getByRole("list", { name: "Resize results" }).locator("li")).toHaveCount(2, { timeout: 120_000 });
  const rows = await resultRows(page);
  const tiny = rows.find((r) => r.name.startsWith("tiny"))!;
  expect(tiny.status, tiny.text).toBe("kept");
  expect(tiny.text).toContain("would have grown");
});

test("Exceptions (portraits) at 1080 while Main is 1600", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, LARGE.slice(0, 5));
  await selectBy(page, "Portrait");
  await openBatchResize(page);

  await page.getByRole("radio", { name: /^Main/ }).click();
  await page.getByRole("radio", { name: "1600", exact: true }).click();
  await page.getByRole("radio", { name: /^Exceptions/ }).click();
  await page.getByRole("radio", { name: "1080", exact: true }).click();

  await page.getByRole("button", { name: "Resize 3 to 1600 · 2 to 1080" }).click();
  await expect(page.getByRole("list", { name: "Resize results" }).locator("li")).toHaveCount(5, { timeout: 240_000 });
  const rows = await resultRows(page);
  for (const r of rows) {
    expect(r.status, r.text).toBe("resized");
    expect(r.width, r.text).toBe(r.name.startsWith("tall") ? 1080 : 1600);
  }
});

// ── 229 · Export recipes ────────────────────────────────────────────────────

/** Entries of a STORED zip (JSZip's default): name → bytes. */
function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 30, p + 30 + nameLen);
    const start = p + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error(`${name}: compressed entry (method ${method})`);
    out.set(name, buf.subarray(start, start + size));
    p = start + size;
  }
  return out;
}

/** A JPEG's size from its SOF marker. */
function jpegSize(b: Buffer): { w: number; h: number } {
  let p = 2;
  while (p < b.length) {
    const marker = b[p + 1]!;
    const len = b.readUInt16BE(p + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: b.readUInt16BE(p + 5), w: b.readUInt16BE(p + 7) };
    }
    p += 2 + len;
  }
  throw new Error("no SOF");
}

async function openDownloadAll(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByText(/^Download All Images/).click();
  return dialog;
}

test("Recipe Instagram 1080×1350: 1080×1350 JPEGs named by the pattern; the gallery is unchanged", async ({ page }) => {
  test.setTimeout(240_000);
  const specs = LARGE.slice(0, 3).map((s) => ({ ...s, w: Math.round(s.w / 2), h: Math.round(s.h / 2) }));
  await open(page, specs);
  const before = await page.locator('[aria-label^="Select photo"]').count();

  const dialog = await openDownloadAll(page);
  await dialog.getByLabel("Recipe").selectOption({ label: "Instagram 1080×1350" });
  const button = dialog.getByRole("button", { name: "Download 3 as Instagram 1080×1350" });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), button.click()]);
  const zip = readZip(readFileSync((await dl.path())!));
  expect([...zip.keys()].sort()).toEqual(specs.map((s) => `${s.name}-instagram.jpg`).sort());
  for (const [name, bytes] of zip) expect(jpegSize(bytes), name).toEqual({ w: 1080, h: 1350 });

  // The gallery: same photos, same sizes as before (Batch would have changed them).
  await expect(page.locator('[aria-label^="Select photo"]')).toHaveCount(before);
  await expect(page.getByText(/Photo: 1600×1200/).first()).toBeVisible();
});

test("a saved recipe survives a reload", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, LARGE.slice(0, 2).map((s) => ({ ...s, w: 800, h: 600 })));
  let dialog = await openDownloadAll(page);
  await dialog.getByRole("button", { name: "Save current as recipe…" }).click();
  await dialog.getByLabel("Recipe name").fill("Blog 1200");
  await dialog.getByRole("radio", { name: "Width", exact: true }).click();
  await dialog.getByLabel("Size (px)").fill("1200");
  await dialog.getByRole("button", { name: "Save recipe" }).click();
  await expect(dialog.getByLabel("Recipe")).toHaveValue(/^r-/);

  await page.reload();
  const resume = page.getByRole("button", { name: /Resume editing/i });
  // The reload lands on Welcome back (the gallery is still there).
  await resume.waitFor({ state: "visible", timeout: 30_000 });
  await resume.click();
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  dialog = await openDownloadAll(page);
  await expect(dialog.getByLabel("Recipe").locator("option", { hasText: "Blog 1200" })).toHaveCount(1);
});
