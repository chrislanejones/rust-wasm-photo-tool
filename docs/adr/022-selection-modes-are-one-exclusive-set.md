# ADR-022: The Select tool's six modes are one exclusive set
Date: 2026-07-25   Status: draft   Supersedes: ADR-021 (in part)

## Context
ADR-021 gave Select its own tool and split the gestures across two orthogonal
axes: a 4-way `SelectionKind` for clicks (wand / edge-aware / color-range /
magnetic lasso) and a 2-way `SelectionShape` for drags (rect / ellipse). Both
were live simultaneously — wand-on-click AND rect-on-drag, no mode switch.
That ADR explicitly rejected "marquee as a 5th kind tile" on the grounds that
it "re-introduces mode-switching for the most common gesture".

Two days of use said the capability wasn't the problem, the legibility was.
The panel showed a 2×2 kind grid and, underneath it, a separate "Drag shape"
pair sitting below a header that rendered the *active kind's* name — so Rect
and Ellipse read as sub-options of the Wand rather than a second axis. Chris,
on first read: "I don't get the rect and circle, should they be in the group
with wand, color range, Edge-aware..." followed by "but I don't want wand and
rect to run at the same time right?". When the person who commissioned the
design can't infer the model from the panel, the model is wrong for this app
even if it is strictly more capable.

The one sentence that explained it — "Click the canvas to select; drag for a
marquee" — was reachable only by hovering a lightbulb, because the
no-permanent-paragraphs rule (correctly) keeps prose out of the panel. A model
that can only be taught in a tooltip is too clever for its surface.

## Decision
Collapse both axes into ONE mutually-exclusive `SelectionKind` of six:
`wand | edge | lasso | colorRange | rect | ellipse`. The mode picks the
gesture, not just the algorithm:

- wand / edge / colorRange — resolve on CLICK (unchanged)
- lasso — a click SESSION: begin → commit* → close (unchanged)
- rect / ellipse — DRAG-only; a plain click is inert

`SelectionShape` survives only as the derived marquee-outline type;
`selectionShape` state and `setSelectionShape` are deleted (both were
transient, never persisted, so there is no migration). `isMarqueeKind()` is
the single predicate gating `marqueeActive`, the click bail-out in
`useSelectionActions`, and the Tolerance slider's visibility.

Each mode keeps its own hash route — `#/tool/select/rect` and
`#/tool/select/ellipse` join the four that already existed. This needed no
routing change: `modesFor("select")` reads `SELECT_MODES`, so routes, the
command palette, and the panel all derive from that one list.

Renames: "Rect" → "Rectangle", "Magnetic" → "Magnetic Lasso" (lucide `Lasso`
→ `Magnet`). Panel grid goes 2-up → 3-up to match the Selection action grid
below it, so the panel reads as two grids of the same shape.

Select is also **keyless** as of this change: `S` was removed from
`TOOL_BY_KEY` at Chris's instruction ("do not give the select tool a shortcut
— UI will change and it will get a number instead"). `shortcutKey` is now
optional on `ToolDefinition`.

## Consequences
+ The panel is self-describing: six tiles, one lit, and the lit one tells you
  the gesture. No tooltip required to learn the model.
+ A stray drag in Wand can no longer produce a rectangle nobody asked for, and
  a stray click in Rectangle can no longer flood-fill from whatever pixel it
  hit. Each mode does exactly one thing.
+ One list (`SELECT_MODES`) still feeds panel + palette + routes, and
  `selectModes.test.ts` now pins ids, order, and `isMarqueeKind` agreement —
  the drift guard ADR-021 lacked.
- Reaching a marquee now costs a mode switch. This is precisely the cost
  ADR-021 refused to pay; we are paying it deliberately, having found the
  saved click cheaper than the confusion.
- Six tiles is a bigger panel block than four. ADR-021's pre-mortem note about
  sidebar height at small windows applies here too — measure before adding a
  seventh.
- Muscle memory from v7.44–7.46 (drag-anywhere-marquees) breaks for anyone who
  had built it in two days of shipping.

## Alternatives considered
1. **Keep both axes, relabel the groups** ("On click" / "On drag"). Cheapest
   fix, preserves the capability, and was the first recommendation. Rejected
   by Chris in favour of exclusivity — the two-axis model is a Photoshop
   deviation and the tool-per-mode shape is what he wants the UI to grow into.
2. **Six separate top-level tools** (Select gone, each mode its own sidebar
   tile). Rejected for now: it puts the sidebar at sixteen buttons and ADR-021
   only just finished arguing selection belongs behind one gate. The routes
   are per-mode already, so this stays available later.
3. **Marquee as a 5th tile, shape as a sub-toggle.** Half-measure with the
   worst of both: still two axes, still an unexplained pair.
