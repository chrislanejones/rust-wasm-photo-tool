# Image Horse

![Image Horse](public/IH-Hero-Image-September-2026.webp)

**Live:** [imagehorse.app](https://imagehorse.app/) &nbsp;·&nbsp; **Editor:** [edit.imagehorse.app](https://edit.imagehorse.app/) &nbsp;·&nbsp; [![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

A browser-based image annotation and editing tool powered by **Rust/WASM** for pixel-level operations, **React + TypeScript** with **Zustand** state stores for the UI, and **Convex** for optional cloud persistence. Edits run locally in WebAssembly and your originals + edits live in the browser's **IndexedDB** — your pixels never leave the tab unless you sign in for persistence or AI features. Includes a **batch editor** that works across a whole gallery in one pass — stamp a logo, apply text, bulk-rename by pattern, or name every photo from what is actually in it with a local describer that needs no account and no per-image cost.

> Previously called **Clone Stamp App** — the app grew well beyond its origins as a single clone stamp tool.

## Quick start

Needs Node + [pnpm](https://pnpm.io/), and the Rust toolchain plus
[`wasm-pack`](https://rustwasm.github.io/wasm-pack/) to build the engine.

```bash
pnpm install
pnpm run build:wasm   # compile the Rust engine -> pkg/  (required before first run)
pnpm run dev          # editor at localhost:5173
```

`pnpm run build` bundles whatever is already in `pkg/` — it does **not** rebuild the
engine. After changing anything under `src/`, run `build:wasm` again, or use
`pnpm run build:all` to do both. A stale `pkg/` looks exactly like a broken feature.

Convex and Clerk are optional: with no keys set the app runs fully logged-out,
which is a supported path and not a degraded one. Full setup, deploy notes and
environment variables → **[Getting Started](docs/Getting-Started.md)**.

## Documentation

- **[Getting Started](docs/Getting-Started.md)** — install it, run the app and the marketing site, set up Convex, deploy.
- **[Architecture](docs/Architecture.md)** — how it fits together: layers and compositing, why one WASM binary, the Rust ↔ Convex bridge.
- **[File Map](docs/File-Map.md)** — where everything lives, in both the Rust crate (`src/`) and the React app (`app/src/`).
- **[Features](docs/Features.md)** — what it can actually do, end to end.
- **[Keyboard Shortcuts](docs/Keyboard-Shortcuts.md)** — every binding. The in-app modal (`Alt + /`) is authoritative for the tool digits; this mirrors it.
- **[OpenRaster (.ora)](docs/OpenRaster-Export-Import.md)** — layered interchange with Krita, GIMP and friends: how import/export work, and why this format.
- **[CI](docs/CI.md)** — the workflow jobs, the deploy sentinel, the static guardrails, and the local git hooks.
- **[Deploying](docs/Deploying.md)** — the two Vercel projects, the prerender step that makes the marketing site indexable, DNS, and the in-progress move of the editor off Netlify.
- **[Change Summary](docs/Change-summary.md)** — the full dated release history.

Design decisions live in **[docs/adr/](docs/adr/INDEX.md)**. Superseded investigations and planning notes are kept in **[docs/archive/](docs/archive/README.md)** rather than deleted — each one says what went stale about it.

## Tech Stack

- **Rust** — WASM processing layer (`wasm-bindgen`, `png` crate, `ab_glyph` fonts, SIMD128 kernels)
- **React 19** — UI framework (19.2.x, pinned through the pnpm catalog)
- **TypeScript** — Type safety
- **Zustand** — Client state management (UI / tool / gallery stores; IndexedDB-persisted prefs)
- **Vite** — Build tool with WASM support (`vite-plugin-wasm` + top-level await)
- **Tailwind CSS v4** — Utility styling via semantic design tokens; core utilities only, variants via cva
- **Radix UI** — Accessible primitives (Dialog, Tooltip, Context Menu)
- **Framer Motion** — Panel animations
- **Lucide React** — Icons
- **Sonner** — Toast notifications
- **emoji-mart** — Emoji picker (stamp tool)
- **JSZip** — Client-side ZIP (batch export)
- **IndexedDB** — Local-first storage (originals, edits, gallery); **Dexie** content layer + Zustand persist adapter
- **Convex** — Real-time database + auth + serverless functions
- **Clerk** — Authentication, wired to Convex through `ConvexProviderWithClerk` (`convex/react-clerk`)
- **Stripe** — Payments / billing, called over raw REST from Convex (no SDK dependency)
- **Replicate** — AI image models (background removal, restore) via Convex

## The marketing site

`marketing/` — the five-page site at **[imagehorse.app](https://imagehorse.app/)**:
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

### v8.84 — 2026-09-22

**Your settings follow you between devices, and "Everything in your browser" now turns off every tool that uploads.**

Sign in on two devices and your settings travel with you: your preferences,
which panels and tabs you last had open, the command palette's recent list,
and which mode each tool was left in. Two tabs on the same machine update
each other instantly. Your photos, edits and gallery do not sync. They stay
in this browser, exactly as they do signed out. The online-features switch
doesn't sync either, because agreeing to send data to a server is something
you do on each device. Settings › General shows what sync is doing, and it
has a button that deletes the synced copy from your account.

The privacy policy said the AI tools aren't offered while online features are
off. That was only true for Create AI Image: background removal, object
removal and OCR still sent the picture to a server. Now all of them are off
with the switch. They're grayed out with a note saying why, and a link or the
command palette can't open them either. Settings › Security has the same
switch as the New dialog and lists exactly what it turns on. Magic Eraser
runs on your machine, so it stays.

Switching tools in the middle of Remove Object used to leave its mask on the
canvas, where it swallowed every click the new tool made. It ends the mask
now. Apply Crop waits until you've drawn a rectangle.

Canvas Size's two buttons, Remove and Resize, fit side by side on one line.
They used to wrap into a staircase.

Alt + ← takes you back to the last tool you used, and Alt + → forward again.
That's the browser's own Back button, and it always worked. Now the shortcut
list says so.

Under the hood, 13 unused files and 53 unused exports are gone, and the
dialogs, dropdowns and headings that were written out by hand in several
places are one component each. A few things look a little more consistent
for it: the Batch text font picker matches the Text tool's, and the
Diagnostics tabs line up.

The engine did not change. It is the same 814,432 bytes as v8.83.

## License

MIT
