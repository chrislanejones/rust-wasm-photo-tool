import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "capture-v13.spec.ts", timeout: 90_000, use: { headless: true } });
