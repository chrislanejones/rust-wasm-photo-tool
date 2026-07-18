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
      // Mirrors vite.config.ts: some store/lib modules reach for this behind a
      // dynamic import() (e.g. lib/photoLimits.ts); Vite's import-analysis
      // still needs to resolve the specifier statically to transform the file
      // at all, even under vitest's node environment. Without this alias,
      // importing anything upstream of that dynamic import fails to load in
      // tests, unrelated to whether the import ever actually executes.
      stamp_tool: path.resolve(__dirname, "../pkg/stamp_tool.js"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
  },
});
