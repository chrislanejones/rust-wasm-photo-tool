import { defineConfig, devices } from "@playwright/test";

// Keyless boot harness. A SEPARATE config because the other harnesses bake in
// placeholder Convex/Clerk keys (see playwright.config.ts) — the very thing
// that hid the "Could not find ConvexProviderWithAuth" crash of a build with no
// env vars. This one builds with both keys set EMPTY (not just unset: Vite would re-read them from an
// .env file), into its own outDir
// (../www-dist-nokeys, gitignored) so it can never clobber a default build.
//
// Run with: pnpm run test:e2e:nokeys
// Port 4313 (4311 default, 4312 sw). `PW_NOKEYS_PORT=4903` to sidestep.
const PORT = Number(process.env.PW_NOKEYS_PORT ?? 4313);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "boot-no-keys.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL: BASE_URL, trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      `VITE_CONVEX_URL= VITE_CLERK_PUBLISHABLE_KEY= pnpm --filter stamp-tool exec vite build --outDir ../www-dist-nokeys && ` +
      `pnpm --filter stamp-tool exec vite preview --outDir ../www-dist-nokeys --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Never reuse: a server already on this port could be a configured build.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
