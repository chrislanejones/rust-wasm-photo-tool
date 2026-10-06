import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────
// Arrows & Shapes: the diagram shapes (kinds 11..=40, src/diagram.rs) draw
// from the panel, land in the engine as their own kind, fill, and come back
// pixel-identical after a reload — no new op-log field rides on them, so the
// kind byte the log already carries has to be enough.
// ─────────────────────────────────────────────────

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

async function importViaPicker(page: Page): Promise<void> {
  const input = page.locator('input[type="file"]');
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
}

async function pickTool(page: Page, group: string, subTool: string): Promise<void> {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.getByRole("button", { name: subTool, exact: true }).first().click();
  await page.waitForTimeout(400);
}

async function canvasPng(page: Page): Promise<string> {
  await page.waitForTimeout(600);
  return page.evaluate(
    () =>
      document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.toDataURL("image/png") ??
      "",
  );
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

async function dragScreen(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

async function dragCanvas(page: Page, from: [number, number], to: [number, number]) {
  await dragScreen(page, await canvasToScreen(page, from[0], from[1]), await canvasToScreen(page, to[0], to[1]));
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

async function reloadAndResume(page: Page): Promise<void> {
  await page.reload();
  const resume = page.getByRole("button", { name: /Resume editing/ });
  await expect(resume, "the welcome-back screen offers Resume").toBeVisible({ timeout: 30_000 });
  await resume.click();
  await waitForCanvas(page);
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test("diagram shapes draw from Arrows & Shapes and survive a reload", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await importViaPicker(page);
  await installEngineProbe(page);
  const untouched = await canvasPng(page);

  await pickTool(page, "Create", "Arrows & Shapes");

  // A database cylinder, then a filled cloud, then a block arrow. Picking the
  // next shape does not retype the one on the canvas; the next drag commits it.
  await page.getByRole("radiogroup", { name: "Flowchart" }).getByRole("radio", { name: /Database/ }).click();
  await dragCanvas(page, [16, 16], [110, 120]);

  await page.getByRole("radiogroup", { name: "Basic" }).getByRole("radio", { name: /Cloud/ }).click();
  await page.getByRole("radiogroup", { name: "Fill" }).getByRole("radio", { name: "Solid" }).click();
  await dragCanvas(page, [130, 16], [240, 110]);

  await page.getByRole("radiogroup", { name: "Block arrows" }).getByRole("radio", { name: /Block Arrow/ }).click();
  await dragCanvas(page, [20, 150], [236, 230]);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);

  await expect
    .poll(async () => (await engineShapes(page)).map((s) => s.kind), {
      message: "the three diagram shapes are in the engine as kinds 19, 31, 36",
    })
    .toEqual([19, 31, 36]);

  // The line arrow is still one click away, and still the arrow kind (4).
  await page.getByRole("radiogroup", { name: "Arrow" }).getByRole("radio", { name: /Single/ }).click();
  await dragCanvas(page, [240, 140], [150, 140]);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await engineShapes(page)).map((s) => s.kind)).toEqual([19, 31, 36, 4]);

  const committed = await canvasPng(page);
  expect(committed, "the shapes changed pixels").not.toBe(untouched);

  await page.waitForTimeout(10_000);
  await reloadAndResume(page);
  await installEngineProbe(page);
  expect((await engineShapes(page)).map((s) => s.kind), "every shape came back as itself").toEqual([
    19, 31, 36, 4,
  ]);
  expect(await canvasPng(page), "after Resume the canvas is PIXEL-IDENTICAL").toBe(committed);
  expect(errors, "no app console errors").toEqual([]);
});
