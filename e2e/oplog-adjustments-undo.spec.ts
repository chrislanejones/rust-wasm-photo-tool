import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

interface Probe {
  broken: boolean;
  status: string;
  cursor: number;
  ops: number;
  undo: number;
  hash: string;
}

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
 *  (same technique as oplog-undo-through-ui.spec.ts). Re-run after a reload. */
async function exposeEngine(page: Page): Promise<void> {
  const found = () => page.evaluate(() => {
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
      oplog_status: () => Promise<string>;
      oplog_cursor: () => Promise<number>;
      oplog_op_count: () => Promise<number>;
      undo_count: () => Promise<number>;
      composite_hash_hex: () => Promise<string>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      cursor: await t.oplog_cursor(),
      ops: await t.oplog_op_count(),
      undo: await t.undo_count(),
      hash: await t.composite_hash_hex(),
    };
  });
}


async function state(page: Page, count: number): Promise<Probe> {
  await expect.poll(async () => (await probe(page)).undo).toBe(count);
  const p = await probe(page);
  expect(p.broken).toBe(false);
  expect(p.cursor).toBe(count);
  return p;
}

async function slider(page: Page, name: string, fraction: number): Promise<void> {
  const s = page.getByRole("slider", { name, exact: true });
  const box = await s.boundingBox();
  expect(box).not.toBeNull();
  await s.click({ position: { x: box!.width * fraction, y: box!.height / 2 } });
}

async function key(page: Page, combo: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

test("Adjustments releases and Reset survive reload as exact undo steps", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(join(__dirname, "fixtures/checker.png"));
  await waitForCanvas(page);
  await exposeEngine(page);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Adjustments", exact: true }).first().click();
  const before = await state(page, 0);
  await slider(page, "Brightness", 0.85);
  const bright = await state(page, 1);
  expect(bright.hash).not.toBe(before.hash);
  await slider(page, "Contrast", 0.65);
  const contrast = await state(page, 2);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const reset = await state(page, 3);
  expect(reset.hash).toBe(before.hash);
  await slider(page, "Saturation", 0.2);
  const last = await state(page, 4);
  // Switching panels commits pending edits and closes the preview session.
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await waitForCanvas(page);
  await exposeEngine(page);
  expect((await state(page, 4)).hash).toBe(last.hash);
  for (const [count, hash] of [[3, reset.hash], [2, contrast.hash], [1, bright.hash], [0, before.hash]] as const) {
    await key(page, "Control+z");
    expect((await state(page, count)).hash).toBe(hash);
  }
  await key(page, "Control+Shift+z");
  expect((await state(page, 1)).hash).toBe(bright.hash);
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("PNG", { exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /^Download PNG/ }).click();
  const file = await downloaded;
  expect(await file.failure()).toBeNull();
  const bytes = await readFile((await file.path())!);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  // Default export excludes the 10 px artboard border on each side.
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([256, 256]);
});
