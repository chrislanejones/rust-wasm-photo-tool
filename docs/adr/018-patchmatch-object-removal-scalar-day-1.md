# ADR-018: PatchMatch object removal ships as a scalar, single-resolution kernel behind a flag
Date: 2026-07-18   Status: Accepted (2026-07-18 — Chris looked at the fill
on a real canvas with `ih_patchmatch` on and confirmed it worked; merged
to master with the flag staying OFF, dogfood before defaulting)

## Context
Remove Object needs to reconstruct a masked region from the surrounding
image. The existing selection machinery (wand / edge-aware / color-range /
lasso, v7.23) already produces `Option<Vec<bool>>`; nothing else in the
engine can fill a hole from context. `edges.rs`'s cost map (livewire) is not
required — classic Barnes et al. PatchMatch works on raw patch-to-patch
distance with no edge term. Rayon is available (ADR-011, COOP/COEP
confirmed live) but a parallel rewrite before a correctness baseline exists
is the wrong order.

## Decision
A scalar, single-resolution PatchMatch nearest-neighbor field
(`src/patchmatch.rs`): random init, 5 iterations of propagation + random
search, 7×7 patches, a seeded in-file PRNG (no `rand` dependency). Feature-
gated end to end — Cargo feature `patchmatch` (empty, no deps) + JS flag
`ih_patchmatch`, both OFF by default, same shape as `tiles`. `remove_object()`
(src/selection.rs) calls `self.snap("Remove Object")` and deliberately does
NOT call `oplog_record` — the result is a history keyframe, not a replayable
op, following the `rotate_90_cw` / `resize_canvas` / `set_artboard_border`
precedent: the kernel's random search makes exact replay dishonest to
promise, and the op-log's own hash sync check (ADR-013) safely retires
op-log undo to snapshot undo if it was active.

## Consequences
+ A real, tested, gated object-removal kernel exists (19 unit tests:
  never-points-into-the-hole, deterministic-with-fixed-seed, degenerate
  masks, flat-color convergence) with zero risk to the default build —
  `patchmatch` off compiles the module out entirely; wasm size is
  byte-count-identical to the 733,842 B baseline until Task C's export.
- Slow on real photos until day-2 rayon; day-1 scope is deliberately a
  small image. Single-resolution fill will look smeary on anything but a
  small, simple hole until day-3's multi-res pyramid.
- Heaviest kernel in the project so far (947 lines); the wasm-on cost was
  measured at +6,585 B (+0.90%) once `remove_object` becomes a reachable
  `#[wasm_bindgen]` export.

## Alternatives rejected
1. **Reuse the AI Remove Background/Inpaint Replicate pipeline instead** —
   requires sign-in + Paid tier + network; the whole point is a free,
   local, no-sign-in removal path.
2. **Build rayon in from day 1** — correctness-first was rust-craft's own
   guidance; parallelizing an unverified kernel just moves the bug into a
   harder-to-debug shape.
3. **Multi-resolution pyramid from day 1** — day-1 goal was a correct
   visible result, not a polished one; the pyramid is additive later.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: nobody
ever ran the interactive fill-quality check the day-1 brief called for
("no headless agent can judge" the fill) before more days of work stacked
on top — day 2's rayon rewrite and day 3's pyramid both assume the day-1
core actually looks right on a real photo, and if it silently doesn't, two
more days get built on a wrong foundation before anyone notices.
Early warning sign: Remove Object shipping (even flag-off, even to
dogfooders) without a recorded "I looked at the fill and it's plausible"
confirmation from Chris in this ADR or SESSION_LOG.

---

## Arc progress — day 2 (2026-07-19): rayon parallelisation attempted, REJECTED on performance

Recorded here rather than as a new ADR: this changes nothing about the
day-1 Decision above, it closes out a planned follow-up with a negative
result. Branch `perf/patchmatch-rayon` (unmerged, `~/ai-repo/ih-rayon-nnf`).

**What was built and what held up.** `compute_nnf_parallel` /
`fill_from_nnf_parallel` / `inpaint_parallel`, behind the existing v7.15
`threads` feature (no new dependencies). The obvious approach — prev/next
buffer pair plus `par_iter` over rows — was rejected during design because
it is a Jacobi rewrite and could never match the scalar in-place
Gauss-Seidel scan byte for byte. Instead: a wavefront over anti-diagonals.
A forward-pass pixel reads only (x-1,y) and (x,y-1), both on diagonal d-1,
so processing diagonals in sequence while parallelising within a diagonal
shows every pixel exactly the state the scalar scan would have. That
worked: output is byte-identical to scalar structurally rather than by
tolerance, proven at pinned pools of 1/2/4/8 threads across 7 fixture
geometries, and the flag-off wasm stayed byte-count-identical at
734,054 B.

**Why it is rejected anyway.** It is 8-31x SLOWER than scalar (native
criterion, 22 cores, 20% centered hole, seed 42):

| size  | scalar     | rayon parallel | ratio            |
| ----- | ---------- | -------------- | ---------------- |
| 256²  | 49.33 ms   | 1,519.1 ms     | **30.8x slower** |
| 512²  | 224.3 ms   | 3,807.7 ms     | **17.0x slower** |
| 1024² | 1,033.7 ms | 8,620.9 ms     | **8.3x slower**  |

The wavefront is what buys correctness and is also what kills throughput:
a 256² image with a 20% hole yields ~227 anti-diagonals of ~114 px, so a
single `remove_object` pays ~1,135 rayon dispatches-plus-barriers, each
guarding ~114 px of work — roughly 1.3 ms of overhead per dispatch,
consistent with waking a 22-thread pool to give each worker ~5 pixels.
The ratio improving with size is fixed cost amortising, not an approaching
break-even; no realistic photo size reaches parity, so this is not a
threshold-tuning gap (`PAR_DIAGONAL_MIN = 4` would need to be in the
thousands, i.e. always-scalar).

**Consequences of this finding**
+ The byte-identity test harness and the fixture set are reusable by any
  future attempt, and are worth keeping regardless of the parallel code.
+ The Jacobi-vs-Gauss-Seidel analysis is now written down, so nobody
  re-proposes the "obvious" row-parallel version without knowing it
  cannot preserve output.
- Day 2 delivered no speedup; Remove Object remains slow on real photos,
  and the day-1 Consequence "slow until day-2 rayon" is now known to be
  wrong — the fix has to come from somewhere else.
- ~540 lines of correct-but-slower-than-useless code exist on a branch;
  merging it as-is would be a regression behind a flag, so it should not
  be merged as a performance change.

**Direction for day 3** (not decided here): bench the fill and the NNF
separately first — `fill_from_nnf_parallel` is a plain row
`par_chunks_mut` with no wavefront dependency and may be a win on its own
that this bench conflates away. Beyond that, the multi-resolution pyramid
reduces total work rather than spreading it and is likely the larger
factor; a coarser tile-parallel scheme is possible but changes output and
would need its own correctness story.

**Still open, unchanged:** in-browser threading needs COOP/COEP headers
shipped to production. ADR-009 confirmed `credentialless` works; the
headers have never been deployed. That remains a separate release
decision and was deliberately NOT made as part of day 2.

**Fill quality, per the pre-mortem above:** on 2026-07-18 Chris tried
Remove Object on a full-size photo (1385x2068) and the result was visibly
wrong — patches of unrelated colour pulled into a flat sky. That is the
day-1 Consequence "will look smeary on anything but a small, simple hole"
behaving exactly as documented, not a new defect, but it is the concrete
confirmation the pre-mortem asked someone to record: the single-resolution
kernel is not usable on real photos, and day 3's pyramid — not threading —
is the blocker for making it so.
