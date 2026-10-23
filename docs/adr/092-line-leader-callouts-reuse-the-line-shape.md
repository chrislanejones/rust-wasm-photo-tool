# ADR-092: Line-leader callouts reuse the Line shape, and the callout join accepts kind 2
Date: 2026-10-23   Status: draft (#397, `feat/callout-leader-line`, stacked on #393)   Relates to: ADR-085

## Context

A Smart Callout (v9.35, #390) is three ordinary annotations, a pin (kind 5),
a text label and a leader, recognized at read time by `findCallouts` in
`app/src/lib/callouts.ts`. Nothing stores a "callout". Until #397 the leader
had to be an Arrow (kind 4), so every callout had a head. A headless leader
as an arrow needs a third `arrow_style` value, but `arrow_style` only knows
single (0) and double (1), and a new value is a format change. The 10-23
night ruled out any op-log or format change.

## Decision

The Pins panel gets **Leader: Line · Arrow** (shown when Drop is on Callout,
default Line, not persisted). A line leader is the existing Line shape
(kind 2), and `findCallouts` accepts kind 2 or kind 4 as a leader. The join
is unchanged: the leader's start (`x0,y0`) within 0.75 px of one of a text
label's four edge midpoints, and its end (`x1,y1`) within 0.75 px of a pin's
outline. Direction matters. A line drawn pin-to-label does not join.
Following a move: an arrow still goes through `reroute_connector`. A line
goes through `continue_step` + `update_shape_annotation` (`rerouteCallouts`
in `app/src/hooks/usePinSteps.ts`), which joins the move's undo step. No new
field, no op-log, IndexedDB or Rust change.

## Consequences

+ Headless leaders ship with zero format risk. Saved files replay on today's
  engine as-is.
+ Callouts made before #397 keep their arrow and still join.
- One-way-ish: once users save line-leader callouts, taking kind 2 out of the
  join rule orphans them. They'd read as a plain line plus a pin, and the
  leader would stop following.
- Builds from before #397 already read them that way. Open the same file in
  an older tab and the leader doesn't follow there. Nothing breaks, the join
  just isn't there.
- Wider net: any Line, not just arrows, can now be read as a leader. The 0.75 px
  tolerance on both ends plus the direction rule keeps that to chance. The Line
  tool has no port snapping (`connectTarget` is Connect's, Connect makes
  arrows and refuses pins). That's from reading the code; no test drew a stray
  line to prove it.
- Two follow paths. The line path rewrites the whole shape and passes star
  points 0, rotation 0 and zeroed corner radii, so a leader field that isn't
  read back gets reset on every follow.

## Alternatives rejected

- **`arrow_style` 2 = "no head":** a format change, which the night ruled out.
  Older builds have no meaning for a value of 2.
- **A stored callout record linking pin, leader and label:** also a format
  change, and it throws away the join-by-geometry rule that already survives
  undo, autosave, reload and export.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: someone
"simplifies" `isLeaderKind` back to arrows only, or adds a stored callout
record and stops reading geometry. Every line-leader callout saved since
#397 quietly turns back into a loose line and a pin, and nothing errors.
Second most likely: a user's ordinary line gets swept into a callout
and moves when they drag a pin.
Early warning sign to watch for: a diff touching `isLeaderKind` or
`LEADER_KIND` in `callouts.ts` without a reload test of a saved line-leader
callout in `e2e/callout-leader.spec.ts`, or a bug report of "my line moved
when I dragged the pin."
