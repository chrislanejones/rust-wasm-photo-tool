# Architecture

> Part of the [Image Horse](../README.md) docs. See also: [File Map](File-Map.md) · [State Management](State-Management.md) · [Change Summary](Change-summary.md).
>
> **Status:** describes what exists on `master` at **v7.8** (`d9960f6`),
> verified against code and git history on 2026-07-09 — not aspirational.
> A separate [Planned](#planned-not-yet-in-the-diagram-above) section at
> the bottom covers what's designed or in-branch but not live. No mermaid
> or other diagram file exists elsewhere in the repo (checked before
> writing this); the ASCII box diagram below is the one system diagram.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React UI Shell (Tailwind CSS, Zustand)                   │   │
│  │                                                          │   │
│  │  AppShell.tsx (composition root, 2,930 lines) orchestrates│   │
│  │  TopBar · ToolsSidebar · GalleryBar · ReviewPanel         │   │
│  │  UploadDialog · StatusBar · ShortcutModal                │   │
│  │                                                          │   │
│  │  Session hooks (app/src/app/session/):                   │   │
│  │  useImageSession · useSelectionActions ·                 │   │
│  │  useCanvasActions · useMaskActions                       │   │
│  │                                                          │   │
│  │  Tool hooks — still hand-wired in AppShell, NOT a         │   │
│  │  registry (see Planned): useEmojiTool, usePaintTool,     │   │
│  │  useMoveLayerTool, usePastePlacementTool, useTextTool,   │   │
│  │  useRedStampTool, dispatched via useEffectiveTool          │   │
│  │                                                          │   │
│  │  Zustand stores (app/src/stores/): useUIStore ·           │   │
│  │  useToolStore · useGalleryStore · useAnnotationStore ·    │   │
│  │  useGuidesStore — panel/tool/gallery/annotation state,   │   │
│  │  atomic selectors, a subset persisted to IndexedDB        │   │
│  │  (idbStorage.ts, its own DB, separate from content data) │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │ zero-copy data_ptr()/data_len() blit    │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  stamp_tool.wasm  (single Rust→WASM binary)               │   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │  core    │ │  layer   │ │   paint   │ │ effects  │   │   │
│  │  │ ImageBuf │ │ Stack &  │ │ Brush/Era │ │ Blur/Pix │   │   │
│  │  │ Bilinear │ │ Composit │ │ Mask/Stab │ │ Redact   │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │ annot    │ │ select   │ │   stamp   │ │ transfrm │   │   │
│  │  │ Text &   │ │ Magic-   │ │ Clone Br  │ │ Flip/Rot │   │   │
│  │  │ Shapes   │ │ Wand     │ │ Dab/Strok │ │ Resize   │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐   │   │
│  │  │ filters  │ │ drawing  │ │   text    │ │ codec/   │   │   │
│  │  │ Bright/  │ │ Arrows/  │ │ Fonts/    │ │ history  │   │   │
│  │  │ Contrast │ │ Shapes   │ │ Bezier    │ │ Snapshot │   │   │
│  │  │          │ │          │ │           │ │ undo     │   │   │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘   │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ simd/{blur,color,resize,pixel}.rs — v128/f32x4    │    │   │
│  │  │ kernels, cfg-gated, bit-identical scalar fallback │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │  utils · shared leaf helpers — all share one pixel buffer│   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Codec worker (Vite module Web Worker, Comlink)           │   │
│  │  WebP/JPEG export encode + gallery thumbnails, off the    │   │
│  │  main thread. Silent main-thread fallback on failure.     │   │
│  │  PNG export stays on the Rust encoder.                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Convex (persistent layer, signed-in only)                │   │
│  │                                                          │   │
│  │  users · subscriptions · projects · images · layers       │   │
│  │  annotations · history · photo_edits · recent_texts ·     │   │
│  │  shares · ai_jobs                                        │   │
│  │                                                          │   │
│  │  Auth via Clerk (AUTH_ENABLED false path = fully local)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Originals → IndexedDB, content-addressed (SHA-256), lazy       │
│    Dexie read-through (legacy store stays the rollback target)  │
│  Working copies downscaled to ≤2048px long edge on upload       │
│  SVG imports rasterized to PNG at the import boundary            │
│    (raw SVG never enters the pipeline)                          │
└─────────────────────────────────────────────────────────────────┘
```

### AppShell & the session-hook refactor — stage 1-3 done, stage 4 not started

`AppShell.tsx` is being dismantled in four stages (see the
`tool-module-migration` and `repo-boundaries` skills). **Stages 1-3
shipped in v7.3** and are verified still true at v7.8:

- Orphan `useState`s that belonged in stores moved to Zustand.
- Four domain hooks were extracted to `app/src/app/session/`:
  `useImageSession.ts`, `useSelectionActions.ts`,
  `useCanvasActions.ts`, `useMaskActions.ts`.
- The window `CustomEvent`s (`text-committed`,
  `text-annotations-changed`) were replaced with store actions; new
  `CustomEvent`s are forbidden project-wide.

**Stage 4 (the tool registry) has NOT shipped** — this is the one
place this document differs from an earlier draft that implied it had.
`AppShell.tsx` is **2,930 lines** as of v7.8 and still imports and
calls tool hooks directly — `useEmojiTool`, `usePaintTool` (three
instances: paint/eraser/mask), `useMoveLayerTool`,
`usePastePlacementTool`, `useTextTool`, `useRedStampTool` — dispatched
through `useEffectiveTool`. There is no `features/tools/modules/`
registry directory and no `ToolModule` type anywhere in the codebase.
Adding tool #N still means editing the shell in multiple places. See
[ADR-002](adr/002-tool-module-registry.md).

### Layers & compositing

The WASM core is not a single pixel buffer — `ImageHorseTool` holds a
**stack of layers** (`Vec<Layer>`) plus an active-layer index. Each
`Layer` owns its own RGBA buffer **and** its own live text/shape
annotations, so every canvas tool (paint, clone stamp, blur,
brightness/contrast, text, shapes, emoji, paste) edits the **active
layer**. The on-screen canvas is the **composite** of all visible
layers, blended bottom→top source-over and scaled by each layer's
opacity.

A reusable `composite_cache` is rebuilt by `recomposite()` and exposed
through `data_ptr()`/`data_len()` for the zero-copy blit; a fast path
copies straight through when there's a single fully-opaque layer with
no overlays. `export_png`, `get_image_data`, and the thumbnail path all
composite the full stack, so export always matches what's on screen.

### Undo/redo is snapshot-based today — not an operation log

`src/history.rs` stores undo as a `VecDeque<Snapshot>`, where each
`Snapshot` is a **full copy of the entire layer stack** (every layer's
pixel buffer + annotations), the active index, and canvas dimensions.
This is deliberately what makes structural layer ops (add/delete/
reorder/merge) undoable alongside pixel edits, at the cost of memory
scaling with edit count rather than edit size. An operation-log
replacement is designed (see [ADR-003](adr/003-operation-log-undo.md))
and exists on an unmerged, feature-gated branch — it is **not** the
live path. See Planned, below.

### Client state (Zustand)

The React side keeps cross-cutting state in five
[Zustand](https://github.com/pmndrs/zustand) stores under
`app/src/stores/`: **`useUIStore`** (panel/dialog visibility, the
compact master-bar tab), **`useToolStore`** (active tool + every
tool-mode flag/settings blob), **`useGalleryStore`** (photo list,
selection, per-photo bookkeeping), **`useAnnotationStore`**, and
**`useGuidesStore`** (image guide lines). Components subscribe with
atomic selectors — one field each — so a panel toggle re-renders only
what reads it. Durable "remember my choice" prefs persist to IndexedDB
through a `StateStorage` adapter (`stores/storage/idbStorage.ts`) in
its own `image-horse-zustand` database, kept separate from content
data. Heavy data (originals, edits, gallery manifest) never lives in
Zustand. See [State Management](State-Management.md) (note: that doc
still describes only the original three stores and predates
`useAnnotationStore`/`useGuidesStore` — flagged stale, out of scope for
this pass).

### Persistence: Dexie originals read-through

Original photo bytes are content-addressed (SHA-256) and read through
a single adapter (`app/src/lib/dexie/originalsAdapter.ts`) that
migrates **lazily, per record, on read** from the legacy raw-IndexedDB
store into a typed Dexie layer — there is no bulk migrator, and the
legacy store is never written by the migration path, only read, so it
stays a byte-identical rollback target. A kill switch
(`USE_DEXIE_ORIGINALS` in `dexie/flags.ts`, currently `true`) reverts
everything to legacy-only. Shipped v7.5. See
[ADR-001](adr/001-originals-lazy-migration-to-dexie.md).

### SVG import: rasterize at the boundary

Chrome's `createImageBitmap()` cannot decode SVG, and the security
firewall (`lib/security/imageFirewall.ts`) rejects raw SVG outright
(it can carry `<script>`/`onload`/`foreignObject`). SVGs are converted
to PNG at both import funnels via `lib/rasterizeSvg.ts` — loaded into
an `<img>` (scripts never execute there), drawn to a canvas, only the
pixels kept. The stored gallery "original" is the PNG, not the SVG
bytes. Shipped v7.8. See
[ADR-008](adr/008-svg-rasterized-at-import.md).

### Codec worker: encode + thumbnails off the main thread

Export encoding (WebP/JPEG) and gallery thumbnailing run in a Vite
module Web Worker (`workers/codec.worker.ts`, Comlink-wrapped),
keeping the UI responsive during big exports and multi-image imports.
Pixel buffers cross as transferables only. Wired into
`useAutoCompress.ts`, `workingCopy.ts` (thumbnails), and
`exportImage.ts` with no feature flag — every path keeps a silent
main-thread fallback if the worker fails to construct or its first
call fails. PNG export stays on the Rust encoder. Shipped v7.7. See
[ADR-005](adr/005-codec-worker-fallback.md).

### Metadata scrub (Settings → Security)

Every export path can strip EXIF/GPS/XMP/IPTC (`lib/exif.ts`,
dependency-free, JPEG/PNG/WebP) before pixels leave the device; a
`'location'` mode removes just GPS and keeps camera/lens/timestamp. See
[ADR-010](adr/010-metadata-scrub-privacy-modes.md).

### Why one WASM binary?

Separate `.wasm` modules (image-core.wasm, filters.wasm, etc.) would
require copying the full pixel buffer across WASM memory boundaries on
every operation. A single binary with Rust modules shares one `Vec<u8>`
in linear memory. Zero-copy, zero overhead.

### Why browser codecs for JPEG/WebP/AVIF?

The `image` crate with all codec features would add real weight to the
WASM binary. The browser's `canvas.toBlob()` already has
hardware-accelerated JPEG/WebP/AVIF encoders built in (now routed
through the codec worker, see above). Rust handles PNG encoding
(lossless, needed for pixel-perfect export); JS delegates the rest to
the browser.

### Rust ↔ Convex bridge (signed-in only; the app must work logged out)

**Principle**: WASM processes pixels locally (fast, zero-latency, works
offline/logged-out). Convex stores metadata, edit archives, and account
state for signed-in users only — nothing here is on the critical
editing path.

- **Per-photo edit persistence** — `useEditPersistence.ts` calls
  `api.photoEdits.save` / `getEdit` (`convex/photoEdits.ts`) to upload
  a binary canvas archive per photo, so a signed-in user's edit state
  survives across devices/sessions. (An earlier draft of this doc
  described a `useConvexHistory.recordAction()` hook — that hook does
  not exist in the current codebase; verified by grep before writing
  this.)
- **Annotations** — arrow/shape/text commits save geometry/color/
  timestamp to the Convex `annotations` table for cross-session
  recovery.
- **AI Jobs Pipeline** — UI triggers → `convex/aiJobs.ts` /
  `convex/ai.ts` call Replicate → webhook updates status → `useQuery`
  auto-updates the UI → result loaded into WASM memory.

---

## Planned (not yet in the diagram above)

Nothing in this section is live. Each item links the ADR that owns it;
none are Accepted yet (see [ADR index](adr/INDEX.md)).

- **Tile engine + operation-log undo** — `src/tiles.rs` (256×256 tile
  buffer) and `src/ops.rs` (serialized op log with keyframed replay)
  exist on the unmerged branch `feat/tile-engine-core`, gated behind an
  off-by-default `tiles` Cargo feature and explicitly excluded from the
  wasm build. 55/55 cargo tests pass on that branch (verified
  2026-07-09). Even if/when the branch merges to master, the render
  path (`src/history.rs` snapshot undo, flat pixel buffers) stays the
  live implementation until something actually calls into `ops.rs`/
  `tiles.rs` — "merged" is not "shipped." See
  [ADR-003](adr/003-operation-log-undo.md),
  [ADR-004](adr/004-tile-buffer.md),
  [ADR-006](adr/006-render-cache-disposable.md).
- **Tool registry (Stage 4)** — replace AppShell's hand-wired tool
  hooks with a `ToolModule` interface + static registry so adding a
  tool is one folder, not a shell edit. Not started; see
  [ADR-002](adr/002-tool-module-registry.md) and the
  `tool-module-migration` skill.
- **Service worker / precache** — investigated only, nothing wired.
  Would cache `stamp_tool_bg.wasm` and the app shell for instant
  repeat loads and offline editing. See
  [Service Workers & Caching](Service-Workers-Caching.md) (status line:
  "no service worker ships today") — no ADR yet.
