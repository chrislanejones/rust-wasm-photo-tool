import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Review › Combine — a placed object as a selection producer (ADR-074).
//
// The unit tests cover the two ends of this feature: `objectSelection.test.ts`
// pins the geometry and `ReviewPanel.combine.test.ts` pins the panel writing
// the store. NOTHING but a browser covers the LINK — panel → `combineRequest`
// nonce → `useSelectionActions` → `set_selection_combine` + a marquee producer
// → a real mask in the engine. That link is the whole feature, and it is three
// modules and a worker boundary long.
//
// What this pins:
//   1. clicking an object's row in Review › Combine makes a REAL selection in
//      the engine (`has_selection`, `selection_coverage`), while the SHAPES
//      tool is held — the reason the control left the Select panel at all
//   2. it is ONE undo step, and one Ctrl+Z takes it back
//   3. the standing mode applies: Subtract on the same object takes the
//      selection back to nothing, so the four buttons really do drive it
//
// Runs against the production build in logged-out demo mode and drives the real
// mouse, the real toggles and the real rows.
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
  await fileInput.first().waitFor({ state: "attached" });
  await fileInput.first().setInputFiles(FIXTURE_PNG);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
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

/** The engine, by walking the React fiber tree — the app exposes no global
 *  handle. Same probe as e2e/shapes-ux.spec.ts; worker-backed methods return
 *  Promises, so every reader below awaits. */
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

/** The probe's engine surface. Declared for the reader; every `page.evaluate`
 *  below re-states the cast inline, because an evaluate body is serialized and
 *  cannot close over anything in this file. */
interface Probe {
  has_selection(): boolean | Promise<boolean>;
  selection_coverage(): ArrayLike<number> | Promise<ArrayLike<number>>;
  undo_count(): number | Promise<number>;
  get_shape_annotations(): string | Promise<string>;
}

async function selectedPixels(page: Page): Promise<number> {
  await page.waitForTimeout(400);
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: Probe }).__probeTool;
    if (!(await t.has_selection())) return 0;
    const c = await t.selection_coverage();
    return Number(c[0]);
  });
}

async function undoCount(page: Page): Promise<number> {
  return page.evaluate(
    async () => await (window as unknown as { __probeTool: Probe }).__probeTool.undo_count(),
  );
}

async function shapeCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: Probe }).__probeTool;
    return (JSON.parse(await t.get_shape_annotations()) as unknown[]).length;
  });
}

async function canvasToScreen(page: Page, cx: number, cy: number) {
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

/** The Combine section's readout, the line the user reads. */
const readout = (page: Page) => page.getByTestId("combine-coverage");

test("Review › Combine: an object row makes a real selection, and the mode drives it", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);

  // A 100×100 rect on the 256×256 checker, committed by a click on bare canvas.
  await pickTool(page, "Create", "Shapes");
  await installEngineProbe(page);
  await drag(page, [40, 40], [140, 140]);
  await clickCanvas(page, 250, 250);
  expect(await shapeCount(page), "precondition: one shape committed").toBe(1);
  expect(await selectedPixels(page), "precondition: nothing selected").toBe(0);

  // ── Open Review, then its fifth section. The SHAPES tool is still the active
  // one — which is the point of the move: the Select panel is not even on
  // screen, and Combine works anyway.
  await page.getByRole("button", { name: "Review", exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Combine", exact: true }).first().click();
  await page.waitForTimeout(300);
  await expect(readout(page), "readout before any combine").toHaveText("Nothing selected");

  // ── 1. The row combines. Mode is New selection (the default), so the
  // selection becomes the shape's footprint: a 100×100 box plus half the
  // default stroke on each side, so comfortably over 10,000 px and well under
  // the whole 65,536 px canvas.
  const row = page.getByRole("button", { name: /Square #1/ }).last();
  const undoBefore = await undoCount(page);
  await row.click();
  const afterCombine = await selectedPixels(page);
  const undoAfter = await undoCount(page);
  console.log(`[combine] selected ${afterCombine} px, undo ${undoBefore} → ${undoAfter}`);
  expect.soft(afterCombine, "a row click selects the object's footprint").toBeGreaterThan(10_000);
  expect.soft(afterCombine, "and not the whole canvas").toBeLessThan(65_536);
  await expect.soft(readout(page), "the readout names the coverage").toContainText("Selected");

  // ── 2. ONE undo step, and Ctrl+Z takes it back.
  expect.soft(undoAfter - undoBefore, "one history step per combine").toBe(1);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(700);
  expect.soft(await selectedPixels(page), "undo restores no-selection").toBe(0);

  // ── 3. The standing mode drives it. Re-combine in New, then switch to
  // Subtract and click the same row: taking a region out of itself leaves
  // nothing, which no other mode would do.
  await row.click();
  expect.soft(await selectedPixels(page), "re-selected before subtracting").toBeGreaterThan(10_000);
  // A RADIO, not a button: the strip passes `value`, which makes
  // ToolButtonGroup a radiogroup (its own doc: "PASSING THE PROP AT ALL is what
  // makes this a SELECT group"). Icon-only, so the name is its `aria-label`.
  await page.getByRole("radio", { name: "Subtract", exact: true }).first().click();
  await page.waitForTimeout(200);
  await row.click();
  expect.soft(await selectedPixels(page), "Subtract of itself leaves nothing").toBe(0);
  await expect
    .soft(readout(page), "and the readout says so")
    .toHaveText("Nothing selected");
  // The head spells the mode out — the strip is four near-identical squares.
  await expect.soft(page.getByText("Subtract", { exact: true })).toBeVisible();

  expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
});
