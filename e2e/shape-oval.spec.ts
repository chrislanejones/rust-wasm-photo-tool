import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The circle's oval handle — the stem + small oval left of the edit box. Drag
// it and the circle stretches about its own center into an oval, which the
// engine stores as kind 41 with the stretched bbox. Through the real mouse
// path and asserted on the engine's own JSON after commit. Helpers are copied
// from shape-corner-radius.spec.ts.
//
// SHOTS_DIR=<dir> also saves a screenshot at each step.
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
interface ShapeRow {
  kind: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

async function shapes(page: Page): Promise<ShapeRow[]> {
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: { get_shape_annotations(): string | Promise<string> } }).__probeTool;
    return JSON.parse(await t.get_shape_annotations()) as ShapeRow[];
  });
}

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.SHOTS_DIR;
  if (dir) await page.screenshot({ path: join(dir, `${name}.png`) });
}

test("shapes: the circle's oval handle stretches it into an oval", async ({ page }) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await importFixture(page);
  await pickTool(page, "Create", "Shapes");
  await page.getByRole("radio", { name: "Circle", exact: true }).first().click();
  await installEngineProbe(page);

  // A wide box: the circle it shows is the inscribed one, r = 40 about (120, 120).
  await drag(page, [60, 80], [180, 160]);
  const handle = page.locator("[data-shape-oval-handle]");
  await expect(handle).toHaveCount(1);
  await shot(page, "1-circle-with-oval-handle");

  // Drag the handle 60 canvas px to the left.
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const to = await canvasToScreen(page, 0, 0);
  const from = await canvasToScreen(page, 60, 0);
  const dx = to.x - from.x;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 3 });
  await page.mouse.move(x + dx, y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await shot(page, "2-stretched");

  await page.keyboard.press("Enter"); // commit
  await page.waitForTimeout(300);
  await shot(page, "3-committed");
  const [s] = await shapes(page);
  expect(s.kind, "stored as an oval").toBe(41);
  const w = Math.abs(s.x1 - s.x0);
  const h = Math.abs(s.y1 - s.y0);
  expect(h, "height is the circle's diameter").toBeCloseTo(80, 0);
  expect(w, "stretched 60 px each side of the 80 px circle").toBeGreaterThan(190);
  expect((s.x0 + s.x1) / 2, "about its own center").toBeCloseTo(120, 0);
  expect((s.y0 + s.y1) / 2).toBeCloseTo(120, 0);
  expect(errors).toEqual([]);
});
