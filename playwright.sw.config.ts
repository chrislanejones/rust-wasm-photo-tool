import { defineConfig, devices } from "@playwright/test";

// Service-worker lifecycle harness (Night B). A SEPARATE config from
// playwright.config.ts because the SW is opt-in at BUILD time: these specs
// need a build made with VITE_ENABLE_SW=1, while the default harness must
// keep building WITHOUT the flag (its no-sw-default spec pins the dark
// default). The SW build lands in ../www-dist-sw (gitignored) so it can
// never masquerade as, or clobber, a default www-dist build.
//
// Run with: pnpm run test:e2e:sw
//
// Port 4312 (4311 = default harness, 4200 = the user's own dev port).
const PORT = 4312;
const BASE_URL = `http://localhost:${PORT}`;

// Same PUBLIC placeholder env as playwright.config.ts (see the rationale
// there): dummy Convex URL + a well-formed pk_test key on non-resolving
// hosts, so the production build boots as the real logged-out demo.
const DEMO_ENV =
  'VITE_CONVEX_URL="https://smoke-placeholder-123.convex.cloud" ' +
  'VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y2xlcmsuc21va2UuaW52YWxpZCQ="';

export default defineConfig({
  testDir: "./e2e/sw",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Build WITH the SW flag into the dedicated outDir, then preview it.
    // (The flag only matters at build time; preview serves static files.)
    command:
      `VITE_ENABLE_SW=1 ${DEMO_ENV} pnpm --filter stamp-tool exec vite build --outDir ../www-dist-sw && ` +
      `pnpm --filter stamp-tool exec vite preview --outDir ../www-dist-sw --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
