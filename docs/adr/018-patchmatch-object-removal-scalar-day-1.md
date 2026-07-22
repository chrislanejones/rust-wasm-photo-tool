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

## Follow-up: day 2 (rayon) REJECTED — 2026-07-19
The parallel NNF rewrite this ADR anticipated was built, measured, and
thrown away. It lives unmerged on `perf/patchmatch-rayon`
(`c6b5399` implementation, `520f6b3` bench) and is kept deliberately —
a recorded negative result, not dead weight. Do not delete the branch,
and do not re-attempt the same shape.

**Result: 8–31× SLOWER than the scalar kernel, while byte-identical in
output.** The anti-diagonal wavefront is correct — same pixels, same
seed, same answer — so this is not a bug to fix. The cost is structural:
per-row rayon dispatch on a kernel whose inner work is small relative to
the join overhead, and it does not tune away. The slowdown is fixed-cost,
so it is worst exactly where the kernel is already fast.

Consequences for this ADR: the "slow on real photos until day-2 rayon"
consequence above **no longer has a day-2 remedy**. Fill speed now rests
entirely on day 3's multi-resolution pyramid, which is also the more
likely fix for fill *quality* — a single-resolution kernel is what makes
a large hole look smeary, and the pyramid addresses both. Nothing should
build on an assumed parallel speedup.

The pre-mortem's early-warning sign was, separately, borne out: the
interactive fill-quality check it asked for still has an untested case —
a generous full-object mask. The X-stroke tried so far masks a fraction
of the object and so copies the object back into the hole, which is
worst-case input, not a verdict on the kernel. No pyramid verdict should
be recorded until that generous-mask test runs.

Also found while investigating, still open: `remove_object` returns
`false` silently when `composite_cache` is cold — a real latent bug,
independent of fill quality.
