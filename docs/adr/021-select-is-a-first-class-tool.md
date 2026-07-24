# ADR-021: Select is a first-class tool, not a sub-mode of Adjust
Date: 2026-07-23   Status: draft

## Context
Selection lived inside tool id `crop` ("Adjust & Select") behind three gates
(`activeTool === "crop" && adjustMode === "select" && selectionMode`) — the
2.6-era decision to cap the sidebar at ten buttons. Testing the boolean-ops
branch surfaced the cost: every selection drag spawned the crop overlay (the
app's only rect gesture belonged to crop), one crosshair covered three
different gestures, and a "Click-to-select" toggle had to be armed before the
canvas responded at all.

## Decision
Select becomes tool #11, id `select` — the first id matching its label from
birth. One gate (`activeTool === "select"`); click fires the active kind,
drag sweeps a marquee via new engine producers `rect_select`/`ellipse_select`
riding `apply_produced_selection` (combine modes compose for free). The
arming toggle, `selectionMode`, and `adjustMode` are deleted; crop is
single-mode "Adjust" again. Shortcut `S` — the first letter key in
`TOOL_BY_KEY` (digits filled at ten; Photoshop precedent). Legacy
`#/tool/adjust/select` URLs redirect to the Select tool. Shift-add /
Alt-subtract ship ON by default (Chris, same day: "I wanted those shortcuts
by default"); `ih_selection_bool` becomes a `"0"` kill switch, the v7.36
op-log pattern.

## Consequences
+ All three UX faults fall out of one structural fix — no crop box during
  selection, per-intent cursors (+/− badges consume the orphaned
  `combineHint`), zero-arming canvas-first gestures.
+ The palette/router special-case for selection kinds collapses into the
  generic registry path (`mode.select.*` with real routes).
- An 11th sidebar tile: vertical space at small window heights is unmeasured
  (Lacey pass pending).
- `TOOL_BY_KEY` now mixes digits and letters; every future tool key is a
  letter with typo-vs-shortcut ambiguity the digit row never had.
- Old persisted palette recents (`select.<kind>` ids) silently drop.

## Alternatives rejected
1. Marquee as a 5th kind tile — re-introduces mode-switching for the most
   common gesture; drag/click split covers it without a tile.
2. Wait for the emoji registry migration first — the skill's ordering governs
   migrations of existing tools; Select is a new tool id, and the UX cost was
   being paid daily.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely reason:
the ten-button cap existed for a real reason — sidebar height — and tool #12
(already foreseeable: a shape/vector tool) forces either a scrolling toolbar
or a grouping mechanism, at which point Select-inside-a-group looks exactly
like Select-inside-Adjust again and the split bought one year, not an answer.
Early warning sign to watch for: the sidebar wrapping or scrolling at the
1366×768 laptop window Chris actually tests at, or a 12th tool proposal
landing in PARKING_LOT.
