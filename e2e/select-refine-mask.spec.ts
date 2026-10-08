import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Select › Refine, and Layer Settings › Add mask from the selection.
//
// What this pins:
//   1. a Refine slider PREVIEWS on a copy: the readout moves, the real
//      selection and the undo count do not
//   2. Apply commits it as exactly one undo step, and one undo takes it back
//   3. Add mask → Reveal selection makes a mask that shows exactly the
//      selected pixels, as one undo step, and hands over to the mask brush
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
      !!v && typeof (v as { add_layer_mask_from?: unknown }).add_layer_mask_from === "function";
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

async function engine(page: Page): Promise<{ selected: number; undo: number }> {
  return page.evaluate(async () => {
    type T = { selection_coverage: () => Promise<Uint32Array>; undo_snapshot_count: () => Promise<number> };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return { selected: (await t.selection_coverage())[0], undo: await t.undo_snapshot_count() };
  });
}

async function setSlider(page: Page, label: string, v: number): Promise<void> {
  // Refine is one slider for the picked operation: Holes, Islands, Smooth,
  // Expand… are radios in "Refine operation", and the slider takes the picked
  // one's label. The old lookup ("the range nearest the text Expand") found the
  // Holes slider once Expand became a mode radio, so it set Holes to 8 and the
  // assertion that Expand grows the selection read a fill-holes result.
  await page.getByRole("radiogroup", { name: "Refine operation" }).getByRole("radio", { name: label, exact: true }).click();
  const input = page.locator(`input[type="range"][aria-label="${label}"]`);
  await expect(input).toHaveCount(1);
  await input.evaluate((el, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
}

async function clickSky(page: Page): Promise<void> {
  const canvas = page.locator("canvas.main-canvas");
  const box = (await canvas.boundingBox())!;
  const [cw, ch] = await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  const px = box.x + (200 * box.width) / cw;
  const py = box.y + (300 * box.height) / ch;
  const onCanvas = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.classList.contains("main-canvas") ?? false,
    [px, py],
  );
  expect(onCanvas, "the click point is on the canvas").toBe(true);
  await page.mouse.click(px, py);
}

const readout = (page: Page) => page.getByTestId("selection-coverage");

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);
  await exposeEngine(page);
  await page.locator('button[aria-label="Select"]').first().click();
  await page.getByRole("button", { name: "Magic Wand", exact: true }).click();
  await clickSky(page);
  await expect(readout(page)).toHaveText(/^Selected \d/);
});

test("a Refine slider previews on a copy; Apply is one undo step", async ({ page }) => {
  const before = await engine(page);
  const beforeText = await readout(page).innerText();

  await setSlider(page, "Expand", 8);
  await expect(readout(page)).not.toHaveText(beforeText);
  expect(await engine(page), "the preview touched neither the selection nor history").toEqual(before);

  await page.getByRole("button", { name: "Apply refine", exact: true }).click();
  await expect.poll(async () => (await engine(page)).undo).toBe(before.undo + 1);
  const applied = await engine(page);
  expect(applied.selected).toBeGreaterThan(before.selected);

  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await engine(page)).selected).toBe(before.selected);
  await expect(readout(page)).toHaveText(beforeText);
});

test("Add mask → Reveal selection masks exactly the selection, in one step", async ({ page }) => {
  await page.evaluate(() => {
    location.hash = "#/tool/layers";
  });
  const tile = page.getByRole("button", { name: /Add mask/ }).first();
  await tile.click();
  await expect(tile).toHaveAttribute("aria-expanded", "true");
  const undo0 = (await engine(page)).undo;
  await page.getByRole("button", { name: "Reveal selection", exact: true }).click();
  await expect(page.getByRole("button", { name: /Painting mask/ })).toBeVisible();

  const alpha = await page.evaluate(async () => {
    type T = {
      capture_composite: () => Promise<{ rgba: Uint8Array; width: number }>;
      undo_snapshot_count: () => Promise<number>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    const cap = await t.capture_composite();
    const a = (x: number, y: number) => cap.rgba[(y * cap.width + x) * 4 + 3];
    return { sky: a(210, 310), building: a(1000, 500), undo: await t.undo_snapshot_count() };
  });
  expect(alpha.sky, "the selected sky shows").toBe(255);
  expect(alpha.building, "the unselected building is hidden").toBe(0);
  expect(alpha.undo).toBe(undo0 + 1);
});

test("leaving Refine restores committed ants; removing a mask exits its brush", async ({ page }) => {
  const before = await engine(page);
  const text = await readout(page).innerText();
  await setSlider(page, "Expand", 8);
  await expect(readout(page)).not.toHaveText(text);
  await page.evaluate(() => { location.hash = "#/tool/layers"; });
  await expect(page.getByRole("contentinfo")).toContainText(text);
  expect(await engine(page)).toEqual(before);
  await page.getByRole("button", { name: /Add mask/ }).first().click();
  await page.getByRole("button", { name: "Reveal selection", exact: true }).click();
  await expect(page.getByRole("button", { name: /Painting mask/ })).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("button", { name: /Painting mask/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add mask/ }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/state-v4-night4-mask.png" });
});
