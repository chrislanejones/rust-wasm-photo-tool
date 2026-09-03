# ADR-042: AppShell shrinks by two structural changes, not by more handler extractions
Date: 2026-09-02   Status: draft

## Context
`AppShell.tsx` is 3,718 lines after the first #45 extraction, and the whole
file was inventoried before the second one was chosen. Its component logic
holds **247 named blocks, of which only 34 are 15 lines or longer** — those 34
total 1,255 lines, so extracting every one of them still leaves roughly 2,560.
The best single candidate available was 103 lines, **2.7% of the file**, and the
JSX return is another **993 lines (26%)** that moving handlers does not touch at
all. The campaign's ceiling is about a third, reached only after many sessions.

## Decision
Handler extraction stops being the strategy for #45. The remaining reduction is
two separate changes, each with its own decision and its own risk profile:
**split the 993-line JSX return into sub-components** (moves rendering), and
**let consumers read the stores directly instead of receiving threaded props**
(moves state ownership, and deletes the ~213 small glue handlers rather than
relocating them). Further extractions are allowed opportunistically when a block
is already coherent, but they are no longer the plan, and the `max-lines`
ratchet stays the scoreboard either way.

## Consequences
+ Stops a campaign whose arithmetic does not reach its goal — twenty more PRs of
  ~100 lines each would end around 2,500 lines and feel like failure.
+ Names the two real changes, so each gets designed rather than discovered
  halfway through a session that thought it was doing a file move.
+ The inventory numbers are recorded, so the next session does not re-derive them.
- #45 stays open longer, and #74 stays blocked behind it longer, because the
  unblocking work is now larger than "one more extraction".
- Both named changes alter behaviour surface (rendering order, subscription
  granularity) where extraction did not, so neither is a green-gates-only job.
- The ceiling estimate assumes the current shape; a burst of accretion into
  AppShell moves it, and nothing currently reports that except the ratchet.

## Alternatives rejected
- **Continue extracting handlers.** Loses on arithmetic: every block worth
  moving totals 1,255 lines against a 3,718-line file.
- **One big rewrite of AppShell.** Rejected for the same reason the campaign was
  chosen originally — no reviewable diff, and the file is the composition root
  for every feature.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely reason: the
two named changes were each big enough to need their own sitting, and neither
sitting ever came, so #45 simply stopped moving — whereas the extraction
campaign, however slow, was at least reducing the number every few weeks. By
declaring the small wins insufficient we may have traded steady progress for
none at all, and "it needs an architectural change" is a comfortable place for
work to go and never come back from.

Early warning sign to watch for: the `max-lines` ratchet for `AppShell.tsx` goes
a full month without being lowered, or is *raised* to admit a new prop.
