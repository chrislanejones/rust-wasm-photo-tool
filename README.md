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

## The marketing site

`marketing/` — the five-page site at **[image-horse.vercel.app](https://image-horse.vercel.app/)**:
home, architecture, features, pricing, trail log. Vite + React 19 + react-router,
plain CSS off the tokens in `src/tokens.css` (no Tailwind, no UI library).
Vercel builds it via the root `vercel.json` — **don't delete that file**, it's what
points the deploy at `marketing/dist` instead of the app.

```bash
pnpm run dev:marketing      # local
pnpm run build:marketing    # production → marketing/dist
node marketing/scripts/gen-trail-data.mjs   # refresh the derived data (see below)
```

Its numbers are derived, never typed. `src/data/commits.ts` (the Trail Log's
commit squares) and `src/data/features.ts` come from `git log` and
`docs/Features.md` via `scripts/gen-trail-data.mjs` — **run it on every release**,
or the graph quietly keeps drawing last month. `src/data/releases.ts` is the
changelog itself, so that one is hand-written: add the new release at the top.

## Changelog

Latest release below. Full dated history → **[docs/Change-summary.md](docs/Change-summary.md)**.

### v7.42 — 2026-07-22

**The lint gate was fiction. Now it runs.** The project's own checklist has required `npx eslint app/src --max-warnings 0` for months. There was no ESLint config anywhere in the repo, and ESLint wasn't a dependency either — so every "run" downloaded ESLint fresh and exited on config-not-found. A gate nobody can run is worse than no gate, because everyone assumes it ran.

There's a real flat config now: TypeScript, React hooks, and Vite fast-refresh rules. Correctness only, no formatting opinions. The first honest run over 207 files found 26 errors and 64 warnings, with 182 files completely clean. The 26 errors are fixed — mostly dead stores, where a variable is initialized and then overwritten on every path before anything reads it, plus three `any` casts that now name the type they always meant and two silent `catch {}` blocks that now say why they swallow.

Two things only turned up once the linter actually ran. The source contained `eslint-disable` comments written for a linter that had never run. And the 13 test files had never been statically analysed at all — `tsconfig.json` excludes them from the type pass, so until now nothing checked them. The 57 remaining `react-hooks/exhaustive-deps` warnings are left visible on purpose: errors block the gate, warnings are a backlog to work down deliberately. Rewriting a dependency array can change behaviour, so each one gets a human.

## License

MIT
