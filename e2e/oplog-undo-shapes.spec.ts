import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// One undo press undoes one thing you did, on the op-log path (ADR-088).
//
// A shape drawn with a non-default style records more than one op under its
// one snapshot: a rounded rectangle is ShapeAdd + ShapeCornerRadii, a star
// with ≠ 5 points is ShapeAdd + ShapeStarPoints, sloppiness adds
// ShapeSloppiness. Before op-log v12, undo rewound ONE op per press, so the
// first Ctrl+Z after a rounded rectangle changed nothing on screen and every
// later undo landed one gesture late. #351 turned op-log undo on for every
// engine, which is what made this reachable; this spec is the person's-eye view
// of src/ops_engine_parity.rs's gesture tests.
//
// Every case checks three things after Ctrl+Z, read off the engine itself:
//   • the shape is gone and the composite hash is back to before the gesture;
//   • `oplog_is_broken()` is false and the status still "recording": the undo
//     REPLAYED the log. A snapshot-path undo with a live log marks it broken,
//     so this is what proves which path ran;
// and after Ctrl+Shift+Z the composite is back, byte-exact.
//
// Shapes are drawn with the real mouse; the style comes from the panel's
// presets, set BEFORE the drag, which is what puts several ops under one
// snapshot. Rotation has no panel control (only the canvas handle), so the
// "two side ops" case is a sloppy rounded rectangle: CornerRadii + Sloppiness.
//
//   E2E_CPU_THROTTLE=4 pnpm exec playwright test oplog-undo-shapes --repeat-each 10
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
 *  (same technique as oplog-undo-through-ui.spec.ts). */
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

/** A preset button or radio on the Shapes panel, e.g. "Corner Radius 24px". */
async function preset(page: Page, name: string): Promise<void> {
  await page.getByRole("radio", { name }).or(page.getByRole("button", { name })).first().click();
}

async function pickShape(page: Page, name: string): Promise<void> {
  await page.getByRole("radiogroup", { name: "Shape" }).getByRole("radio", { name }).click();
}

/** Canvas pixels → a real-mouse drag, then Apply. */
async function drawShape(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const at = (cx: number, cy: number) =>
    page.evaluate(
      ([px, py]) => {
        const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
        const r = c.getBoundingClientRect();
        return { x: r.left + (px / c.width) * r.width, y: r.top + (py / c.height) * r.height };
      },
      [cx, cy] as const,
    );
  const a = await at(...from);
  const b = await at(...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await commit(page);
}

async function commit(page: Page): Promise<void> {
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

/** One Ctrl+Z takes the whole gesture back on the op-log path; Ctrl+Shift+Z
 *  brings it back byte-exact. */
async function undoRedoOneGesture(page: Page, before: Probe, what: string): Promise<void> {
  const after = await probe(page);
  expect(after.shapes, `${what}: drawn`).toBe(before.shapes + 1);
  expect(after.broken, `${what}: log healthy before the undo`).toBe(false);

  await key(page, "Control+z");
  const undone = await settled(page, before.undo);
  console.log(`${what}: after Ctrl+Z ${JSON.stringify(undone)}`);
  expect(undone.shapes, `${what}: one Ctrl+Z removes it`).toBe(before.shapes);
  expect(undone.hash, `${what}: composite back to before`).toBe(before.hash);
  expect(undone.broken, `${what}: still on the op-log path`).toBe(false);
  expect(undone.status).toBe("recording");

  await key(page, "Control+Shift+z");
  const redone = await settled(page, after.undo);
  expect(redone.shapes, `${what}: redo brings it back`).toBe(after.shapes);
  expect(redone.hash, `${what}: redo is byte-exact`).toBe(after.hash);
  expect(redone.broken).toBe(false);
}

test("a rounded rectangle: one Ctrl+Z removes it", async ({ page }) => {
  await setup(page);
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 24px");
  const before = await probe(page);
  await drawShape(page, [40, 40], [200, 180]);
  await settled(page, before.undo + 1);
  await undoRedoOneGesture(page, before, "rounded rectangle");
});

test("an 8-point star: one Ctrl+Z removes it", async ({ page }) => {
  await setup(page);
  await pickShape(page, "Star");
  await preset(page, "Points 8");
  const before = await probe(page);
  await drawShape(page, [40, 40], [200, 200]);
  await settled(page, before.undo + 1);
  await undoRedoOneGesture(page, before, "8-point star");
});

test("a sloppy rounded rectangle (two side ops): one Ctrl+Z removes it", async ({ page }) => {
  await setup(page);
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 24px");
  await preset(page, "Sloppiness 50%");
  const before = await probe(page);
  await drawShape(page, [40, 40], [200, 180]);
  await settled(page, before.undo + 1);
  await undoRedoOneGesture(page, before, "sloppy rounded rectangle");
});

test("a duplicated rounded rectangle: one Ctrl+Z removes only the copy", async ({ page }) => {
  await setup(page);
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 24px");
  // Draw, then duplicate from the action bar before applying.
  const at = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    const r = c.getBoundingClientRect();
    const s = r.width / c.width;
    return { x: r.left, y: r.top, s };
  });
  await page.mouse.move(at.x + 30 * at.s, at.y + 60 * at.s);
  await page.mouse.down();
  await page.mouse.move(at.x + 100 * at.s, at.y + 140 * at.s, { steps: 6 });
  await page.mouse.up();
  await commit(page);
  const before = await settled(page, 1);

  // Select it again and duplicate through the action bar's east port.
  await page.mouse.click(at.x + 65 * at.s, at.y + 62 * at.s);
  const bar = page.getByTestId("shape-action-bar");
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: /^Duplicate —/ }).click();
  await page.locator('[data-shape-port="e"]').click();
  await expect.poll(async () => (await probe(page)).shapes).toBe(2);
  await bar.getByRole("button", { name: "Stop duplicating" }).click();
  await commit(page);
  await settled(page, before.undo + 1);
  await undoRedoOneGesture(page, before, "duplicate");
});

test("three gestures undo in order: stroke, then B, then A whole", async ({ page }) => {
  await setup(page);
  const h0 = await probe(page);
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 24px");
  await drawShape(page, [30, 30], [110, 110]);
  const a = await settled(page, h0.undo + 1);
  await preset(page, "Corner Radius 0px");
  await drawShape(page, [140, 140], [220, 220]);
  const b = await settled(page, h0.undo + 2);

  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Brush", exact: true }).first().click();
  const box = (await page.locator("canvas.main-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.9);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.85, { steps: 8 });
  await page.mouse.up();
  await settled(page, h0.undo + 3);

  await key(page, "Control+z");
  expect((await settled(page, h0.undo + 2)).hash, "first undo: the stroke").toBe(b.hash);
  await key(page, "Control+z");
  expect((await settled(page, h0.undo + 1)).hash, "second undo: B").toBe(a.hash);
  await key(page, "Control+z");
  const end = await settled(page, h0.undo);
  expect(end.hash, "third undo: A, whole").toBe(h0.hash);
  expect(end.shapes).toBe(0);
  expect(end.broken).toBe(false);
});
