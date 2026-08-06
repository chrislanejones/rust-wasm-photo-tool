# ADR-031: Export quality lives on the engine Snapshot, and the persisted archive goes to v6
Date: 2026-08-05   Status: draft

## Context
A quality-only Apply pushes a `"Compress"` history entry via
`push_compress_marker()`, but `snap()` captures layer pixels and a quality-only
apply changes none. Undo consumes the step, restores identical pixels, and
leaves the slider where it was — an undo that does not undo. Found during v7.67
QC. It is the **only** genuine case of its kind: the Phase 1 audit of 108
exported mutators found `Snapshot` already carries every other non-pixel
document parameter (`Layer.opacity`, `.visible`, `.name`, `.mask`, annotations,
plus `width`, `height`, `active`, `selection`), all restored by
`restore_snapshot`.

## Decision
Add export quality to the engine `Snapshot`. `push_compress_marker(quality)`
records it, `restore_snapshot` applies it, and a getter exposes the current
value so React reads engine truth rather than holding its own. Both persisted
forms carry it: the binary cloud archive goes **VERSION 5 → 6**, and the local
`SavedEdit` snapshot entries gain a quality field. v5 archives stay readable and
decode with quality absent.

## Consequences
+ Undo genuinely reverses a quality change, and redo restores it.
+ One owner. The value is engine state with no JS mirror — the pattern that
  caused the archive corruption (2026-08-04) and the `syncState` drift
  (2026-08-05) within a day of each other.
+ Quality survives reload, because it rides the snapshot that already persists.
- **A persisted-format change in two places at once.** IndexedDB is user data
  with no backup; this goes through `dexie-migration` before any code.
- **The engine now owns a value it never reads.** Encoding happens in the codec
  worker and the JS export path, not in Rust. The crate stores and serializes a
  number purely so undo can reverse it.
- Every snapshot grows, multiplied by undo depth. Small per step, but the
  archive already averages ~35 MB and snapshot count is uncapped in the log.

## Alternatives rejected
1. **Remove the `"Compress"` marker entirely.** A quality-only apply changes no
   document state, so arguably it should hold no history step — the smallest and
   most honest fix. Lost because it removes a capability rather than delivering
   one: the user's expectation is that quality is undoable.
2. **A JS-side map from history depth to quality.** No format change, no Rust.
   Lost on principle: it is an unowned mirror of engine truth, and two
   production incidents in twenty-four hours came from exactly that shape.

## Pre-mortem
It is six months later and this decision was a mistake. Most likely reason: it
established that the Snapshot is where UI parameters go to become undoable, and
the argument that won here — "the user expects it to be undoable" — is equally
true of export format, of the resize filter, of the artboard colour. Each one
individually looks like the same small addition. Three of them in and the
`Snapshot` is a settings bag, the archive is at v9, every version bump is a
migration against user data with no backup, and the engine serializes a growing
set of values it never reads. The honest version of this decision was
alternative 1, and it lost to a feeling about professionalism rather than to an
argument about ownership — quality is not document state, and no amount of
storing it in the engine makes it document state.

Early warning sign to watch for: **a second non-engine parameter proposed for
the `Snapshot`.** The first time someone writes "and export format should be
undoable too, it's the same change", this ADR was wrong and the answer is a
separate undoable-settings mechanism outside the pixel-history snapshot — not
archive v7.
