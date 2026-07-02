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

### v7.0 — 2026-07-02

| # | Change | Status |
| --- | --- | --- |
| 1 | **"Resize Layer"** — new Rust `begin_layer_resize_preview` reuses the paste-placement preview machinery to give any layer's content a movable/resizable bounding box (non-destructive, one-step commit/cancel); lives in the Layers tab next to Move | Complete |
| 2 | **Settings-panel redesign** — every tool panel now uses a shared `SectionHeader` (title + lightbulb info tooltip) instead of inline paragraphs; Paint became a 2×2 icon grid (Paint / Blur / Pen / Eraser); Eraser moved here from Edit & Transform, and the Color Picker moved the other way (Edit & Transform now hosts it, Effects lost its Levels/Color-Picker toggle) | Complete |
| 3 | **Status bar hints** — now cycles 4 slots (two tool-related, one general, Alt+/ always pinned last) every 3 minutes; top tool icons show their digit-key shortcut in their tooltip | Complete |
| 4 | **Checkerboard unification** — the app-chrome, per-image, and thumbnail transparency checkerboards now share one set of theme tokens instead of three independently hand-tuned patterns | Complete |
| 5 | **Shift = 90° angle lock** — holding Shift while dragging an arrow/shape endpoint or moving any bounding box (paste, resize) now snaps to 0/90/180/270° | Complete |
| 6 | **Componentized list rows** — `ReselectBar` gained optional index/type/delete so History, Reselect, Guides, and Batch Rename's Preview rows all render as one shared `full-width-badge`; `PlacementGrid` now owns its own label + tooltip, standardized to "Placement" everywhere it appears | Complete |

> **About this release — a settings-panel overhaul, plus a new layer tool.** The biggest UI pass yet: every tool's settings panel was rebuilt around a consistent title-plus-lightbulb pattern, trading paragraphs of instructions for on-demand tooltips. Paint gained a proper 2×2 mode grid and inherited the Eraser from Edit & Transform, which in turn picked up the Color Picker from Effects. The new **Resize Layer** tool reuses the paste-placement machinery to let you scale/reposition any layer's content in place. Smaller fixes: a unified checkerboard pattern, Shift-to-90° angle snapping, and a handful of list components (history, reselect, guides, batch preview) consolidated onto one shared row style.

## License

MIT
