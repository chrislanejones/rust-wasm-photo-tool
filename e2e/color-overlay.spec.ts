import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Smoke for the Layers → Color Overlay style, driven against the PRODUCTION
// build in logged-out demo mode. Green unit tests prove the engine maths; this
// proves the CLICK PATH — swatch → handler → engine → repainted canvas — which
// is the half a gate cannot see.

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256
const RED = "#ef4444";

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
  await page.waitForTimeout(500);
}

/** Sample the centre pixel of the visible composite.
 *
 * The display canvas is worker-owned (ADR-024 put the engine in a worker and
 * transferred control to an OffscreenCanvas), so `getContext("2d")` on it
 * throws InvalidStateError. It is still a valid CanvasImageSource though, so
 * `drawImage` onto a scratch canvas gets the presented frame — which is the
 * right thing to sample anyway: it is literally what the user sees. */
async function centrePixel(page: Page): Promise<[number, number, number, number]> {
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c || !c.width) return [-1, -1, -1, -1];
    const scratch = document.createElement("canvas");
    scratch.width = c.width;
    scratch.height = c.height;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [-1, -1, -1, -1];
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(
      Math.floor(c.width / 2),
      Math.floor(c.height / 2),
      1,
      1,
    ).data;
    return [d[0], d[1], d[2], d[3]];
  }) as Promise<[number, number, number, number]>;
}

test("Color Overlay: swatch tints, strength blends, undo reverses, apply bakes", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);

  await pickTool(page, "Edit", "Layers");

  // 1. The section exists, under Layer Mask.
  await expect(page.getByText("Color Overlay", { exact: true })).toBeVisible();

  const before = await centrePixel(page);
  console.log("[smoke] before overlay:", before);

  // 2. Picking a swatch IS the on-switch. Full strength → the exact colour.
  await page.getByRole("button", { name: `Color ${RED}`, exact: true }).first().click();
  const tinted = await centrePixel(page);
  console.log("[smoke] after red swatch:", tinted);
  expect(tinted[0]).toBe(0xef);
  expect(tinted[1]).toBe(0x44);
  expect(tinted[2]).toBe(0x44);
  expect(tinted[3]).toBe(255); // alpha untouched — a style, not a fill

  // 3. Strength appears only once an overlay exists, and blends it back.
  const strength = page.getByLabel("Color overlay strength");
  await expect(strength).toBeVisible();
  await strength.fill("50");
  await strength.dispatchEvent("change");
  const half = await centrePixel(page);
  console.log("[smoke] at 50% strength:", half);
  expect(half).not.toEqual(tinted);
  expect(half).not.toEqual(before);

  // 4. The layer dropdown flags it.
  await expect(page.locator("select option:checked")).toContainText("tinted");

  // 5. Undo reverses the WHOLE overlay in one step (the snap-once contract).
  // Pressed while the Strength slider STILL HAS FOCUS from the fill above —
  // on purpose. A range input is a control, not a text field, and Ctrl+Z
  // there must reach the app's undo (useKeyboardShortcuts' guard lets only
  // undo/redo through for non-text inputs).
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(800);
  const undone = await centrePixel(page);
  console.log("[smoke] after undo:", undone);
  expect(undone).toEqual(before);
  await expect(page.getByLabel("Color overlay strength")).toHaveCount(0);

  // 6. Re-apply, then bake it in. Pixels stay; the live controls go.
  await page.getByRole("button", { name: `Color ${RED}`, exact: true }).first().click();
  const retinted = await centrePixel(page);
  expect(retinted[0]).toBe(0xef);

  await page.getByRole("button", { name: /^Apply$/ }).first().click();
  await page.waitForTimeout(800);
  const baked = await centrePixel(page);
  console.log("[smoke] after apply:", baked);
  expect(baked).toEqual(retinted);
  await expect(page.getByLabel("Color overlay strength")).toHaveCount(0);

  // 7. Remove after a bake must NOT resurrect the original — it was baked.
  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});
