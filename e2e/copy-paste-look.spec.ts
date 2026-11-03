import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Copy look → Paste to selected (Night 11-02, 228; lib/look.ts).
//
// THE ORACLE. Three copies of the SAME photo: A, B and C. A is edited by hand
// through the real panels (Levels, then Adjustments, then a Preset), and A's
// canvas afterwards is exactly "what A's values produce on this photo". B and C
// start from the same pixels, so after a paste each must show A's picture:
// B through the live engine (the open photo), C from its stored file (not
// open). Levels first means A's canvas after Levels alone is also the oracle
// for a Levels-only paste.

const SKY = readFileSync(join(__dirname, "fixtures", "sky-building.png"));
const three = ["A.png", "B.png", "C.png"].map((name) => ({ name, mimeType: "image/png", buffer: SKY }));

type Print = { w: number; h: number; rgb: [number, number, number] };

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Size + mean color of the main canvas (the photo-switch-state probe). */
const print = (page: Page): Promise<Print | null> =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c || c.width === 0) return null;
    const o = document.createElement("canvas");
    o.width = 16;
    o.height = 16;
    const ctx = o.getContext("2d")!;
    ctx.drawImage(c, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      s[0] += d[i]!;
      s[1] += d[i + 1]!;
      s[2] += d[i + 2]!;
    }
    const n = d.length / 4;
    return { w: c.width, h: c.height, rgb: [s[0] / n, s[1] / n, s[2] / n] as [number, number, number] };
  });

const same = (a: Print | null, b: Print | null, tol = 1) =>
  !!a && !!b && a.w === b.w && a.h === b.h && a.rgb.every((v, i) => Math.abs(v - b.rgb[i]!) <= tol);
const fmt = (p: Print | null) => (p ? `${p.w}x${p.h} rgb(${p.rgb.map((v) => v.toFixed(1)).join(",")})` : "none");

async function settled(page: Page): Promise<Print | null> {
  let last: Print | null = null;
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    await page.waitForTimeout(300);
    const p = await print(page);
    stable = same(p, last, 0.01) ? stable + 1 : 0;
    last = p;
  }
  return last;
}

async function press(page: Page, keys: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(keys);
}

async function open(page: Page, group: string, tool: string) {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: tool, exact: true }).first().click();
  await page.waitForTimeout(500);
}

async function setSlider(page: Page, label: string, v: number) {
  const input = page.locator(`input[type="range"][aria-label="${label}"]`);
  await expect(input).toHaveCount(1);
  await input.evaluate((el, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
}

/** A by hand: Levels (→ the Levels-only oracle), Brightness +40, Vivid. */
async function editA(page: Page): Promise<{ p0: Print; pLevels: Print; pAll: Print }> {
  const p0 = (await settled(page))!;
  await open(page, "Enhance", "Levels");
  await setSlider(page, "Black point", 48);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const pLevels = (await settled(page))!;
  expect(same(pLevels, p0), "Levels changed A").toBe(false);

  await open(page, "Enhance", "Adjustments");
  const s = page.getByRole("slider", { name: "Brightness", exact: true });
  const box = (await s.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 140) / 200, y, { steps: 8 });
  await page.mouse.up();
  await settled(page);

  await open(page, "Enhance", "Presets");
  await page.getByRole("button", { name: /^Apply Vivid —/ }).first().click();
  const pAll = (await settled(page))!;
  expect(same(pAll, pLevels), "Adjustments and Vivid changed A further").toBe(false);
  return { p0, pLevels, pAll };
}

async function setup(page: Page) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(three);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect(page.locator('[aria-label^="Select photo"]')).toHaveCount(3);
}

/** Tick gallery photos by index (the tile's own select toggle). */
async function tick(page: Page, ...indexes: number[]) {
  const toggles = page.locator('[aria-label="Select image"]');
  for (const i of indexes) await toggles.nth(i).click();
}

/** Ctrl+Alt+C on A. The gallery names a photo without its extension. Any of
 *  Copy look's three answers is waited for, and the one shown is checked, so
 *  a refusal reads as itself instead of as a missing toast. */
async function copyFromA(page: Page) {
  await press(page, "Control+Alt+c");
  const toast = page.getByText(/Copied the look of|no Adjustments, Preset or Levels to copy|Open a photo to copy/).first();
  await expect(toast).toBeVisible();
  expect(await toast.textContent()).toMatch(/^Copied the look of A: Adjustments, Preset, Levels\.$/);
}

async function pasteDialog(page: Page) {
  await press(page, "Control+Alt+v");
  const dialog = page.getByRole("dialog", { name: "Paste look" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.setTimeout(240_000);

test("the look travels: B (open) and C (not open) end exactly like A, and B undoes in one step", async ({ page }) => {
  await setup(page);
  const { p0, pAll } = await editA(page);

  await copyFromA(page);

  await press(page, "PageDown");
  expect(same(await settled(page), p0), "B starts as the untouched photo").toBe(true);
  await tick(page, 1, 2);

  const dialog = await pasteDialog(page);
  await expect(dialog.getByRole("checkbox")).toHaveCount(3);
  await expect(dialog).toContainText("Paste can't be undone on photos that aren't open");

  // Peak JS heap while the paste runs (the engine's wasm memory is not in it).
  await page.evaluate(() => {
    const w = window as unknown as { __peak: number; __peakTimer: number };
    const mem = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    w.__peak = mem();
    w.__peakTimer = window.setInterval(() => (w.__peak = Math.max(w.__peak, mem())), 25);
  });
  await dialog.getByRole("button", { name: "Paste to 2" }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  const peak = await page.evaluate(() => {
    const w = window as unknown as { __peak: number; __peakTimer: number };
    clearInterval(w.__peakTimer);
    return w.__peak;
  });
  console.log(`paste-look: peak JS heap ${(peak / 1048576).toFixed(1)} MB`);

  const b = await settled(page);
  console.log(`paste-look: A ${fmt(pAll)} B ${fmt(b)}`);
  expect(same(b, pAll), `B (open) shows A's look (${fmt(b)} vs ${fmt(pAll)})`).toBe(true);

  await press(page, "Control+z");
  expect(same(await settled(page), p0), "one Ctrl+Z puts B back").toBe(true);
  await press(page, "Control+Shift+z");
  expect(same(await settled(page), pAll), "redo puts the look back").toBe(true);

  await press(page, "PageDown");
  const c = await settled(page);
  console.log(`paste-look: C ${fmt(c)}`);
  expect(same(c, pAll), `C (not open, from its stored file) shows A's look (${fmt(c)} vs ${fmt(pAll)})`).toBe(true);
});

test("paste only Levels: B gets A's Levels and nothing else, and undoes in one step after a reload", async ({ page }) => {
  await setup(page);
  const { p0, pLevels } = await editA(page);
  await copyFromA(page);

  await press(page, "PageDown");
  await settled(page);
  await tick(page, 1);
  const dialog = await pasteDialog(page);
  await dialog.getByRole("checkbox", { name: /^Adjustments/ }).uncheck();
  await dialog.getByRole("checkbox", { name: /^Preset/ }).uncheck();
  await dialog.getByRole("button", { name: "Paste to 1" }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });

  const b = await settled(page);
  expect(same(b, pLevels), `B has A's Levels only, Brightness untouched (${fmt(b)} vs ${fmt(pLevels)})`).toBe(true);

  // Let the autosave land, reload, resume: the op log is all undo has left.
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
  // Resume reopens the first photo here (A), not the last one open; that is
  // the app's resume, not this feature. Go to B, which now loads from what
  // was saved: its op log, with the paste as one step in it.
  const lit = () => page.evaluate(() =>
    [...document.querySelectorAll('[aria-label^="Select photo"]')].findIndex((t) => t.getAttribute("aria-pressed") === "true"));
  await settled(page);
  if ((await lit()) !== 1) {
    await press(page, "PageDown");
    await expect.poll(lit).toBe(1);
  }
  const reloaded = await settled(page);
  console.log(`paste-look reload: B=${fmt(reloaded)} levels=${fmt(pLevels)} p0=${fmt(p0)}`);
  expect(same(reloaded, pLevels), `after the reload B still has the Levels (${fmt(reloaded)} vs ${fmt(pLevels)})`).toBe(true);
  await press(page, "Control+z");
  expect(same(await settled(page), p0), "one Ctrl+Z after the reload puts B back").toBe(true);
});
