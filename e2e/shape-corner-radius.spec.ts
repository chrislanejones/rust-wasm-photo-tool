import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Shape corner radius (ADR-082) through the real mouse path: the panel slider
// rounds every corner, a corner dot on the edit box does the same, and
// Shift-dragging one dot rounds only that corner. Asserted on the engine's own
// JSON after commit, so the overlay → store → commitEdit → engine chain is
// what is under test. Helpers are copied from shapes-ux.spec.ts.
//
// SHOTS_DIR=<dir> also saves a screenshot of the edit box at each step.
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


async function radii(page: Page): Promise<number[][]> {
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: { get_shape_annotations(): string | Promise<string> } }).__probeTool;
    return (JSON.parse(await t.get_shape_annotations()) as { cornerRadii: number[] }[]).map(
      (s) => s.cornerRadii,
    );
  });
}

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.SHOTS_DIR;
  if (dir) await page.screenshot({ path: join(dir, `${name}.png`) });
}

/** Drag a corner dot by (dx, dy) screen px, optionally with Shift held. */
async function dragDot(page: Page, index: number, dx: number, dy: number, shift: boolean): Promise<void> {
  const dot = page.locator(`[data-shape-radius-handle="${index}"]`);
  const box = (await dot.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
  await page.mouse.move(x + dx, y + dy, { steps: 3 });
  await page.mouse.up();
  if (shift) await page.keyboard.up("Shift");
  await page.waitForTimeout(250);
}

test("shapes: corner radius from the slider, a corner dot, and Shift on one dot", async ({ page }) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await importFixture(page);
  await pickTool(page, "Create", "Shapes");
  await installEngineProbe(page);

  // A big rect, so its dots are on screen.
  await drag(page, [40, 40], [216, 216]);
  await expect(page.locator("[data-shape-radius-handle]")).toHaveCount(4);
  await shot(page, "1-square-with-dots");

  // Panel slider preset: every corner.
  await page.getByRole("radio", { name: "Corner Radius 24px" }).or(page.getByRole("button", { name: "Corner Radius 24px" })).first().click();
  await page.waitForTimeout(250);
  await shot(page, "2-slider-24");

  // A corner dot without Shift: every corner follows it.
  await dragDot(page, 0, 12, 12, false);
  await shot(page, "3-dot-all-corners");

  // Shift on the top-right dot: that corner only.
  await dragDot(page, 1, -30, 30, true);
  await shot(page, "4-shift-one-corner");

  await clickCanvas(page, 252, 252); // commit
  await shot(page, "5-committed");
  const [r] = await radii(page);
  expect(r[0], "TL kept the shared radius").toBeGreaterThan(24);
  expect(r[2]).toBe(r[0]);
  expect(r[3]).toBe(r[0]);
  expect(r[1], "Shift rounded TR alone").toBeGreaterThan(r[0]);
  expect(errors).toEqual([]);
});
