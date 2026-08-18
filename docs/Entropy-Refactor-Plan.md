# Entropy Refactor Plan — dead code + drift, measured 2026-08-18 (v8.53)

An audit-with-a-plan, in the tradition of the (untracked) `docs/internal/`
entropy reports. Every "dead" claim below was verified by hand against all of
`src/`, `benches/`, `app/src/`, `e2e/`, `tests/` and `spike/` — not taken from
a tool. Fallow can't see the Rust/SIMD side at all, and rustc can't see it
either for anything `pub` in a `pub mod` (the crate is `rlib` + `cdylib`, so
those items are "externally reachable" and the `dead_code` lint stays silent).
That blind spot is where most of the findings live, and Phase 2 exists to
close it permanently.

## Baseline (what grew since the 2026-07-30 report)

| File | 2026-07-30 | Today | Note |
| --- | --- | --- | --- |
| `app/src/app/AppShell.tsx` | 3,314 LOC / 89 imports | **3,701 LOC / 108 imports** | grew again *while being dismantled* |
| `app/src/features/canvas/CanvasArea.tsx` | 2,493 LOC (2,102-line fn) | **2,946 LOC** — the `forwardRef` body at `CanvasArea.tsx:424` is now ~2,500 lines | accelerating, still nobody's target |
| `src/lib.rs` | — | **5,245 LOC**, 123 `pub fn` | the wasm API + glue, all in one file |
| `app/src/hooks/useCloneStamp.ts` | 229 | 296 | the v7.49 split is still holding |
| `app/src/hooks/useMoveLayerTool.ts` | 89-line triplicate member | 81 LOC, thin callbacks | the triplicate got fixed — record it |

`cargo check --all-features`: zero warnings. That is not cleanliness — it is
the lint's blind spot (see Phase 2).

## Phase 1 — delete the verified dead items

### Rust

| Item | Where | Evidence |
| --- | --- | --- |
| `fill_rounded_rect` | `src/drawing.rs:214` | `#[allow(dead_code)]`, zero callers; only a doc-comment mention at `drawing.rs:293` |
| `fill_triangle_public` | `src/drawing.rs:406` | `#[allow(dead_code)]`, zero callers (the private `fill_triangle` it wraps is live) |
| `ImageHorseTool::oplog_keyframe_rgba` | `src/lib.rs:1949` | superseded by `oplog_keyframe_pixels_rgba` (`lib.rs:1993`) and `oplog_keyframe_png` (`lib.rs:2012`); `app/src/lib/oplogPersistence.ts` calls only those two — zero JS callers for the composite variant |
| `TileBuffer::is_dirty` | `src/tiles.rs:55` | zero callers anywhere, including tests |

**Not dead — fix the annotation instead:** `edges::is_wall`
(`src/edges.rs:137`) is called from `src/paint.rs:224`; its
`#[allow(dead_code)]` says "temporary: the Smart Brush lands in the next
commit" — it landed. Delete the `allow` and the stale comment sentence.

**Demote, don't delete** (used only by same-file tests; shrinking their
visibility lets `dead_code` guard them from now on):

- `OpLog::replay_document` (`src/ops.rs:1381`) — only caller is the test at
  `ops.rs:2066`, but it is the documented gold-gate helper; `pub(crate)`.
- `TileBuffer::tile_count` (`src/tiles.rs:118`) — same-file tests only.

### TypeScript / TSX

| Item | Where | Evidence |
| --- | --- | --- |
| `TabGroup` — **the whole file** | `app/src/components/TabGroup.tsx` | never imported, never rendered, anywhere |
| `activeModeOf` | `app/src/features/tools/toolModes.ts:192` | zero callers (the file's other exports are heavily used) |
| `useActiveMode` | `app/src/features/tools/toolModes.ts:201` | zero callers |
| `allToolModes` | `app/src/features/tools/toolModes.ts:242` | zero callers |
| `__resetGpuProbe` | `app/src/lib/webgpu/detect.ts:92` | test-reset helper no test uses |
| `__resetEncodeSupportCache` | `app/src/lib/encodeSupport.ts:45` | test-reset helper no test uses |
| `CAPTURE_REPLY` | `app/src/lib/engine/captureMarshal.ts:56` | the protocol actually uses the boolean `r.capture` flag (`workerClient.ts:239`); nobody references the constant or the string. Its doc comment describes wiring that does not exist — delete both |

**Unexport (alive, but same-file-only):** `webgpuAvailable`
(`lib/webgpu/detect.ts:40`, used at `:58`), `formatAuditBytes`
(`lib/contentAudit.ts:479`, aliased at `:491`), `MultiTabCard`
(`components/MultiTabScreen.tsx`, rendered at `:53`).

### Decide, don't blind-delete (the missing-wire class)

Last month's paid-tier bug was a zero-reference export that was really a
missing wire. Two findings match that signature exactly:

1. **`resize_pixels_filter`** (`src/lib.rs:3764`). Zero callers in app, e2e,
   tests, benches, spike — but its doc says the SIMD benchmark harness times
   it, and `docs/Change-summary.md` (v-something, row 4) says "used by the
   bench". No such harness exists in-tree. Either wire the batch-logo /
   Power-Resize path through it (it is the *better* resizer — Catmull/Lanczos
   vs. the bilinear `resize_pixels` the app actually calls), or delete the
   export. Deleting changes the shipped wasm surface; wiring improves output
   quality. **Recommendation: wire it in `BatchSettings.tsx` (the
   `resizePixels` injection point at `BatchSettings.tsx:145`), else delete.**
2. **`DESCRIBE_TOKENS`** (`app/src/lib/describeImage.ts:49`). Comment says
   "Tokens the Name-pattern field understands, for the panel's help text" —
   but the Rename panel (`BatchSettings.tsx:788-794`) hand-writes only
   `{name}` / `{n}` and never mentions the seven AI-describe tokens the
   renamer accepts. Dead export *or* missing help-text wire; the drift the
   constant was built to prevent is happening in its absence.
   **Recommendation: wire it into the `SectionHeader info` prop; else delete
   and inline the two tokens.**

### Verified alive — so the next audit doesn't re-derive them

- `useToolStore`'s six mode tuples (`BRUSH_MODES`, `STAMP_SUB_MODES`,
  `SHAPES_MODES`, `ERASER_MODE_VALUES`, `TEXT_MODES`, `BATCH_MODES`) and
  `MASTER_TABS` (`useUIStore.ts:34`, used at `:294`) — the persist-`merge`
  validation pattern. Fallow's standing false positive; teach `.fallow`.
- Every SIMD kernel: all 16 public functions in `src/simd/{blur,color,resize}.rs`
  have live call sites in `filters.rs`, `transform.rs`, `selection.rs`,
  `layer.rs`, `lib.rs`. Nothing to cut there.
- `blur.rs::horizontal_row`/`vertical_row` — `threads`-feature row kernels,
  used by `blur_*_parallel` and `benches/blur_threads.rs`.
- The Zustand stores are clean: every state key and action on all seven
  stores has external callers (only `useGuidesStore._counter` is
  same-file, and the underscore already says so).
- `gpuBlurSelfTest` chain is live via `installGpuBlurSelfTest()` at
  `main.tsx:25` (a window-hook diagnostic).
- `capture.rs` structs (`RgbaCapture`, `PenHit`, …) and `perspective::Warped`,
  `text::RenderedText` — named-reference scans miss them because callers get
  them by inference; they are return types of live functions.

## Phase 2 — make the compilers do fallow's job on the Rust side

The reason this audit had to be manual: `pub` items in the `pub mod`s
(`ops`, `tiles`, `filters`, `simd`, `patchmatch`, `perspective`) are exempt
from `dead_code` because benches link the rlib. Fix the visibility so the
exemption only covers what benches genuinely import
(`ops::{Brush, LevelsParams, Op, OpLog, Rect, Rgba}`, `tiles::TileBuffer`'s
live surface, `filters::build_gaussian_kernel`, `simd::blur` row kernels):

- `src/ops.rs`: `encode_op` (`:531`), `decode_op` (`:559`),
  `default_quad_if_unset` (`:237`) → `pub(crate)` — their only callers are
  `encode_op_frames`/`decode_op_frames` and lib.rs-internal paths.
- `src/history.rs`: `undo_bytes` (`:100`) → private (only `:112` uses it).
- After the demotions, `cargo check --all-features` becomes the Rust-side
  dead-export tripwire — for free, on every CI run. Add
  `cargo check --all-features -- -D dead_code`-equivalent
  (`RUSTFLAGS="-D dead_code"`) to the guardrails script once the tree is
  clean, so a new stranded export fails instead of idling.
- Rule for new code: a `#[allow(dead_code)]` must carry a date and a
  removal condition (the `is_wall` allow rotted precisely because its
  condition ("next commit") was met and nothing forced the cleanup).

On the TS side: the one-liner scan that produced this report (export-name ↔
reference cross-check, engine-export ↔ JS-callsite cross-check) belongs in
`scripts/` next to `engine-call-audit.mjs` — call it
`scripts/dead-exports-audit.mjs`, run it in the same place guardrails run,
and encode the persist-tuple exception so it stays quiet on the known-good
pattern.

## Phase 3 — turn on the ratchet (the PARKING_LOT item, now with its baseline)

`eslint.config.mjs` deliberately holds `max-lines` off pending "a recorded
baseline to ratchet down from". This document is that baseline:

- `max-lines`: warn at 900, with per-file overrides pinned to today's sizes
  for the four legacy giants only — `AppShell.tsx` (3,701),
  `CanvasArea.tsx` (2,946), `BatchSettings.tsx` (1,428),
  `useDrawingTools.ts` (1,160). Any *other* file crossing 900 is a new
  AppShell being born — that is the tripwire firing, not noise.
- Ratchet rule: whenever a Phase-4 extraction lands, lower that file's
  override to its new size in the same commit. Numbers only go down.
- Rust twin: the guardrails script should fail if `src/lib.rs` exceeds its
  current 5,245 lines — extractions there follow the extension-`impl`
  pattern `annotations.rs`/`capture.rs`/`selection.rs` already use.

## Phase 4 — the structural work (ordered by risk-adjusted payoff)

1. **`CanvasArea.tsx` first, not AppShell.** It was "the finding nobody was
   looking for" two audits ago, is still accelerating, and its ~2,500-line
   `forwardRef` body (from `CanvasArea.tsx:424`) with 27
   `useEffect`/`useCallback` sites is one hurricane away from unmergeable.
   Extract along the seams that already have names: `arrowGeometry`
   (`:282`), `handCirclePath` (`:325`), `getCursorForSubTool` (`:390`) are
   already free functions — the effects clustered around pointer routing,
   overlay drawing, and cursor management go to
   `features/canvas/hooks/usePointerRouting.ts`, `useOverlayPainting.ts`,
   `useCanvasCursor.ts`, mirroring how `useCanvasCoords.ts` was cut loose.
   Behaviour-preserving by construction: same callbacks, same dep arrays.
2. **AppShell stage-3**: it grew 387 lines and 19 imports since the last
   report *during* its own dismantle, so extraction has to outpace accretion
   or stop pretending. The 84 `useEffect`/`useCallback` sites and 108-import
   fan-out say the remaining mass is wiring; the next slices follow the
   stage-1/2 playbook (state → stores like `useUIStore`, effects → session
   hooks like `useImageSession`).
3. **`src/lib.rs` (5,245)**: keep the wasm surface, move flesh. The stateless
   free functions (`describe_image`, `resize_pixels*`, `encode_png_pixels`,
   `decode_png_to_rgba` — the block around `lib.rs:3740-3800`) and the oplog
   persistence surface (`lib.rs:1860-2070`) are both already coherent
   chunks; give each the `annotations.rs` treatment (own file, extension
   `impl` / free fns, lib.rs keeps only `mod` lines).
4. **`BatchSettings.tsx` (1,428)**: five independent panels share one file;
   split along the `SectionHeader` boundaries (Resize / Rename / Logo / …)
   the way `features/tools/settings/` already houses one file per concern.
5. **`useDrawingTools.ts` (1,160) / `useEngineCore.ts` (878)**: known risk
   files from the last report; hold until 1-4 land — touching them while
   CanvasArea still owns the pointer pipeline doubles the blast radius.

## Order of operations & verification

Phase 1 and 2 are one PR each, behaviour-preserving, verifiable by:
`cargo test --all-features` + `cargo check` staying warning-free,
`pnpm --filter stamp-tool test`, `pnpm lint`, and — because two deletions
touch the wasm export list — a `build:wasm` + grep of `pkg/stamp_tool.d.ts`
confirming only `oplog_keyframe_rgba` (and `resize_pixels_filter`, if the
delete branch is chosen) disappeared. Phase 3 is config + this baseline.
Phase 4 is one extraction per session, ratchet lowered in the same commit,
exactly as the Refactor-Playbook prescribes.

## Addendum — twiggy size profile (2026-08-18)

Run against a fresh `cargo build --release --target wasm32-unknown-unknown
--features tiles,patchmatch` with `CARGO_PROFILE_RELEASE_DEBUG=limited` so
twiggy can attribute bytes (the debug sections that adds are 86% of the raw
7.4 MB file and are exactly what `twiggy garbage` flags; the real payload is
**714 KB of code + 194 KB of `.rodata`**, pre-wasm-bindgen/wasm-opt).

**Verdict: no size crisis.** `twiggy garbage` finds nothing but strip-able
custom sections; `twiggy monos` tops out at ~3 KB of drop glue — the
monomorphization bloat that usually plagues wasm crates isn't here.

Per-crate code budget: `stamp_tool` 38.3%, `ttf_parser` 13.5% (~97 KB — the
text tool's font stack, retained via `Face::parse` at 28 KB +
`rasterise_line` at 49 KB), `core` 8.7%, `png` 7.5%, and ~6% split between
`miniz_oxide`/`fdeflate`/`flate2` — two deflate implementations, but both
are the `png` crate's own choices (fdeflate decode, flate2 encode), not an
accident to fix. Biggest single dominators: `codec::decode_png` 58 KB
retained, `text::rasterise_line` 49 KB, `codec::export_png` 41 KB.

What this changes about the phases above:

- **The Phase-1 Rust deletions are hygiene, not bytes.** `fill_rounded_rect`,
  `fill_triangle_public` and `TileBuffer::is_dirty` do not appear in the
  binary at all — LTO already eliminated them. The two dead *exports* do
  ship, but tiny: `oplog_keyframe_rgba` retains 472 B (+58 B describe shim),
  `resize_pixels_filter` 310 B (+142 B) — their bodies are shared with live
  code. Delete them for API-surface truth, not for the sentinel band.
- The only real size levers, if one is ever needed, are structural:
  the font stack (~97 KB, priced into having a text tool) and the PNG
  codec pair (~100 KB, priced into engine-side encode/decode per ADR).
  ~11 KB of `flt2dec::strategy::dragon` float formatting rides in on the
  JSON-string surfaces (`get_layers`, `describe_image`) — noted, not worth
  chasing.
