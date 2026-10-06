import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Beta "history forks" (ADR-086, ported from the 09-24 Time Machine branch),
// against the PRODUCTION build in logged-out demo mode. tests/history_branches.rs
// proves the branch store; this proves the CLICK PATH — edit after undo, a row
// appears, clicking it puts the abandoned photo back — and that with the Beta
// OFF nothing appears at all.
//
// Presets are the edit: each click is one undo step with a distinct label and
// a visibly different photo, with no drag geometry to unwind.

test.setTimeout(120_000);
const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** The photo as the user sees it. */
async function pixels(page: Page): Promise<string> {
  await page.waitForTimeout(400);
  return page.evaluate(
    () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.toDataURL("image/png") ?? "",
  );
}

async function applyPreset(page: Page, name: string): Promise<void> {
  // The accessible name is the whole tooltip — "Apply Vivid — …".
  await page.getByRole("button", { name: new RegExp(`^Apply ${name} —`) }).first().click();
  // Leave the grid so no hover preview stands over the applied photo.
  await page.locator("canvas.main-canvas").hover({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
}

async function undo(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await page.waitForTimeout(300);
}

/** The Review panel holds the History section. */
async function openReview(page: Page): Promise<void> {
  if ((await page.getByText("History", { exact: true }).count()) === 0) {
    await page.getByRole("button", { name: "Review", exact: true }).first().click();
  }
  await expect(page.getByText("History", { exact: true }).first()).toBeVisible();
}

const branchList = (page: Page) => page.getByTestId("history-branches");
const branchRows = (page: Page) => branchList(page).locator(".history-list [role='button']");

async function boot(page: Page, forksOn: boolean): Promise<void> {
  if (forksOn) await page.addInitScript(() => localStorage.setItem("ih_history_forks", "1"));
  await blockExternalNetwork(page);
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  const canvas = page.locator("canvas.main-canvas");
  await canvas.waitFor({ state: "visible", timeout: 60_000 });
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await openReview(page);
}

test("the invite link turns history forks on for this device", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/?beta=history-forks");
  await page.locator('input[type="file"]').first().waitFor({ state: "attached" });
  expect(await page.evaluate(() => localStorage.getItem("ih_history_forks"))).toBe("1");
});

test("OFF: an edit after an undo clears redo and shows no branch list", async ({ page }) => {
  await boot(page, false);
  await applyPreset(page, "Vivid");
  await applyPreset(page, "Noir");
  await undo(page);
  await undo(page);
  const redo = page.getByRole("button", { name: "Redo", exact: true }).first();
  await expect(redo, "two steps to redo before the edit").toBeEnabled();

  await applyPreset(page, "Warm");

  await expect(redo, "the redo future is cleared, as always").toBeDisabled();
  await expect(branchList(page)).toHaveCount(0);
  await expect(page.getByText("Time Machine")).toHaveCount(0);
});

test("ON: an edit after an undo keeps the abandoned photo, and clicking it brings it back", async ({ page }) => {
  await boot(page, true);
  await expect(branchList(page), "nothing forked yet").toHaveCount(0);

  await applyPreset(page, "Vivid");
  await applyPreset(page, "Noir");
  const abandonedTip = await pixels(page);

  await undo(page);
  await undo(page);
  const atTheFork = await pixels(page);
  expect(atTheFork, "two undos are back at the original").not.toBe(abandonedTip);

  await applyPreset(page, "Warm");
  const otherTimeline = await pixels(page);
  expect(otherTimeline).not.toBe(atTheFork);

  await expect(branchList(page)).toBeVisible();
  await expect(branchRows(page), "one abandoned timeline, one row").toHaveCount(1);
  // Presets all label their step "Preset", so the row is told apart by its
  // step count: the abandoned Vivid -> Noir pair is two steps.
  await expect(branchRows(page).first().locator(".history-index")).toHaveText("2");

  // Keyboard path: focus the row and press Enter.
  await branchRows(page).first().focus();
  await page.keyboard.press("Enter");
  expect(await pixels(page), "the row lands on that timeline's tip — the Noir photo").toBe(abandonedTip);

  // The timeline just left took its place, so the trip is reversible…
  await expect(branchRows(page), "the way back is a row too").toHaveCount(1);
  await expect(branchRows(page).first().locator(".history-index"), "the Warm timeline: one step").toHaveText("1");
  await branchRows(page).first().click();
  expect(await pixels(page), "travelling back lands exactly where we were").toBe(otherTimeline);

  // …and plain undo still walks the timeline we are on.
  await undo(page);
  expect(await pixels(page), "one undo from Warm is the original").toBe(atTheFork);
});

test("ON: forgetting a timeline removes its row and leaves the photo alone", async ({ page }) => {
  await boot(page, true);
  await applyPreset(page, "Vivid");
  await undo(page);
  await applyPreset(page, "Noir");

  const row = branchRows(page).first();
  await expect(row).toBeVisible();
  const showing = await pixels(page);

  await row.hover();
  // Scoped to the ✕ itself: the row's own accessible name CONTAINS its
  // actions' labels, so a loose match finds the row and travels instead.
  await branchList(page).getByRole("button", { name: "Forget this timeline", exact: true }).first().click();

  await expect(branchList(page)).toHaveCount(0);
  expect(await pixels(page), "forgetting a branch is not an edit").toBe(showing);
});
