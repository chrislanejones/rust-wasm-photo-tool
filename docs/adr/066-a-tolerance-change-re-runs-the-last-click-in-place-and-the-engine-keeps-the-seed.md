# ADR-066: A Tolerance change re-runs the last click in place, and the engine keeps the seed
Date: 2026-09-24   Status: draft   Amends: ADR-022 (the panel rule only)

## Context
Select's Tolerance slider only set the value for the NEXT click. The plan
wanted it live: drag the slider, watch the sky come in before the building.
A selection is an undo step through `snap_selection` (`src/lib.rs:687`), a
`selection_only` snapshot that the op log never records, and every producer
combines with the current selection through `set_selection_combine`
(`src/selection.rs:649`; 0 replace, 1 add, 2 subtract). A slider tick is not
a click, and nothing in the engine could tell the two apart.

## Decision
1. **The engine remembers the last click.** `SelectionRetune {kind, x, y,
   mode, label, snapped, generation}` (`selection.rs:248`) is set by
   `click_select` (`:408`), the shared body of wand / edge-aware / color
   range, and cleared by every other producer in `apply_produced_selection`
   (`:377`). New exports: `selection_can_retune()` (`:485`) and
   `selection_retune(tolerance, edge_threshold)` (`:499`).
2. **A re-run combines with the PRE-CLICK base.** If the click pushed a step,
   the base is the undo-stack top's selection; if it was a no-op, the base is
   the live selection, and the first re-run that changes anything pushes the
   one step the click did not. No step per tick.
3. **Validity is `History::generation`**, which moves on every push, undo and
   redo. Stack depth cannot tell "undo, then a new edit" from "nothing
   happened"; `undo_then_a_new_edit_at_the_same_depth_is_still_stale`
   (`tests/selection_retune.rs:206`) pins that case.
4. **The JS scheduler** (`app/src/lib/liveRetune.ts:41`): 70 ms debounce, at
   most ONE run in flight, ticks during a run collapse to the newest, only the
   newest answer is shown. Not the lasso's drop-stale pattern: its preview is
   a read, but retune MUTATES, so one call per tick queues a flood fill per
   tick behind the worker's FIFO port.
5. **Live below a pixel budget, on pause above it**
   (`useSelectionActions.ts:30-42`): 8 MP for the flood kinds, 3.2 MP for
   edge-aware. Above it the re-run waits for 300 ms of quiet.
6. **Same change:** `selection_coverage() -> [selected, total]` (`:630`) for
   the "Selected 18.4% · 2.1 MP" readout (panel and status bar), and
   INTERSECT as combine mode 3, shown as a standing Combine group
   (New / Add / Subtract / Intersect, `SelectSettings.tsx:143`). Shift/Alt
   still override it for one gesture; `ih_selection_bool` now kills only the
   modifiers, not the visible group.
7. **Amends ADR-022:** settings a mode does not use are no longer HIDDEN.
   They are shown disabled with a one-line reason (`selectReasons.ts`), so the
   panel stops changing height on every mode switch.

Measured 09-24-2026, production build, engine in the worker. 2068×1385 (the
largest import; `WORKING_MAX_EDGE` is 2048): wand re-run 31–43 ms,
slider-to-readout 203–255 ms including the debounce, worst frame gap during a
drag 29 ms. 24 MP (6000×4000 through `load_image_artboard`): wand re-run
237–347 ms, edge-aware 822–899 ms, `selection_coverage` 25 ms. Every import is
fully live.

## Consequences
+ One undo step per click, however far the slider moves, and Add / Subtract /
  Intersect stay correct while dragging back down.
+ The readout and the Combine group make the selection's state visible
  without a modifier held.
- wasm 814,432 → 816,594 B (+2,162; 816,586 before the Magic Eraser clear was added). One more engine field: `lib.rs` is at
  4,767 lines against the 4,808 guardrail cap.
- Edge-aware re-runs recompute the Sobel map every time (822–899 ms at 24 MP).
  A cached map is the obvious next step if big documents become common.
- Not done: a Contiguous checkbox (contiguous-off IS Color Range), Anti-alias
  (no engine support, and morphology is excluded), Sample Layer / Visible (the
  engine samples the composite only).

## Alternatives rejected
- **A. JS re-calls `magic_wand_select` per tick.** One undo step per tick, and
  in Add/Subtract it combines with the previous TICK's result: a union never
  shrinks, so dragging back down does nothing.
- **B. Undo, then re-select, per tick from JS.** Churns history and redo,
  flickers the History panel, and depends on undo's side effects.
- **C. Preview with `selection_preview` (`:539`), commit on release.** The
  commit still needs a no-new-step replace, which is the same engine problem,
  and the preview returns a tinted overlay, not the selection.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: a new
producer (a Smart Brush fill, an AI subject select) writes `self.selection`
without going through `apply_produced_selection`, and without pushing a
history step. Two guards exist: the explicit clear in
`apply_produced_selection` (`:377`) and the generation check, which only
catches writers that push a step (`select_all`, `selection_union`,
`selection_subtract`, undo/redo all do). A writer that does neither leaves the
record live, and the next slider tick replaces the new selection with a re-run
of an old wand click, with no undo step to mark the loss. `src/` already has
12 direct `self.selection =` sites, and this already happened once before
the branch shipped: `magic_eraser_brush_down` (`src/paint.rs`) replaced the
selection with neither a clear nor a snap, so a wand click followed by a
Magic Eraser stroke left the slider able to overwrite the painted mask. Found
while drafting this record; it now clears the record itself, and
`a_magic_eraser_stroke_ends_the_retune` pins it (seen red without the clear).
Early warning sign: a new `self.selection =` site in a diff that does not
touch `selection_retune`, or a new producer with no "not retunable" test
beside `marquee_and_select_all_are_not_retunable`.

*Amended 09-24-2026, by ADR-069:* the Consequences line "Anti-alias (no
engine support, and morphology is excluded)" is half out of date. Morphology
now exists: `dilate` / `erode` in `src/selection_refine.rs` drive Refine's
Smooth and Expand. Anti-alias is still not done, for the reason that remains:
the selection is `Vec<bool>`, so a soft edge has nowhere to live except a
layer mask (Refine's Feather, through `add_layer_mask_from`).
