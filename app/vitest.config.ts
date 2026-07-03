import { defineConfig } from "vitest/config";
import path from "path";

// Minimal vitest harness for the Dexie persistence layer (Night A). Node
// environment + fake-indexeddb (see vitest.setup.ts) is enough for the storage
// adapter tests — they exercise IndexedDB + crypto.subtle + Blob, no DOM. The
// `@` alias mirrors vite.config.ts / tsconfig so `@/lib/...` imports resolve.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
  },
});
