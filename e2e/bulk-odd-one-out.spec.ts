import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Batch › Bulk — the odd one out. The pass used to be all-or-nothing: every
// loaded photo was cropped, and the only way to keep one out was to remove it
// from the gallery. Now a photo can be HELD out of the bulk and left exactly
// as it arrived, so it can be given a different attribute afterwards.
//
// What this spec holds the implementation to:
//   • the picker is the whole gallery, numbered, and a tile says which way it
//     is ("in the bulk" / "held out of the bulk") — the state is on the
//     accessible name, not only in a colour
//   • the button stops claiming "All" the moment something is held out, and
//     counts what is left
//   • the pass really skips it: 1200×800 comes out of a 1:1 / 1080 pass as
//     1200×800, and the photo that stayed in comes out 1080×1080
//   • a held photo carries no crop shade, and the frame steps off it
//
// checker.png is 256×256 and sky-building.png is 1200×800, so "unchanged" is
// readable off the status bar rather than being a guess.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

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

/** Two photos in, canvas up, Batch → Bulk. Returns once the panel is there. */
async function openBulk(page: Page): Promise<void> {
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Bulk", exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole("group", { name: "Which photos are in the bulk" })).toBeVisible();
}

const IN_BULK = /in the bulk$/;
const HELD = /held out of the bulk$/;

test("holding a photo out changes the pass, and the pass leaves it alone", async ({ page }) => {
  await openBulk(page);

  // 1:1 at the default 1080 — so anything that moved is obviously 1080 wide.
  await page.getByRole("radio", { name: "1:1", exact: true }).click();

  // Nothing held yet: the whole gallery, and the button still says All.
  await expect(page.getByText("2 in the bulk")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Crop All Images to 1:1$/ })).toBeVisible();
  await expect(page.getByText("Put them back")).toHaveCount(0);
  await expect(page.locator(".photo-thumb:not(.active) [data-testid=batch-crop-thumb-shade]")).toHaveCount(1);

  // Hold photo 2 out. The tile says so in its accessible name.
  const heldTile = page.getByRole("button", { name: HELD });
  await expect(heldTile).toHaveCount(0);
  await page.getByRole("button", { name: IN_BULK }).nth(1).click();
  await expect(heldTile).toHaveCount(1);
  await expect(heldTile).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: IN_BULK })).toHaveCount(1);

  // The counts follow: one held out, the button no longer claims "All", and the
  // held photo's thumbnail stops being shaded (nothing will be cut from it).
  await expect(page.getByText("1 in the bulk · 1 held out")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crop 1 of 2 to 1:1" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Crop All Images/ })).toHaveCount(0);
  await expect(page.locator("[data-testid=batch-crop-thumb-shade]")).toHaveCount(0);

  // Put them back — the count and the button return to their old words.
  await page.getByRole("button", { name: "Put them back" }).click();
  await expect(page.getByRole("button", { name: IN_BULK })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Crop All Images to 1:1$/ })).toBeVisible();

  // Hold it out for real and run the pass.
  await page.getByRole("button", { name: IN_BULK }).nth(1).click();
  await page.getByRole("button", { name: "Crop 1 of 2 to 1:1" }).click();
  await expect(page.getByText("Cropped 1 image").first()).toBeVisible({ timeout: 30_000 });

  // The photo that stayed in is 1080×1080…
  await expect(page.getByText("Photo: 1080×1080")).toBeVisible();
  // …and the odd one is untouched: still 1200×800, never cropped.
  await page.locator('[aria-label^="Select photo"]').nth(1).click();
  await expect(page.getByText("Photo: 1200×800")).toBeVisible({ timeout: 30_000 });
});

test("a photo held out carries no frame to drag", async ({ page }) => {
  await openBulk(page);

  // The active photo has the frame while it is in the bulk.
  await expect(page.getByRole("group", { name: /^Crop frame, / })).toBeVisible();
  await page.getByRole("button", { name: IN_BULK }).first().click();
  // Holding it out withdraws the frame: there is no crop to make on a photo the
  // pass skips, and a frame you can drag but cannot apply is a broken control.
  await expect(page.getByRole("group", { name: /^Crop frame, / })).toHaveCount(0);
  // One photo is still in, so the pass is still a real pass.
  await expect(page.getByRole("button", { name: "Crop 1 of 2 to 1:1" })).toBeEnabled();

  // Hold the last one out too. The button cannot promise a pass over nothing,
  // and Enter on an empty bulk must do nothing rather than throw.
  await page.getByRole("button", { name: IN_BULK }).click();
  const empty = page.getByRole("button", { name: "Crop 0 of 2 to 1:1" });
  await expect(empty).toBeDisabled();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await expect(page.getByText(/✓ Cropped/)).toHaveCount(0);
  await expect(page.getByText("Nothing went wrong.")).toHaveCount(0);
});