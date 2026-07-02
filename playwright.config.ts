import { defineConfig, devices } from "@playwright/test";

// Smoke harness for imagehorse-qc section 1: boot, load, export. Runs against
// the PRODUCTION build served by `vite preview` (the same surface QC targets).
// One command — `npx playwright test` — builds nothing but boots the preview
// server via `webServer` below, so the gate is self-contained.
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// The app always mounts the Convex/Clerk providers — logged-out demo mode still
// needs them present (auth is what's optional, not the provider). A production
// build with NO env crashes ("Could not find ConvexProviderWithClerk ancestor").
// The real QC target has live keys; here we bake in PUBLIC placeholder values
// (dummy Convex URL + a well-formed pk_test key on a guaranteed-non-resolving
// `.invalid` domain) so the app boots as the real logged-out demo. These are not
// secrets — publishable keys ship to every browser, and these point nowhere. The
// unreachable-backend network noise is routed offline + filtered in the spec.
// Convex fatally rejects a deployment name that isn't the reserved
// `word-word-123` shape, so the placeholder host uses that format.
const DEMO_ENV =
  'VITE_CONVEX_URL="https://smoke-placeholder-123.convex.cloud" ' +
  'VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y2xlcmsuc21va2UuaW52YWxpZCQ="';

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // The preview build serves the WASM engine; the default bundled Chromium
      // decodes/encodes WebP fine. If headless Chromium can't launch on this
      // WSL box for missing system libs, set `channel: "chrome"` here (see
      // SESSION_LOG DECISION) — /usr/bin/google-chrome + chromium exist.
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Build (with the demo env baked in) then serve — makes `npx playwright test`
    // a single self-contained gate that produces a bootable production surface.
    command: `${DEMO_ENV} pnpm run build && pnpm --filter stamp-tool exec vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
