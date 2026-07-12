# ADR-003: Operation log replaces snapshot undo
Date: 2026-07-02 (backfilled)   Status: draft
Blocked on: SHIPPING. As of 2026-07-11 (`feat/tile-wiring-oplog-undo`,
unmerged) the render path DOES call into ops.rs: every apply() is
implemented via the engine's own kernels (byte-parity proven in
src/ops_engine_parity.rs), a passive recorder captures real sessions,
and undo()/redo() replay from the log behind the `ih_oplog_undo`
switch with a hash-checked snapshot fallback (ADR-013). Flip to
Accepted when that branch ships in a release.

## Context
Snapshot undo copies the full buffer per edit: 16 MB at 2048×2048,
~3.2 GB after 200 edits. Sessions can OOM inside a browser tab and
history cannot be persisted or branched.

## Decision
Record edits as serialized ops (Rust, serde + postcard, leading
format-version byte). Keyframe snapshot every 50 ops. Undo = replay
from nearest keyframe. Linear log now; branch DAG later.

## Consequences
+ Memory scales with edits (~bytes each), not states; persistent
  undo, branching, and macro replay become possible.
- Replay must be deterministic forever: apply functions are frozen
  contracts, randomness must be seeded, ops are versioned.
- Two version systems (JS envelope vs Rust encoding), deliberately
  decoupled, both maintained.

## Alternatives rejected
Delta-compressed snapshots — solid middle ground but no branching or
macros; capped history — silently loses user work.

## Pre-mortem
Mistake most likely because replay parity for brush strokes proved
harder than recording fidelity, leaving undo subtly lossy.
Early warning: golden-image replay tests needing tolerance bumps.
