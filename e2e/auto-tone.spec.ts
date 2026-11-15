import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { crc32, deflateSync } from "node:zlib";

// Enhance › Adjustments › Auto (ticket 239, src/auto_tone.rs).
//
// Auto only COMPUTES four slider values; the panel commits them as one
// release. So it must be one undo step, it must be on the op log, and a
// reload must undo it through that log. Fixtures are built here from a
// formula (the same one as the Rust tests in src/auto_tone.rs), never from a
// real photo.

interface Probe {
  broken: boolean;
  cursor: number;
  undo: number;
  hash: string;
}

/** Luma points of the photo (Canvas excluded), the engine's own luma. */
interface Points {
  lo: number;
  mid: number;
  hi: number;
  mean: number;
}

/** xorshift32 → -1..1, the Rust tests' `Noise`. */
function noise(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return (x / 0xffffffff) * 2 - 1;
  };
}

/** The Rust tests' `fixture`: a diagonal ramp shaped by `gamma`, soft
 *  texture, ±4 noise, a faint warm tint. As an RGB PNG. */
function fixturePng(w: number, h: number, lo: number, hi: number, gamma: number): Buffer {
  const n = noise(0x23915eed);
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  const c = (g: number, k: number) => Math.min(255, Math.max(0, Math.round(g * k)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h - 2);
      const texture = 10 * Math.sin(x / 7) * Math.cos(y / 11);
      const g = lo + (hi - lo) * t ** gamma + texture + 4 * n();
      const p = y * row + 1 + x * 3;
      raw[p] = c(g, 1.04);
      raw[p + 1] = c(g, 1.0);
      raw[p + 2] = c(g, 0.92);
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
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const DARK = { name: "auto-dark.png", mimeType: "image/png", buffer: fixturePng(128, 96, 14, 120, 1.8) };
const GOOD = { name: "auto-good.png", mimeType: "image/png", buffer: fixturePng(128, 96, -12, 266, 1.0) };

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

async function waitForCanvas(page: Page): Promise<void> {
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () => page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/** The engine through the React fiber tree, parked on `window.__ihTool`
 *  (oplog-adjustments-undo.spec.ts). Re-run after a reload. */
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

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(async () => {
    type T = {
      oplog_is_broken: () => Promise<boolean>;
      oplog_cursor: () => Promise<number>;
      undo_count: () => Promise<number>;
      composite_hash_hex: () => Promise<string>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      cursor: await t.oplog_cursor(),
      undo: await t.undo_count(),
      hash: await t.composite_hash_hex(),
    };
  });
}

async function state(page: Page, count: number): Promise<Probe> {
  await expect.poll(async () => (await probe(page)).undo).toBe(count);
  const p = await probe(page);
  expect(p.broken, "the op log still describes the photo").toBe(false);
  expect(p.cursor).toBe(count);
  return p;
}

/** 0.5% / 50% / 99.5% luma points and the mean, measured on the photo the
 *  engine would export (the Canvas fill excluded). */
async function points(page: Page): Promise<Points> {
  return page.evaluate(async () => {
    type Cap = { rgba: Uint8Array; free: () => void };
    type T = { capture_composite_excluding_background: () => Promise<Cap> };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    const cap = await t.capture_composite_excluding_background();
    const px = cap.rgba;
    cap.free();
    const bins = new Array<number>(256).fill(0);
    let n = 0;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const l = Math.min(255, Math.floor((px[i]! * 3 + px[i + 1]! * 6 + px[i + 2]!) / 10));
      bins[l]! += 1;
      n += 1;
      sum += l;
    }
    const at = (frac: number) => {
      const want = Math.max(1, Math.ceil(frac * n));
      let cum = 0;
      for (let v = 0; v < 256; v++) {
        cum += bins[v]!;
        if (cum >= want) return v;
      }
      return 255;
    };
    return { lo: at(0.005), mid: at(0.5), hi: at(0.995), mean: sum / n };
  });
}

const SLIDERS = ["Brightness", "Contrast", "Saturation", "Shadows", "Highlights"] as const;
async function sliders(page: Page): Promise<Record<(typeof SLIDERS)[number], number>> {
  const out = {} as Record<(typeof SLIDERS)[number], number>;
  for (const name of SLIDERS) {
    out[name] = Number(await page.getByRole("slider", { name, exact: true }).inputValue());
  }
  return out;
}

async function key(page: Page, combo: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function openAdjustments(page: Page, file: typeof DARK): Promise<void> {
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await waitForCanvas(page);
  await exposeEngine(page);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Adjustments", exact: true }).first().click();
}

const auto = (page: Page) => page.getByRole("button", { name: "Auto", exact: true });

test("Auto brightens a dark photo as one undo step that survives a reload", async ({ page }) => {
  await openAdjustments(page, DARK);
  const before = await state(page, 0);
  const pBefore = await points(page);

  await auto(page).click();
  const after = await state(page, 1);
  expect(after.hash).not.toBe(before.hash);
  const picked = await sliders(page);
  const pAfter = await points(page);
  console.log(`dark  before ${JSON.stringify(pBefore)}`);
  console.log(`dark  after  ${JSON.stringify(pAfter)}`);
  console.log(`dark  picked ${JSON.stringify(picked)}`);
  expect(picked.Saturation, "Auto leaves Saturation alone").toBe(100);
  expect(picked.Brightness).toBeGreaterThan(0);
  expect(pAfter.mean).toBeGreaterThanOrEqual(pBefore.mean + 30);
  expect(pAfter.hi - pAfter.lo).toBeGreaterThanOrEqual(pBefore.hi - pBefore.lo + 80);

  // One Ctrl+Z puts the photo back exactly, and the sliders back to neutral.
  await key(page, "Control+z");
  expect((await state(page, 0)).hash).toBe(before.hash);
  await expect.poll(() => sliders(page)).toEqual({ Brightness: 0, Contrast: 100, Saturation: 100, Shadows: 0, Highlights: 0 });
  await key(page, "Control+Shift+z");
  expect((await state(page, 1)).hash).toBe(after.hash);

  // Switching panels closes the session; give the save time to land.
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await waitForCanvas(page);
  await exposeEngine(page);
  expect((await state(page, 1)).hash, "the reload shows the Auto result").toBe(after.hash);
  await key(page, "Control+z");
  expect((await state(page, 0)).hash, "undone through the op log after a reload").toBe(before.hash);
  await key(page, "Control+Shift+z");
  expect((await state(page, 1)).hash).toBe(after.hash);
});

// The bound: on an already-good photo each of the 0.5%, 50% and 99.5% points
// and the mean moves by at most 8 levels of 255 (the Rust test's bound).
test("Auto moves an already-good photo only a little", async ({ page }) => {
  await openAdjustments(page, GOOD);
  await state(page, 0);
  const pBefore = await points(page);
  await auto(page).click();
  // A pick that changes nothing records nothing, so 0 or 1 steps are both fine.
  await expect.poll(async () => (await probe(page)).undo).toBeLessThanOrEqual(1);
  await page.waitForTimeout(500);
  const picked = await sliders(page);
  const pAfter = await points(page);
  console.log(`good  before ${JSON.stringify(pBefore)}`);
  console.log(`good  after  ${JSON.stringify(pAfter)}`);
  console.log(`good  picked ${JSON.stringify(picked)}`);
  for (const k of ["lo", "mid", "hi", "mean"] as const) {
    expect(Math.abs(pAfter[k] - pBefore[k]), `${k} moved`).toBeLessThanOrEqual(8);
  }
  expect(picked.Saturation).toBe(100);
});
