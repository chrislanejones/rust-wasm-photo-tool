# ADR-069: Refine is four integer ops on the selection plus a feather that only a mask can hold; Apply is one unrecorded snapshot
Date: 2026-09-24   Status: accepted (ships in v8.98)   Builds on: ADR-066

## Context
The plan was Select → Refine → Mask with nothing modal, "three clicks on one
panel". In the shipped UI it is two panels: Refine sits on the Select panel
(`SelectSettings.tsx:299`), Add mask on Layer Settings (`LayerSettings.tsx:352`).
Still nothing modal. Three premises in the plan were wrong: connected
components did not exist (the wand's contiguous mode is a seeded flood,
`flood_select`, `src/selection.rs:102`); there is no "u8 selection plane"
(`selection: Option<Vec<bool>>`, `src/lib.rs:465`); and the size cost was not
"low single digits" of KB.

## Decision
1. **Four integer ops on the bool selection** (`src/selection_refine.rs`), run
   in this order (`refine_mask`, `:135`): remove islands, fill holes, smooth
   (open, then close), expand/contract (dilate/erode). Islands and holes share
   `drop_small_components` (`:63`), built on the lasso/Smart Brush flood core
   `flood_barrier_into` (`selection.rs:172`). Its `open` closure returns true
   exactly once per pixel it adds, so it doubles as the component's member
   list. No second flood. Square (Chebyshev) element, separable running counts,
   O(pixels) at any radius (`dilate`, `:97`). Pixels outside the image count
   for nothing, so an erode leaves an edge-touching selection touching the edge.
2. **Feather is not a selection op.** A soft edge is not a bool. It is two
   integer box passes (`box_pass` `:156`, `mask_plane` `:188`) producing the u8
   plane in `add_layer_mask_from(id, source, feather)` (`:293`; 0 reveal all,
   1 hide all, 2 reveal selection, 3 hide selection; feather applies to 2 and 3
   only). Same finding as Anti-alias in ADR-066: no soft selection anywhere.
3. **Preview on a copy.** `selection_refine_preview` (`:219`) keeps
   `refine_preview` (`lib.rs:477`) only to feed
   `selection_refine_preview_coverage` (`:241`). Apply (`:260`) recomputes
   from the parameters and never commits the copy. A preview that selects
   nothing returns a full-size TRANSPARENT overlay, because
   `SelectionOverlay.tsx:48` returns early on a short buffer without clearing
   (`:54`), which would leave stale ants on screen.
4. **Undo: unrecorded, deliberately.** Apply pushes ONE `snap_selection` step,
   "Refine Selection". `add_layer_mask_from` snaps "Add Mask" the same way
   `add_layer_mask` does (`layer.rs:1616`). Neither is an op-log record:
   `src/ops.rs` untouched, format not bumped.
5. **JS is store-driven.** `selectionRefine`, `refinePreviewing`,
   `refineRequest {kind, n}` (a nonce) in `useToolStore.ts:223-231`, answered
   by `useSelectionActions.ts:164-229` on ADR-066's `createLiveRetune`
   scheduler. The panel has no engine handle and AppShell must not grow. The
   coverage readout reads the preview while one is on screen (`:109-113`),
   so the number matches the ants drawn.
6. **Add mask opens inline** under the tile: a `ToolButtonGroup` in ACTION mode
   (`LayerSettings.tsx:366`). "Select subject…" sets eraserMode `rembg` + tool
   `ai` (`:404-405`). It is a link, not a path.
7. **QC fix:** Combine's "New" had the same accessible name as the top bar's
   "New" (new image), so it is now "New selection" (`SelectSettings.tsx:152`, uncommitted in the tree).

## Consequences
+ Deterministic: integer only, so two machines never disagree on a pixel. The
  tests read as pictures (`tests/selection_refine.rs`, 16 tests).
+ Every size slider is linear in pixels, whatever the radius.
- `make_snapshot` (`lib.rs:657`) clones the WHOLE layer stack, even for a
  selection-only step. On a large photo one Apply costs one of very few undo
  steps. The Refine lightbulb says so (`SelectSettings.tsx:315-318`), and the
  status bar's Undo NN% drops as the honest signal.
- **Op-log debt.** The format bump (#37 / #33a / #89) must cover: Refine
  Selection (islands, holes, smooth, expand); Add Mask from source (0..3 +
  feather); and ADR-066's selection steps (`selection_retune`'s one-time step,
  Intersect combine).
- wasm 816,594 → 824,328 B (+7,734; `pkg/stamp_tool_bg.wasm` measured at
  824,328). Twiggy on a named wasm32 build (unoptimized): `box_pass` 1,198 +
  `dilate` 1,166, `add_layer_mask_from` 975, `drop_small_components` 859 +
  flood specialization 264, `refined_selection` 673, `selection_refine_apply`
  497, `erode` 434, four exports' glue ~1.5 KB. Headroom to `MAX_WASM` 860,000
  (`scripts/deploy-sentinel.sh:87`): 35,672 B. `lib.rs` 4,771 of the 4,808 cap.
- Not done: mask view modes (Overlay / B&W), deferred to Night 4. Both can be
  DOM overlays like `SelectionOverlay` / `ObjectRemovalOverlay` with one new
  export (mask → RGBA), without touching compositing, so the parity-test stop
  condition would not fire.

## Alternatives rejected
- **Make the selection u8 so Feather lives in it.** Touches the overlay,
  delete, copy/cut, patchmatch and every other consumer. Far out of scope.
- **Merge `box_pass` and `dilate` into one fn-pointer body.** Measured 43 B
  LARGER (824,371), so it was reverted.
- **`@radix-ui/react-dropdown-menu` for the Add mask choices.** A new
  dependency for one menu. `components/ui/` has only `context-menu`.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: someone
"fixes" Feather by thresholding it back into the bool selection so the ants
show it. Thresholded, a box blur is a second Smooth. The slider still moves and
the result looks plausible, so nobody notices. Or: the op-log format bump
ships without Refine Selection because it has no `Op` to grep for, and a
replayed document loses every refine. Early warning sign: a
`snap_selection("…")` label in a diff with no matching line in the bump's
coverage list, or a `mask_plane`/`box_pass` call whose result is compared
against a threshold.
