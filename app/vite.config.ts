import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// SPIKE (spike/coop-coep-clerk, ADR-009): opt-in COOP/COEP on the preview
// server, to test whether cross-origin isolation (needed for
// wasm-bindgen-rayon / SharedArrayBuffer) breaks Clerk sign-in.
// `vite preview` is the imagehorse-qc target (CLAUDE.md), so this must be
// a no-op unless SPIKE_COEP is explicitly set — set it to "require-corp"
// or "credentialless" to opt in; unset (the default) leaves preview
// headers untouched.
const spikeCoepMode = process.env.SPIKE_COEP;

// ─── Service worker (opt-in, ships DARK — repo convention) ──────────────────
//
// One build-time variable, three states, resolved HERE so a default build
// carries zero service-worker bytes (verified by the grep gate in
// SESSION_LOG and e2e/no-sw-default.spec.ts):
//
//   VITE_ENABLE_SW unset  → "off"  DEFAULT. No sw.js, no registration code
//                                  in the bundle, no version.json. Byte-level
//                                  identical behavior to pre-SW builds.
//   VITE_ENABLE_SW=1      → "on"   Precache-only SW (generateSW below):
//                                  hashed assets + WASM + app shell. PROMPT
//                                  update flow — never skipWaiting, never
//                                  yank a build out from under an active
//                                  editing session. NO runtimeCaching of any
//                                  kind: Clerk, Convex, share URLs and every
//                                  other network request pass straight
//                                  through. IndexedDB is untouched by
//                                  definition (SW caches are Cache Storage),
//                                  stated here anyway per the run brief.
//   VITE_ENABLE_SW=kill   → "kill" EVICTION build: emits + registers a
//                                  self-destructing sw.js (skipWaiting on
//                                  install; on activate: delete all caches,
//                                  unregister, reload clients).
//
// EVICTION PROCEDURE (once "on" has EVER shipped to production):
//   The way OFF is `kill`, NOT unset. Unsetting the flag removes the
//   registration code from the new build, but every browser that already
//   installed the SW keeps it controlling the origin and serving the OLD
//   precached shell forever — users would be stranded on a stale build with
//   no path forward. Deploy with VITE_ENABLE_SW=kill for at least one full
//   release cycle: the browser's own sw.js update check (which bypasses the
//   SW cache) picks up the self-destruct worker, it evicts itself, and
//   clients reload uncontrolled. Only after that may the flag go back to
//   unset.
const SW_MODE: "off" | "on" | "kill" =
  process.env.VITE_ENABLE_SW === "1"
    ? "on"
    : process.env.VITE_ENABLE_SW === "kill"
      ? "kill"
      : "off";

// One hash per `vite build` invocation, carried by BOTH sides of the skew
// guard (lib/pwa/skew.ts): `define`d into the JS bundle as __IH_BUILD_HASH__
// AND written to version.json (network-only — globIgnores keeps it out of
// the precache). If a stale SW cache serves an old bundle while the server
// has a new version.json, the pair diverges and the update banner fires.
// Content-independence is fine here: the hash only ever compares to itself.
const BUILD_HASH = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const versionManifestPlugin = (): PluginOption => ({
  name: "ih-version-manifest",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ buildHash: BUILD_HASH }),
    });
  },
});

const swPlugins = (): PluginOption[] => {
  if (SW_MODE !== "on") return [];
  return [
    VitePWA({
      // Prompt flow: the waiting SW activates only after the user clicks
      // Reload in the update toast (SKIP_WAITING message) — never automatic.
      registerType: "prompt",
      // Registration is owned by src/lib/pwa/swBoot.ts (needs the sonner
      // toast + skew guard); the plugin must not inject its own.
      injectRegister: false,
      // Precache-only app shell, NOT an installable PWA — no webmanifest.
      manifest: false,
      // Never in dev: HMR + a precache SW is stale-module misery, and the
      // brief forbids it. (false is the plugin default; pinned for clarity.)
      devOptions: { enabled: false },
      workbox: {
        // Hashed build assets + app shell + the WASM engine. woff2/svg cover
        // self-hosted assets only — Google-Fonts CSS stays network-only
        // (no runtimeCaching), so offline boots fall back to system fonts.
        globPatterns: ["**/*.{js,css,html,wasm,svg,woff2}"],
        // The skew manifest must ALWAYS come from the network — a precached
        // version.json could never disagree with the precached JS, which is
        // the exact skew the guard exists to catch. (.json is outside the
        // globPatterns already; the ignore pins it against future edits.)
        globIgnores: ["**/version.json"],
        // SPA shell. Share links are `?v=<token>` on this same shell
        // (App.tsx), not server-rendered routes — no denylist needed.
        navigateFallback: "/index.html",
        // Workbox default is 2 MiB, which would silently drop a grown WASM
        // binary from the precache (today: ~0.7 MiB).
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        // Prompt flow, spelled out (both are workbox defaults):
        skipWaiting: false,
        clientsClaim: false,
        // Old precaches from superseded builds are purged on activate.
        cleanupOutdatedCaches: true,
        // NO runtimeCaching key — its absence is the decision (ADR-019).
      },
    }),
    versionManifestPlugin(),
  ];
};

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait(), ...swPlugins()],
  define: {
    // Statically folded (same mechanism as import.meta.env guards): in "off"
    // builds every SW branch is dead code and the minifier drops it — the
    // grep gate + e2e assert that empirically.
    __IH_SW_MODE__: JSON.stringify(SW_MODE),
    __IH_BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
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
