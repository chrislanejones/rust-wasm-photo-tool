# ADR-044: A shape reorder is deliberately not replayable
Date: 2026-09-04   Status: draft

## Context

Backlog #62 (shape z-order) has been blocked on one question for three
sessions: **does a reorder need an op-log entry, and therefore an
`OP_FORMAT_VERSION` 5→6 bump and a dexie migration** (which is what #68 was)?

Checked before writing code, and the premise behind #68 does not hold. **Shape
annotations are not written to the op log at their call sites at all.** Neither
`add_shape_annotation` nor `remove_shape_annotation` records an op; both only
`snap()`. The log **reconciles** instead — it diffs the engine's
`layer.shape_annotations` against `log_doc.shapes` and emits
`ShapeAdd`/`ShapeEdit`/`ShapeRemove` for the differences (`lib.rs:1511`).

That reconciliation is keyed by `id` and iterates to match, so it is
**order-insensitive**, and `ShapeParams` carries no z field. **A pure reorder
therefore emits zero ops no matter what the reorder call does.**

Z-order itself needs no new state: it **is** Vec order. `render_layer` draws
`for s in &layer.shape_annotations` (`layer.rs:217`), so a later index is drawn
later and sits on top.

## Decision

Add `move_shape_annotation(&mut self, id: u32, to: u32) -> bool` — snap history,
move within the Vec, **record no op-log entry**. Follows the `remove_object`
precedent (`selection.rs`), and `rotate_90_cw` / `resize_canvas` before it.

**#68 closes with no code.** The format bump it existed for is not needed.

## Consequences

**+** No persisted-format change, no dexie migration, no one-way door into
IndexedDB — the four UI actions become reachable behind one engine call.
**+** Consistent with the two shape calls either side of it, which already skip
the log.
**+** `to` saturates at the last index, so "bring to front" needs no count read.

**−** A reorder is **not replayable from the op log.** A document rebuilt purely
from the log gets shapes back in log order.
**−** That cost is bounded but not zero: **`oplog_engine_in_sync` compares the
composite pixel hash** (`lib.rs:1572`), so a reorder that changes what the user
sees changes that hash, the next op-log undo declines, and snapshot undo takes
over — the documented safe fallback. A reorder that does *not* change the
composite is one where z-order was visually irrelevant. The check catches
exactly the cases that matter, but it catches them by **breaking the log for the
session**, which costs op-log undo's cheaper path.
**−** One more engine call the JS must not spam: it snaps history per move, so a
"bring forward" held down would push one entry per step.

## Alternatives rejected

1. **Add a `z` field to `ShapeParams` and bump the format (this was #68).** A
   persisted-format change plus a dexie migration, to make replayable a property
   that the pixel-hash check already guards. Rejected on cost against a one-way
   door.
2. **Make reorder emit `ShapeEdit` for the affected shapes.** Does nothing —
   `ShapeParams` has no order field, so the emitted params are identical and the
   reconciler skips them.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: **op-log
restore became a routine path rather than a fallback, and users started losing
z-order silently on reload** — the pixel-hash guard protects undo *within* a
session, and says nothing about a document rebuilt from the log on a later
visit. The z-order would come back in creation order, and it would look like the
shapes moved themselves.

Early warning sign: **any bug report of the form "my shapes came back in the
wrong order after reloading"**, or an op-log restore path being promoted from
fallback to default for annotations. Either one means the `z` field in
`ShapeParams` has to be revisited, and #68 reopened as ADR-0xx rather than
patched in quietly.
