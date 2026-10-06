import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The shape action bar — Apply · Cancel · Duplicate [-] 20px [+] · Connect —
// driven through the real UI (ShapeActionsOverlay + useShapeActions):
//
//   1. A drawn square gets the bar under it; Cancel/Apply are on it.
//   2. Duplicate opens eight ports; [+] / [−] move the spacing by 5px.
//   3. A port press lays a copy one box + gap away, counted from the
//      ORIGINAL (press → twice: two copies marching right), and the bar
//      stays open on the original.
//   4. Connect is refused while Duplicate is on; with Duplicate off, a drag
//      from a pigtail onto the copy adds an arrow between the two.
//   5. A shape too small on screen gets no bar at all.
//
// Helpers are the ones perspective-vector.spec.ts / shapes-ux.spec.ts use.
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

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function dragOnCanvas(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const box = await page.locator("canvas.main-canvas").boundingBox();
  if (!box) throw new Error("no canvas box");
  await drag(page, { x: box.x + from.x, y: box.y + from.y }, { x: box.x + to.x, y: box.y + to.y });
}

/** The live engine, found through the React fiber tree — perspective-vector.spec.ts. */
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

type Shape = { id: number; kind: number; x0: number; y0: number; x1: number; y1: number };

async function engineShapes(page: Page): Promise<Shape[]> {
  await installEngineProbe(page);
  return page.evaluate(async () => {
    const t = (window as unknown as {
      __probeTool: { get_shape_annotations(): string | Promise<string> };
    }).__probeTool;
    return JSON.parse(await t.get_shape_annotations());
  });
}

const left = (s: Shape) => Math.min(s.x0, s.x1);
const width = (s: Shape) => Math.abs(s.x1 - s.x0);

test.describe("Shape action bar", () => {
  test("duplicate along a port, then connect the copy", async ({ page }, info) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    await pickTool(page, "Create", "Shapes");
    await dragOnCanvas(page, { x: 40, y: 60 }, { x: 140, y: 140 });

    // ── 1. the bar hangs under the pending square ───────────────────────────
    const bar = page.getByTestId("shape-action-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Apply (Enter)" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Cancel (Esc)" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("1-bar.png") });

    // ── 2. Duplicate: eight ports and the spacing control ──────────────────
    await bar.getByRole("button", { name: /^Duplicate —/ }).click();
    await expect(page.locator("[data-shape-port]")).toHaveCount(8);
    await expect(bar.getByText("20px")).toBeVisible();
    await bar.getByRole("button", { name: /More space/ }).click();
    await expect(bar.getByText("25px")).toBeVisible();
    await bar.getByRole("button", { name: /Less space/ }).click();
    await expect(bar.getByText("20px")).toBeVisible();
    // Connect is refused while Duplicate is on.
    await expect(bar.getByRole("button", { name: "Turn Duplicate off to connect" })).toBeDisabled();
    await page.screenshot({ path: info.outputPath("2-duplicate-ring.png") });

    // ── 3. → twice: two copies marching right, counted from the original ───
    await page.locator('[data-shape-port="e"]').click();
    await expect.poll(async () => (await engineShapes(page)).length).toBe(2);
    await expect(page.locator('[data-shape-port="e"]')).toBeVisible(); // reopened
    await page.locator('[data-shape-port="e"]').click();
    await expect.poll(async () => (await engineShapes(page)).length).toBe(3);
    const [orig, one, two] = await engineShapes(page);
    const step = width(orig) + 20;
    expect(left(one) - left(orig)).toBeCloseTo(step, 0);
    expect(left(two) - left(orig)).toBeCloseTo(2 * step, 0);
    expect(one.y0).toBe(orig.y0);
    await page.screenshot({ path: info.outputPath("3-two-copies.png") });

    // ── 4. Connect: pigtail from the original's east port onto the copy ────
    await bar.getByRole("button", { name: "Stop duplicating" }).click();
    await bar.getByRole("button", { name: /^Connect —/ }).click();
    await expect(page.locator("[data-shape-port]")).toHaveCount(8);
    const from = await page.locator('[data-shape-port="e"]').boundingBox();
    const canvasBox = (await page.locator("canvas.main-canvas").boundingBox())!;
    const scale = canvasBox.width / (await page.evaluate(
      () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!.width,
    ));
    const target = {
      x: canvasBox.x + (left(one) + width(one) / 4) * scale, // the left side: W is nearest
      y: canvasBox.y + ((one.y0 + one.y1) / 2) * scale,
    };
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.screenshot({ path: info.outputPath("4-connect-drag.png") });
    await page.mouse.up();
    await expect.poll(async () => (await engineShapes(page)).filter((s) => s.kind === 4).length).toBe(1);
    const arrow = (await engineShapes(page)).find((s) => s.kind === 4)!;
    // Starts on the original's east edge, ends on the copy's nearest port —
    // its west edge.
    expect(arrow.x0).toBeCloseTo(Math.max(orig.x0, orig.x1), 0);
    expect(arrow.x1).toBeCloseTo(left(one), 0);
    await page.keyboard.press("Enter");
    await expect(bar).toBeHidden();
    await page.screenshot({ path: info.outputPath("5-connected.png") });
  });

  test("a shape too small on screen gets no bar", async ({ page }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);
    await pickTool(page, "Create", "Shapes");
    await dragOnCanvas(page, { x: 60, y: 60 }, { x: 72, y: 72 });
    await expect(page.locator("[data-draw-overlay]").first()).toBeVisible();
    await expect(page.getByTestId("shape-action-bar")).toHaveCount(0);
  });
});
