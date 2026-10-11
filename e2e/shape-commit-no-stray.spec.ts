import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// A commit click must not leave a stray rectangle (PARKING_LOT 2026-09-18,
// Night 10-07 §1.4). The exact repro from the entry, with `mouse.click` (no
// pause between down and up), which is what reproduced it:
//
//   1. draw a star, click empty canvas to commit
//   2. draw a rectangle, click empty canvas (252,252) to commit
//   3. click the star's tip (190,21) to reselect it; change a style control
//   4. click empty canvas (252,252) to commit
//
// It used to leave an extra rectangle (252,252)→(190,21): step 2's commit
// point to step 3's click point. The annotation count after step 4 must equal
// the count after step 2.
//
// NIGHT 10-07: NOT REPRODUCED on master `20418196` — 12/12 green across both
// restyle paths at 1× and 4× CPU. #304 (10-06) rebuilt useDrawingTools' press
// handling on PressQueue, which targets this exact race (a press decided
// after its release, drawing from a stale start); likely why, NOT isolated.
// Kept as the guard so it cannot come back unnoticed.
// Helpers are shapes-ux.spec.ts's, copied (spec files do not import specs).
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

async function shapes(page: Page): Promise<Array<{ kind: number }>> {
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: { get_shape_annotations(): string | Promise<string> } }).__probeTool;
    return JSON.parse(await t.get_shape_annotations()) as Array<{ kind: number }>;
  });
}

for (const restyle of ["keyboard", "track click"] as const)
  for (const cpu of [1, 4]) {
test(`reselect, restyle (${restyle}), commit at ${cpu}× CPU: no stray rectangle`, async ({ page }) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);
  await pickTool(page, "Create", "Shapes");
  await installEngineProbe(page);
  if (cpu > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  }

  // 1. A star whose top point sits at (190, 20).
  await page.getByRole("radio", { name: "Star", exact: true }).first().click();
  await drag(page, [140, 20], [240, 120]);
  await clickCanvas(page, 252, 252);
  // 2. A rectangle, committed at (252, 252).
  await page.getByRole("radio", { name: "Rectangle", exact: true }).first().click();
  await drag(page, [20, 150], [100, 220]);
  await clickCanvas(page, 252, 252);
  const afterTwo = await shapes(page);
  expect(afterTwo.length, "precondition: star + rect committed").toBe(2);

  // 3. Reselect the star by its tip, then change a style control.
  await clickCanvas(page, 190, 21);
  expect(await selectedShapeOverlay(page), "the tip click reselected the star").toBe(true);
  const stroke = page.getByRole("slider", { name: /Stroke Width/ }).first();
  if (restyle === "keyboard") {
    await stroke.focus();
    await page.keyboard.press("ArrowRight");
  } else {
    const b = (await stroke.boundingBox())!;
    await page.mouse.click(b.x + b.width * 0.8, b.y + b.height / 2);
  }
  await page.waitForTimeout(300);

  // 4. Commit on empty canvas.
  await clickCanvas(page, 252, 252);
  await page.mouse.move(10, 10); // a later move must not grow a band either
  await page.waitForTimeout(800);
  const after = await shapes(page);
  console.log(`[stray] ${restyle} ${cpu}x kinds after commit: ${after.map((s) => s.kind).join(",")}`);
  expect(after.length, "the annotation count is unchanged by reselect + restyle + commit").toBe(afterTwo.length);
  expect(await selectedShapeOverlay(page), "nothing pending after the commit").toBe(false);
  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});
  }
