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

### v7.10 — 2026-07-09

**Four new Levels adjustments**: Saturation, Shadows, Highlights, and Sharpen join Brightness/Contrast/Blur in the Effects panel, each a new SIMD128+scalar Rust kernel (`simd/color.rs`) exposed through the same undo-able wasm-bindgen pattern as the existing sliders. Saturation is a grayscale-lerp against pixel luminance (0 = grayscale, 1 = unchanged, matching CSS `filter: saturate()`); Shadows/Highlights are luminance-masked additive brightness (peaks in dark/bright tones respectively, tapers to ~0 elsewhere); Sharpen is a standard unsharp mask built on the existing Gaussian blur kernel. Verified end-to-end against real pixel math via headless-browser smoke test, not just unit tests. WASM: +3,086 B (+0.56%).

Also: two real bugs fixed. **AI results (background removal, etc.) no longer blank the canvas**: `useAIJob`'s `urlToPixels` was reading `bitmap.width`/`height` *after* calling `bitmap.close()`, and a closed `ImageBitmap` reports 0×0 — that 0×0 result was reaching `loadImageFromPixels`, which resized the canvas to nothing. Width/height are now captured before close, and `useCloneStamp.loadImageFromPixels` additionally rejects any zero-size or undersized pixel buffer outright rather than forwarding it to the engine. **Paid accounts now unlock immediately**: a new `useRealTier()` hook reads the signed-in user's actual Convex tier and lifts the client's UI mode to "paid" for real pro/team accounts — previously tier gating only ever saw "loggedIn," so entitled paying users still saw locked AI/paid features in the UI. Also corrected the public Architecture page, which had drifted into describing fictional API routes and storage that never existed; browser QC pass found and logged one new bug (canvas border grows +20px after a compress→reload cycle — tracked, not yet fixed).

> **About this release.** Four new professional-grade adjustment sliders, plus: if you ever ran an AI tool and got a blank result, or paid and still saw things locked, both are fixed now.

## License

MIT
