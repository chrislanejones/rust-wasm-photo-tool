# ADR-004: 256×256 tiles become the canonical image representation
Date: 2026-07-02 (backfilled)   Status: draft
Blocked on: wiring into the render path — not just merging the branch.
`src/tiles.rs` exists on `feat/tile-engine-core` (55/55 cargo tests
passing, verified 2026-07-09, cleanly rebased on v7.8/`d9960f6`) but is
gated behind an off-by-default `tiles` Cargo feature and is not part of
the wasm build; flat buffers remain the only representation the app
actually runs. Even if this branch lands on master (a decision in
progress in parallel), that is "merged," not "shipped" — this stays
Draft until something in the render/flush path calls into it.

## Context
Flat buffers make large images all-or-nothing: full-buffer flushes,
full-buffer saves, memory proportional to canvas size regardless of
what changed. Infinite canvas, dirty-rect rendering, and incremental
autosave all need sub-image granularity.

## Decision
TileBuffer: sparse HashMap of 256×256 RGBA tiles with dirty flags,
generation counters, and per-tile content hashes. Built behind a
cargo feature, proven by tests/benches before wiring into the render
path. Flat-buffer blit APIs preserve compatibility during migration.

## Consequences
+ Dirty-tile flush, incremental autosave, tile dedupe via content
  hashes; foundation for infinite canvas.
- Every kernel eventually needs a tile-aware path or a blit-through
  compromise; boundary-crossing strokes touch multiple tiles.
- Two representations coexist during migration.

## Alternatives rejected
Keep flat + dirty rects only — helps rendering but not memory,
persistence granularity, or canvas bounds.

## Pre-mortem
Mistake most likely because the flat↔tile blit compatibility layer
became permanent, paying both representations' costs indefinitely.
Early warning: new features writing through blit_to_flat "for now".
