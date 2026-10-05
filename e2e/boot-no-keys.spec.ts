import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";

// A build with NO env vars (no Convex URL, no Clerk key) must still boot.
//
// Every other spec runs against a build baked with PLACEHOLDER keys — which is
// exactly why this slipped: with keys the providers exist, so a Convex hook
// outside one never throws. Without keys `ConvexClerkProvider` renders nothing
// and the first unguarded `useConvexAuth` took the whole app down
// ("Could not find ConvexProviderWithAuth", blank #root). Runs under its own
// config (playwright.nokeys.config.ts), which builds with the keys unset.

async function bootErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

for (const [name, size] of [
  ["desktop", { width: 1280, height: 800 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test(`a build with no keys boots at ${name} width`, async ({ page }) => {
    const errors = await bootErrors(page);
    await page.setViewportSize(size);
    await page.goto("/");
    // The upload input exists only once boot has finished and the first-run
    // surface (desktop) or the phone's gallery surface is up — the splash alone
    // would leave #root non-empty and prove nothing.
    await expect(page.locator('input[type="file"]').first()).toBeAttached({ timeout: 30_000 });
    expect(errors.filter((e) => /Convex|Clerk/.test(e))).toEqual([]);
  });
}

test("the static boot shell is gone once React mounts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator('input[type="file"]').first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator(".boot-shell")).toHaveCount(0);
});

test("with no keys, a photo loads and Settings › Sync and Shared open without a Convex error", async ({ page }) => {
  const errors = await bootErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await expect(input).toBeAttached({ timeout: 30_000 });
  await input.setInputFiles(["e2e/fixtures/checker.png"]);
  // The top bar, and with it SubscriptionButton, mounts once a photo is open.
  await expect(page.locator("canvas.main-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Settings/ }).first().click();
  for (const pane of ["Sync", "Shared"]) {
    await page.getByRole("tab", { name: pane, exact: true }).or(page.getByRole("button", { name: pane, exact: true })).first().click();
    await expect(page.getByRole("heading", { name: pane, exact: true }).first()).toBeVisible();
  }
  // AI usage is a Settings pane too; open it when this build lists it.
  const ai = page.getByRole("tab", { name: /AI usage/i }).or(page.getByRole("button", { name: /AI usage/i })).first();
  if (await ai.count()) await ai.click();
  expect(errors.filter((e) => /Convex|Clerk|ConvexProvider/.test(e))).toEqual([]);
});
