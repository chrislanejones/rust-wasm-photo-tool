import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────
// A turned, eight-point star and a triangle are still exactly that after a
// reload (op-log v9, ADR-059 / ADR-070).
//
// Rotation and the star's point count are `#[serde(skip)]` fields, so the ONLY
// place a saved log carries them is the two appended ops (ShapeRotation 19,
// ShapeStarPoints 20) and the 10th / 11th trailing elements of the annotation
// blob. Rust pins the bytes (oplog_v7_v8_fixture_resume, the v8 and v9 decode
// tests, op_variant_indices_are_append_only). Only a browser can show them
// reaching the pixels after a real Resume.
//
// Two guards so the reload assertion cannot pass for the wrong reason:
//   • the shapes are read back from the ENGINE (`get_shape_annotations`) before
//     and after, so "the same pixels" is backed by "the same rotation and
//     point count", not just by a canvas that happens to look alike;
//   • the turned star must differ from the pixels of the untouched photo AND
//     carry a rotation that is not zero, so a reload that dropped the turn but
//     kept the star would fail on the field, not slip through on a similar look.
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

test("a turned 8-point star and a triangle are pixel-identical after a reload", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await importViaPicker(page);
  await installEngineProbe(page);
  const untouched = await canvasPng(page);

  await pickTool(page, "Create", "Shapes");

  // ── the star: pick it, set Points to 8, draw, then turn it by its handle ──
  await page.getByRole("radiogroup", { name: "Shape" }).getByRole("radio", { name: /Star/ }).click();
  // PresetRow renders a radio group; each preset is named "<label> <value>".
  await page.getByRole("radio", { name: "Points 8", exact: true }).click();
  await dragCanvas(page, [24, 24], [128, 128]);

  const handle = page.locator("[data-shape-rotate-handle]").first();
  await expect(handle, "the star's edit box offers the rotate hook").toBeVisible({ timeout: 10_000 });
  const hb = (await handle.boundingBox())!;
  const from = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
  // Sweep a quarter of the way round the box center, so the turn is large.
  await dragScreen(page, from, { x: from.x + 120, y: from.y - 90 });

  // ── the triangle: drawing it commits the star ──
  await page.getByRole("radiogroup", { name: "Shape" }).getByRole("radio", { name: /Triangle/ }).click();
  await dragCanvas(page, [140, 140], [236, 236]);
  // Commit the triangle too: the recipe shapes-ux uses is to start another gesture.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);

  await expect
    .poll(async () => (await engineShapes(page)).length, { message: "both shapes are in the engine" })
    .toBe(2);
  const before = await engineShapes(page);
  const star = before.find((s) => s.kind === 9);
  const triangle = before.find((s) => s.kind === 10);
  expect(star, "a star was committed").toBeTruthy();
  expect(triangle, "a triangle (kind 10) was committed").toBeTruthy();
  expect(star!.starPoints, "the star kept its eight points").toBe(8);
  expect(Math.abs(star!.rotation ?? 0), "the star was really turned").toBeGreaterThan(5);

  const committed = await canvasPng(page);
  expect(committed, "the shapes changed pixels").not.toBe(untouched);

  // Give the autosave time to write the archive and the op log.
  await page.waitForTimeout(10_000);
  await reloadAndResume(page);
  await installEngineProbe(page);

  const after = await engineShapes(page);
  expect(after.length, "both shapes came back").toBe(2);
  const star2 = after.find((s) => s.kind === 9)!;
  expect(star2.starPoints, "the star still has eight points after Resume").toBe(8);
  expect(star2.rotation, "the star is still turned by the same angle").toBeCloseTo(star!.rotation ?? 0, 3);
  expect(after.find((s) => s.kind === 10), "the triangle came back").toBeTruthy();

  const resumed = await canvasPng(page);
  expect(resumed, "after Resume the shapes are there").not.toBe(untouched);
  expect(resumed, "after Resume the canvas is PIXEL-IDENTICAL").toBe(committed);
  expect(errors, "no app console errors across draw, turn and reload").toEqual([]);
});
