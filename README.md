Image Horse

![Image Horse](public/Rust-Wasm-Photo-Tool-App-June-2.webp)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations, **React + TypeScript** with **Zustand** state stores for the UI, and **Convex** for optional cloud persistence. Edits run locally in WebAssembly and your originals + edits live in the browser's **IndexedDB** — your pixels never leave the tab unless you sign in for persistence or AI features. Includes a **Batch Image Editor** for applying a logo to many photos in one pass, with a grid mosaic view of the gallery.

> Previously called **Clone Stamp App** — the app grew well beyond its origins as a single clone stamp tool.

## Documentation

- **[Architecture](docs/Architecture.md)** — system diagram, layers/compositing, the single-WASM-binary rationale, Rust ↔ Convex bridge.
- **[File Map](docs/File-Map.md)** — Rust module map (`src/`) and the React frontend structure (`app/src/`).
- **[Change Summary](docs/Change-summary.md)** — full dated release history (v2.1 → latest).
- **[Keyboard Shortcuts](docs/Keyboard-Shortcuts.md)** — every shortcut (tools, panels, transforms, zoom, gallery). The in-app modal (`Alt + /`) is the source of truth; this mirrors it.
- **[Getting Started](docs/Getting-Started.md)** — install, run the app + marketing site, Convex setup, deploy notes.
- **[Features](docs/Features.md)** — full feature list: Rust/WASM image processing + the React UI.
- **[GitHub Actions (CI)](docs/GitHub-Actions.md)** — the CI workflow jobs (build, security, audits) and Dependabot.
- **[CI Guardrails](docs/CI-Guardrails.md)** — the advisory `guardrails` job, flipping checks to blocking, and the local hook mirror.
- **[Refactor Playbook](docs/Refactor-Playbook.md)** — single-source-of-truth conventions (color / type / z-index tokens, React + Rust health, target folder structures) and the reusable guardrail bundle.
- **[State Management](docs/State-Management.md)** — the Zustand stores, the `SetArg` drop-in migration off AppShell's `useState`, and what stays local.
- **[IndexedDB Investigation](docs/IndexedDB-Investigation.md)** — why IndexedDB, the live content databases, the Zustand persist adapter, and the Dexie content layer.
- **[Service Workers & Caching](docs/Service-Workers-Caching.md)** — investigation: caching the WASM binary + app shell, the never-cache deny-list, and a phased PWA rollout.
- **[OpenRaster (.ora) Export/Import](docs/OpenRaster-Export-Import.md)** — layered `.ora` interchange: how export/import work and why the format was chosen. **Shipped.**
- **[Architecture Roadmap](docs/Architecture-Roadmap.md)** — the document-based-editor direction, prioritized and mapped onto the real repo (AppShell split, Zustand, workers, GPU).
- **[Entropy Report](docs/entropy-2026-07-30.md)** — dated structural-drift measurement: where AppShell actually is, whether the decompositions paid off, and what the hotspot list says.
- **[Content-Addressed GC Audit](docs/content-addressed-gc-audit.md)** — read-only reachability audit of everything in IndexedDB: what a collector would find, and the three orphan sources.
- **[Share-Links Auth Mismatch](docs/share-links-auth-mismatch.md)** — the two-Clerk-instance investigation, the prod auth verification, and the Stripe-linkage verdict.
- **[Security Hardening](docs/Security-Hardening.md)** — audit + roadmap: **the outstanding JWT key rotation**, share-token CSPRNG, the image-upload firewall, EXIF-by-default, and the supervised items (CSP, COEP, encryption).

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

### v7.60 — 2026-07-30

**Edits made in the last moments before switching photos could be lost.** Your
drawing is saved on a short delay, and if you switched photos while one of those
saves was still writing, the next save was dropped instead of queued — silently,
with nothing left to retry it. The strokes since the last completed save never
reached disk, and because the app trusts that record over its other copy when
reopening a photo, it would hand you back an older version that looked
perfectly intact. Saves now queue behind each other, so switching photos waits
for the write instead of racing it.

The drop was reproduced under test fixtures first — four tests that failed
before the fix and pass after.

**Drop shadows on text vanished when a photo came back from the cloud.** Saving
locally and saving to the cloud each had their own copy of the same list of
things to keep, and the cloud copy was missing all nine shadow settings. Open
the photo on the same machine and your shadows were there; open it on another
device and the text came back flat, with no error either way. There is one copy
of that list now, and a test that fails if the two ever disagree again.

**Four smaller ways storage could quietly stop working.** A single failed
connection to browser storage used to be remembered for the rest of the
session, so one bad moment wedged that store until you reloaded. Browsers also
close idle connections on their own, and the app kept using the closed one —
after which every save failed. A failed upload was read as if it had succeeded,
storing a pointer to nothing. And an unreadable cloud archive was treated as if
it were an old-format image, which hid the real problem behind a confusing one.
All four now recover or say what happened.

Four **[architecture decision records](docs/adr/INDEX.md)** were written for
calls already made — the five-group toolbar, the focus-ring vocabulary, how
non-React code talks to the UI, and how shared image data is collected. They
record; they don't decide.

**The docs got audited too** — all fifteen. Four were saying things that are no
longer true (the shortcut table still listed the old tool keys, and the
OpenRaster page still called a shipped feature a plan), and the security page
was missing the most urgent item in the repo. Nothing was deleted; everything
listed still earns its place.

The **paid-tier question got a verdict**, too: nobody has ever subscribed, so
there is no billing record attached to the wrong account and nothing to migrate.
Details in [docs/share-links-auth-mismatch.md](docs/share-links-auth-mismatch.md).

An **[entropy report](docs/entropy-2026-07-30.md)** also went in — ten releases
of structural drift, measured rather than guessed. Short version: the clone-stamp
split held (that file is the same size it was ten releases ago), but the file it
was split out of grew anyway, and a second oversized file has been quietly
getting bigger. Nothing in it was acted on; the numbers are the deliverable.

## License

MIT
