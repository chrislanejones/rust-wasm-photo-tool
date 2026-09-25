import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Select › live Tolerance and the "Selected N%" readout.
//
// The fixture is a sky gradient over a ground band with a building, so the
// wand's reach into the sky grows step by step as tolerance rises.
//
// What this pins:
//   1. a wand click shows a readout, in the panel AND the status bar, and the
//      number is the engine's count of the same mask the ants are drawn from
//   2. moving the slider re-runs the click — the number moves — without a
//      single extra undo step
//   3. one undo takes the click and every re-run away, and the readout says
//      "Nothing selected" while the status chip disappears
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "sky-building.png");

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
  await page.waitForTimeout(1000);
}

/** The engine, reached through the React fiber tree (the canvas lives in a
 *  worker, so there is no 2D context to read). Parked on `window.__ihTool`. */
async function exposeEngine(page: Page): Promise<void> {
  const found = await page.evaluate(() => {
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"))!;
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedState?: unknown };
    const isTool = (v: unknown) =>
      !!v && typeof (v as { selection_coverage?: unknown }).selection_coverage === "function";
    let tool: unknown = null;
    const walk = (f: Fiber | undefined, d: number) => {
      if (!f || tool || d > 600) return;
      let s = f.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
      while (s && !tool) {
        const v = s.memoizedState as { current?: unknown } | undefined;
        if (isTool(v)) tool = v;
        else if (v && isTool(v.current)) tool = v.current;
        s = s.next as typeof s;
      }
      walk(f.child, d + 1);
      walk(f.sibling, d + 1);
    };
    walk(root[key] as Fiber, 0);
    (window as unknown as { __ihTool: unknown }).__ihTool = tool;
    return !!tool;
  });
  expect(found, "engine handle reachable").toBe(true);
}

type Truth = { selected: number; ants: number; undo: number };
async function engineTruth(page: Page): Promise<Truth> {
  return page.evaluate(async () => {
    type T = {
      selection_coverage: () => Promise<Uint32Array>;
      selection_overlay: () => Promise<Uint8Array>;
      undo_snapshot_count: () => Promise<number>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    const c = await t.selection_coverage();
    const ov = await t.selection_overlay();
    let ants = 0;
    for (let i = 3; i < ov.length; i += 4) if (ov[i] > 0) ants++;
    return { selected: c[0], ants, undo: await t.undo_snapshot_count() };
  });
}

async function setTolerance(page: Page, v: number): Promise<void> {
  const slider = page.locator('input[type="range"]').first();
  await slider.evaluate((el, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
}

const readout = (page: Page) => page.getByTestId("selection-coverage");
const chip = (page: Page) => page.getByTestId("status-selection");

test("wand click, live tolerance, readout matches the ants, one undo", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);
  await exposeEngine(page);

  await page.locator('button[aria-label="Select"]').first().click();
  // The mode tile is named "Magic Wand" (its label under the tile is "Wand").
  await page.getByRole("button", { name: "Magic Wand", exact: true }).click();
  await expect(readout(page)).toHaveText("Nothing selected");
  await expect(chip(page)).toHaveCount(0);

  const canvas = page.locator("canvas.main-canvas");
  const box = (await canvas.boundingBox())!;
  const [cw, ch] = await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  const undo0 = (await engineTruth(page)).undo;
  // Mid-sky, left of the building. NOT near the top: at 1280×720 the top of
  // the canvas sits under the floating top bar, and a click there lands on
  // the bar. Proven below by hit-testing the point before clicking it.
  const px = box.x + (200 * box.width) / cw;
  const py = box.y + (300 * box.height) / ch;
  const onCanvas = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.classList.contains("main-canvas") ?? false,
    [px, py],
  );
  expect(onCanvas, "the click point is on the canvas, not under chrome").toBe(true);
  await page.mouse.click(px, py);

  await expect(readout(page)).toHaveText(/^Selected \d/);
  const first = await engineTruth(page);
  expect(first.selected, "the click selected something").toBeGreaterThan(0);
  expect(first.selected, "readout count == ants").toBe(first.ants);
  expect(first.undo).toBe(undo0 + 1);
  await expect(chip(page)).toHaveText(await readout(page).innerText());

  const firstText = await readout(page).innerText();
  await setTolerance(page, 60);
  await expect(readout(page)).not.toHaveText(firstText);
  const wider = await engineTruth(page);
  expect(wider.selected, "a wider tolerance takes more sky").toBeGreaterThan(first.selected);
  expect(wider.selected).toBe(wider.ants);
  expect(wider.undo, "the slider pushes no undo step").toBe(undo0 + 1);

  await page.keyboard.press("Control+z");
  await expect(readout(page)).toHaveText("Nothing selected");
  await expect(chip(page)).toHaveCount(0);
  expect((await engineTruth(page)).undo).toBe(undo0);
});
