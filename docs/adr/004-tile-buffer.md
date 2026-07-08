# ADR-004: 256×256 tiles become the canonical image representation
Date: 2026-07-02 (backfilled)   Status: draft

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
