import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Ctrl+Y redoes, like Ctrl+Shift+Z (Night 10-23 §3, PARKING_LOT 10-14).
//
// Windows users reach for Ctrl+Y; only Ctrl+Shift+Z was bound. Each case reads
// the engine itself, as oplog-undo-shapes.spec.ts does: after Ctrl+Y the shape
// is back, the composite is byte-exact, and `oplog_is_broken()` is still false,
// so the redo ran on the op-log path. Inside a text field Ctrl+Y belongs to the
// browser: the canvas does not change and the app does not cancel the key.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE = join(__dirname, "fixtures", "checker.png"); // 256×256

interface Probe {
  broken: boolean;
  status: string;
  shapes: number;
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

async function importFixture(page: Page): Promise<void> {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURE);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () => page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/** The engine through the React fiber tree, parked on `window.__ihTool`
 *  (same technique as oplog-undo-shapes.spec.ts). */
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
      get_shape_annotations: () => Promise<string>;
      undo_count: () => Promise<number>;
      composite_hash_hex: () => Promise<string>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      shapes: (JSON.parse(await t.get_shape_annotations()) as unknown[]).length,
      undo: await t.undo_count(),
      hash: await t.composite_hash_hex(),
    };
  });
}

async function setup(page: Page): Promise<void> {
  await blockExternalNetwork(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await importFixture(page);
  await exposeEngine(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
}

/** Canvas pixels → a real-mouse drag, then Apply. */
async function drawRectangle(page: Page): Promise<void> {
  await page.getByRole("radiogroup", { name: "Shape" }).getByRole("radio", { name: "Rectangle" }).click();
  const at = (cx: number, cy: number) =>
    page.evaluate(
      ([px, py]) => {
        const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
        const r = c.getBoundingClientRect();
        return { x: r.left + (px / c.width) * r.width, y: r.top + (py / c.height) * r.height };
      },
      [cx, cy] as const,
    );
  const a = await at(40, 40);
  const b = await at(200, 180);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await page.getByTestId("shape-action-bar").getByRole("button", { name: "Apply (Enter)" }).click();
  await expect(page.getByTestId("shape-action-bar")).toHaveCount(0);
}

async function key(page: Page, combo: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

/** Wait for the engine to settle on `undo` steps, then read it. */
async function settled(page: Page, undo: number): Promise<Probe> {
  await expect.poll(async () => (await probe(page)).undo, { timeout: 15_000 }).toBe(undo);
  return probe(page);
}

/** Draw, then Ctrl+Z; returns the engine before the draw and after it. */
async function drawThenUndo(page: Page): Promise<{ before: Probe; drawn: Probe }> {
  const before = await probe(page);
  await drawRectangle(page);
  const drawn = await settled(page, before.undo + 1);
  expect(drawn.shapes).toBe(before.shapes + 1);
  await key(page, "Control+z");
  const undone = await settled(page, before.undo);
  expect(undone.shapes, "Ctrl+Z removed it").toBe(before.shapes);
  expect(undone.broken, "undo stayed on the op-log path").toBe(false);
  return { before, drawn };
}

for (const combo of ["Control+y", "Meta+y"]) {
  test(`${combo} redoes a shape on the op-log path`, async ({ page }) => {
    await setup(page);
    const { drawn } = await drawThenUndo(page);

    await key(page, combo);
    const redone = await settled(page, drawn.undo);
    expect(redone.shapes, `${combo} brings it back`).toBe(drawn.shapes);
    expect(redone.hash, "redo is byte-exact").toBe(drawn.hash);
    expect(redone.broken, "still on the op-log path").toBe(false);
    expect(redone.status).toBe("recording");
  });
}

test("Ctrl+Y in a text field is the browser's, not the canvas's", async ({ page }) => {
  await setup(page);
  const { before } = await drawThenUndo(page);

  // The Pins panel's Next field: a place people type.
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
  const next = page.getByRole("textbox", { name: "Next" });
  await next.click();
  await next.press("End");

  // Record whether the app cancelled the key. This listener is added after the
  // app's own window listener, so it sees the event after the app has had it.
  await page.evaluate(() => {
    const w = window as unknown as { __ctrlYPrevented?: boolean };
    window.addEventListener("keydown", (e) => {
      if (e.key === "y" || e.key === "Y") w.__ctrlYPrevented = e.defaultPrevented;
    });
  });
  await next.press("Control+y");

  await expect.poll(() => page.evaluate(() => (window as unknown as { __ctrlYPrevented?: boolean }).__ctrlYPrevented)).toBe(false);
  // Give a stray redo time to land before reading the engine.
  await page.waitForTimeout(500);
  const after = await probe(page);
  expect(after.shapes, "the undone shape stays undone").toBe(before.shapes);
  expect(after.undo, "no redo ran").toBe(before.undo);
  expect(after.hash).toBe(before.hash);
});
