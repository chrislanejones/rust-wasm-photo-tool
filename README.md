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

### v7.16 — 2026-07-11

**The Resources tab stops polling like it's 2010.** The Alt+Delete diagnostics window's Resources tab used to read everything — cores, tab memory, JS heap, WASM bytes, FPS — off one flat 800ms timer, forever, whether the panel was useful or not. `useDiagnostics` replaces it with three tiers matched to actual cost: an on-demand tab-memory read behind a manual Refresh button (that measurement is expensive and browser-throttled, so it shouldn't run on a clock), a 1.5s poll for heap/WASM/canvas while the panel's open, and a per-frame FPS counter that only samples while you're actively drawing — frozen at its last reading the moment you stop. Resources is now the tab you land on first. Merged from the `ih-diag` worktree (open since v7.14) and reconciled with v7.15's `ThreadedBlurBenchRow`, which shipped independently on the old architecture while this branch was in flight.

> **About this release.** v7.14 (metadata scrubber + Diagnostics-window freeze fix + repo cleanup), v7.15 (parallel blur kernel), and v7.16 (diagnostics tiered polling) close out the same run of overnight/parallel-worktree sessions.

## License

MIT
