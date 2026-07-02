# Service Workers & Caching — Investigation

> Part of the [Image Horse](../README.md) docs. See also: [IndexedDB Investigation](IndexedDB-Investigation.md) · [Architecture](Architecture.md) · [Getting Started](Getting-Started.md).
>
> **Status: investigation only — no service worker ships today.** This note records the case for one, exactly what to cache (and what to never cache), the hosting interplay on Vercel/Netlify, and a phased rollout. Nothing here is wired yet.

---

## 1. Why a service worker for Image Horse

Image Horse is an almost-entirely **client-side** photo editor: the heavy lifting is a Rust→WASM binary, and a user's images never leave the device for editing. That profile makes a service worker (SW) unusually high-value:

1. **Cache the large WASM binary.** `stamp_tool_bg.wasm` is the single biggest asset on the critical path. A cache-first SW turns every repeat visit into an instant cold start instead of a multi-MB download.
2. **Offline / flaky-network editing.** Once the app shell + WASM are cached, the editor boots and runs with no network. Editing is local anyway — only sign-in, cloud persistence, and AI need the network.
3. **PWA installability.** A SW + web manifest makes Image Horse installable to the desktop/home screen, launching in a standalone window — fitting for an "app", not a "page".
4. **Faster repeat loads generally.** App shell (HTML/JS/CSS), fonts, and icons served from cache eliminate render-blocking round-trips.

---

## 2. What to cache — and what to NEVER cache

The single most important design decision. Get the deny-list wrong and you ship stale auth or break the realtime backend.

### Cache (cache-first, they're content-hashed & immutable)

- The Vite build output: hashed JS/CSS chunks (`assets/*.[hash].js|css`).
- **The WASM binary + JS glue** (`pkg/stamp_tool_bg.wasm`, `pkg/stamp_tool.js`). These two are a **matched pair** — never cache one without the other (see §7).
- Fonts, icons, the web manifest, static images in the shell.
- `index.html` — but **network-first** (or stale-while-revalidate) so a new deploy's asset manifest is picked up promptly.

### NEVER cache (must always hit the network)

- **Convex** (`*.convex.cloud`, websockets) — the realtime backend. Caching breaks live queries and writes.
- **Clerk** (`*.clerk.accounts.dev`, auth endpoints) — caching auth = stale/incorrect sessions. Security-sensitive.
- **Replicate / AI dispatch** and any Convex action endpoints — one-shot mutations, never idempotent-cacheable.
- **PostHog** (analytics ingest) — must reach the network; also should never be served from cache.

The user's photos themselves are **never** an SW concern — they live in IndexedDB (`originals` / `edits` / `gallery`, see [IndexedDB Investigation](IndexedDB-Investigation.md)), not in the HTTP cache.

---

## 3. The WASM caching angle (the main prize)

Vite emits the WASM with a **content hash** in its filename, which means:

- The URL changes whenever the bytes change → a **cache-first** strategy is safe (a new build = a new URL = automatic cache miss = fresh fetch). No manual invalidation needed for the hashed asset itself.
- The risk is **not** staleness of a single file; it's a **version skew** between the cached `.wasm` and the cached JS glue if they're cached/evicted independently. Treat them as one cache entry group keyed to the build (see §7).
- Precaching the WASM (Workbox `precacheAndRoute`) warms it on SW install so the *first* post-install navigation is already instant.

---

## 4. Approaches

| Approach | Verdict | Notes |
| --- | --- | --- |
| **`vite-plugin-pwa` (Workbox under the hood)** | ✅ Recommended | First-class Vite integration; `generateSW` auto-builds the precache manifest from the Vite bundle (hashed assets handled for free); declarative `runtimeCaching` for the deny-list; injects the manifest + registration. Least bespoke code to maintain. |
| Standalone Workbox | ➖ Viable | More control, more wiring; redundant given the plugin. |
| Hand-rolled SW | ❌ Avoid | We'd re-implement precache-manifest generation, cache versioning, and update flow by hand — exactly what the plugin gives us. Only worth it for a need the plugin can't express. |

**Recommended config sketch** (`vite.config.ts`):

```ts
import { VitePWA } from "vite-plugin-pwa";

VitePWA({
  registerType: "prompt",            // see §6 — don't yank WASM mid-edit
  injectRegister: "auto",
  devOptions: { enabled: false },    // never run the SW under `vite dev` (HMR)
  workbox: {
    globPatterns: ["**/*.{js,css,html,wasm,woff2,svg,png}"],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // WASM can be multi-MB
    navigateFallbackDenylist: [/^\/api/, /convex/, /clerk/],
    runtimeCaching: [
      // NEVER cache realtime / auth / analytics — NetworkOnly.
      { urlPattern: /\.convex\.cloud/, handler: "NetworkOnly" },
      { urlPattern: /clerk\./,         handler: "NetworkOnly" },
      { urlPattern: /posthog\.com/,    handler: "NetworkOnly" },
    ],
  },
  manifest: {
    name: "Image Horse",
    short_name: "Image Horse",
    display: "standalone",
    /* theme/background/icons … */
  },
});
```

> ⚠️ The pnpm **store-v11 install gotcha** (see [IndexedDB Investigation §4](IndexedDB-Investigation.md)) applies when adding `vite-plugin-pwa`: use
> `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.7.0 --pm-on-fail=ignore --filter stamp-tool add -D vite-plugin-pwa`.

---

## 5. Hosting interplay (Vercel / Netlify)

- **Scope.** The SW must be served from the site root (`/sw.js`) to control the whole app. `vite-plugin-pwa` emits it at the root by default; no extra `Service-Worker-Allowed` header needed for root scope.
- **The `pkg/` symlink.** The app's `pkg/` is a **symlink** to the wasm-pack output (see the Netlify build note in the Change Summary). The SW precache globs the *built* `dist/` output, so the symlink is resolved at build time and is a non-issue at runtime — but verify the `.wasm` lands in `dist/assets` (or wherever Vite places it) and is matched by `globPatterns`.
- **Two hosts.** The app deploys to **both** Netlify and Vercel; the marketing site is a separate Vercel project pinned by the root `vercel.json` (do **not** remove it — it stops Vercel building the app). An SW on the app domain doesn't touch the marketing domain.
- **Headers / cross-origin isolation.** Current WASM uses **SIMD128, single-threaded** — no `SharedArrayBuffer`, so **COOP/COEP are not required today**. If we ever add WASM **threads** (pthreads / SAB), we must serve `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`, which also constrains what the SW may serve cross-origin. Documenting now so it isn't a surprise later.

---

## 6. Update strategy

The SW update flow matters more here than on a typical site because a stale WASM can corrupt an in-progress edit (§7).

- Prefer **`registerType: "prompt"`** over `autoUpdate`. On a new SW, **notify** the user and let them reload, rather than silently `skipWaiting()` + `clientsClaim()` mid-session and swap the WASM out from under an active edit.
- Reuse the existing **`DialogContent size="sm"`** notice-card pattern (ui/dialog; used for idle / small-window / resume) for an "Update available — reload" prompt. Consistent UX, already built.
- Only `skipWaiting` on explicit user action (clicking "Reload to update"), so the swap happens at a safe moment.

---

## 7. Pitfalls

- **WASM ↔ glue version skew.** The `.wasm` and its generated JS glue are produced together by `wasm-bindgen` and must match exactly; a cached old `.wasm` against new glue (or vice-versa) panics or silently miscomputes. Precache them as one group tied to the build hash; never partial-update.
- **Caching realtime/auth.** Re-stated because it's the most damaging mistake: Convex/Clerk/Replicate/PostHog are `NetworkOnly`. A cached auth token or a swallowed mutation is a real bug, not a perf win.
- **Dev-mode interference.** A SW caching assets fights Vite HMR. Keep `devOptions.enabled = false`; only register in production builds.
- **Hard-to-clear caches.** A bad SW can pin users to broken assets. Always ship a working `unregister`/kill-switch path and bump cache names on the SW's own version. Test the update path before relying on it.
- **Quota & eviction.** SW Cache Storage shares the origin storage budget with our IndexedDB content stores. Precache the shell + WASM (bounded), not user data — user data already lives in IndexedDB and shouldn't be duplicated into the HTTP cache.

---

## 8. Recommendation & phased rollout

1. **Phase 0 (this note).** Decision recorded; no SW shipped.
2. **Phase 1 — shell + WASM precache.** Add `vite-plugin-pwa` with `registerType: "prompt"`, precache the hashed shell + `.wasm`, `NetworkOnly` for Convex/Clerk/PostHog/Replicate. Verify offline boot + instant repeat load.
3. **Phase 2 — update UX.** Wire the "update available" prompt into the `ui/dialog` `size="sm"` notice card; `skipWaiting` only on user click.
4. **Phase 3 — installable PWA.** Web manifest + icons; test install on desktop + mobile.
5. **Future — threads.** If WASM threads are adopted, add COOP/COEP headers on both hosts and re-validate the SW's cross-origin behaviour (§5).

**Bottom line:** high value, low-to-moderate cost via `vite-plugin-pwa`. The only sharp edges are the WASM/glue pairing and the realtime/auth deny-list — both are well-understood and handled by the config in §4. Recommend proceeding to Phase 1 when the `zustand-build` refactor settles.
