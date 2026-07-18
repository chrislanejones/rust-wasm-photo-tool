# ADR-013: Op-log undo activates behind a composite-hash sync check, with snapshot undo as the permanent fallback
Date: 2026-07-11   Status: Accepted (2026-07-17 — op-log undo verified
live on the shipped defaults; the hash-gated snapshot fallback stays
permanent per this ADR's own decision)

## Context
Not every edit is recordable yet (clone stamp, filters, masks,
pixelate/redact, layer-structure ops). Swapping undo to op-log replay
only when the log is provably in sync — and falling back otherwise —
is what lets the swap ship before op coverage is total.

## Decision
Recording is passive and always-on for single-layer docs (tiles
builds): base captured lazily at `snap()`, pixel ops at commit
points, annotations by an engine-vs-log diff at `recomposite()`.
`undo()`/`redo()` consult the log only when the runtime switch is on
AND the engine composite FNV-hashes byte-identical to the log's.
A mismatch marks the log broken for the session and undo falls
through to the untouched snapshot path; snapshot stacks stay aligned
(one snap per recorded op, popped in lockstep).

## Consequences
+ No stage of the rollout can strand the editor; unrecorded edits
  degrade to today's behavior instead of corrupting history.
+ The same hash gate protects persistence restores.
- Both histories are maintained while the log is healthy, so the
  memory win arrives only when snapshot pushing is later suppressed.
- One unrecorded edit disables the log for the rest of the session
  (until the next image load) — coverage gaps are user-visible as
  "deep undo stopped surviving reload."

## Alternatives rejected
Swap undo unconditionally once the harness is green — no defense
against the (large) unrecorded-op surface; rejected. Per-op-type
gating without a hash check — cannot catch future unrecorded
mutations; rejected as unauditable.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely
reason: the per-undo full-composite hash (two 16 MB scans on large
canvases) made undo feel sluggish exactly when users undo rapidly,
and the check was quietly weakened. Early warning sign: undo latency
complaints on 4K-class documents in the diagnostics FPS/flush-ms
numbers.
