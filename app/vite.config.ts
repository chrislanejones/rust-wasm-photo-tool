import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

// SPIKE (spike/coop-coep-clerk, ADR-009): opt-in COOP/COEP on the preview
// server, to test whether cross-origin isolation (needed for
// wasm-bindgen-rayon / SharedArrayBuffer) breaks Clerk sign-in.
// `vite preview` is the imagehorse-qc target (CLAUDE.md), so this must be
// a no-op unless SPIKE_COEP is explicitly set — set it to "require-corp"
// or "credentialless" to opt in; unset (the default) leaves preview
// headers untouched.
const spikeCoepMode = process.env.SPIKE_COEP;

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@stores": path.resolve(__dirname, "./src/stores"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@app": path.resolve(__dirname, "./src/app"),
      // Single source of truth for the WASM bundle: built once to ../pkg by
      // `pnpm run build:wasm` at the repo root. (server.fs.allow includes "..".)
      stamp_tool: path.resolve(__dirname, "../pkg/stamp_tool.js"),
    },
  },
  server: {
    // Bind all interfaces (0.0.0.0) so the dev server is reachable on the WSL2
    // IP from the Windows browser, not just 127.0.0.1 — WSL localhost-forwarding
    // can break under VPNs / mirrored networking. strictPort keeps it on 5173
    // rather than silently bumping to 5174 when a stale instance lingers.
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      allow: [".."],
    },
    historyApiFallback: true,
  },
  build: {
    outDir: "../www-dist",
    emptyOutDir: true,
  },
  preview: {
    ...(spikeCoepMode && {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": spikeCoepMode,
      },
    }),
  },
});
