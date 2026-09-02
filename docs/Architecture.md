# Architecture

> Part of the [Image Horse](../README.md) docs. See also: [File Map](File-Map.md) · [Change Summary](Change-summary.md) · [ADR index](adr/INDEX.md).
>
> **Status:** describes what exists on `master` at **v8.61** (`7c166fc`),
> re-verified against code on 2026-09-01 — not aspirational.
>
> This pass re-read the tree rather than patching version numbers. What was
> checked, and what it cost: the engine's **thread** (it moved into a worker
> and the diagram still had it on the main one), the **tool registry** (the
> doc said "not started", the code says a registry shape exists and nothing
> routes through it — both the doc and the backlog note were wrong, in
> opposite directions), the **service worker** (the doc said "nothing wired,
> no ADR"; the code ships it dark behind a build flag under an ADR that has
> been Accepted since July), **undo**, **WebGPU**, the **Convex table list**,
> and `AppShell.tsx`'s **line count**. Sections that had drifted were
> rewritten from the code, not amended in place.
>
> A separate [Planned](#planned-not-yet-in-the-diagram-above) section at the
> bottom covers what is designed or in-tree but not live. The ASCII box
> diagram below is the one system diagram in the repo.

```
┌─ Browser ──────────────────────────────────────────────────────────┐
│                                                                    │
│  MAIN THREAD                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  React UI Shell (React 19, Tailwind CSS v4, Zustand)         │  │
│  │                                                              │  │
│  │  AppShell.tsx (composition root, 3,813 lines) orchestrates   │  │
│  │  TopBar · ToolsSidebar · GalleryBar · ReviewPanel            │  │
│  │  UploadDialog · StatusBar · ShortcutModal                    │  │
│  │                                                              │  │
│  │  Session hooks (app/src/app/session/):                       │  │
│  │  useImageSession · useSelectionActions ·                     │  │
│  │  useCanvasActions · useMaskActions                           │  │
│  │                                                              │  │
│  │  Tool hooks — still hand-wired in AppShell (see Planned):    │  │
│  │  useEmojiTool, usePaintTool, useMoveLayerTool,               │  │
│  │  usePastePlacementTool, useTextTool, useRedStampTool,        │  │
│  │  dispatched via useEffectiveTool. A registry SHAPE exists    │  │
│  │  (features/tools/toolModules.ts, 5 modules) but nothing      │  │
│  │  routes through it yet.                                      │  │
│  │                                                              │  │
│  │  Zustand stores (app/src/stores/): useUIStore ·              │  │
│  │  useToolStore · useGalleryStore · useAnnotationStore ·       │  │
│  │  useGuidesStore — atomic selectors, a subset persisted to    │  │
│  │  IndexedDB (idbStorage.ts, its own DB, separate from         │  │
│  │  content data)                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                       │                                            │
│                       │  engine port — lib/engine/port.ts          │
│                       │  request ids · FIFO queue ·                │
│                       │  cancellation · panics come back as        │
│                       │  rejections, never hangs                   │
│                       ▼                                            │
│  ENGINE WORKER — the default engine since v8.32 (ADR-024)          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  engine.worker.ts — owns its OWN wasm instance and its own    │ │
│  │  ImageHorseTool. Nothing is shared with the main thread: no   │ │
│  │  SharedArrayBuffer, no COOP/COEP, no wasm threads.            │ │
│  │                                                               │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐         │ │
│  │  │  core    │ │  layer   │ │   paint   │ │ effects  │         │ │
│  │  │ ImageBuf │ │ Stack &  │ │ Brush/Era │ │ Blur/Pix │         │ │
│  │  │ Bilinear │ │ Composit │ │ Mask/Stab │ │ Redact   │         │ │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐         │ │
│  │  │ annot    │ │ select   │ │   stamp   │ │ transfrm │         │ │
│  │  │ Text &   │ │ Magic-   │ │ Clone Br  │ │ Flip/Rot │         │ │
│  │  │ Shapes   │ │ Wand     │ │ Dab/Strok │ │ Resize   │         │ │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐         │ │
│  │  │ filters  │ │ drawing  │ │   text    │ │ codec/   │         │ │
│  │  │ Bright/  │ │ Arrows/  │ │ Fonts/    │ │ history  │         │ │
│  │  │ Contrast │ │ Shapes   │ │ Bezier    │ │ Snapshot │         │ │
│  │  │          │ │          │ │           │ │ + op log │         │ │
│  │  └──────────┘ └──────────┘ └───────────┘ └──────────┘         │ │
│  │  ┌───────────────────────────────────────────────────┐        │ │
│  │  │ simd/{blur,color,resize,pixel}.rs — v128/f32x4    │        │ │
│  │  │ kernels, cfg-gated, bit-identical scalar fallback │        │ │
│  │  └───────────────────────────────────────────────────┘        │ │
│  │  utils · shared leaf helpers — all share one pixel buffer     │ │
│  │                                                               │ │
│  │  Draws the composite straight onto the OffscreenCanvas        │ │
│  │  transferred from the main thread. Main-thread blocking per   │ │
│  │  heavy op: 129–137 ms → 0.                                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                       │                                            │
│                       │  ih_engine_worker=0 falls back to the      │
│                       │  main-thread engine — slower under load,   │
│                       │  never wrong                               │
│                       ▼                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Codec worker (Vite module Web Worker, Comlink)               │ │
│  │  WebP/JPEG export encode + gallery thumbnails, off the main   │ │
│  │  thread. Silent main-thread fallback on failure.              │ │
│  │  PNG export stays on the Rust encoder.                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                       │                                            │
│                       ▼                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Convex (persistent layer, signed-in only)                    │ │
│  │                                                               │ │
│  │  users · subscriptions · projects · images · layers ·         │ │
│  │  annotations · history · recent_texts · photo_edits ·         │ │
│  │  shares · ai_jobs                                             │ │
│  │                                                               │ │
│  │  Auth via Clerk (AUTH_ENABLED false path = fully local)       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Originals → IndexedDB, content-addressed (SHA-256), lazy          │
│    Dexie read-through (legacy store stays the rollback target)     │
│  Working copies downscaled to ≤2048px long edge on upload          │
│  SVG imports rasterized to PNG at the import boundary              │
│    (raw SVG never enters the pipeline)                             │
└────────────────────────────────────────────────────────────────────┘
```

### The engine runs in a Web Worker — default since v8.32

This is the biggest structural change since the op log, and until this pass
the diagram above still drew the engine on the main thread. It is not there
any more.

`app/src/workers/engine.worker.ts` owns **its own wasm instance and its own
`ImageHorseTool`**. Nothing is shared with the main thread: no
`SharedArrayBuffer`, no COOP/COEP headers, no wasm threads. The main
`<canvas>` is handed over with `transferControlToOffscreen()` and the worker
draws the composite onto it directly, so a heavy operation never touches the
thread that handles input.

| | |
| --- | --- |
| Shipped | **v8.32**, 2026-08-13 ([ADR-024](adr/024-engine-in-a-worker.md), Accepted 2026-08-07) |
| Default | **ON.** `ih_engine_worker=0` in `localStorage` opts a tab out, on next load |
| Main-thread blocking, per heavy op | **129–137 ms → 0** |
| Shared memory | none — one wasm instance per side, never both live for one document |

**The invariant the whole thing rests on is one port per document.** Every
mutation of the document the user is editing reaches the engine through a
single message queue. That queue is explicit rather than left to Comlink for
one reason: `OpLog::append` records **arrival** order and no `Op` carries a
sequence number, so `postMessage` order *is* append order — but only while
every mutation goes through one port, in order. Comlink would return correct
results with no ordering promise between concurrent calls, and the op log
would quietly stop describing the document.

The port (`app/src/lib/engine/port.ts`) adds what the early spike lacked:
request ids so concurrent calls cannot take each other's answers, FIFO
queueing, cancellation for superseded requests, and errors that come back as
rejections instead of hangs.

**Two details that cost real bugs, recorded here so they are not rediscovered:**

- **The fallback branches on where the engine lives, not on the flag.** A live
  handle was built by whichever mode was active when the document opened, and
  nothing migrates it afterwards, so the flag and the engine can disagree.
  Reading the flag at call time is how a stale flag reaches a live document —
  measured, it took down the whole React tree (`#root` empty), not merely the
  canvas. `livePort` answers the real question — *is this document
  worker-resident?* — and cannot be stale, because it **is** the thing that
  owns the engine.
- **The worker is reused, not rebuilt, and the reason is not efficiency.**
  `transferControlToOffscreen()` may be called once per element. Disposing the
  worker to load a second photo destroys the only surface that element will
  ever yield, and the replacement worker draws nowhere — which shipped as a
  blank canvas on every load past the first, with a correct thumbnail and an
  empty console.

Turning the switch off falls back to the main-thread engine: slower under
load, never wrong. The losing instance is terminated on the way, because wasm
memory never shrinks and a worker left running holds a whole instance for a
document nobody is editing.

### AppShell & the session-hook refactor — stages 1-3 done, stage 4 part-built

`AppShell.tsx` is being dismantled in four stages (see the
`tool-module-migration` and `repo-boundaries` skills). **Stages 1-3
shipped in v7.3** and are still true at v8.61:

- Orphan `useState`s that belonged in stores moved to Zustand.
- Four domain hooks were extracted to `app/src/app/session/`:
  `useImageSession.ts`, `useSelectionActions.ts`,
  `useCanvasActions.ts`, `useMaskActions.ts`.
- The window `CustomEvent`s (`text-committed`,
  `text-annotations-changed`) were replaced with store actions; new
  `CustomEvent`s are forbidden project-wide.

**Stage 4 (the tool registry) is part-built, and the honest description is
"the shape exists, the wiring does not."** This section is where the doc had
drifted furthest, in both directions — the previous revision said Stage 4 had
not started and no `ToolModule` type existed anywhere, which is wrong; a note
in the backlog said Stage 4 was closed, which is also wrong. What is in the
tree at v8.61:

| | Status at v8.61 | Where |
| --- | --- | --- |
| `ToolModule` type | **Exists** | `app/src/features/tools/toolModules.ts:40` |
| Registered modules | **5** — Paint, Resize, Adjust, Select, Perspective | `TOOL_MODULES`, same file |
| `features/tools/modules/` directory | **Does not exist** | — |
| AppShell imports `TOOL_MODULES` | **No** | nothing routes through the registry |
| Tool hooks hand-wired in AppShell | **Still 7** | `AppShell.tsx:14-22` |
| `AppShell.tsx` line count | **3,813** | was 2,930 at v7.8 |

The registry file says so itself: it "only LAYS THE SHAPE", and routing —
the `ToolsSidebar` `activeTool` switch, keyboard shortcuts, persistence keys
— is not wired through it. So adding tool #N still means editing the shell in
several places, which is the thing ADR-002 exists to end.

**AppShell grew by 883 lines while being dismantled.** That is not a
contradiction to explain away: the registry work added a parallel structure
without removing the old one, and eleven releases of features landed in the
shell in the meantime. The line count is the honest measure of how much of
Stage 4 is left. See [ADR-002](adr/002-tool-module-registry.md).

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

### Undo/redo — two mechanisms, one of them authoritative

The previous revision of this doc led with "snapshot-based today — not an
operation log" and carried the op-log amendment beside it as a correction.
Both halves are still true, and reading them as a before/after gets the
system backwards. They run **together**, and have since v7.36. Written as one
description of what happens at v8.61:

**Snapshots are the base mechanism and the fallback.** `src/history.rs`
stores undo as a `VecDeque<Snapshot>`. Each `Snapshot` is a full copy of the
entire layer stack — every layer's pixel buffer and its annotations — plus
the active index, canvas dimensions, the selection mask, and (since
[ADR-031](adr/031-export-quality-lives-on-the-engine-snapshot.md)) the export
quality. That is what makes structural layer ops (add/delete/reorder/merge)
undoable alongside pixel edits, at the cost of memory scaling with edit
count rather than edit size. Two caps bound it, both in `src/settings.rs`:
**50 steps** (`DEFAULT_MAX_HISTORY`) and **512 MB** (`DEFAULT_MAX_HISTORY_BYTES`),
enforced on every push.

**The op log replays when it can prove it is still describing the document.**
`undo()`/`redo()` take the op-log path only when the engine's composite
FNV-hashes byte-identical to the log's. Any unrecorded edit — clone stamp,
filters, masks, layer ops — fails that hash, marks the log broken, and
snapshot undo takes over untouched
([ADR-013](adr/013-oplog-undo-hash-fallback.md)). No stage can strand the
editor. This is why the two are not alternatives: the op log is an
optimisation that is allowed to fail, and the snapshot stack is the thing
that is not.

**Selection is an undo step, and a transparent one.** Each select / add /
subtract / deselect pushes a snapshot carrying `selection_only: true`. Those
steps recorded no op, so undo restores just the mask and never seeks the log
cursor — the layer stack in a selection-only snapshot is identical to the
state below it by construction.

**It survives reload.** `oplogPersistence.ts` debounces ~2s after each flush
and commits op chunks, PNG keyframes (engine codec, byte-exact) and a
manifest in one Dexie transaction. Restore replays from the base keyframe.
See [The op-log pipeline](#the-op-log-pipeline-live-since-v736) below for the
recording and persistence detail.

**The on-disk op format is at version 5**, not the v4 that
[ADR-033](adr/033-the-text-box-has-a-height-and-the-op-log-goes-to-v4.md)
named — [ADR-034](adr/034-perspective-is-projective-and-text-keeps-its-corners.md)
took it to 5 for the perspective quads. `OP_FORMAT_VERSION` in `src/ops.rs`
is the value; v2, v3 and v4 blobs all still decode through the one path, and
that prefix-extension property is pinned by tests
(`v3_blobs_still_decode_under_v4`, `v4_blobs_still_decode_under_v5`).

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
Zustand. See [State Management](archive/State-Management.md) (note: that doc
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

### Two things in the tree that no pixel goes through

Both of these are real code on `master`, both are off in a default build, and
both were described wrongly by this doc before 2026-09-01 — in opposite
directions. They are grouped here so the distinction stays visible:
**shipped-but-dark is not the same as planned, and neither is the same as
wired.**

**Service worker — ships dark, not "investigated only".** The previous
revision of this doc said "investigated only, nothing wired… no ADR yet."
Every clause was wrong.
[ADR-019](adr/019-opt-in-precache-service-worker.md)
has been **Accepted since 2026-07-19**, and the code is in the tree:
`app/src/lib/pwa/swBoot.ts` (registration), `skew.ts`, `updatePrompt.ts` and
`components/UpdatePrompt.tsx` (the Phase 2 update toast). What is true is
that **it has never been on in a shipped build.** `__IH_SW_MODE__` is a
build-time constant fed by `VITE_ENABLE_SW`, defaulting to `"off"`, and in an
"off" build every service-worker branch is statically dead code the minifier
drops — verified empirically at merge: no `sw.js`, no workbox chunk, no
`version.json`, zero occurrences of `serviceWorker` in the bundle. A third
mode, `"kill"`, ships a self-destruct worker for the rollback path. Phase 3
(installable PWA) is genuinely unstarted.

`playwright.sw.config.ts` at the repo root belongs to this and is **not dead
weight** — it is a live harness (`pnpm run test:e2e:sw`, spec at
`e2e/sw/sw-lifecycle.spec.ts`) that is separate from the default Playwright
config on purpose: the SW is opt-in at *build* time, so these specs need a
`VITE_ENABLE_SW=1` build while the default harness must keep building without
it, since its own spec pins the dark default. It is not run in CI.

**WebGPU — a correctness harness, Phase 0.** The engine's blur has a WGSL
counterpart under `app/src/lib/webgpu/`, and
[ADR-030](adr/030-webgpu-runs-in-js-not-in-the-crate.md) (status: **draft**)
records why it runs in JS beside the engine rather than as `wgpu` inside the
crate. It is opt-in — `ih_webgpu=1` in `localStorage` — and what the opt-in
buys is a self-test: `main.tsx` installs `window.__ihGpuBlurSelfTest()`, which
compares the WGSL blur against the CPU reference. The Features panel can
probe for an adapter and show what it found.

**No pixel in the app goes near the GPU.** Not in preview, not in export, not
behind a flag — the only consumers of the WebGPU modules outside their own
tests are that self-test installer and the adapter probe. Anything describing
a shipped GPU accelerator is describing something that is not in this tree.

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

**Principle**: WASM processes pixels locally (fast, zero-latency, no
network round trip, works logged out). Convex stores metadata, edit
archives, and account
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

## The op-log pipeline (live since v7.36)

Shipped ON by default 2026-07-17 after the four-check A/B (flags-OFF
baseline vs flags-ON dimensions, plain-stroke round trip, AI round
trip). ADRs [003](adr/003-operation-log-undo.md) ·
[004](adr/004-tile-buffer.md) · [006](adr/006-render-cache-disposable.md)
· [012](adr/012-oplog-document-model.md) ·
[013](adr/013-oplog-undo-hash-fallback.md) ·
[016](adr/016-canvas-is-document-metadata.md) ·
[017](adr/017-tiles-compiled-into-shipped-wasm.md) — all Accepted.

- **What records:** the WASM (`--features tiles`, ADR-017) keeps a
  passive op log for single-CONTENT-layer documents. The base document
  is captured lazily at `snap()` (rebased while the log is empty, so
  unlogged setup edits like the artboard border are absorbed — the
  v7.33 fix); pixel ops record at commit points (`paint_up`, crop…);
  annotations are diffed at `recomposite()`. The Canvas artboard fill
  is document METADATA riding beside the ops, not a logged layer
  (ADR-016) — the default Canvas + Photo import is one content layer
  and fully in scope.
- **Undo:** `undo()`/`redo()` replay from the log only when the
  engine's composite FNV-hashes byte-identical to the log's; any
  unrecorded edit (clone stamp, filters, masks, layer ops) fails the
  hash, marks the log broken, and snapshot undo takes over untouched
  (ADR-013). No stage can strand the editor.
- **Persistence:** `oplogPersistence.ts` debounces ~2s after each
  flush and commits op chunks + PNG keyframes (engine codec,
  byte-exact) + a manifest in one Dexie transaction. Restore replays
  from the base keyframe and rebuilds the Canvas from metadata; a log
  that stops describing the document is marked stale and the working
  copy — which never stopped writing — carries the resume (ADR-006).
- **Kill switches:** `localStorage` `ih_tiles_flush` / `ih_oplog_undo`
  / `ih_oplog_persist` = `"0"` disables each per profile;
  `USE_OPLOG_PERSISTENCE` in `app/src/lib/dexie/flags.ts` is the
  build-time revert. Per ADR-017's pre-mortem these stay until the
  codec has real production mileage.

---

## Planned (not yet in the diagram above)

Nothing in this section is live in a default build. The two entries that used
to sit here both claimed less than the tree contains, so the list is now
shorter and the "in the tree but dark" cases have moved up to
[their own section](#two-things-in-the-tree-that-no-pixel-goes-through) where
they can be described accurately.

- **Tool registry (Stage 4), the routing half** — `ToolModule` and
  `TOOL_MODULES` exist and five tools are registered, but nothing routes
  through them: the `ToolsSidebar` `activeTool` switch, the keyboard
  shortcuts and the persistence keys are still hand-wired, and `AppShell.tsx`
  still imports seven tool hooks directly. What remains is the migration
  itself — one tool per session, emoji first as the reference
  implementation, clone stamp last. See
  [ADR-002](adr/002-tool-module-registry.md) and the
  `tool-module-migration` skill.
- **Service worker Phase 3 (installable PWA)** — genuinely unstarted. Phases
  1 and 2 are written and ship dark; see above for what that means and how
  to build with them on.
- **WebGPU on a pixel path** — the blur has a WGSL counterpart and a
  self-test that says it agrees with the CPU reference. Nothing consumes it.
  [ADR-030](adr/030-webgpu-runs-in-js-not-in-the-crate.md) is still **draft**,
  and it is the decision that would have to be Accepted first.
