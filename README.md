# Image Horse

![Image Horse](public/IH-Hero-Image-August-2026.webp)

**Live:** [rust-wasm-photo-tool.netlify.app](https://rust-wasm-photo-tool.netlify.app/) &nbsp;·&nbsp; [![CI](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/chrislanejones/rust-wasm-photo-tool/actions/workflows/ci.yml)

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

### v8.76 — 2026-09-11

**Perspective, Distort and Skew work on the things you drew — squares,
circles and text — and the box can be cancelled.**

Point the Perspective tool at a square, a circle or a piece of text and the
warp happens to *that object*, not to the photo underneath it. Until now only
text worked that way; everything else fell through to the destructive pixel
warp, so a square you had just drawn sat perfectly still while the picture
under it was resampled. That is what "it only works with raster" meant, and it
is fixed: click the object, drag the corners, press Apply.

The result stays an object. Recolour it, move it, drag it to a new size, undo
it, or click it again and adjust the same corners — the perspective comes
along, because it is stored on the shape as fractions of its own box rather
than baked into pixels. Resize a warped square and the warp scales with it.

Apply, Reset and Cancel now sit **on the canvas**, under the box, as well as
in the panel — the gesture happens there, so the buttons that end it belong
there. **Esc cancels**, and cancelling takes the whole six-handle frame and
its grid off the canvas instead of just straightening the corners. When there
is no box the panel offers a single button to put one back.

Only the objects on the layer you are working in can be picked, and switching
layers drops the pick rather than leaving the box floating over something that
is no longer there.

Under it: shapes carry a projective quad the way text has since v8.42, the
engine warps them through a tile padded past the shape's box so a thick stroke
is not shaved off, and the on-disk op format steps to v6 — older documents
decode unchanged and simply mean "no perspective", which is what they meant.

### v8.75 — 2026-09-11

**Shapes duplicate in any direction, the Stroke Stabilizer steadies every
brush, and the lists stop disagreeing with each other.**

Pick a rectangle or a circle out of Review → Reselect and press the d-pad on
its row: four ⊕ appear around the shape on the canvas. Press one and you get
another copy of the same size, clear of the original, in that direction. Press
the left one twice and you get two marching left. Each side counts on its own,
so a press upward afterwards goes above the original rather than above the
last copy — which is what you want when you are building a diagram out of
repeated boxes.

Any placed text or shape can also be duplicated straight from its row. The
copy is made inside the engine by cloning the object rather than rebuilding it
from a list of properties, so nothing about it can be quietly left behind — a
shadow, a rotation, a background, a perspective warp all come with it.

The Stroke Stabilizer used to reach only the Paint brush. It now steadies the
Eraser, the blur brush, pixelate, redact and the clone stamp, from the one
setting — turn it on because your hand shakes and it is on everywhere. The
Eraser had in fact been honouring it all along; there was simply no control in
the panel to switch it on. On the clone stamp the source offset is kept
exactly, so the smoothing changes the path and nothing else.

History, Reselect and the Layers list are one component now instead of three
that had drifted apart. Row buttons sit together in one cluster, the coloured
dots are gone in favour of the numbers that were already beside them, and
Reselect rows are numbered too. History and Reselect keep their buttons out of
sight until you hover or tab into a row; the Layers list keeps its visible,
because those get used constantly and the eye is reporting a state, not just
offering an action.

The gallery bar's header is three columns — the count on the left, the
compress buttons centred, the actions on the right — and the compress pair is
centred on the bar rather than on the space left over, so it stops shifting
when a selection appears.

The "+" on any colour swatch opens a real colour picker — a hue wheel or a
saturation/brightness rectangle, with hex, RGB and HSL fields that all track
each other. Colours you keep land in a palette that follows you: saved locally
when you are logged out, synced to your account when you are signed in.

Smaller things: dropping an image with nothing open goes straight to the
gallery instead of asking a question with one possible answer; the status
bar's second number is labelled; the Eraser panel says "Eraser" rather than
"Brush" above a field called Brush Size; and the mobile version can save a
photo to your device, which the notice now says.

Known and open: on a freshly imported photo the status bar reports the
document size, which includes the canvas border, and a resize to an exact
width applies that width to the document rather than the picture. Export of an
untouched photo is correct.

## License

MIT
