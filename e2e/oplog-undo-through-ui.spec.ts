import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// PARKING_LOT "in the running app, undo of ANY recorded edit breaks the op log
// (2026-09-15)", pinned as the regression test the entry asked for.
//
// The engine-level tests (src/ops_engine_parity.rs) drive `paint_down/move/up`
// and `undo()` directly and the log replays: cursor 1 → 0, log healthy. In the
// running app the same stroke, undone with Ctrl+Z, left the cursor at 1 and
// `oplog_status()` reading "broken — snapshot undo has taken over". Undo still
// showed the right pixels, so no gate noticed: the undo DEPTH the log exists to
// deliver (ADR-052) was never delivered. This spec takes the observation the
// parity tests cannot: the edit goes through the real UI, so the app's own
// flush path (`flushToCanvas` → `onOplogFlush` + `blitLiveEngine`) runs between
// the edit and the undo, exactly as it does for a user.
//
// What "healthy" means here, read off the engine itself (`window.__ihTool`,
// reached through the React fiber tree the way select-refine-mask.spec.ts does):
//   • `oplog_is_broken()` is false after the undo — the entry's assertion;
//   • `oplog_cursor()` went 1 → 0 with `oplog_op_count()` still 1 — the undo
//     REPLAYED the log rather than popping a snapshot. The cursor is the
//     discriminator: both paths leave `undo_count()` at 0 and the same pixels.
// Two edits are covered because the entry names both: a brush stroke
// (`Op::Stroke`, recorded at `paint_up`) and a Levels apply (`Op::Levels`,
// recorded at `levels_apply`). Shipped defaults throughout: no flag is set, so
// this is the path every user is on.
//
// Run it the way CI does, or 10× at 4× CPU to prove it waits on state:
//   E2E_CPU_THROTTLE=4 pnpm exec playwright test oplog-undo-through-ui --repeat-each 10
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE = join(__dirname, "fixtures", "checker.png"); // 256×256

/** What the engine says about its log. */
interface OplogProbe {
  broken: boolean;
  status: string;
  cursor: number;
  ops: number;
  undo: number;
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

/** Drive the app's real Browse-Files pipeline and wait for the engine's blit. */
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

/** The engine, reached through the React fiber tree (it lives in a worker, so
 *  the handle is the main-thread proxy and every call returns a Promise).
 *  Parked on `window.__ihTool` — same technique as select-refine-mask.spec.ts.
 *  Polled: the canvas shows the decoded pixels BEFORE the engine exists
 *  (`previewLiveCanvas`), so a sized canvas does not yet mean a handle. */
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

async function oplog(page: Page): Promise<OplogProbe> {
  return page.evaluate(async () => {
    type T = {
      oplog_is_broken: () => Promise<boolean>;
      oplog_status: () => Promise<string>;
      oplog_cursor: () => Promise<number>;
      oplog_op_count: () => Promise<number>;
      undo_count: () => Promise<number>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      cursor: await t.oplog_cursor(),
      ops: await t.oplog_op_count(),
      undo: await t.undo_count(),
    };
  });
}

async function open(page: Page, group: string, tool: string): Promise<void> {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.getByRole("button", { name: tool, exact: true }).first().click();
}

/** One real-mouse diagonal stroke across the canvas. Untrusted pointer events
 *  dispatched from `page.evaluate` do not drive the brush (photo-switch-paint
 *  measured it), so this is the real thing. */
async function paintStroke(page: Page): Promise<void> {
  const box = (await page.locator("canvas.main-canvas").boundingBox())!;
  const px = (f: number) => box.x + box.width * f;
  const py = (f: number) => box.y + box.height * f;
  await page.mouse.move(px(0.25), py(0.3));
  await page.mouse.down();
  await page.mouse.move(px(0.7), py(0.65), { steps: 8 });
  await page.mouse.up();
}

/** A native range input: set the value through the prototype setter so React's
 *  value tracker sees the change, then raise the events it listens for. */
async function setSlider(page: Page, label: string, v: number): Promise<void> {
  const input = page.locator(`input[type="range"][aria-label="${label}"]`);
  await expect(input).toHaveCount(1);
  await input.evaluate((el, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
}

/** Ctrl+Z the way a user presses it. The shortcut returns early while a range
 *  slider has focus, so focus is dropped first — a slider is exactly what the
 *  Levels test just touched. */
async function undoKey(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
}

/** The edit was recorded and the undo must be able to replay it. */
function expectOneRecordedOp(p: OplogProbe, what: string): void {
  expect(p.broken, `${what}: oplog_is_broken() before the undo`).toBe(false);
  expect(p.status, `${what}: oplog_status() before the undo`).toBe("recording");
  expect(p.ops, `${what}: one op recorded`).toBe(1);
  expect(p.cursor, `${what}: cursor at the recorded op`).toBe(1);
  expect(p.undo, `${what}: one undo step`).toBe(1);
}

/** The undo rewound THE LOG: the cursor moved, the op is still there (redo
 *  tail), and the engine never fell back to a snapshot. */
function expectReplayedUndo(p: OplogProbe, what: string): void {
  console.log(`${what}: after Ctrl+Z ${JSON.stringify(p)}`);
  expect(p.broken, `${what}: oplog_is_broken() after Ctrl+Z`).toBe(false);
  expect(p.status, `${what}: oplog_status() after Ctrl+Z`).toBe("recording");
  expect(p.cursor, `${what}: the undo seeks the log back one op`).toBe(0);
  expect(p.ops, `${what}: the op stays in the log as the redo tail`).toBe(1);
  expect(p.undo, `${what}: nothing left to undo`).toBe(0);
}

async function setup(page: Page): Promise<void> {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);
  await exposeEngine(page);
}

test("a brush stroke through the UI, then Ctrl+Z, leaves the op log healthy", async ({ page }) => {
  await setup(page);
  await open(page, "Create", "Brush");
  await paintStroke(page);
  // The stroke commits at paint_up, which is where the op is recorded.
  await expect.poll(async () => (await oplog(page)).undo, { timeout: 15_000 }).toBe(1);
  expectOneRecordedOp(await oplog(page), "stroke");

  await undoKey(page);
  await expect.poll(async () => (await oplog(page)).undo, { timeout: 15_000 }).toBe(0);
  expectReplayedUndo(await oplog(page), "stroke");
});

test("a Levels apply through the UI, then Ctrl+Z, leaves the op log healthy", async ({ page }) => {
  await setup(page);
  await open(page, "Enhance", "Levels");
  // Apply is inert at the identity (0, 255, 1): move the black point first.
  await setSlider(page, "Black point", 48);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect.poll(async () => (await oplog(page)).undo, { timeout: 15_000 }).toBe(1);
  expectOneRecordedOp(await oplog(page), "levels");

  await undoKey(page);
  await expect.poll(async () => (await oplog(page)).undo, { timeout: 15_000 }).toBe(0);
  expectReplayedUndo(await oplog(page), "levels");
});
