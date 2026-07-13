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

### v7.25 — 2026-07-13

**The magnetic lasso is real, and every view has an address.** Two features, both landing on foundations laid earlier: v7.23's shared edge core, and v7.19's command-palette registry.

**Magnetic lasso + Smart Brush** (`ih_smart_edge`, **off by default** until it's been dogfooded). The disabled lasso stub from v7.23 is now wired to an actual live-wire path-finder. Drop anchors loosely around an object and the wire snaps to the edge between them, tracking your cursor as you go; double-click closes the loop and it becomes an ordinary selection — same mask, same overlay, same Delete key as the wands. The **Smart Brush** is the second consumer of the same primitive: a stroke is walled in by strong edges, so paint stays in the region you started in instead of bleeding across an outline.

Both stand on one new shared piece — an **edge cost map** derived from the Sobel magnitude that already shipped (strong edge = cheap to travel, flat area = expensive). The lasso path-finds along it; the brush uses it as a wall. Building it once is why the brush cost almost nothing to add once the lasso existed.

The honest numbers: the cost map takes **31 ms** on a 2048×2048 image, paid at the first lasso click and at the start of each smart stroke — noticeable, but not per-frame. Each path search during a drag is **1–5.6 ms**, comfortably inside a 16 ms frame; a bounded search window is what buys that, and beyond a 250k-pixel window the engine returns a straight line rather than lag. The whole feature adds **516 bytes** to the wasm. Scalar only — threading stays parked behind the COOP/COEP question (ADR-009).

**Hash routing.** App state now has a URL: `#/tool/paint/blur`, `#/settings/security`. Back and forward work. Deep links land where they say. The palette's Alt+, actions and a pasted link now flow through **one** navigation path — the action registry is the single source of truth, and routing and the palette are two front doors onto it, not two implementations. New palette entries: **"Copy link to this view"** and **"Go to route…"**, plus a status-bar tip that says so. No router dependency was added: there are no *pages* here, just a tool/sub-mode/pane coordinate, so it's a small hash-sync layer instead.

A side-effect worth naming: making the settings pane linkable meant making it *readable*, so `settingsOpen`/`settingsTab` moved into the store — which retired the last window CustomEvent in the navigation path (Stage 3 of the AppShell teardown). And the routing tests caught a crash before a browser ever saw it: `#/tool/%%%` threw a `URIError` out of `decodeURIComponent`, because the hash is untrusted input.

ADR-014 (lasso/brush) and ADR-015 (routing) are both **Draft** pending a human check of the parts no test can prove: whether the wire *feels* like it's tracking your cursor, and whether back/forward feel right.

## License

MIT
