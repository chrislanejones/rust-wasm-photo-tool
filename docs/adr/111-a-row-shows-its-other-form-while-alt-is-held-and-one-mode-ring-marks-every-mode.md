# ADR-111: A row shows its other form while Alt is held, and one mode ring marks every mode
Date: 2026-11-25   Status: draft (`land/v979`, PR #517 later commits)   Relates to: ADR-110, ADR-107

## Context

ADR-110 gave Fill Color a transparent swatch but no in-between: a fill was
solid or gone. Corner Radius set all corners at once. One corner could only
be changed on the canvas with Shift-drag, and the panel showed that as
"Mixed". Adding an Opacity slider and a per-corner panel would have put two
more rows in a panel that ADR-107 had just reordered. Separately, three
modes (a file drag, Compare, and now these two Alt forms) each wanted a way
to say "this surface is doing something else right now". The drop ring
spun, and Compare borrowed it with its own inline `div`.

## Decision

1. **Hold Alt over a row to show its other form** (`hooks/useAltOverRow.ts`).
   The hook listens on `window` only while the row is hovered or focused, so
   Alt everywhere else keeps its meaning. The pointer wins: focus counts only
   from the keyboard (`:focus-visible`) and only when no other Alt row is
   under the pointer (a module-level `rowsUnderPointer` count). A bare Alt
   is `preventDefault`ed so Windows does not move focus to the menu bar.
2. **Fill Color → opacity steps** (`ColorSwatchGrid opacity`, on both Fill
   Color rows). The swatches become the current color at `OPACITY_STEPS`
   100 … 0; 0 is `transparent`. Clicking the "Opacity N%" readout pins that
   form without Alt. The color travels as `#rrggbbaa` (`withAlpha`, `alphaOf`,
   `rgbOf` in `lib/colors.ts`). Picking a new color keeps the exact alpha byte
   (`keepAlpha`), not a rounded percent. A reselected shape reopens with its
   alpha (`hexWithAlpha`, `lib/drawEditState.ts`).
3. **Corner Radius → per-corner tiles** (`CornerRadiusControl.tsx`): All, then
   each corner by name (rect 4, diamond 4, triangle 3; a star has none). The
   picked corner lives in a new store, `useCornerFocusStore` (`null` = all).
   The label names the corner and `ShapeEditOverlay` lights its dot. The
   reset arrow squares every corner, with no edited dot (`ControlRow`
   `edited.dot: false`). No engine change: `cornerRadii` was already per corner.
4. **Engine:** `parse_hex_color` (`src/drawing.rs`) keeps alpha from an
   8-digit hex. Every other form stays opaque, as before. `parse_color` already
   read it. Shapes already stored `fill_a`. Colors were already strings in
   the op log, so it stays at v17. Wasm size not measured for this ADR.
5. **One `ModeRing`** (`components/ui/mode-ring.tsx`, `.image-drop-ring`)
   marks every mode: file drag, Compare, Fill Color in opacity form, Corner
   Radius showing or editing a corner. It is 4 px around a surface and 2 px
   around a row, `aria-hidden`, and the words beside it say what the mode is.
   It no longer spins: the gold itself is the signal. DESIGN.md: "never a
   new outline".
6. **Fixes made at landing.** `useKeepFocusOnSwap` hands focus to the new set
   of controls when the swap unmounts the focused one. `SizeSlider valueHint`
   is both hover text on the value and the range's `aria-describedby`, so a
   keyboard user hears the Alt hint.

## Consequences
+ Opacity and per-corner radius without a new row. The panel stays the
  length ADR-107 set.
+ One look for one meaning. The next mode gets the ring and costs no design
  call.
+ The 8-digit hex is the one spelling for a translucent fill, from the
  swatch to the engine. Older 6-digit colors read exactly as before.
- **Hidden behind a key.** The Alt form is found only by hovering the value
  or the readout. On touch there is no Alt: Fill Color still has the click
  pin, but Corner Radius has no per-corner path at all (the canvas fallback,
  Shift-drag, also needs a keyboard).
- While the pointer is over one of these rows, the hook takes Alt for itself.
  That includes the Alt of Alt+E (Export, v9.72), so the row flips for a
  moment before Export opens.
- `useAltOverRow` keeps module-level mutable state, and every new reader of a
  fill must now expect `#rrggbbaa` as well as `transparent` (ADR-110's cost,
  widened).

## Alternatives rejected
- **A separate Opacity slider, and a per-corner panel:** two more rows for
  settings most shapes never use. The Alt form puts them in the row that
  already holds the value.
- **A new outline or color per mode:** each mode would need its own look and
  its own contrast check, and the person would have to learn each one.
- **Lightbulb hints next to each row:** Chris, 11-25-2026: "not little light
  bulbs just everywhere". The hint is hover text on the value instead.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: a
modifier key held over a row is a power-user habit, and nobody finds it.
People who want a 50% fill never see the opacity steps, because the only clue
is hover text. On a tablet, per-corner radius cannot be reached at all.
Meanwhile the ring is spread across four modes, so a person seeing gold
around a row cannot tell which mode is on without reading the label.
Early warning sign to watch for: a request for "fill opacity" or "round one
corner" from someone who already has this build.
