import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────
// Thirty fast drags in a row all land, each where it was drawn and as what
// was picked for it.
//
// A press on the Shapes canvas waits on engine round trips (commit the pending
// shape, hit-test) before it is a drag, and they slow as shapes pile up. The
// pointer used to move and lift into a hook that was not drawing yet: from
// about the 14th shape every other drag vanished, and the next one started
// from the vanished one's start point. Presses are now recorded at once, their
// moves and release buffered, and handled in order (lib/pressQueue.ts).
//
// The drags here do not pause after the press and do not commit with Enter:
// the next drag commits the last, which is the path that dropped them.
// ─────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");

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

async function waitForCanvas(page: Page): Promise<void> {
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

/** The engine, found through the React fiber tree (the recipe from
 *  shapes-ux.spec.ts). Re-install after a reload: the page is new. */
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

interface ShapeJson {
  kind: number;
  rotation?: number;
  starPoints?: number;
}

async function engineShapes(page: Page): Promise<ShapeJson[]> {
  return page.evaluate(async () => {
    const tool = (window as unknown as { __probeTool: { get_shape_annotations(): Promise<string> } })
      .__probeTool;
    return JSON.parse(await tool.get_shape_annotations()) as ShapeJson[];
  });
}

/** A fast drag in canvas px: press, two hops, release — no pauses. */
async function fastDrag(page: Page, from: [number, number], to: [number, number]) {
  const a = await canvasToScreen(page, from[0], from[1]);
  const b = await canvasToScreen(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 2 });
  await page.mouse.move(b.x, b.y, { steps: 2 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test("thirty fast drags in a row all land where they were drawn", async ({ page }) => {
  const errors = watchConsole(page);
  // Tall enough that the canvas clears the floating top bar: a drag that
  // starts under the bar is the bar's, not the canvas's.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  const input = page.locator('input[type="file"]');
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
  await installEngineProbe(page);
  await pickTool(page, "Create", "Shapes");

  const shapeGroup = page.getByRole("radiogroup", { name: "Shape" });
  // Rectangle, Diamond, Star, Triangle in turn: kinds 0, 8, 9, 10.
  const tiles = [0, 3, 4, 5];
  const kinds = [0, 8, 9, 10];
  const starts: Array<[number, number]> = [];
  for (let i = 0; i < 30; i++) {
    await shapeGroup.getByRole("radio").nth(tiles[i % 4]).click();
    const x = 40 + (i % 6) * 195;
    const y = 110 + Math.floor(i / 6) * 150;
    starts.push([x, y]);
    await fastDrag(page, [x, y], [x + 150, y + 105]);
  }
  await page.waitForTimeout(600); // the last press lands, then Enter commits it
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => (await engineShapes(page)).length, { message: "all thirty drags landed" })
    .toBe(30);
  const shapes = (await engineShapes(page)) as unknown as Array<{ kind: number; x0: number; y0: number }>;
  shapes.forEach((s, i) => {
    expect(s.kind, `shape ${i} is the tile picked for it`).toBe(kinds[i % 4]);
    expect(Math.abs(s.x0 - starts[i][0]), `shape ${i} starts where its drag did`).toBeLessThanOrEqual(2);
    expect(Math.abs(s.y0 - starts[i][1]), `shape ${i} starts where its drag did`).toBeLessThanOrEqual(2);
  });
  expect(errors, "no app console errors").toEqual([]);
});
