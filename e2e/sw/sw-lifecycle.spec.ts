import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Service-worker lifecycle against a VITE_ENABLE_SW=1 build (Night B,
// Task C). Runs under playwright.sw.config.ts — NOT the default harness.
//
// NOTE on request interception: page.route() is deliberately absent from the
// SW-active tests — Playwright's routing does not see requests a service
// worker answers from its cache, so route-based network blocking would be a
// lie here. The harness env points Convex/Clerk at non-resolving placeholder
// hosts instead (see the config), which is how the default harness keeps the
// logged-out demo deterministic too. The skew test DOES use page.route — it
// runs with serviceWorkers: "block", where routing is reliable again.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("precache service worker (VITE_ENABLE_SW=1 build)", () => {
  test("first load registers and activates; precache holds the shell + WASM", async ({
    page,
  }) => {
    await page.goto("/");

    // Registration fires on window load; ready resolves once active.
    const activated = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active !== null;
    });
    expect(activated).toBe(true);

    // The precache must contain the app shell and the WASM engine — the two
    // things whose absence would make an "offline-capable" claim false.
    const precache = await page.evaluate(async () => {
      const names = await caches.keys();
      const name = names.find((n) => n.includes("workbox-precache"));
      if (!name) return { names, urls: [] as string[] };
      const cache = await caches.open(name);
      return { names, urls: (await cache.keys()).map((r) => r.url) };
    });
    expect(
      precache.urls.some((u) => u.includes(".wasm")),
      `no .wasm in precache: ${JSON.stringify(precache)}`,
    ).toBe(true);
    expect(precache.urls.some((u) => u.includes("index.html"))).toBe(true);
    // The skew manifest must NOT be precached — it is the network-only truth
    // the guard compares against (vite.config.ts globIgnores).
    expect(precache.urls.some((u) => u.includes("version.json"))).toBe(false);
  });

  test("reload is served BY the service worker", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Second navigation: now controlled, and the document itself must come
    // out of the SW (precached index.html via navigateFallback).
    const response = await page.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    const controlled = await page.evaluate(
      () => navigator.serviceWorker.controller !== null,
    );
    expect(controlled).toBe(true);
  });

  test("offline reload still boots the app shell from the precache", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // become controlled

    await context.setOffline(true);
    try {
      const response = await page.reload();
      expect(response?.fromServiceWorker()).toBe(true);
      // React must actually mount — proves JS + CSS + shell all came from
      // cache, not just that a navigation "succeeded". (External fonts and
      // the placeholder Convex/Clerk hosts fail offline by design; the
      // logged-out demo boots without them.)
      await expect(page.locator("#root > *").first()).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe("build-skew guard (new build simulated via version.json)", () => {
  // SW registration is blocked here so page.route() is reliable (see header
  // note). The guard under test is page JS, not the worker: a stale bundle
  // discovering the server has moved on. Fulfilling version.json with a
  // foreign hash IS the "simulate a new build" step from the brief — the
  // running bundle's embedded hash can no longer match.
  test.use({ serviceWorkers: "block" });

  test("hash mismatch raises the update toast and exactly one console.error", async ({
    page,
  }) => {
    const skewErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("build skew")) {
        skewErrors.push(msg.text());
      }
    });

    await page.route("**/version.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ buildHash: "simulated-new-build" }),
      }),
    );

    await page.goto("/");

    // Boot check runs BOOT_SETTLE_MS (2.5s) after load, post-Toaster-mount.
    await expect(page.getByText("Update available")).toBeVisible({
      timeout: 20_000,
    });
    expect(skewErrors).toHaveLength(1);

    // The banner offers Reload — the escape hatch exists and is clickable.
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  test("matching version.json stays silent — no false update banner", async ({
    page,
  }) => {
    // No route override: the preview server serves the REAL version.json,
    // whose hash matches the bundle by construction.
    await page.goto("/");
    await page.waitForTimeout(4500); // past the 2.5s boot check, with margin
    await expect(page.getByText("Update available")).toHaveCount(0);
  });
});
