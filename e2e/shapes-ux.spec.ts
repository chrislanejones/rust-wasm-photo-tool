import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Shapes tool — the four user-testing findings of 2026-08-28, as one spec.
//
//   1. Delete / Backspace on a selected shape removes it.
//   2. Ctrl+Z is ONE history step, not two.
//   3. Clicking the EMPTY INTERIOR of an unfilled rect does not select it —
//      so a shape can be drawn inside another shape.
//   4. Clicking the STROKE of that same rect still selects it.
//
// Runs against the PRODUCTION build in logged-out demo mode, driving the real
// mouse path (rubber-band drag → overlay → commit) rather than the engine, so
// it exercises the hit-test → selectShape → commitEdit chain the user hits.
//
// `expect.soft` throughout: a failure records the number and keeps going, so a
// single run reports every finding instead of stopping at the first.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return route.continue();
    }
    return route.abort();
  });
}

const HARNESS_NOISE =
  /Clerk|clerk|ERR_INTERNET_DISCONNECTED|ERR_FAILED|net::|WebSocket|Failed to load resource|convex/i;

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !HARNESS_NOISE.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!HARNESS_NOISE.test(e.message)) errors.push("PAGEERROR: " + e.message);
  });
  return errors;
}

async function importFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  const canvas = page.locator("canvas.main-canvas");
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(1200);
}

async function pickTool(page: Page, group: string, subTool: string): Promise<void> {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.getByRole("button", { name: subTool, exact: true }).first().click();
  await page.waitForTimeout(400);
}

/**
 * Find the live engine by walking the React fiber tree (the app exposes no
 * global handle — see feedback_browser_probe_techniques). Cached on `window`
 * after the first walk. Worker-backed methods return Promises; every reader
 * below awaits.
 */
async function installEngineProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __probeTool?: unknown };
    if (w.__probeTool) return;
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"));
    if (!key) throw new Error("no react container");
    const seen = new Set<unknown>();
    const isEngine = (v: unknown): boolean =>
      !!v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).get_shape_annotations === "function" &&
      typeof (v as Record<string, unknown>).undo_count === "function";
    const probe = (v: unknown, depth: number): unknown => {
      if (!v || typeof v !== "object" || depth > 6 || seen.has(v)) return null;
      seen.add(v);
      if (isEngine(v)) return v;
      const o = v as Record<string, unknown>;
      for (const k of ["current", "toolRef", "memoizedState", "memoizedProps", "next", "baseState"]) {
        if (k in o) {
          const r = probe(o[k], depth + 1);
          if (r) return r;
        }
      }
      return null;
    };
    const fibers = new Set<unknown>();
    const stack: unknown[] = [root[key]];
    while (stack.length) {
      const f = stack.pop() as Record<string, unknown> | null;
      if (!f || fibers.has(f)) continue;
      fibers.add(f);
      for (const slot of ["memoizedState", "memoizedProps"]) {
        let s = f[slot] as Record<string, unknown> | null;
        // hooks are a linked list on memoizedState
        for (let i = 0; s && i < 64; i++) {
          const r = probe(s, 0);
          if (r) {
            w.__probeTool = r;
            return;
          }
          s = (s.next as Record<string, unknown> | null) ?? null;
        }
      }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    throw new Error("engine not found in fiber tree");
  });
}

async function shapeCount(page: Page): Promise<number> {
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: { get_shape_annotations(): string | Promise<string> } }).__probeTool;
    return (JSON.parse(await t.get_shape_annotations()) as unknown[]).length;
  });
}

async function undoCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: { undo_count(): number | Promise<number> } }).__probeTool;
    return await t.undo_count();
  });
}

async function selectedShapeOverlay(page: Page): Promise<boolean> {
  await page.waitForTimeout(250);
  return (await page.locator("[data-draw-overlay]").count()) > 0;
}

/** Canvas-pixel → viewport-pixel, so drags land where the engine thinks. */
async function canvasToScreen(page: Page, cx: number, cy: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([px, py]) => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
      const r = c.getBoundingClientRect();
      return { x: r.left + (px / c.width) * r.width, y: r.top + (py / c.height) * r.height };
    },
    [cx, cy] as const,
  );
}

async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = await canvasToScreen(page, from[0], from[1]);
  const b = await canvasToScreen(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}

async function clickCanvas(page: Page, cx: number, cy: number): Promise<void> {
  const p = await canvasToScreen(page, cx, cy);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(350);
}

test("shapes: delete key, single-step undo, interior vs stroke selection", async ({ page }) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);
  await pickTool(page, "Create", "Shapes");
  await installEngineProbe(page);

  expect(await shapeCount(page), "precondition: no shapes").toBe(0);

  // ── Three rects in three separate regions of the 256×256 canvas. Each new
  // drag's mouse-down commits the previous pending shape; a final click on
  // bare canvas (bottom-right corner, outside every padded bbox) commits C.
  await drag(page, [10, 10], [60, 60]); // A
  await drag(page, [100, 100], [150, 150]); // B (commits A)
  await drag(page, [190, 190], [240, 240]); // C (commits B)
  await clickCanvas(page, 252, 252); // commits C
  const after3 = await shapeCount(page);
  const undoBefore = await undoCount(page);
  console.log(`[shapes] committed: ${after3} shapes, undo_count=${undoBefore}`);
  expect.soft(after3, "three rects committed").toBe(3);

  // ── 2. Ctrl+Z is ONE step.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  const afterUndo = await shapeCount(page);
  const undoAfter = await undoCount(page);
  console.log(`[shapes] after ONE Ctrl+Z: ${afterUndo} shapes, undo_count=${undoAfter}`);
  expect.soft(undoBefore - undoAfter, "one Ctrl+Z = one history step").toBe(1);
  expect.soft(afterUndo, "one Ctrl+Z removes ONE rect").toBe(after3 - 1);

  // ── 3. Empty INTERIOR of A (unfilled) does not select it: a drag started
  // there draws a NEW rect inside A.
  const before = await shapeCount(page);
  await drag(page, [25, 25], [45, 45]); // wholly inside A, off its stroke
  const overlayAfterInteriorDrag = await selectedShapeOverlay(page);
  await clickCanvas(page, 252, 252); // commit whatever is pending
  const afterInterior = await shapeCount(page);
  console.log(
    `[shapes] drag inside A: overlay=${overlayAfterInteriorDrag}, shapes ${before} → ${afterInterior}`,
  );
  expect.soft(afterInterior, "a drag inside an unfilled rect draws a new shape").toBe(before + 1);

  // ── 4. The STROKE still selects. A's left edge is x=10; y=35 is mid-height.
  await clickCanvas(page, 10, 35);
  const selectedOnStroke = await selectedShapeOverlay(page);
  console.log(`[shapes] click on A's stroke: selected=${selectedOnStroke}`);
  expect.soft(selectedOnStroke, "clicking the stroke selects the shape").toBe(true);

  // ── 1. Delete removes the selected shape.
  const beforeDelete = await shapeCount(page);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(500);
  const afterDelete = await shapeCount(page);
  console.log(`[shapes] Delete on selected: shapes ${beforeDelete} → ${afterDelete}`);
  expect.soft(afterDelete, "Delete removes the selected shape").toBe(beforeDelete - 1);
  expect.soft(await selectedShapeOverlay(page), "nothing stays selected after Delete").toBe(false);

  // And that delete is itself ONE undo step.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  const afterUndoDelete = await shapeCount(page);
  console.log(`[shapes] Ctrl+Z after Delete: shapes → ${afterUndoDelete}`);
  expect.soft(afterUndoDelete, "undo brings the deleted shape back, one step").toBe(beforeDelete);

  // ── 2b. Ctrl+Z on a drawn-but-uncommitted shape discards THAT shape and
  // leaves the engine alone — the previous action must not be undone instead
  // while the new shape hangs on in the overlay ("undo skipped one").
  const engineBefore = await undoCount(page);
  const shapesBefore = await shapeCount(page);
  await drag(page, [130, 20], [180, 60]); // pending, bare canvas (right of A)
  expect.soft(await selectedShapeOverlay(page), "the new shape is pending in the overlay").toBe(true);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  const engineAfter = await undoCount(page);
  console.log(
    `[shapes] Ctrl+Z on a PENDING shape: overlay=${await selectedShapeOverlay(page)}, ` +
      `undo_count ${engineBefore} → ${engineAfter}, shapes ${shapesBefore} → ${await shapeCount(page)}`,
  );
  expect.soft(await selectedShapeOverlay(page), "the pending shape is gone").toBe(false);
  expect.soft(engineAfter, "the engine's history was NOT stepped back").toBe(engineBefore);
  expect.soft(await shapeCount(page), "committed shapes untouched").toBe(shapesBefore);

  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});
