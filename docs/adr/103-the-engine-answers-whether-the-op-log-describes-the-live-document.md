# ADR-103: The engine answers whether the op log describes the live document, by comparing the two
Date: 2026-11-05   Status: draft (proposed)   Relates to: ADR-024, ADR-088

## Context

JS inferred coverage from `undo_count > oplog_cursor`. One undo gesture can
record several ops (deleting a pin renumbers the others), and the history cap
trims undo depth, so undo depth sits below the cursor and an unrecorded edit
fits in the gap. A persisted log then restores cleanly without that edit.
Measured after a solid redaction: undo=5, cursor=6, broken=false; the restore
succeeded and the hashes differed.

Second half: `onOplogFlush` returned "nothing new" when the op counters had not
moved, so an unrecorded edit on an already-saved log never reached a save at all.

## Decision

**`oplog_coverage()`** compares the log's composite with the engine's at save
time and returns 0 missing, 1 covered, 2 an edit is open. On 0 the persisted log
is retired. On 2 the save still writes, because refusing would keep older
recorded edits off disk, and the binding stays `UNVERIFIED` so the flush closing
the edit checks again. It compares composites rather than pixels only, because
unrecorded layer metadata (masks, overlays) changes the composite and not the
pixels. It runs per save, never per frame.

**`oplog_edit_revision()`** is `hist.generation` (which also catches the clone
stamp, which bypasses `snap()`) plus a counter of `continue_step` joins. The
flush compares it to the last verified revision, so an unrecorded edit now
reaches a save.

`oplog_engine_in_sync` now compares bytes directly instead of hashing both,
which is cheaper for undo too. The `undo_count` check stays as a cheap per-flush
signal. ADR-024-F4 (record clone stamp, emoji, Magic Eraser) stays open; this
does not replace it. No on-disk format change, so no Dexie migration and no
`OP_FORMAT_VERSION` bump.

## Consequences

+ An unrecorded edit can no longer hide in the gap and come back undone on restore.
+ The failure direction is safe: a false mismatch only retires the log and falls
  back to the working-copy archive, never data.
- A full document compare per save: 114 ms with a Canvas, 32 ms without, measured
  in the shipped wasm at 2068x1556. Accepted. Wasm 957,006 -> 957,088 B (+82).
- Known limit: logs already saved before this fix can't be checked at restore.
- Until F4, an unrecorded edit still costs the log; only the data loss is fixed.

## Alternatives rejected

- **Marking at each snap whether its gesture recorded:** recording happens after
  the snap and sometimes in a later recomposite, and no-op steps would read as edits.
- **Comparing gesture counts:** history caps break it.
- **Recording redaction and pixelate as ops:** F4's job, not needed to stop the loss.

## Pre-mortem

It is six months from now and this was a mistake. The likeliest way: documents
keep growing, the per-save compare grows with them, and it starts to be felt on
large multi-layer documents, or someone moves the call onto a hotter path because
the name reads as cheap. The 114 ms figure is one size, not a ceiling.

**Warning signs:**
- an autosave pause traced to `oplog_coverage` on a large document;
- or an `oplog_coverage` call outside the save path.
