import { test, expect } from "./guard/test";
import type { CDPSession, Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

// ─────────────────────────────────────────────────────────────────────────────
// Batch › Crop, the two #267 review findings (PARKING_LOT 09-29-2026).
//
// 1a. "Keep" used to cap every photo but the open one at 2048 px: the
//     non-active pass cropped the ≤2048 working copy, so a 4000×3000 photo
//     cropped 1:1 came out 1536×1536 and its gallery size still read
//     4000×3000. It now crops the stored ORIGINAL, one photo at a time.
//
//     The OPEN photo is not part of this claim. It lives in the engine at the
//     working resolution (every load goes through makeWorkingCopy), so its
//     crop is a normal undo step on ≤2048 px. That is why the open photo here
//     is the small checker and both 4000×3000 photos are the other ones.
//
// 1b. Re-apply used to recognize its own last crop by UNDO COUNT. Crop, undo,
//     paint one stroke, and the count matched again, so re-apply rewound the
//     stroke instead of the crop. It now asks the engine which history state
//     is live (`history_node`) and rewinds only from the crop's own state.
// ─────────────────────────────────────────────────────────────────────────────

const CHECKER = join(__dirname, "fixtures", "checker.png"); // 256×256
const SKY = join(__dirname, "fixtures", "sky-building.png"); // 1200×800

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/**
 * A `w×h` RGB PNG built here rather than committed: a 4000×3000 fixture is
 * megabytes in the repo for a picture of a gradient. `seed` changes the blue
 * channel, so two photos never share a content hash (the originals store
 * dedupes identical bytes, which would quietly make "both photos" one record).
 */
function gradientPng(w: number, h: number, seed: number): Buffer {
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    const o = y * row; // filter byte 0 (None) is already there
    const g = Math.floor((y * 255) / h);
    for (let x = 0; x < w; x++) {
      const p = o + 1 + x * 3;
      raw[p] = Math.floor((x * 255) / w);
      raw[p + 1] = g;
      raw[p + 2] = (seed * 53 + ((x >> 6) ^ (y >> 6)) * 17) & 0xff;
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const bigPhoto = (name: string, seed: number, w = 4000, h = 3000) => ({
  name: `${name}.png`,
  mimeType: "image/png",
  buffer: gradientPng(w, h, seed),
});

type Upload = { name: string; mimeType: string; buffer: Buffer };
/** A fixture on disk as an upload buffer — Playwright will not mix paths and buffers. */
const fromDisk = (path: string): Upload => ({ name: basename(path), mimeType: "image/png", buffer: readFileSync(path) });

async function importFiles(page: Page, files: Upload[]): Promise<void> {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), { timeout: 60_000 })
    .toBeGreaterThan(0);
  // Every photo is in the gallery before the pass is asked for.
  await expect(page.locator(".photo-thumb")).toHaveCount(files.length, { timeout: 120_000 });
  await page.waitForTimeout(1000);
}

async function openBatchCrop(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Crop", exact: true }).first().click();
  await page.waitForTimeout(600);
}

/** The size the gallery shows for a photo: the "bytes · W×H" line of its tooltip. */
async function galleryDims(page: Page, name: string): Promise<string | null> {
  const tip = page.getByRole("tooltip").filter({ hasText: name });
  // Leave the last tile first: a tooltip still open on it can hold the next
  // one back, so hover again until this photo's opens.
  await expect(async () => {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: `Select photo ${name}`, exact: true }).first().hover();
    await expect(tip).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const text = (await tip.textContent()) ?? "";
  return /(\d+)×(\d+)/.exec(text)?.[0] ?? null;
}

/**
 * The pixel sizes of every stored original that was written after `since`,
 * decoded, read straight out of IndexedDB. The gallery line above is what the
 * app SAYS; this is what it STORED.
 */
const storedSince = (page: Page, since: number): Promise<string[]> =>
  page.evaluate(async (t0) => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("image-horse-dexie");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const recs: { blob: Blob; width: number; height: number; createdAt: number }[] = await new Promise((res, rej) => {
      const r = db.transaction("originals").objectStore("originals").getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    const out: string[] = [];
    for (const rec of recs.filter((x) => x.createdAt >= t0)) {
      const bmp = await createImageBitmap(rec.blob);
      out.push(`${bmp.width}×${bmp.height} (record ${rec.width}×${rec.height})`);
      bmp.close();
    }
    return out.sort();
  }, since);

interface Heap {
  used: number;
  backing: number;
  /** Resident memory of the test browser's renderer (Linux /proc; 0 elsewhere).
   *  The CDP numbers above do not see Blink's decode and ImageData buffers;
   *  this does. */
  rss: number;
}

/** Largest VmRSS among this run's Playwright Chromium renderer processes. */
function rendererRss(): number {
  let max = 0;
  let pids: string[] = [];
  try {
    pids = readdirSync("/proc").filter((d) => /^\d+$/.test(d));
  } catch {
    return 0;
  }
  for (const pid of pids) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
      if (!cmd.includes("ms-playwright") || !cmd.includes("--type=renderer")) continue;
      const m = /VmRSS:\s+(\d+) kB/.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
      if (m) max = Math.max(max, Number(m[1]) * 1024);
    } catch {
      // the process went away between the listing and the read
    }
  }
  return max;
}

/** Peak of the page's JS heap (and ArrayBuffer backing stores, which is where
 *  decoded pixels and wasm memory live) while `run` is in flight. Sampled over
 *  CDP every 50 ms. Main thread only — the batch pass runs there. */
async function peakHeapDuring(page: Page, run: () => Promise<void>) {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const read = async (): Promise<Heap> => {
    const h = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number; backingStorageSize?: number };
    return { used: h.usedSize, backing: h.backingStorageSize ?? 0, rss: rendererRss() };
  };
  await cdp.send("HeapProfiler.collectGarbage");
  const base = await read();
  const peak = { ...base };
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      const h = await read();
      peak.used = Math.max(peak.used, h.used);
      peak.backing = Math.max(peak.backing, h.backing);
      peak.rss = Math.max(peak.rss, h.rss);
      await new Promise((r) => setTimeout(r, 50));
    }
  })();
  try {
    await run();
  } finally {
    stop = true;
    await loop;
    await cdp.detach();
  }
  return { base, peak };
}

const MB = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

test.setTimeout(240_000);

test("1a: Keep crops the other photos from their full-resolution originals", async ({ page }) => {
  // The checker is first, so it is the open photo; both 4000×3000s are not.
  await importFiles(page, [fromDisk(CHECKER), bigPhoto("big-a", 1), bigPhoto("big-b", 2)]);
  expect(await galleryDims(page, "big-a")).toBe("4000×3000");

  await openBatchCrop(page);
  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await page.getByRole("radio", { name: "Keep", exact: true }).click();
  const since = await page.evaluate(() => Date.now());
  const { base, peak } = await peakHeapDuring(page, async () => {
    await page.getByRole("button", { name: /^Crop All Images to 1:1$/ }).click();
    await expect(page.getByText(/Cropped 3 images/).first()).toBeVisible({ timeout: 120_000 });
  });
  console.log(
    `heap 2×12MP Keep: JS used ${MB(base.used)} → peak ${MB(peak.used)}; ` +
      `ArrayBuffer backing ${MB(base.backing)} → peak ${MB(peak.backing)}; renderer RSS ${MB(base.rss)} → peak ${MB(peak.rss)}`,
  );

  // What the gallery says…
  expect(await galleryDims(page, "big-a"), "big-a in the gallery").toBe("3000×3000");
  expect(await galleryDims(page, "big-b"), "big-b in the gallery").toBe("3000×3000");
  // …and what is really stored: two new originals, both 3000×3000 pixels.
  const stored = (await storedSince(page, since)).filter((s) => !s.startsWith("256×"));
  console.log(`stored after Keep: ${JSON.stringify(stored)}`);
  expect(stored).toEqual(["3000×3000 (record 3000×3000)", "3000×3000 (record 3000×3000)"]);
});

test("1a: a set width still lands every photo on that size", async ({ page }) => {
  await importFiles(page, [fromDisk(CHECKER), bigPhoto("big-a", 3), bigPhoto("big-b", 4)]);
  await openBatchCrop(page);
  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await page.getByRole("radio", { name: "1080px", exact: true }).click();
  const since = await page.evaluate(() => Date.now());
  await page.getByRole("button", { name: /^Crop All Images to 1:1$/ }).click();
  await expect(page.getByText(/Cropped 3 images/).first()).toBeVisible({ timeout: 120_000 });

  expect(await galleryDims(page, "big-a")).toBe("1080×1080");
  expect(await galleryDims(page, "big-b")).toBe("1080×1080");
  await expect(page.getByText("Photo: 1080×1080"), "the open photo too").toBeVisible();
  const stored = (await storedSince(page, since)).filter((s) => !s.startsWith("256×"));
  expect(stored).toEqual(["1080×1080 (record 1080×1080)", "1080×1080 (record 1080×1080)"]);
});

// ── 1b ───────────────────────────────────────────────────────────────────────

/** The engine through the React fiber tree, parked on `window.__ihTool`
 *  (same technique as redo-ctrl-y.spec.ts). */
async function exposeEngine(page: Page): Promise<void> {
  const found = () =>
    page.evaluate(() => {
      const root = document.querySelector("#root") as unknown as Record<string, unknown>;
      const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"))!;
      type Fiber = { child?: Fiber; sibling?: Fiber; memoizedState?: unknown };
      const isTool = (v: unknown) =>
        !!v && typeof (v as { add_layer_mask_from?: unknown }).add_layer_mask_from === "function";
      let tool: unknown = null;
      const walk = (f: Fiber | undefined, d: number) => {
        if (!f || tool || d > 600) return;
        let s = f.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
        while (s && !tool) {
          const v = s.memoizedState as { current?: unknown } | undefined;
          if (isTool(v)) tool = v;
          else if (v && isTool(v.current)) tool = v.current;
          s = s.next as typeof s;
        }
        walk(f.child, d + 1);
        walk(f.sibling, d + 1);
      };
      walk(root[key] as Fiber, 0);
      (window as unknown as { __ihTool: unknown }).__ihTool = tool;
      return !!tool;
    });
  await expect.poll(found, { message: "engine handle reachable", timeout: 30_000 }).toBe(true);
}

/** The undo stack's labels, oldest first. */
const undoLabels = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const t = (window as unknown as { __ihTool: { history_labels: () => Promise<string> | string } }).__ihTool;
    const raw = await t.history_labels();
    return raw
      .split("|")
      .filter((p) => p.startsWith("undo:"))
      .map((p) => p.slice(5));
  });

async function blurAndPress(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

test("1b: crop → undo → paint → re-apply keeps the stroke and crops once", async ({ page }) => {
  // Batch needs two photos; the sky (first) is the open one.
  await importFiles(page, [fromDisk(SKY), fromDisk(CHECKER)]);
  await exposeEngine(page);
  const start = await undoLabels(page);

  await openBatchCrop(page);
  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await page.getByRole("radio", { name: "Keep", exact: true }).click();
  const cropAll = page.getByRole("button", { name: /^Crop All Images to 1:1$/ });
  await cropAll.click();
  await expect(page.getByText(/Cropped 2 images/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Photo: 800×800")).toBeVisible();
  // Keep on a 1200×800 photo is ONE step (crop, no resize) — the case where
  // one new edit after an undo puts the count right back where it was.
  expect(await undoLabels(page)).toEqual([...start, "Crop"]);

  await blurAndPress(page, "Control+z");
  await expect(page.getByText("Photo: 1200×800")).toBeVisible();
  expect(await undoLabels(page)).toEqual(start);

  // One brush stroke across the middle of the photo.
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Brush", exact: true }).first().click();
  await page.waitForTimeout(500);
  const box = (await page.locator("canvas.main-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => undoLabels(page).then((l) => l.length)).toBe(start.length + 1);
  const afterStroke = await undoLabels(page);
  const strokeLabel = afterStroke[afterStroke.length - 1]!;
  expect(strokeLabel, "the stroke is its own step").not.toBe("Crop");

  // Re-apply.
  await openBatchCrop(page);
  await cropAll.click();
  await expect(page.getByText(/Cropped 2 images/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Photo: 800×800")).toBeVisible();
  const final = await undoLabels(page);
  console.log(`1b history: start=${JSON.stringify(start)} final=${JSON.stringify(final)}`);
  expect(final, "the stroke is still there, with ONE crop on top of it").toEqual([...afterStroke, "Crop"]);
});

test("1b: crop → re-apply with nothing in between still re-frames from the original", async ({ page }) => {
  // The rewind this fix must keep: switching 1:1 → 4:5 and applying again
  // replaces the first crop rather than cropping the square.
  // Batch needs two photos; the sky (first) is the open one.
  await importFiles(page, [fromDisk(SKY), fromDisk(CHECKER)]);
  await exposeEngine(page);
  const start = await undoLabels(page);
  await openBatchCrop(page);
  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await page.getByRole("radio", { name: "Keep", exact: true }).click();
  await page.getByRole("button", { name: /^Crop All Images to 1:1$/ }).click();
  await expect(page.getByText("Photo: 800×800")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("radio", { name: "16:9", exact: true }).click();
  await page.getByRole("button", { name: /^Crop All Images to 16:9$/ }).click();
  // From the 1200×800 original, not from the 800×800 square (which would be 800×450).
  await expect(page.getByText("Photo: 1200×675")).toBeVisible({ timeout: 30_000 });
  expect(await undoLabels(page)).toEqual([...start, "Crop"]);
});

// ── Opt-in: the 12 × 24 MP memory measurement for the PR ─────────────────────
// Too slow for every CI run (twelve 6000×4000 imports plus twelve full-res
// crops). `IH_HEAP_BATCH=1 PW_PORT=… pnpm exec playwright test batch-crop-full-res`
test("1a memory: twelve 24 MP photos are cropped one at a time", async ({ page }) => {
  test.skip(!process.env.IH_HEAP_BATCH, "opt-in: set IH_HEAP_BATCH=1");
  test.setTimeout(900_000);
  const files = Array.from({ length: 12 }, (_, i) => bigPhoto(`mp24-${i}`, 10 + i, 6000, 4000));
  await importFiles(page, files);
  await openBatchCrop(page);
  await page.getByRole("radio", { name: "1:1", exact: true }).click();
  await page.getByRole("radio", { name: "Keep", exact: true }).click();
  const t0 = Date.now();
  const { base, peak } = await peakHeapDuring(page, async () => {
    await page.getByRole("button", { name: /^Crop All Images to 1:1$/ }).click();
    await expect(page.getByText(/Cropped 12 images/).first()).toBeVisible({ timeout: 800_000 });
  });
  console.log(
    `heap 12×24MP Keep (${((Date.now() - t0) / 1000).toFixed(1)} s): JS used ${MB(base.used)} → peak ${MB(peak.used)}; ` +
      `ArrayBuffer backing ${MB(base.backing)} → peak ${MB(peak.backing)}; renderer RSS ${MB(base.rss)} → peak ${MB(peak.rss)}`,
  );
  expect(await galleryDims(page, "mp24-5")).toBe("4000×4000");
  // One decoded 24 MP original is 96 MB of RGBA; twelve would be 1.1 GB.
  expect(peak.used + peak.backing - (base.used + base.backing)).toBeLessThan(600 * 1048576);
  if (base.rss > 0) expect(peak.rss - base.rss).toBeLessThan(1100 * 1048576);
});
