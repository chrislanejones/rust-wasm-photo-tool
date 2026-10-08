import { defineConfig } from "vitest/config";

// The Convex backend suite (`pnpm test:convex`). Separate from app/'s vitest
// harness on purpose: these tests run real mutations against `convex-test`'s
// in-memory backend — real transactions, real `_storage`, real indexes — and
// that needs the edge-runtime environment Convex functions run in, not node.
//
// Test files live beside the functions as `convex/*.test.ts`. The Convex
// bundler skips any file whose name has more than one dot, so they are never
// pushed as functions.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
