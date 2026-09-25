import { defineConfig, devices } from "@playwright/test";
import { PLACEHOLDER_CONVEX_URL, assertPlaceholderConvexUrl, demoEnv } from "./e2e/guard/backend";

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
// Same escape hatch as playwright.config.ts: `PW_SW_PORT=4901 pnpm run test:e2e:sw`.
const PORT = Number(process.env.PW_SW_PORT ?? 4312);
const BASE_URL = `http://localhost:${PORT}`;

// Same PUBLIC placeholder env as playwright.config.ts (see the rationale
// there): dummy Convex URL + a well-formed pk_test key on non-resolving
// hosts, so the production build boots as the real logged-out demo.
// Checked at load (e2e/guard/backend.ts): a real Convex URL fails the run.
const E2E_CONVEX_URL = PLACEHOLDER_CONVEX_URL;
assertPlaceholderConvexUrl(E2E_CONVEX_URL);
const DEMO_ENV = demoEnv(E2E_CONVEX_URL);

export default defineConfig({
  testDir: "./e2e/sw",
  globalSetup: "./e2e/guard/global-setup.ts",
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
