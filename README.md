Image Horse

![Image Horse](public/Rust-Wasm-Photo-Tool-App-June-2.webp)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations, **React + TypeScript** with **Zustand** state stores for the UI, and **Convex** for optional cloud persistence. Edits run locally in WebAssembly and your originals + edits live in the browser's **IndexedDB** — your pixels never leave the tab unless you sign in for persistence or AI features. Includes a **Batch Image Editor** for applying a logo to many photos in one pass, with a grid mosaic view of the gallery.

> Previously called **Clone Stamp App** — the app grew well beyond its origins as a single clone stamp tool.

## Documentation

- **[Architecture](docs/Architecture.md)** — system diagram, layers/compositing, the single-WASM-binary rationale, Rust ↔ Convex bridge.
- **[File Map](docs/File-Map.md)** — Rust module map (`src/`) and the React frontend structure (`app/src/`).
- **[Change Summary](docs/Change-summary.md)** — full dated release history (v2.1 → latest).
- **[Keyboard Shortcuts](docs/Keyboard-Shortcuts.md)** — every shortcut (tools, panels, transforms, zoom, gallery).
- **[Getting Started](docs/Getting-Started.md)** — install, run the app + marketing site, Convex setup, deploy notes.
- **[Features](docs/Features.md)** — full feature list: Rust/WASM image processing + the React UI.
- **[GitHub Actions (CI)](docs/GitHub-Actions.md)** — the CI workflow jobs (build, security, audits) and Dependabot.
- **[CI Guardrails](docs/CI-Guardrails.md)** — the advisory `guardrails` job, flipping checks to blocking, and the local hook mirror.
- **[Refactor Playbook](docs/Refactor-Playbook.md)** — single-source-of-truth conventions (color / type / z-index tokens, React + Rust health, target folder structures) and the reusable guardrail bundle.
- **[State Management](docs/State-Management.md)** — the Zustand stores, the `SetArg` drop-in migration off AppShell's `useState`, and what stays local.
- **[IndexedDB Investigation](docs/IndexedDB-Investigation.md)** — why IndexedDB, the live content databases, the Zustand persist adapter, and the Dexie content layer.
- **[Service Workers & Caching](docs/Service-Workers-Caching.md)** — investigation: caching the WASM binary + app shell, the never-cache deny-list, and a phased PWA rollout.
- **[OpenRaster (.ora) Export/Import](docs/OpenRaster-Export-Import.md)** — plan for layered `.ora` interchange, grounded in the existing Rust layer API.
- **[Architecture Roadmap](docs/Architecture-Roadmap.md)** — the document-based-editor direction, prioritized and mapped onto the real repo (AppShell split, Zustand, workers, GPU).
- **[Security Hardening](docs/Security-Hardening.md)** — audit + roadmap: share-token CSPRNG, the image-upload firewall, EXIF-by-default, and the supervised items (CSP, COEP, encryption).

## Tech Stack

- **Rust** — WASM processing layer (`wasm-bindgen`, `png` crate, `ab_glyph` fonts, SIMD128 kernels)
- **React 19** — UI framework
- **TypeScript** — Type safety
- **Zustand** — Client state management (UI / tool / gallery stores; IndexedDB-persisted prefs)
- **Vite** — Build tool with WASM support (`vite-plugin-wasm` + top-level await)
- **Tailwind CSS** — Utility styling (semantic design tokens)
- **Radix UI** — Accessible primitives (Dialog, Tooltip, Context Menu)
- **Framer Motion** — Panel animations
- **Lucide React** — Icons
- **Sonner** — Toast notifications
- **emoji-mart** — Emoji picker (stamp tool)
- **JSZip** — Client-side ZIP (batch export)
- **IndexedDB** — Local-first storage (originals, edits, gallery); **Dexie** content layer + Zustand persist adapter
- **Convex** — Real-time database + auth + serverless functions
- **Clerk** — Authentication (via `@convex-dev/auth`)
- **Stripe** — Payments / billing
- **Replicate** — AI image models (background removal, restore) via Convex

## Changelog

Latest release below. Full dated history → **[docs/Change-summary.md](docs/Change-summary.md)**.

### v7.30 — 2026-07-13

**The op log recorded your stroke and then told nobody.** Dogfooding the op-log flags, the Diagnostics gauge sat at `0/0 ops` after painting on a normal photo — which read exactly like "the feature isn't running." It was running. The stroke *was* recorded. One line of JavaScript was swallowing the news:

```ts
const changed = t?.paint_up();
if (changed) flushToCanvas();   // only flushed if the STABILIZER had catch-up pixels
```

`paint_up()` returns whether the *stroke stabilizer* had leftover pixels to paint — and with the stabilizer off (the default) that's `false` for every ordinary stroke, because the pixels all landed during the drag. But `paint_up()` is also where the op log **commits** the stroke, and `flushToCanvas()` is what publishes it: it pushes the diagnostics stats **and** schedules the debounced save to IndexedDB.

So the op existed and nothing announced it. The gauge showed a stale count, and — the part that actually mattered — **the save was never scheduled**, so reloading right after your last stroke could silently drop it. A data-loss window, found by pulling on a gauge that read zero.

Now the flush always runs at stroke end (once per stroke, not per frame; the zero-copy per-frame path is untouched). Verified on a clean profile: one stroke → `OP LOG 1/1 ops`, `PERSISTED 1 op`; reload → `restored` from the op log.

**And the reason no test caught it:** every op-log test built its document with `load_image_artboard`. **The app doesn't call that.** It calls `load_image` and then `set_artboard_border` — a different path to the same shape, and nothing was testing it. Two new tests now pin the import path the app actually uses: it yields one content layer with the *photo* active, and a paint stroke on it records. That's the second time in three releases that a green suite was testing a program the product doesn't run.

**Also:** the Diagnostics window overlays the canvas, so strokes painted while it's open never reach the image. Paint with it closed, then open it to read the gauge.

## License

MIT
