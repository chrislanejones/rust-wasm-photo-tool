# ADR-074 — Combine lives in Review, and a placed object is another selection producer

- **Status:** Draft
- **Date:** 2026-09-28
- **Deciders:** Chris
- **Supersedes:** —            <!-- amends ADR-066's placement note only -->

## Context

`Combine` — New selection / Add / Subtract / Intersect — arrived with ADR-066
as "a standing Combine group" on the **Select panel**, next to Tolerance and
the six selection modes. Three facts about the system make that placement
wrong, and all three were true before this change rather than caused by it:

1. **It is not a Select-tool setting.** The engine field it writes
   (`selection_combine`, consumed by `apply_produced_selection`) is read by
   every producer — the three click kinds, the lasso's close, and both
   marquees. Nothing about it is scoped to the tool whose panel held it.
2. **It was unreachable from anywhere else.** A tool panel is visible only
   while you hold that tool, so the standing choice could not be read or
   changed while painting, cropping or placing shapes. In practice people knew
   "add" only as Shift, which is the modifier override, not the mode.
3. **Review is where the selection's neighbours already are.** History (the
   steps a combine pushes), Layers (what a selection becomes via Ctrl+J) and
   Reselect (every placed text and shape) are all one panel, 260px wide, and
   Combine belongs beside them.

The third fact creates the second decision. Review's Reselect list is the other
kind of thing a user can point at, and a control that lives beside it and says
"Add" has to mean something when you point at a shape — otherwise the move
trades one wrong placement for a section that ignores half its own panel.

Two constraints bound how far this could go. **The wasm is byte-pinned**
(ADR-046: `netlify.toml` asserts an exact hash, reproduced by CI), so a new
engine export costs the release its size assertion — which makes a TS-only
change strongly preferred, exactly as `lib/annotationHitTest.ts` documents for
the same reason. And **AppShell is line-pinned** (ADR-042, `max-lines: 3564`,
error not warning), so "thread two more props" is not available either.

## Decision

**Combine is the fifth section of the Review panel, and a placed object is one
more selection producer.**

The strip moves verbatim — same `ToolButtonGroup segmented`, same four modes in
the same order, same `selectionCombine` store field, same
`set_selection_combine` call — so every gesture path keeps combining exactly as
it did and the modifier overrides are untouched. It is the fifth toggle, after
Histogram, and like Histogram it **starts closed**; the panel's existing
"at most three open" rule is unchanged.

Under the strip is the same object list Reselect shows, with one job instead of
five: **clicking a row combines the area that object covers.** That is the
whole of "an object is a producer" —

- the object's **footprint** is its bounding box, padded by half the stroke
  (where the ink is), or the **ellipse inscribed in it** for a circle (kind 1)
  and the legacy hand-drawn circle (kind 3);
- the footprint is handed to the marquee producer the engine **already has**:
  `ellipse_select` for those two kinds, `rect_select` for everything else;
- so New / Add / Subtract / Intersect, the marching ants, the coverage readout
  and the undo step are the ones a marquee drag already produces, and nothing
  downstream learns the region came from a shape.

Three supporting decisions, each load-bearing:

- **Bounding-rect, not mask-shaped.** The same decision
  `useCopyRegionAction` already states for the same objects, so Ctrl+C over a
  shape and Combine on that shape's row agree about what the shape covers.
- **Geometry is read from the ENGINE at click time**, not off the panel's row
  (`objectFootprint`). A row that has not re-rendered since a nudge, an undo or
  a Place would otherwise combine the box the shape used to have.
- **The panel reaches the session hook through a store nonce**
  (`combineRequest`), the channel `refineRequest` opened for this exact problem
  in ADR-069. The Review panel has no engine handle, and the alternative is two
  more props through AppShell, which its own ratchet refuses.

New files: `app/src/lib/objectSelection.ts` (pure geometry + the engine read)
and its test; `ReviewPanel.combine.test.ts`. **No Rust change**, so the wasm
byte count does not move.

## Alternatives considered

- **Leave Combine on the Select panel and add a second copy in Review.** Two
  controls writing one store field is the "a rule three surfaces re-derive is a
  rule they eventually disagree about" pattern this repo keeps paying for —
  and the Select panel's copy would still be invisible from every other tool,
  so the reason for the move would survive the move.
- **True vector booleans on the shapes themselves** (union two rects into one
  shape). This is what "Combine" means in a vector editor, and it is a real
  feature — but it is path arithmetic in Rust (a new export, a new
  `ShapeAnnotation` kind, a wasm size change against a pinned hash) and it
  answers a different question: the shapes stay shapes and the *selection* is
  what the rest of the app acts on. Deliberately out of scope; if it lands
  later it is a Shapes-panel feature, not this section.
- **Rasterize each shape's real ink to a mask in JS** and push it through
  `selection_union` / `selection_subtract`. Buys the outline instead of the
  box, and costs a THIRD definition of shape geometry in TypeScript (after the
  engine's and `annotationHitTest`'s) — including sloppiness wobble, arrowheads
  and pin labels, all of which would have to stay pixel-identical to
  `drawing.rs` forever. `annotationHitTest.ts`'s header is the argument
  against; its duplication is known, dated and has a stated expiry, and this
  would have neither.
- **A new `object_select(kind, id, mode)` export in Rust.** The tidiest
  version, and the one that fixes the history label below. Rejected for now
  only on cost: it moves the wasm byte count and so costs the release its
  `netlify.toml` hash assertion (ADR-046) for a cosmetic gain. It is the right
  change for the next session that rebuilds the engine anyway.
- **Multi-select the rows, then one Apply.** More capable, and it needs a
  second selection model (which rows are ticked) layered over a list that
  already has a selection meaning in Reselect. Clicking rows one at a time in
  Add mode reaches the same result through the model the canvas already uses:
  each gesture combines with the standing mode.

## Pre-mortem (mandatory)

**It is March 2027 and a user reports that combining a shape DESELECTED
everything.** The most likely path: a shape whose box has zero area on one
axis — a horizontal line, a flat arrow, a degenerate drag. `rect_select` snaps
outward from a zero-height rect to a zero-height mask, and the engine reads an
empty marquee in replace mode as Photoshop's empty-marquee *deselect*. The user
clicked "combine this line" and lost their selection.

Mitigated in the Decision by the stroke pad: `inkPad` floors at ½ px, so no
footprint can be zero on either axis, and `objectSelection.test.ts` pins the
horizontal-line case by name. `objectFootprint` returning `null` (a deleted id,
an object on another layer, a text tile with no area) also does *nothing*
rather than sending an empty marquee.

**The second failure, and the likelier one to go unnoticed:** the footprint
drifts from the ink. A future shape kind draws outside its bbox (a callout tail,
a long arrowhead), or the engine's own padding rule changes, and Combine quietly
selects the wrong region — no error, no test, just a selection that is subtly
too small. The mitigation is that this module reads only `x0..y1` and
`stroke_width` from the engine's own JSON and derives nothing else, so it can be
wrong only in the one documented way (box, not ink) rather than in a new way.
**Warning sign:** a diff that adds a shape kind to `ELLIPSE_KINDS`, or a second
rasterization of a shape into a mask anywhere in `app/src`.

Reversibility: the whole change is TypeScript and one store field. Reverting it
puts the strip back on the Select panel; no engine call, no persisted state and
no document format is involved (`selectionCombine` and `combineRequest` are both
outside the persistence allowlist).

## Consequences

- The standing Combine mode is now reachable from every tool, which is the
  point. Its section starts closed, so nobody who was not looking for it pays
  for it.
- **KNOWN, ACCEPTED:** in New-selection mode the History step for an object
  combine reads **"Marquee"** — the label `rect_select` passes. The other three
  modes are named after the mode by the engine (`combine_label`), so they read
  correctly already. The fix is the rejected `object_select` export above.
- **The marching ants now draw whatever tool is held.** The first cut of this
  change left `AppShell`'s gate in place (`activeTool === "select"`, plus the
  Magic Eraser, which writes the same field), and a browser run showed what that
  costs: a combine made while holding Shapes changed the readout and the status
  chip and put nothing on the canvas. The gate is gone; `selectionMask` reaches
  `<SelectionOverlay>` for every tool. **The trade, decided by Chris on
  2026-09-30:** the engine does not clip a paint, stamp or eraser stroke to the
  selection (`src/paint.rs` touches it only for the Magic Eraser's own mask), so
  ants under the Paint brush show a selection that the brush ignores. A visible
  selection that does not constrain the brush was judged better than an
  invisible one that exists. Clipping strokes to the selection is the follow-up
  that would make the two agree. `e2e/review-combine.spec.ts` pins the ants
  under the Shapes tool; AppShell's `max-lines` cap follows the file down
  3564 → 3540.
- **Ellipse fidelity is per-kind, not general.** A circle selects a circle; a
  diamond, a star and a bézier select their boxes. The section's lightbulb says
  so out loud rather than letting a user discover it.
- The Select panel is shorter by one section, and each of its six mode
  lightbulbs now says where Combine went. `SelectSettings.states.test.ts`'s
  Combine cases moved to `ReviewPanel.combine.test.ts` rather than being
  deleted.
- Two pinned numbers moved deliberately: `accessibleNames.test.ts`'s "Close
  section" count 3 → 4, and `engineAsyncMigration.contract.test.ts`'s awaited
  sites +2 (158 → 160 as written; 173 → 175 after merging master's own bumps) — the `rect_select` / `ellipse_select` pair in
  `useSelectionActions`, twins of `handleMarqueeCommit`'s. `objectFootprint`'s
  two annotation reads are awaited too but do not appear in that count: it
  takes the handle as a typed PARAMETER, which the audit's receiver regex
  cannot see (its own "KNOWN REMAINING GAP" — the count is a floor). That
  file's convention is a paragraph per bump; this one gets a pointer here
  instead, because the file is AT its `max-lines` cap and that ratchet only
  ever goes down.
- AppShell gains no props and no state — its only change is the overlay gate
  above, which made it shorter. The next person adding a Review section should
  use the same store-nonce
  channel rather than reaching for props.
