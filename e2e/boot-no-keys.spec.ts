import { test, expect, type Page } from "@playwright/test";

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
    await expect(page.locator("#root > *").first()).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => /Convex|Clerk/.test(e))).toEqual([]);
    expect(await page.locator("#root").innerHTML()).not.toBe("");
  });
}
