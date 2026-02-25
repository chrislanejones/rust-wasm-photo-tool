import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      // Points to the pkg/ dir produced by wasm-pack
      stamp_tool: "/../pkg/stamp_tool.js",
    },
  },
  server: {
    fs: {
      // Allow serving files from one level up (for ../pkg)
      allow: [".."],
    },
  },
  build: {
    outDir: "../www-dist",
    emptyOutDir: true,
  },
});
