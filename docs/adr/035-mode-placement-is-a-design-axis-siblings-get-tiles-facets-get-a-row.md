# ADR-035: Mode placement is a design axis — sibling modes get sidebar tiles, facets of one object get an in-panel row
Date: 2026-08-17   Status: accepted

Supersedes **ADR-034 decision 1** (Perspective ships as three Edit sub-tools).
ADR-034's decisions 2–4 — rules in TypeScript, resampling in Rust, text storing
normalised corners — stand unchanged.

## Context

ADR-034 shipped Distort / Perspective / Skew as three sibling entries in the
Edit group, on the rule that "a registered module's modes surface as group
sub-tools". Within an hour of v8.43 going live the shape failed in use: none of
the three tiles ever highlighted, so there was no way to tell which of the
three you were in. The cause was a **fourth hand-written copy of the sub-mode
axis** in `activateSubTool.ts` with no `perspective` case — it returned
`undefined`, `useActiveSubTool` rejected the stored key on every read, and the
fallback lit `live[0]` (Distort) whichever tile you clicked.

Fixing the copy would have restored the highlight and left the real question
unanswered: three near-identical quad tiles read as three tools, when they are
one box and three rules about what the other corners do when you drag one.

## Decision

**Where a tool's modes live is a design axis, not a default.** Modes that are
siblings — separate things you pick up, like Select's six selection kinds or
Paint's four brushes — stay as tiles in `SubtoolRow`. Modes that are *facets of
one object* get a single sidebar tile and a button row inside the panel, via
`ToolModeToggle`'s `showModeRow`, which is hereby a supported layout choice
rather than a migration shim awaiting deletion.

Perspective takes the second form: **Edit → Perspective → perspective |
distort | skew**. Its sidebar entry carries **no `mode`**, because
`useActiveSubTool` keeps a stored key only while the sub-tool's mode is
`undefined` or equals the live mode — a tile pinned to one mode goes dark the
instant the row selects another, reproducing the bug being fixed.

The duplicated axis is deleted in the same change: `activateSubTool.ts`
delegates to a new `selectModeOf()` in `toolModes.ts`, leaving one definition
instead of four.

## Consequences

+ One tile and a row says "one tool, three rules" with no explanatory text —
  the toolbar's no-paragraphs constraint holds.
+ The Edit group stops showing three near-identical quad icons among tools that
  are genuinely separate (Crop, Guides, Layers, Canvas Size).
+ Four copies of the sub-mode axis become one, closing the defect class that
  caused the bug — `MODE_ACCESS`'s own comment had predicted it verbatim.
- **Two placements now exist, so a reader must ask which applies.** Mitigated
  by the rule above and by requiring the reason in each panel's header comment;
  not eliminated.
- Perspective's three modes are one click deeper than the other seven tools'.
- `showModeRow`, previously slated for deletion, is now API surface to keep.

## Alternatives rejected

- **Fix the fourth copy and keep three tiles.** Restores the highlight and
  leaves three tiles that read as three tools; the placement question would
  have come back the next time someone used it.
- **A modifier key on one Distort tool** (hold Shift for keystone). Hides two
  of three rules behind an undiscoverable gesture, and ADR-034 already rejected
  it for the same reason.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: "siblings
versus facets" turned out to be a judgement call nobody applies the same way
twice, so panels drifted one at a time — each with a plausible header comment —
until the toolbar had no predictable answer to "where are this tool's modes?"
and the consistency ADR-023 bought was spent. The rule reads crisp here because
Perspective is an unusually clean case; Shapes (rectangle/ellipse/line) and
Text (text/background/OCR) are genuinely arguable both ways, and whoever
touches them next will have to decide with no stronger guide than taste.

Early warning sign to watch for: **a second panel turning on `showModeRow`
without an explicit ask from Chris** — or any panel whose header comment
justifies the placement by what it already looked like rather than by whether
its modes are siblings or facets.
