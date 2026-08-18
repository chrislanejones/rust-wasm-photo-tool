# ADR-036: Perspective's three drag rules stay three sibling tiles — the highlight bug was the mode axis, not the placement
Date: 2026-08-17   Status: accepted

Supersedes **ADR-035** entirely and **restores ADR-034 decision 1**. ADR-034's
decisions 2–4 were never in question.

## Context

v8.43 shipped Distort / Perspective / Skew as three Edit tiles and **none of
them ever highlighted**, so there was no way to tell which was active. v8.44
read that as a placement problem and collapsed them into one tile with an
in-panel row; v8.45 wrote that up as a design rule and promoted
`ToolModeToggle`'s `showModeRow` from migration shim to supported layout.

Both were fixes for the wrong thing. The symptom was a stale **fourth copy of
the sub-mode axis** in `activateSubTool.ts` — a hand-written switch with no
`perspective` case, so `useActiveSubTool` rejected the stored key on every read
and the fallback lit `live[0]` (Distort) whichever tile was clicked. That copy
was deleted in v8.44 too, which is why the collapsed tile appeared to fix it:
**the real fix shipped alongside the unnecessary one and got the credit.**

## Decision

**Three sibling tiles, one per drag rule** — ADR-034's original shape — now
that each lights correctly. Every entry carries its `mode`; that is what makes
the *right* one of the three light rather than all or none.

`showModeRow` goes back to being a migration shim that nothing passes, with the
v8.45 promotion recorded in its header so the reasoning is not re-run. The
toolbar keeps **one** rule for where a tool's modes live: sibling tiles in
`SubtoolRow`, the same as Select's six kinds and Paint's four brushes.

## Consequences

+ One placement rule for the whole toolbar again — nothing to decide per panel,
  nothing to drift. ADR-035's pre-mortem risk is retired rather than managed.
+ All three rules are one click from the Edit group, not two.
+ `showModeRow` stays deletable, which was the point of calling it a shim.
- Three visually similar quad icons sit in the Edit group; they are
  distinguished by icon and tooltip, not by shape.
- Three ADRs now cover one UI decision in a single day. The record is honest
  but it is not short.

## Alternatives rejected

- **Keep the collapsed tile (ADR-035).** It works, but it bought a second
  placement rule to solve a bug that was already fixed by the axis
  de-duplication — cost with no remaining benefit.
- **Three tiles plus an in-panel row.** Two controls for one piece of state,
  and the row would have to stay in sync with the tiles for no gain.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: three
near-identical quad icons in a fourteen-tile Edit group turn out to be
genuinely hard to tell apart at a glance, and users keep landing in Distort
when they wanted the keystone — the discoverability complaint that started
this, returning in a form the highlight fix does not address. The honest
counter is that we have not yet watched anyone use the three-tile version with
working highlights; that is the evidence this decision is missing.

Early warning sign to watch for: **Chris reaching for the wrong one of the
three**, or asking again what the difference between Distort and Perspective
is — as opposed to the v8.43 complaint, which was that none of them lit up.
