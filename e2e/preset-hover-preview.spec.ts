import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Enhance › Presets — the hover contract, in the real app.
//
// The engine side is pinned in tests/presets.rs. What only a browser can show
// is the wiring around it: the panel opens the shared preview slot lazily,
// recomputes on hover, puts the photo back when the pointer leaves the grid,
// and commits ONE undo step on click.
//
// The pixels are read off `canvas.main-canvas`, so a preview that never
// reached the canvas — a missing flush, a preview opened on the wrong layer —
// fails here even though the engine unit tests would still pass.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256
const PRESET = /^Apply Vivid/;

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

async function waitForCanvas(page: Page): Promise<void> {
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
}

/** The photo as the user sees it. */
async function pixels(page: Page): Promise<string> {
  await page.waitForTimeout(350); // let an in-flight preview blit settle
  return page.evaluate(
    () =>
      document
        .querySelector<HTMLCanvasElement>("canvas.main-canvas")
        ?.toDataURL("image/png") ?? "",
  );
}

async function openPresets(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
  await openPresets(page);
});

test("hovering a preset previews it, and leaving the grid puts the photo back", async ({
  page,
}) => {
  const before = await pixels(page);
  expect(before).not.toBe("");

  await page.getByRole("button", { name: PRESET }).first().hover();
  const previewed = await pixels(page);
  expect(previewed, "hovering shows the preset on the photo").not.toBe(before);

  // Leave the grid entirely — this is what fires the panel's mouseleave.
  await page.locator("canvas.main-canvas").hover({ position: { x: 5, y: 5 } });
  const restored = await pixels(page);
  expect(restored, "leaving restores the photo exactly").toBe(before);
});

test("a hover costs no undo step, and clicking costs exactly one", async ({ page }) => {
  const before = await pixels(page);

  await page.getByRole("button", { name: PRESET }).first().hover();
  await page.locator("canvas.main-canvas").hover({ position: { x: 5, y: 5 } });

  // A hover that left no undo step means Ctrl+Z here does nothing to the photo.
  await page.keyboard.press("Control+z");
  expect(await pixels(page), "a hover was never an undo step").toBe(before);

  await page.getByRole("button", { name: PRESET }).first().click();
  const applied = await pixels(page);
  expect(applied, "clicking keeps the preset").not.toBe(before);

  await page.keyboard.press("Control+z");
  expect(await pixels(page), "ONE undo puts the whole preset back").toBe(before);
});

// ─────────────────────────────────────────────────────────────────────────────
// All twelve presets, against the one failure this table can have.
//
// A preset is five numbers in five different units, and the shadows/highlights
// pair is ABSOLUTE 8-bit (see the header of PresetsSettings.tsx): a value that
// looks like the others — `0.1` — is a tenth of one level out of 255 and
// contributes exactly nothing. Nothing else in the repo would notice. tsc sees
// a valid number, the engine skips the component at its identity, the button
// still renders, and the preset just quietly does less than it says.
//
// So each one is hovered and its pixels compared: to the untouched photo (it
// must DO something) and to every preset before it (it must do something the
// others do not). Two presets with the same five numbers is the other silent
// failure, and it fails here as a duplicate.
// ─────────────────────────────────────────────────────────────────────────────

const ALL_PRESETS = [
  "Enhance",
  "Vivid",
  "Fade",
  "Dark",
  "Warm",
  "Cool",
  "Mono",
  "Noir",
  "Airy",
  "Moody",
  "Recover",
  "Lift",
] as const;

test("every preset changes the photo, and no two change it the same way", async ({
  page,
}) => {
  const untouched = await pixels(page);
  expect(untouched).not.toBe("");

  const seen = new Map<string, string>();

  for (const label of ALL_PRESETS) {
    await page
      .getByRole("button", { name: new RegExp(`^Apply ${label} —`) })
      .first()
      .hover();
    const shown = await pixels(page);

    expect(shown, `${label} must actually move pixels`).not.toBe(untouched);

    const twin = seen.get(shown);
    expect(twin, `${label} renders identically to ${twin}`).toBeUndefined();
    seen.set(shown, label);
  }

  expect(seen.size, "twelve presets, twelve distinct looks").toBe(
    ALL_PRESETS.length,
  );

  // And the grid still puts the photo back when the pointer leaves it.
  await page.locator("canvas.main-canvas").hover({ position: { x: 5, y: 5 } });
  expect(await pixels(page), "leaving restores the photo exactly").toBe(untouched);
});
