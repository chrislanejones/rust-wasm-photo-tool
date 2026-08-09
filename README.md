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

### v7.88 — 2026-08-09

**Exports that leave the canvas background out are three times faster.**
Choosing "Photo only" was rebuilding the whole image three times to answer one
question — once for the pixels, once for the width, once for the height. It
does it once now. On a 1385x2068 photo that is 69 ms down to 20 ms, and the
same bytes come out the other end. Copy to clipboard, download and batch export
all took the slow path.

Also groundwork: nine places that read a picture and the dimensions describing
it now read both in one call, so nothing can change in between.

<details><summary>Older releases</summary>

### v7.87 — 2026-08-09

**Docs only.** ADR-024 gains a triage table recording which files in the
background-thread migration have been checked and what was found, so the next
session does not re-derive it. Two more places were caught where reads that
must describe the same moment would break if converted one at a time.

### v7.86 — 2026-08-09

**Tooling only.** The audit that tracks the background-thread migration was
mis-filing the lasso's live preview as ordinary work. It runs on every mouse
move, where waiting on a background thread would cost a frame, so it belongs in
the group that gets handled last and separately. No app code changed.


### v7.85 — 2026-08-09

**Groundwork, nothing user-visible.** More of the engine-on-a-background-thread
preparation: the layer operations — add, remove, rename, reorder, merge, show
and hide, opacity, masks — are ready for an engine that answers over a message
queue. Behaviour is unchanged; verified by driving every one of them and
checking the layer stack after each.


### v7.84 — 2026-08-09

**Groundwork, nothing user-visible.** Saving a photo now reads the whole
document in one go rather than eighteen separate reads. Same bytes on disk —
verified byte-exact through a save, reload and restore — but the read can no
longer be interrupted halfway, which is what would have let switching photos
mid-save mix one photo's canvas with another's history.


### v7.83 — 2026-08-09

**Marketing site.** The button-set image on the home page lost its caption
strip and got 34% smaller, the two unlabelled tiles (Undo and Layers) now say
what they are, and the nav's hover underline is drawn at its real width instead
of being a one-pixel line stretched by the GPU — which is what made it look
smeared while it moved.


### v7.82 — 2026-08-09

**Groundwork, nothing user-visible.** The engine can now hand over everything a
save needs in one call instead of eighteen. That matters for a bug nobody has
hit yet: the save reads a photo's canvas, its history and its layers as a set,
and once the engine moves onto a background thread those reads could be
interrupted halfway by switching photos — saving the first half of one photo
and the second half of another. One call cannot be interrupted.


### v7.81 — 2026-08-09

**"Download All" stops throwing your edits away.** Edit a photo, reload the
page, pick "Resume editing" — your work is right there on the canvas, but the
ZIP shipped the untouched original instead. Every stroke, every annotation,
gone from the archive with nothing to show it. Exporting a single photo was
always correct; only the batch ZIP did this, and only after a reload, which is
why it looked random.


### v7.80 — 2026-08-09

**Groundwork, nothing user-visible.** Text layout now reads its measurements
from a cache instead of asking the engine on every render. The numbers are
identical — these particular measurements depend only on the text, size and
weight you asked about, so a cached answer can never be out of date.


### v7.79 — 2026-08-08

**Tooling only.** The engine-call audit now measures whether the
engine-in-a-worker migration has actually happened, rather than just how big it
is, and a contract test pins the number so it can only go down. Nothing in the
app changed.


### v7.78 — 2026-08-08

**Docs only.** ADR-024 claimed the export-dimension cost "scales several-fold
on a large photo" and cited a 12-megapixel benchmark. It can't: every import is
downscaled to 2048 on the long edge, so the biggest document the editor ever
holds is about 4.3 MP. The measurements were already near the ceiling. No code
changed.


### v7.77 — 2026-08-08

**Exporting stops doing work it doesn't need to.** If you'd set exports to
"Photo only", the app was compositing the whole image twice on every redraw
just to work out how big the export would be — even with the download dialog
shut. It now works that out once, when you open the dialog.

JPEG, WebP and AVIF exports also read the image from the engine now instead of
scraping it back off the canvas, and the encoding moves off the main thread
where the browser allows it.


### v7.76 — 2026-08-08

**Dragging a shape, arrow or crop box no longer redraws your photo.** The
rubber band you drag out used to be painted straight onto the image: the whole
canvas was copied on mouse-down, copied back on every mouse-move to erase the
last frame, and copied back once more on release. On a 12-megapixel photo that
is a lot of pixels moved to draw a rectangle. It now draws on its own
transparent layer, so the image underneath is never touched — and erasing the
band is a clear instead of a full-resolution copy.

Copying to the clipboard also stops rewriting the document. It was calling a
flatten on the live image first; the copy never needed it, because the
composite already draws text and shapes.

### v7.75 — 2026-08-08

**The gallery grid stops reserving space it doesn't use.** v7.74 stopped the
tiles stretching, which removed a slab of bare checkerboard under every
thumbnail. It left the row heights alone, so the slab came back as empty
background — about 117px of it per row, worst at tablet width. Both halves are
fixed now.

### v7.74 — 2026-08-08

**Emptying the gallery gets your storage back.** Delete All removed the photos
and left every original image file behind — 108.6 MiB stranded in one click, on
a real gallery. Deleting photos one at a time always cleaned up properly; only
the bulk path skipped it. Nothing was visible in the app, so the space just
went missing.

**Gallery tiles stop stretching.** In the vertical layout a short photo's tile
grew to match the tallest one in its row, leaving up to 188px of bare
checkerboard under the image. The checkerboard still shows through genuinely
transparent pixels, which is the point of it.

</details>

## License

MIT
