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

### v8.8 — 2026-08-11

**Nothing you can see.** The whole Select tool — wand, edge-aware, colour
range, magnetic lasso, and both marquees — now waits for the engine's answer.

Thirteen calls in one file, the largest batch of this run, and five of them
were checks written as `if (engine says yes)`. Every mode was driven in a real
browser afterwards and each left the right entry in the history: Magic Wand,
Edge Select, Colour Range, Magnetic Lasso, Marquee, Ellipse Marquee, Select
All, Delete Selection, Selection to Layer.

The live wire that follows your cursor while a lasso is open was deliberately
left alone. It runs on every mouse-move, and it is the one place in this file
where waiting for an answer would cost a frame.

<details><summary>Older releases</summary>

### v8.7 — 2026-08-11

**Nothing you can see.** The two AI buttons and the layer-resize box now wait
for the engine's answer.

The one worth explaining: dropping a resize box and pressing Enter is a
"commit", and the same commit runs quietly every time you switch tools, on the
understanding that it does nothing when there is no box open. That "does
nothing" is a check, and the check is the call that was converted here — left
half-done it would have stopped saying no, and every tool switch would have
added a step to your undo history for a box that was never there.

Both AI buttons were then checked on a real signed-in account, with the upload
step blocked so no credit was spent: each hands the model a full-size PNG of
the current picture, and Remove Object opens its window with the image already
loaded.

### v8.6 — 2026-08-11

**Nothing you can see.** The last three files with a single engine call left in
them: the export dialog's size label, the eyedropper, and the clone stamp.

These are the three that needed the surrounding code rearranged rather than one
keyword added. The clone stamp's was the one worth being careful about — the
call it makes is the check for "has a source point been set yet", and that check
sits inside an `if`. Left half-converted it would have stopped rejecting
anything, and the stamp would have painted from wherever the engine happened to
be, silently. Verified in the browser both ways round: a click with no source
still does nothing, and a source-then-stamp still leaves a stroke.

### v8.5 — 2026-08-11

**Nothing you can see.** Four more engine calls now wait for the answer before
using it: copying a selection to the clipboard, both of the paths that save an
edited photo, and the OCR button that pulls text out of an image.

Each of the four was a single keyword, because each already sat inside code
that waits for something else. The three remaining one-call files are not like
that — every one of them needs the surrounding code rearranged first, which is
a different job and is queued as its own.

### v8.4 — 2026-08-11

**Nothing you can see.** Copy-to-clipboard and the single-photo download now
wait for the engine's answer before using it.

The fourth call in that file turned out not to be ordinary work at all: the
histogram under the image is redrawn from a full pass over the whole picture,
and the code that asks for it runs once per animation frame until the bars
settle. That one is now filed with the other frame-rate work rather than queued
for conversion.

### v8.3 — 2026-08-10

**Nothing you can see.** The export paths now wait for the engine's answer
before using it — saving a photo, sharing a link, and building the .zip of a
whole gallery.

Checked against the real thing rather than only by tests: PNG, JPEG and WebP
each came back as genuinely that format, and a twelve-photo .zip built
correctly with an edited photo among them.

### v8.2 — 2026-08-10

**Nothing you can see.** Four more engine calls turned out to sit on the path
that repaints the canvas — not because of anything in the functions themselves,
but because the redraw reaches into two other files to call them. Their names
give nothing away, and the check that finds this class of problem only ever
looks at a function's own name, never at who calls it from somewhere else.

Left in the ordinary queue, the next batch would have made the redraw wait for
a round trip on every frame. They are now listed with the reason, and the list
of remaining work drops accordingly.

### v8.1 — 2026-08-10

**Nothing you can see.** Flip-horizontal, flip-vertical and copy-region now wait
for the engine's answer before using it — three more calls converted for the
background-thread move.

The more useful find was accidental. One source file contained two invisible
NUL characters, used as a separator inside a cache key. That is enough to make
every search tool classify the file as *binary* and skip it silently, so
searching the project for anything defined in it returned a confident zero. The
characters are now written as an escape — identical behaviour, and the file is
searchable again.

### v8.0 — 2026-08-10

**Nothing you can see — the migration's own bookkeeping, corrected the other
way.** Yesterday's release fixed a rule that was filing live drawing code as
ordinary work. This one retires that rule entirely, because it was wrong far
more often in the opposite direction: of the 21 calls it alone marked as
"drawing hot path", **19 were ordinary once-per-click actions** — commit,
cancel, apply-crop, drop-a-pin, mouse-down, mouse-up. They had been set aside
to be done last, which meant nobody was looking at them.

The list of remaining work therefore goes **up**, not down. That is the honest
number, and the first one the rest of this migration can actually be planned
against.

### v7.99 — 2026-08-10

**Nothing you can see.** The checklist tracking the background-thread migration
had a target it could never reach: five of the calls it was counting are ones
the plan says must *not* be changed, because a later stage removes that code
path entirely. The checklist wanted them at zero; the plan forbade touching
them.

Left alone that doesn't just stall — it pushes the wrong way. Sooner or later
someone grinds the number down, meets those five, and "finishes the job" by
changing the one piece of code that repaints the canvas on every frame. Those
five are now named, with the reason, and changing them makes the test suite fail
loudly instead of looking like progress.

### v7.98 — 2026-08-10

**Nothing you can see.** Undo, redo, jump-to-step and delete-step now wait for
the engine's answer before repainting. Four of the five were the same shape:
"if the engine says it undid something, repaint" — and once the engine answers
from a background thread, that question stops being answerable on the spot. Left
alone, every Ctrl+Z would have repainted and re-synced whether or not anything
was actually undone.

Checked in a browser rather than only by tests, because a broken undo button is
not something a type checker can see: undo and redo work from both the toolbar
and the keyboard, and pressing Ctrl+Z with nothing left to undo correctly does
nothing at all.

### v7.97 — 2026-08-10

**Nothing you can see — a measuring instrument corrected.** The tool that
decides which engine calls sit on a drawing hot path had six of them filed as
ordinary work, including the blur brush's drag, the eyedropper's magnifier and
the text tool's hover highlight. The next batch of background-thread work would
have made those wait for a round trip on every mouse movement, which is a
dropped frame in exactly the places you would notice one.

Nothing in the app changed. The list it was working from did.

### v7.96 — 2026-08-10

**Something you can feel.** Every time the editor refreshed itself — after a
brush stroke, an undo, a layer change — it rebuilt the entire image from scratch
and checked every single pixel, to work out whether the picture had any
transparency in it. On a 1385x2068 photo that was about 30 ms of work, and it
was the whole cost of the refresh: the other ten things it collects took no
measurable time at all.

Nothing was using the answer. The canvas checkerboard used to ask, and stopped
in June when it became always-on; the question kept being asked anyway. It is
gone, and the refresh now costs nothing measurable.

The engine can still answer it — that hasn't been removed, just taken off the
path that runs after every edit.

### v7.95 — 2026-08-10

**Nothing you can see.** More of the same groundwork: exporting a layered `.ora`
project asked the engine for the canvas size and the layer list as four separate
questions, and the routine that flattens each layer first asked three more. Both
sets describe one document and get written into one file, so once the engine
moves to a background thread, a resize arriving mid-question could put a canvas
size from before it next to a layer list from after — a broken `.ora` saved to
disk with no error at the time. Each set is one question now.

This does not make `.ora` export airtight on its own, and it is worth being
straight about that: the export still loads its ZIP library partway through, and
the layer images are fetched after that point. Closing that gap is a bigger
decision, and it is still open.

### v7.94 — 2026-08-10

**Nothing you can see, and one thing that can no longer go wrong later.**
Clicking a pen path to re-edit it used to ask the engine two questions: which
path is under this point, then give me every path so I can look that one up. Two
questions with a gap between them. Today the gap is empty; once the engine moves
to a background thread it stops being, and a path deleted in that gap would make
the click do nothing at all — no error, no message, just a click that does not
work. It is one question now.

The engine also keeps the rule the app used to apply itself: a rectangle drawn
over a pen path still means "no pen path here", rather than reaching through it.

### v7.93 — 2026-08-10

**Nothing you can see.** The plan to move the engine onto a background thread
rested on a number nobody had measured: what it costs to get finished pixels
onto the screen from over there. It is 22 ms on a 3.1 megapixel photo, against
23 ms for the main thread doing the same work — so there is no penalty, and the
reason for picking this approach over the alternative holds up.

Getting that number needed a real engine running inside a background thread that
owns the canvas. Two earlier experiments had each done one half of that and
never both at once. Two other things fell out of the run: the first operation
after switching costs about 1.8x the ones after it, so the switch has to warm
the thread up before handing it work; and the old thread has to be shut down
rather than left idle, because the memory it holds is never given back.

### v7.92 — 2026-08-09

**Nothing you can see.** More groundwork for moving the engine onto a background
thread. The switch that turns that mode off now works mid-session instead of
only on reload — it swaps the drawing surface for a fresh one rather than trying
to reclaim a surface it can no longer draw to.

### v7.91 — 2026-08-09

**Nothing you can see.** Groundwork for moving the engine onto a background
thread. The app now keeps track of which drawing surface is live and gives each
one a number, so a later change can refuse work aimed at a surface that has been
replaced instead of drawing into nothing.

Worth knowing why that matters: once the engine draws from a background thread,
switching in and out of Batch replaces the canvas underneath it. Without this,
the background thread would keep painting into the old one — no error, no
warning, just a blank screen.

### v7.90 — 2026-08-09

**Nothing you can see, and one thing you can feel.** Creating a share link with
"Photo only" set was building the whole image twice to work out two numbers; it
does it once now, and skips a step it never needed — 40 ms down to 17 ms on a
1385x2068 photo.

The rest is groundwork for moving the engine onto a background thread. The
eleven values the editor reads to redraw itself — size, zoom, layers, undo
history, export quality — now come back in one call instead of eleven, so they
can never describe two different moments.

### v7.89 — 2026-08-09

**No user-visible change.** The v7.81 fix — Download All shipping your original
files instead of your edits — now has a regression test. That bug only appeared
after a page reload, which is why it lasted two months and why the fix went out
without one. The code underneath it has been rewritten twice since, so the
cover is overdue.

### v7.88 — 2026-08-09

**Exports that leave the canvas background out are three times faster.**
Choosing "Photo only" was rebuilding the whole image three times to answer one
question — once for the pixels, once for the width, once for the height. It
does it once now. On a 1385x2068 photo that is 69 ms down to 20 ms, and the
same bytes come out the other end. Copy to clipboard, download and batch export
all took the slow path.

Also groundwork: nine places that read a picture and the dimensions describing
it now read both in one call, so nothing can change in between.

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
