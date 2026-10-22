import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// A shape drag writes the edit box inside each pointermove's own task.
//
// Until 10-21 every move went into AppShell state: the whole editor
// re-rendered (two commits, about 990 fibers) in a task AFTER the event, so
// the box landed 14 ms after the handler ran, 81 ms at 4× CPU — the "21 ms"
// in docs/benchmarks/README.md. Moves now go through lib/liveEditGeometry and
// only the box and its action bar render, in the event's own task.
//
// This checks the property, not a clock: a MessageChannel message posted
// from the first pointermove listener runs after that event's task, so a box
// that is written by then was written in the task. A drag routed back through
// AppShell state fails it on every move whatever the machine's speed.
//
// Also: the action bar follows the box mid-drag (it reads the same live
// geometry), and Enter pressed mid-drag commits what is on screen.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");

declare global {
  interface Window {
    __moves: { inTask: boolean | null }[];
  }
}

async function openWithPendingRect(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  // No artboard border, so canvas pixels are image pixels (as the bench).
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
  await page.getByRole("radio", { name: "Rectangle", exact: true }).first().click();
  const a = await screenPoint(page, 200, 200);
  const b = await screenPoint(page, 500, 400);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  await expect(page.getByTestId("shape-action-bar")).toBeVisible();
  return { center: await screenPoint(page, 350, 300) };
}

/** Engine coordinates are rounded where screen deltas are not. */
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(1.5);

const dashedX = (page: Page) =>
  page.locator("svg[data-draw-overlay] rect[stroke-dasharray]").first().getAttribute("x").then(Number);
const barLeft = (page: Page) =>
  page.getByTestId("shape-action-bar").boundingBox().then((b) => b!.x);

test("a body drag writes the box in each move's own task and the bar follows it", async ({ page }) => {
  const { center } = await openWithPendingRect(page);
  await page.evaluate(() => {
    window.__moves = [];
    let cur: { inTask: boolean | null } | null = null;
    window.addEventListener("pointermove", (e) => {
      if (e.buttons !== 1) return;
      const move = { inTask: null as boolean | null };
      cur = move;
      window.__moves.push(move);
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { if (move.inTask === null) move.inTask = false; };
      ch.port2.postMessage(0);
    }, true);
    const overlay = document.querySelector("svg[data-draw-overlay]")!;
    new MutationObserver(() => {
      if (cur && cur.inTask === null) cur.inTask = true;
    }).observe(overlay, { attributes: true, subtree: true });
  });
  const x0 = await dashedX(page);
  const bar0 = await barLeft(page);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(center.x + i * 4, center.y);
    await expect.poll(() => page.evaluate((i) => window.__moves[i - 1]?.inTask ?? null, i)).not.toBeNull();
  }
  // Mid-drag, before any release: the box and the bar have both moved.
  expect(await dashedX(page)).toBeCloseTo(x0 + 80, 0);
  expect(await barLeft(page)).toBeCloseTo(bar0 + 80, 0);
  await page.mouse.up();
  const moves = await page.evaluate(() => window.__moves.map((m) => m.inTask));
  expect(moves).toHaveLength(20);
  expect(moves.filter((inTask) => inTask !== true)).toEqual([]);
  // React caught up on release: the box stays where it was dropped.
  await expect.poll(() => dashedX(page)).toBeCloseTo(x0 + 80, 0);
  const before = await page.evaluate(async () => (await window.__annotationTool.shape_annotation_count()));
  await page.keyboard.press("Enter");
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
  const shapes = await page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()));
  expect(shapes).toHaveLength(before + 1);
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  near(Math.min(shapes.at(-1).x0, shapes.at(-1).x1), 200 + 80 / scale);
});

test("Enter pressed mid-drag commits the box where it is on screen", async ({ page }) => {
  const { center } = await openWithPendingRect(page);
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 30, center.y + 40, { steps: 6 });
  await page.keyboard.press("Enter");
  await page.mouse.up();
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
  const shapes = await page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()));
  expect(shapes).toHaveLength(1);
  near(Math.min(shapes[0].x0, shapes[0].x1), 200 + 30 / scale);
  near(Math.min(shapes[0].y0, shapes[0].y1), 200 + 40 / scale);
});

// Night 10-22: the corner-radius dot used to write the panel's radii on every
// move, which reached a RESELECTED shape's box only through a React effect a
// task later. It now writes lib/liveEditGeometry like the body drag; the panel
// takes the radius once, on release.
test("a corner-dot drag on a reselected shape writes the box in each move's own task", async ({ page }) => {
  await openWithPendingRect(page);
  await page.keyboard.press("Enter");
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
  const top = await screenPoint(page, 350, 200); // the top edge: reselects
  await page.mouse.click(top.x, top.y);
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  const dot = (await page.locator('[data-shape-radius-handle="0"]').boundingBox())!;
  const at = { x: dot.x + dot.width / 2, y: dot.y + dot.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  // The first few px round to radius 0 and write nothing, so there is no DOM
  // change to time: move past that before the probe starts counting.
  await page.mouse.move(at.x + 4, at.y + 4);
  await page.evaluate(() => {
    window.__moves = [];
    let cur: { inTask: boolean | null } | null = null;
    window.addEventListener("pointermove", (e) => {
      if (e.buttons !== 1) return;
      const move = { inTask: null as boolean | null };
      cur = move;
      window.__moves.push(move);
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { if (move.inTask === null) move.inTask = false; };
      ch.port2.postMessage(0);
    }, true);
    new MutationObserver(() => {
      if (cur && cur.inTask === null) cur.inTask = true;
    }).observe(document.querySelector("svg[data-draw-overlay]")!, { attributes: true, subtree: true });
  });
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(at.x + 4 + i * 3, at.y + 4 + i * 3);
    await expect.poll(() => page.evaluate((i) => window.__moves[i - 1]?.inTask ?? null, i)).not.toBeNull();
  }
  await page.mouse.up();
  const moves = await page.evaluate(() => window.__moves.map((m) => m.inTask));
  expect(moves).toHaveLength(12);
  expect(moves.filter((inTask) => inTask !== true)).toEqual([]);
  // Enter straight after release: the radius must not be lost to the panel
  // patch, which is a passive effect and can land after the keypress.
  await page.keyboard.press("Enter");
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
  const radii = await page.evaluate(async () =>
    JSON.parse(await window.__annotationTool.get_shape_annotations()).at(-1).cornerRadii as number[]);
  expect(radii.every((r) => r > 0), `committed radii ${radii}`).toBe(true);
});
