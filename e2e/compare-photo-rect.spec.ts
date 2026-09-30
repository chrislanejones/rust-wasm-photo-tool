import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// A/B compare covers the PHOTO, not the artboard around it.
//
// A default import is an artboard: the photo on a Canvas fill with a 10px band.
// Compare used to lay the original over the WHOLE canvas box, so the original
// half was stretched across the band while the edited half showed it — measured
// on edit.imagehorse.app (v8.76): overlay 420×320 over a 400×300 photo at
// [10,10]. The two sides differed in something that is not content.
//
// What this pins, and why each part is here:
//   1. the overlay is inset from the canvas by the SAME band on all four sides
//      (an overlay the size of the canvas has a band of 0 and fails)
//   2. leaving compare removes the overlay and leaves the document's pixels
//      byte-identical — compare must never be something you have to undo
//   3. entering again gives the same geometry — the exit path is where a
//      "restore" bug would live, so it is exercised, not assumed
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

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
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
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
  await page.waitForTimeout(1000);
}

/** The engine's own pixel identity, reached through the React fiber tree — the
 *  canvas is transferred to a worker, so `getContext("2d")` throws. */
async function compositeHash(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"))!;
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedState?: unknown; memoizedProps?: unknown };
    type Tool = { composite_hash_hex: () => Promise<string> };
    const isTool = (v: unknown): v is Tool =>
      !!v && typeof (v as Tool).composite_hash_hex === "function";
    let tool: Tool | null = null;
    const walk = (f: Fiber | undefined, d: number) => {
      if (!f || tool || d > 400) return;
      let s = f.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
      while (s && !tool) {
        const v = s.memoizedState as { current?: unknown } | undefined;
        if (isTool(v)) tool = v;
        else if (v && isTool(v.current)) tool = v.current;
        s = s.next as typeof s;
      }
      const p = f.memoizedProps as { toolRef?: { current?: unknown } } | null;
      if (!tool && p?.toolRef && isTool(p.toolRef.current)) tool = p.toolRef.current;
      walk(f.child, d + 1);
      walk(f.sibling, d);
    };
    walk(root[key] as Fiber, 0);
    if (!tool) throw new Error("engine not found in the fiber tree");
    return (tool as Tool).composite_hash_hex();
  });
}

/** Insets of the compare overlay from the canvas's on-screen rect, in CSS px. */
async function overlayBands(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    const ov = document.querySelector("div.z-20.cursor-col-resize");
    if (!ov) return null;
    const cr = c.getBoundingClientRect();
    const o = ov.getBoundingClientRect();
    return {
      scale: cr.width / c.width,
      left: o.left - cr.left,
      right: cr.right - o.right,
      top: o.top - cr.top,
      bottom: cr.bottom - o.bottom,
    };
  });
}

test("A/B compare covers the photo, not the artboard, and leaves no trace", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);

  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Resize & Compress", exact: true }).first().click();
  await page.waitForTimeout(900);

  const hashBefore = await compositeHash(page);
  // The top bar's Compare toggle opens and closes the overlay.
  const toggle = page.getByRole("toolbar", { name: "Editor controls" }).getByRole("button", { name: "Compare", exact: true });

  // ── 1. Enter: the overlay sits on the photo, the band is the same all round.
  await toggle.click();
  await expect.poll(() => overlayBands(page), { timeout: 15_000 }).not.toBeNull();
  // photo_bounds answers after the blob URL; poll until the inset lands.
  await expect.poll(async () => (await overlayBands(page))?.left ?? 0).toBeGreaterThan(0);
  const first = (await overlayBands(page))!;
  console.log(`[compare] bands ${JSON.stringify(first)}`);
  const band = 10 * first.scale; // the default canvasPadding, in CSS px
  for (const side of ["left", "right", "top", "bottom"] as const) {
    expect(first[side], `${side} band is the 10px artboard at this zoom`).toBeCloseTo(band, 0);
  }

  // ── 2. Leave: overlay gone, document byte-identical.
  await toggle.click();
  await expect.poll(() => overlayBands(page)).toBeNull();
  expect(await compositeHash(page), "compare changed the document").toBe(hashBefore);

  // ── 3. Enter again: the same geometry, not a leftover from the first round.
  await toggle.click();
  await expect.poll(async () => (await overlayBands(page))?.left ?? 0, { timeout: 15_000 }).toBeGreaterThan(0);
  const second = (await overlayBands(page))!;
  for (const side of ["left", "right", "top", "bottom"] as const) {
    expect(second[side], `${side} band after re-entry`).toBeCloseTo(first[side], 0);
  }
  await toggle.click();
  await expect.poll(() => overlayBands(page)).toBeNull();
});
