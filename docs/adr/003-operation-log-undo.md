# ADR-003: Operation log replaces snapshot undo
Date: 2026-07-02 (backfilled)   Status: draft

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
