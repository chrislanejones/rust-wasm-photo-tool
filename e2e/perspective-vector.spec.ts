import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Perspective on VECTOR objects — the 2026-09-11 report, driven through the
// real UI: *"Perspective, skew, and distort only work with vector objects, it
// needs to work with vector objects like the square, circle, and text"*, and
// then *"only works with raster"*.
//
//   1. A square drawn with the Shapes tool is PICKABLE by the Perspective
//      tool, and picking it says so ("Warping Square").
//   2. Dragging a corner and pressing Apply stores a non-identity quad ON THAT
//      SHAPE — `shape_perspective_of` is the engine's own answer, so this
//      cannot pass on a warp that only repainted pixels.
//   3. The shape is still a shape: its bbox is untouched by the warp.
//   4. Esc takes the box AND its grid off the canvas.
//   5. Cancel does the same thing from the button.
//
// Runs against the PRODUCTION build in logged-out demo mode, driving the mouse
// through the rubber-band → overlay → commit chain a user actually hits,
// exactly like `shapes-ux.spec.ts`, whose harness helpers this borrows.
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
            document.querySelector<HTMLCanvasElement>("canvas.main-canvas")
              ?.width ?? 0,
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

/** Drag from a→b in CSS px relative to the main canvas. */
async function dragOnCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const box = await page.locator("canvas.main-canvas").boundingBox();
  if (!box) throw new Error("no canvas box");
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (from.x + to.x) / 2, box.y + (from.y + to.y) / 2, {
    steps: 8,
  });
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/**
 * Find the live engine by walking the React fiber tree (the app exposes no
 * global handle). Lifted verbatim from `shapes-ux.spec.ts`, which documents
 * the technique — worker-backed methods return Promises, so every reader
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

/** The live shape list, straight out of the engine. */
async function engineShapes(page: Page): Promise<
  { id: number; kind: number; x0: number; y0: number; x1: number; y1: number }[]
> {
  await installEngineProbe(page);
  return page.evaluate(async () => {
    const t = (window as unknown as {
      __probeTool: { get_shape_annotations(): string | Promise<string> };
    }).__probeTool;
    return JSON.parse(await t.get_shape_annotations());
  });
}

/** The quad the engine currently holds for `id`, as 8 numbers. */
async function storedQuad(page: Page, id: number): Promise<number[]> {
  await installEngineProbe(page);
  return page.evaluate(async (shapeId) => {
    const t = (window as unknown as {
      __probeTool: {
        shape_perspective_of(id: number): ArrayLike<number> | Promise<ArrayLike<number>>;
      };
    }).__probeTool;
    return Array.from(await t.shape_perspective_of(shapeId));
  }, id);
}

const IDENTITY = [0, 0, 1, 0, 1, 1, 0, 1];

test.describe("Perspective reaches the objects the app draws", () => {
  test("a square can be warped, and the box can be cancelled", async ({ page }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    // ── draw a square ───────────────────────────────────────────────────────
    await pickTool(page, "Create", "Shapes");
    await dragOnCanvas(page, { x: 60, y: 60 }, { x: 180, y: 180 });
    // The rubber band is a PENDING shape until Enter places it — the status
    // bar says "Enter/Esc place / cancel". Without this the engine has no
    // annotation and there is nothing for Perspective to point at.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const shapes = await engineShapes(page);
    expect(shapes.length, "the square was drawn").toBeGreaterThan(0);
    const square = shapes[shapes.length - 1];
    const bboxBefore = [square.x0, square.y0, square.x1, square.y1];

    // ── point Perspective at it ─────────────────────────────────────────────
    await pickTool(page, "Edit", "Perspective");
    await expect(page.getByTestId("perspective-overlay")).toBeVisible();
    await expect(page.getByTestId("perspective-actions")).toBeVisible();

    expect(
      await storedQuad(page, square.id),
      "a freshly drawn square is unwarped",
    ).toEqual(IDENTITY);

    // Click the square's own box to target it — the canvas-side twin of
    // picking it out of Review → Reselect.
    const canvasBox = await page.locator("canvas.main-canvas").boundingBox();
    if (!canvasBox) throw new Error("no canvas box");
    const scale = canvasBox.width / (await page.evaluate(
      () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!.width,
    ));
    const toScreen = (x: number, y: number) => ({
      x: canvasBox.x + x * scale,
      y: canvasBox.y + y * scale,
    });
    const centre = toScreen(
      (square.x0 + square.x1) / 2,
      (square.y0 + square.y1) / 2,
    );
    await page.mouse.click(centre.x, centre.y);
    await page.waitForTimeout(300);
    // The panel names what is about to be transformed. "Square", not "pixels",
    // is the entire report in one word.
    await expect(page.getByText(/Warping\s*Square/i)).toBeVisible();

    // ── drag the top-left corner inward and Apply ───────────────────────────
    const tl = toScreen(Math.min(square.x0, square.x1), Math.min(square.y0, square.y1));
    await page.mouse.move(tl.x, tl.y);
    await page.mouse.down();
    await page.mouse.move(tl.x + 40 * scale, tl.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    await page.getByTestId("perspective-actions").getByRole("button", { name: /Apply/ }).click();
    await page.waitForTimeout(500);

    const quad = await storedQuad(page, square.id);
    expect(quad.length, "the engine answered for this shape").toBe(8);
    expect(quad, "the warp is stored ON THE SHAPE, not baked into pixels").not.toEqual(
      IDENTITY,
    );

    // ── it is still a shape ─────────────────────────────────────────────────
    const after = (await engineShapes(page)).find((s) => s.id === square.id)!;
    expect(
      [after.x0, after.y0, after.x1, after.y1],
      "warping an object must not move its geometry",
    ).toEqual(bboxBefore);

    // ── Esc takes the box away ──────────────────────────────────────────────
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page.getByTestId("perspective-overlay")).toHaveCount(0);
    await expect(page.getByTestId("perspective-actions")).toHaveCount(0);

    // ── and the panel can put it back, so Cancel is not a trap ──────────────
    await page.getByRole("button", { name: /Place box/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("perspective-overlay")).toBeVisible();

    // ── Cancel does what Esc does ───────────────────────────────────────────
    await page.getByTestId("perspective-actions").getByRole("button", { name: /Cancel/ }).click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("perspective-overlay")).toHaveCount(0);
  });
});
