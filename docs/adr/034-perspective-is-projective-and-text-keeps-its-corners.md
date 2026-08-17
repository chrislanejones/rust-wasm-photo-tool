# ADR-034 — Perspective is a projective warp, and text keeps its corners instead of its pixels

**Status: Accepted** 2026-08-17 (v8.42). Extends ADR-006 (op log) and ADR-033
(format v4). Fills the `perspective` slot that ADR-023 reserved as Coming Soon.
Supersedes nothing.

## Context

Chris, 2026-08-17, with a reference image of a Grand Wagoneer carrying two
quadrilaterals — a green one on the glass, a red one down the door with the
words "Text in Perspective" receding along it:

> time to add prespective tool - use the mutiple ui thing here to select
> between each prespective, make sure to use worker-engine and rust when
> possible - add to review --> history and reselect - tool works with vector
> items like text, just like in photoshop

The Edit group has held a `perspective` tile since the five-group restructure
(ADR-023), marked `comingSoon` with the note *"Perspective correction is not
built yet"*. Because a Coming Soon entry carries no `tool` **by type**, nothing
downstream had ever resolved a route or a palette entry for it, so switching it
on is purely additive — there is no legacy alias to retire.

Two decisions in the brief are load-bearing and easy to get wrong: what the
"multiple UI thing" selects between, and what "works with vector items like
text" actually demands of the storage format.

## Decision

**Ship one four-corner quad with three drag rules, surfaced as three group
sub-tools; resample pixels in Rust; and store a text annotation's corners as
NORMALISED fractions on the annotation itself rather than baking them into its
tile.**

Four parts, each chosen against a specific alternative.

**1. Three sub-tools, not three tools and not an in-panel row.** Distort,
Perspective and Skew are one quad and three rules about what happens to the
*other* corners when you drag one. They are registered as three entries in the
Edit group, all pointing at the single `perspective` ToolType and differing
only in `mode`.

The rejected alternative was one tile plus `ToolModeToggle`'s `showModeRow`
shim, and it is worth recording because it was BUILT FIRST AND SHIPPED BROKEN
into the first browser run. In this app a registered module's modes surface as
group sub-tools — Select's six kinds, Paint's four brushes, Resize's two modes
are all sub-tool tiles backed by one ToolType — because `SubtoolRow` renders
the *group*. A mode with no sub-tool of its own has nowhere to appear. The
single-tile version therefore had three working drag rules and no way to reach
two of them. `showModeRow` would have worked and is explicitly documented as a
migration shim not to reach for; the registry already had the right shape.

**2. The drag rules live in TypeScript; only resampling is in Rust.** "The
engine owns pixels" is a project invariant, and this does not violate it: a
drag rule maps one pointer position to four corner positions and touches no
image data. Since ADR-024 the engine is in a worker, so putting the rules
behind the port would add a `postMessage` round trip to every `pointermove` at
120–420 Hz — the banked-lag failure the brush arc spent five releases
removing. `src/perspective.rs` owns the homography solve and the resampler;
`app/src/lib/perspective.ts` owns the rules and a second copy of the solver for
the overlay's preview grid.

**3. A projective map, solved in the dst→src direction.** An affine 2×3 maps
parallelograms to parallelograms; it cannot make a far edge shorter than a near
one, which is the entire point. The homography's two extra terms are the
perspective divide. Resampling walks destination pixels asking "where did this
come from?", which normally means solving src→dst and inverting a 3×3 — instead
the solver is handed the correspondences the other way round, so there is one
solve, no matrix inverse and no second source of numerical error.

**4. Text corners are stored NORMALISED (0..1) on the annotation, and the warp
is the last stage of the tile pipeline.** This is what makes the tool vector
rather than a raster effect, and it is the decision with the longest tail.

A text tile is rebuilt from scratch whenever the words, font size, wrap width
or box height change, and it comes back a different pixel size each time.
Corners stored in PIXELS would drift — or fall off the tile entirely — the
first time somebody fixed a typo. Corners stored as fractions describe the
SHAPE, so the same quad re-applies to whatever the tile becomes. Verified in
the browser: forcing a rebuild that took the tile from 488×280 to 488×862 left
the stored quad bit-identical and re-applied it to the new geometry.

## Consequences

**Format v4 → v5, by ADR-033's recipe, for the third time.** Two APPENDED `Op`
variants (`TextPerspective`, `PerspectiveWarp`), a `#[serde(skip)]` field on
`TextParams`, and a sixth trailing element on the annotation tuple. A v4
document decodes with every quad at the identity. No Dexie `.version()` bump —
key paths are unchanged, ADR-031's precedent.

**⚠️ The skipped field's default is NOT its semantic default, and that is new.**
`wrap_width` and `box_height` both get away with `#[serde(skip)]` because their
skipped default (`0`) *is* their meaning ("size the box to the text"). An
all-zero QUAD is a collapsed point, not "no perspective" — the identity is.
`decode_op` therefore normalises `TextAdd`/`TextEdit` on the way in. Without
that step `oplog_sync_annotations` diffs a decoded all-zero quad against the
engine's identity, finds them unequal on EVERY sync, and appends a fresh
`Op::TextPerspective` each time: an op log that grows forever while the user
does nothing. Caught by `postcard_round_trip_every_variant`.

**⚠️ Two bugs got through every green gate and were found only by driving the
real thing.** This is the fifth time the arc records that shape.

The first: `targetBounds` is derived from the `annotations` PROP, which arrives
fresh from AppShell on every render. A new array identity meant a new frame
object even when every number was unchanged, so the seed effect re-ran
constantly and reset the in-progress drag to a rectangle. Apply then committed
the identity. `tsc` clean, 591 tests green, engine verified correct by hand
through the worker — and the feature did nothing. The effect now keys on a
primitive string, and that is load-bearing.

The second: once a warp is applied, the annotation's reported bounds are the
bounding box of the WARPED tile, while the stored corners are normalised
against the UNWARPED one. Denormalising onto the live bounds draws the handles
in the wrong place and — worse — a second Apply re-normalises against the
warped box and COMPOUNDS the transform, shearing further on every visit with no
way back. No engine round trip is needed to fix it: the warped bbox *is* the
bounding box of the stored quad, so the unwarped rect falls out of the two.

**Validity is checked before the snapshot, and rejects degenerate quads.** The
first version SKIPPED degenerate vertices rather than rejecting them, which let
a fully collapsed quad read as convex; the pixel path survived only because the
solver refused the singular system a moment later — after the caller had
already pushed a history step for a warp that never happened. The check is now
scale-free (the cross product is divided by both edge lengths, making it
`sin θ`), so one threshold serves a normalised quad in 0..1 and an absolute one
spanning thousands of pixels.

**One resampler, called by both the engine and replay.**
`perspective::warp_region_in_place` is the only implementation;
`ImageHorseTool::perspective_warp_region` and `Op::PerspectiveWarp` both call
straight through it, because `ops_engine_parity` asserts byte-identical output
and two hand-kept copies of a resampler would drift on rounding alone.

**The pixel path is a MOVE, not a stamp** — the source rect is cleared. That
matches Free Transform on a selection; leaving it would double the content on
every warp with no way to undo half of it.

**Review → History and Reselect came free, and that is the point.** The label
is the engine's own `snap("Perspective")` / `Op::label`, so both undo engines
agree by construction. Reselect already lists every live annotation; targeting
one loads its stored quad back from the engine, which is the source of truth —
this hook keeps no private copy that could drift from what was committed.
Measured round trip after leaving the tool entirely: 0.03 px, f32 precision.

**Shapes are NOT covered.** Only text warps non-destructively. A homography
maps straight lines to straight lines, so a rect's four mapped corners would be
exact and a polyline/arrow/pen path is just its control points — but a circle
becomes a conic and needs polygon approximation, and the shape render path has
no tile cache to warp. Named and deferred rather than half-built.

**Cost.** wasm 790,179 → 806,975 B (+16,796, +2.1%). Rust tests 266 → 275.
TypeScript tests 573 → 591. Awaited engine call sites 115 → 118, all born
awaited; the Stage-3.5 gate numbers (5 exempt / 0 unawaited / 0 truthy) are
unchanged.

## Alternatives considered

**A single "perspective crop" that rectifies a keystoned photo.** Narrower and
genuinely useful, but it is the inverse of what the reference image shows — the
brief is about placing content ONTO a receding plane, not straightening one.
Reachable later as a fourth rule over the same quad.

**Storing a 3×3 matrix instead of four corners.** Equivalent information, worse
ergonomics: the overlay would have to invert it to place handles, the op log
would carry nine floats instead of eight, and a matrix has no natural
normalised form, so it would re-acquire exactly the rebuild-drift problem
normalised corners solve.

**A `showModeRow` in-panel mode row.** See decision 1 — it works, and it
disagrees with every other multi-mode tool about where sub-modes live.
