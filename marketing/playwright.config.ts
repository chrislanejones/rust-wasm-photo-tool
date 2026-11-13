import { defineConfig, devices } from "@playwright/test";

// Browser tests for the MARKETING site, against its production build
// (`pnpm -C marketing run build` first: this serves dist/, it builds nothing).
// The root playwright.config.ts is the editor's; this one is separate so the
// two never share a server.
const PORT = Number(process.env.PW_PORT ?? 4320);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, ...devices["Desktop Chrome"] },
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/design-system`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
