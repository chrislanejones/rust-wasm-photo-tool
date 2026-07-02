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

### v7.2 — 2026-07-02

| # | Change | Status |
| --- | --- | --- |
| 1 | **Layers are free (no login)** — layers are a fundamental, purely client-side editing tool (the Rust layer stack lives entirely in memory / IndexedDB), so they're no longer paywalled: the no-login Demo tier now gets 3 layers per image, same as Logged In. Login/paid differentiate on **cloud** features (storage, gallery cap, sharing, AI), not on local editing. "Unlimited layers" stays the paid perk. The other fundamental tools (Crop, Blur, Resize, Paint, Histogram) already ran in Demo | Complete |
| 2 | **Pen: fill a path you already drew** — the Bézier pen's Background fill only applied if set *before* drawing; reselecting a committed path and changing the Background did nothing. `update_bezier_annotation` now carries stroke + fill, so reselecting a pen path and adjusting the Paint→Pen panel restyles it — including filling one drawn with Background: None | Complete |

> **About this release — pricing philosophy + a pen fix.** Fundamental editing is local and costs us nothing to run, so it shouldn't sit behind a login: layers now work in the no-login tier (login/pay gate the cloud, not the canvas). And the pen tool's Background fill can finally be applied to a path you've already drawn, not just set up front.

### v7.1 — 2026-07-02

| # | Change | Status |
| --- | --- | --- |
| 1 | **Crop no longer slides annotations** — `ImageHorseTool::crop` cropped the pixels but never offset text/shape annotations by the crop origin, so any crop not starting at the top-left corner left text and shapes visually drifting off the photo. They now shift with the pixels (same offset pattern as Move and Canvas Size), with a regression test | Complete |
| 2 | **One dialog system** — `ui/Modal` and `SmallDialog` deleted; every dialog (Settings, Diagnostics, idle screen, small-window notice) now composes the shadcn `ui/dialog` primitives, which gained `size="sm" \| "default" \| "xl"` presets and an `overlayClassName` escape hatch. One focus trap, one animation, one API | Complete |
| 3 | **One button primitive** — the unused stock-shadcn `ui/button` was rewritten as the app's real Button with cva sizes (`xs` / `tiny` / `default` / `large`), absorbing `LargeButton` and `TinyButton` (both deleted; 17 consumer files migrated). Also fixes the Apply Crop vs Activate Eyedropper font-size mismatch | Complete |

> **About this release — a bug fix and two consolidations.** Cropping with any offset used to leave text and shape annotations behind while the pixels moved — they now travel together, verified down to the pixel. Under the hood, three modal systems became one and seven button-ish primitives became fewer: the shadcn dialog and a single cva-variant Button are now the only game in town, deleting four files and a matching set of visual inconsistencies.

## License

MIT
