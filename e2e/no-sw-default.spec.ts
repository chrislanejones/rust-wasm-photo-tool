import { test, expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// The service worker ships DARK (ADR-019): this harness builds WITHOUT
// VITE_ENABLE_SW, and a default build must not register anything — no
// registration, no controller, ever. This is the runtime twin of the
// build-side gate (grep of www-dist: zero "serviceWorker" strings, no
// sw.js, no version.json). The SW-enabled lifecycle specs live in e2e/sw/
// under their own harness (playwright.sw.config.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** Keep the run offline + deterministic (same pattern as the oplog spec):
 *  abort everything that leaves localhost. */
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

test("a default build never registers a service worker", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.waitForLoadState("load");

  // Registration (in an SW-enabled build) fires on the window load event —
  // give a generous settle window so absence is meaningful, not a race.
  await page.waitForTimeout(3000);

  const swState = await page.evaluate(async () => ({
    supported: "serviceWorker" in navigator,
    registrations:
      "serviceWorker" in navigator
        ? (await navigator.serviceWorker.getRegistrations()).length
        : -1,
    controlled:
      "serviceWorker" in navigator
        ? navigator.serviceWorker.controller !== null
        : false,
  }));

  // The API must EXIST (otherwise "no registrations" would prove nothing)…
  expect(swState.supported).toBe(true);
  // …and stay completely unused.
  expect(swState.registrations).toBe(0);
  expect(swState.controlled).toBe(false);
});
