# ADR-014: Magnetic lasso and Smart Brush both stand on one shared edge cost map
Date: 2026-07-13   Status: draft

## Context

v7.23 shipped the edge core (`src/edges.rs`): a Sobel magnitude map, consumed by
the edge-aware magic wand as a set of walls a flood fill may not cross. That same
release shipped a **disabled** Magnetic Lasso button, honest about why — "the
path-finding kernel is the remaining piece."

Two queued features want more than walls. The lasso needs to find a *path* along
an edge; the Smart Brush needs a *region* bounded by one. Both could have grown
their own gradient pass and their own idea of "where does this object stop" —
which is exactly how two features that should agree start disagreeing, and how
the same bug gets fixed in one place and not the other.

## Decision

Derive **one** primitive from the existing Sobel output — an **edge cost map**
(`edges::edge_cost_map`): strong edge = LOW cost, flat region = HIGH cost. It is
a pure function of the shipped magnitude; no second edge pass exists.

Both features are then a different *reading* of that one map:

- **Magnetic lasso** (`src/livewire.rs`) — live-wire/intelligent scissors. The
  minimum-cost 8-connected path between two anchors IS the path a human would
  trace, because edges are the cheap road. Dijkstra, **bounded to a window**
  around the segment (+32px margin, 250k-pixel ceiling), so cost tracks how far
  you dragged, not how big the image is. Closing the loop rasterizes it as a
  barrier and floods inward — reusing the wands' existing mask representation
  (`selection: Option<Vec<bool>>` + the same overlay RGBA).
- **Smart Brush** (`src/paint.rs`) — a region-grow from the dab centre over the
  same map, **bounded to the dab's bbox**, rolling back coverage the paint can't
  reach. O(dab area) per dab, not O(image).

Integer-only and totally-ordered, so both are **byte-stable**: same input, same
path, same mask, every run. Scalar — no rayon.

Both ship behind `ih_smart_edge` (localStorage, default OFF). With the switch
off the wands and the normal brush take their original code paths unchanged.

## Consequences

+ One definition of "an edge" across three tools (wand, lasso, brush). A tuning
  fix to the cost map improves all of them at once.
+ Interactive without threads: 1.0ms per path at a 64px drag, 5.6ms at 400px
  (native, 2048²), inside a frame budget. The window bound is what buys that.
+ The brush was nearly free to add once the map existed — the second consumer
  cost 6 tests and one containment kernel, no new edge work.

- The cost map is a `w*h` `u16` plane: ~8 MB held for the life of a lasso
  session on a 2048² image (freed on close/cancel), and rebuilt once per Smart
  Brush stroke (31ms on 2048² — a real hitch at stroke start on a big image).
- A large drag silently degrades to a straight line past the 250k-pixel search
  ceiling. Predictable, but it *is* the tool quietly stopping being magnetic.
- Per-image peak normalization means the same object can cost differently in two
  crops of the same photo. Deliberate (see below), but it makes the map's output
  a function of the whole image, not just the local neighbourhood.

## Alternatives rejected

- **A second gradient pass per feature.** The thing the edge core's own module
  doc warns against; two implementations drift.
- **Un-normalized invert of the magnitude.** A soft photo peaking at magnitude
  ~80 yields costs in 176..=256 — a 1.45× spread the path finder can barely see,
  so the wire cuts corners instead of hugging the edge.
- **Scanline/even-odd polygon fill for the lasso's mask.** Fragile on a dense
  pixel polyline with long collinear runs; the 8-connected-loop/4-connected-flood
  duality is exact and needs no special cases.
- **Contorting `flood_select` into the barrier fill** (`tol = 255` + boundary as
  edge map). It works, but it routes the shipped wands' fill down a path it never
  runs, to save twenty lines.
- **rayon now.** Browser threading is gated on a COOP/COEP check only a human can
  run (see ADR-009's spike and **ADR-011**, which owns the rayon kernels
  decision). The kernels are shaped for it — the per-segment path searches and
  the per-dab region-grows are bounded, independent work units — but this session
  ships scalar.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: **the cost
map's edge-vs-flat tuning turned out to be per-image, and one global map was the
wrong abstraction.** Peak normalization is a single scalar for the whole image —
fine for a product shot on white, wrong for a photo that is half blown-out sky
and half shadowed foreground, where the sky's hard horizon sets the peak and the
foreground's real edges normalize down into the noise. The wire then snaps
confidently to the horizon and ignores the object the user is actually tracing,
and the fix is local/adaptive normalization (per-tile, or a percentile instead of
a max) — which changes the map's contract and every test pinned to it. The
second-most-likely reason is the 250k ceiling: users drag further than I assumed,
hit the straight-line fallback constantly, and conclude the lasso is broken.

Early warning sign to watch for: **someone reports the lasso "only works on
simple images"**, or that it snaps to a strong background edge instead of the
object they're tracing. That's the normalization failing, not the path finder.
Second sign: the straight-line fallback firing in normal use — worth a counter
before it ships wide.
