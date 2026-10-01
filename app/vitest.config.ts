import { defineConfig } from "vitest/config";
import path from "path";

// Minimal vitest harness for the Dexie persistence layer (Night A). Node
// environment + fake-indexeddb (see vitest.setup.ts) is enough for the storage
// adapter tests — they exercise IndexedDB + crypto.subtle + Blob, no DOM. The
// `@` alias mirrors vite.config.ts / tsconfig so `@/lib/...` imports resolve.
export default defineConfig({
  define: {
    // Mirrors the `define` block in vite.config.ts. Under vitest the SW mode
    // is always "off" (the skew guard's PURE logic is what's under test —
    // skewVerdict.test.ts — not the browser wiring), but any module that
    // references these globals must still evaluate in the node environment.
    __IH_SW_MODE__: JSON.stringify("off"),
    __IH_BUILD_HASH__: JSON.stringify("vitest"),
  },
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
    // ⚠️ `.tsx` AS WELL AS `.ts`, and this was the real blocker for component
    // tests: a `*.test.tsx` was never COLLECTED, so writing one produced no
    // failures and no passes — it simply did not run. Checked by adding a
    // deliberately-failing .tsx and watching the file count stay put.
    //
    // The environment stays `node` globally on purpose. Flipping it to jsdom
    // for the whole suite would put 139 Dexie/engine files through a DOM they
    // do not need; component files opt in per file with
    // `// @vitest-environment jsdom` instead.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
