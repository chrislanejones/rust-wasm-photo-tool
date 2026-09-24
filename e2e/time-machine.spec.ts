import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// The Time Machine (ADR-065), against the PRODUCTION build in logged-out demo
// mode. `tests/history_branches.rs` proves the branch store's arithmetic; this
// proves the CLICK PATH — edit after undo → a row appears → clicking it puts
// the abandoned photo back — which is the half a Rust test cannot see.
//
// Presets are the edit here for one reason: each click is exactly one undo step
// with a distinct label and a visibly different photo, with no drag, no
// pointer geometry and no tool state to unwind (see preset-hover-preview.spec).

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

async function waitForCanvas(page: Page): Promise<void> {
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
}

/** The photo as the user sees it. */
async function pixels(page: Page): Promise<string> {
  await page.waitForTimeout(350);
  return page.evaluate(
    () =>
      document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.toDataURL("image/png") ??
      "",
  );
}

async function applyPreset(page: Page, name: string): Promise<void> {
  // The accessible name is the whole tooltip — "Apply Vivid — Pushes contrast
  // and color hard" — so match its head, the way preset-hover-preview does.
  await page
    .getByRole("button", { name: new RegExp(`^Apply ${name} —`) })
    .first()
    .click();
  // Leave the grid so no hover preview is standing over the applied photo.
  await page.locator("canvas.main-canvas").hover({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(250);
}

/** The Review panel holds the History section, and it starts closed. */
async function openReview(page: Page): Promise<void> {
  if ((await page.getByText("History", { exact: true }).count()) === 0) {
    await page.getByRole("button", { name: "Review", exact: true }).first().click();
  }
  await expect(page.getByText("History", { exact: true }).first()).toBeVisible();
}

/** The Time Machine's rows. Its heading is only in the DOM when a fork exists. */
function branchRows(page: Page) {
  return page.locator(".time-machine .history-list [role='button']");
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await openReview(page);
});

test("an edit after an undo keeps the abandoned photo, and clicking it brings it back", async ({
  page,
}) => {
  // Nothing forked yet, so the list is not on screen at all.
  await expect(page.getByText("Time Machine")).toHaveCount(0);

  await applyPreset(page, "Vivid");
  await applyPreset(page, "Noir");
  const abandonedTip = await pixels(page);

  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  const atTheFork = await pixels(page);
  expect(atTheFork, "two undos are back at the original").not.toBe(abandonedTip);

  // The fork: an edit made from here used to free the Vivid → Noir pair.
  await applyPreset(page, "Warm");
  const otherTimeline = await pixels(page);
  expect(otherTimeline).not.toBe(atTheFork);

  await expect(page.getByText("Time Machine")).toBeVisible();
  await expect(branchRows(page), "one abandoned timeline, one row").toHaveCount(1);

  await branchRows(page).first().click();
  expect(
    await pixels(page),
    "clicking the row lands on that timeline's tip — the Noir photo",
  ).toBe(abandonedTip);

  // …and the timeline we just left took its place, so the trip is reversible.
  await expect(branchRows(page), "the way back is a row too").toHaveCount(1);
  await branchRows(page).first().click();
  expect(await pixels(page), "travelling back lands exactly where we were").toBe(otherTimeline);
});

test("forgetting a timeline removes its row and leaves the photo alone", async ({ page }) => {
  await applyPreset(page, "Vivid");
  await page.keyboard.press("Control+z");
  await applyPreset(page, "Noir");

  const row = branchRows(page).first();
  await expect(row).toBeVisible();
  const showing = await pixels(page);

  await row.hover();
  // `exact`, and scoped to the ✕ itself: a ReselectBar row is a `role=button`
  // whose own accessible name CONTAINS its actions' labels, so a loose
  // `getByRole("button", { name: "Forget this timeline" })` matches the row
  // first and travels to the timeline instead of forgetting it. (It did.)
  await page
    .locator(".time-machine")
    .getByRole("button", { name: "Forget this timeline", exact: true })
    .first()
    .click();

  await expect(page.getByText("Time Machine")).toHaveCount(0);
  expect(await pixels(page), "forgetting a branch is not an edit").toBe(showing);
});
