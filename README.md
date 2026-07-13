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

### v7.22 — 2026-07-13

**Compression that hits a target, alignment that works, and shadows you can see.**

**Compress Image(s) now earns its PageSpeed badge.** The old pass did one encode at quality 75 with a 2200px cap and no size target — routinely producing 300–400 KB files. It now iterates toward a 200 KB byte budget: quality steps down first (floor 0.5), then dimensions (15% at a time, never below a 1280px long edge), and anything over 2500px on a side is resized as part of the job — the toast reads "Compressing & resizing…" when that kicks in. A 9.9 MB original came out at exactly 200 KB.

**The Align grid works from every selection path.** It only ever armed from the Reselect list, so picking an object on the canvas left all nine cells dead. Now selecting *or* creating a shape or a text arms it — and placing an object whose editor is open re-syncs that editor, which is why text placement used to look like it did nothing at all.

**Shadows work in dark mode.** Tailwind bakes a 10%-black shadow into every `shadow-*` utility, which is invisible against the dark palette — menus, toasts, tooltips and modals all read as flat. They're now restated in dark with layered black and a hairline edge (light mode is untouched). Found while in there: `.shadow-panel` never generated a rule at all, so two surfaces had been shipping with no elevation in either theme.

**The command palette grew up.** Alt+, now wears the same chrome as the Settings and Diagnostics windows instead of a stock dropdown: a real search field at the top, All / Tools / Settings / Actions tabs under it, a **Most Used** grid (top 10 by how often you actually run each command, not just what you touched last — seeded with sensible defaults until you've used it enough), and the search results filling the rest of the dialog.

**Also:** text with a background box or speech bubble now commits exactly where it's placed (the bubble was landing ~71px off — the plain-text fix in v7.21 hadn't covered the bubble's tail geometry); the gallery gets **shift-click range selection**; the palette is finally listed in the Alt+/ modal and the status bar; and Resize/Compress becomes the second tool on the shared `ToolModeToggle` + registry, with its sub-modes reachable from the palette.

## License

MIT
