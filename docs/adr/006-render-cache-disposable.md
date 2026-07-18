# ADR-006: Working copies become a disposable render cache; truth is original + op log
Date: 2026-07-02 (backfilled)   Status: Accepted (2026-07-17)
Accepted on the four-check A/B (v7.36): a plain stroke and an AI result
both persisted and restored from the op log on a real gallery — the
Diagnostics read "restored", full dimensions and Canvas intact, with
the write path inspected at the IndexedDB level (correct post-artboard
base keyframe, 1 chunk, canvas metadata in the annotations blob). The
working copy remains the fallback for retired/failed logs.
The persistence layer: Dexie v2 adds
opLogs/keyframes/oplogManifests (additive; ADR-012 document model), the
debounced write path commits chunks + keyframes + manifest in one
transaction, and restore replays from the base keyframe —
persist→reload→restore proven byte-identical at the engine level
(`src/ops_engine_parity.rs::persist_restore_round_trip_is_byte_identical_across_keyframes`).

A gap audit on 2026-07-13 found and closed **two silent-corruption paths**
that had to be fixed before this could be Accepted (both were live only with
the flag on, both now regression-tested):
1. **Log identity.** `oplog_generation()` is not an identity — a fresh log
   restarts at 0 — so a *new* log on the same photo (AI result, re-load,
   failed restore) could append its ops onto the *previous* log's chunks, over
   the previous base keyframe. The write path now appends only against a
   binding proving the engine holds the log those chunks describe; anything
   else rewrites.
2. **Log retirement.** A log that goes broken (unrecorded edit) or whose
   document goes multi-layer still *replays perfectly* — into a document the
   user no longer has. Such a log is now marked `stale` and skipped by
   restore, so the (current) working copy carries the resume.

USE_OPLOG_PERSISTENCE still ships OFF and the working-copy path remains the
fallback. **Flip to Accepted after the real-gallery check** (below) plus a
dogfooding period — not before; nothing here has yet touched a real photo.

## Context
Today the flattened working copy in IndexedDB IS the edit state:
16 MB-class rewrites per save, torn writes can corrupt work, history
cannot survive reload.

## Decision
Truth = originals (content-addressed, immutable) + opLogs
(+ keyframes). renderCache stores an encoded composite (WebP) tagged
with atOp, read by resume/gallery. Any migration may clear it;
mismatch or corruption falls back to keyframe + replay. One
readwrite transaction per save event; encode work happens before the
transaction opens (auto-commit rule).

## Consequences
+ Saves shrink to op appends; torn cache writes cannot lose work;
  edits survive reload via the log.
+ Blob-encoded cache cuts per-photo footprint ~8-16x vs raw RGBA.
- Content-addressed stores need GC (refcount or idle mark-and-sweep)
  once tiles/branches share blobs.
- Cold resume without a valid cache pays a replay.
- **An append is only sound against a proven log identity.** A document
  reset (AI result, re-load) unbinds the log, so the photo's persisted
  history is rewritten from the new base — the previous session's undo
  history for that photo is dropped rather than spliced. Pixels are never
  lost (the new base keyframe IS the current document); only replayable
  history is.
- **The log can stop being the truth mid-session** (unrecorded edit →
  broken; multi-layer → out of scope). It is then retired (`stale`) and the
  working copy — which must therefore keep being written — carries the
  resume. "Working copies are disposable" holds only for documents the log
  can model.

## Alternatives rejected
Keep flattened-copy-as-truth — simplest, but every listed defect is
inherent to it.

## Pre-mortem
Mistake most likely because GC was deferred indefinitely and storage
growth surfaced as user-visible quota errors.
Early warning: Storage pane totals growing after photo deletions.

Second, sharper failure: the log replays *confidently* into the wrong
document. Both corruption paths found on 2026-07-13 shared that shape — the
data was well-formed, the restore "succeeded", and the user silently got an
older document back. A snapshot save is dumb and cannot be wrong that way.
Early warning: any resume that lands on pixels the user did not last see, or
a Diagnostics "Persisted" row whose op count disagrees with the live Op Log.

## Real-gallery check required before Accepted
With `localStorage.ih_oplog_persist = "1"` on a profile that has a real
gallery (this is the only verification that matters — none of it has been
done on real photos yet):
1. Edit → reload → the photo comes back exactly as left, and **undo still
   walks back through the pre-reload strokes** (Diagnostics "Persisted" shows
   `… · restored`).
2. A photo with a working copy but **no** op log still opens (legacy bridge),
   and its first edit starts a log from a keyframe of the current state.
3. Add a layer to a photo that has a log, reload → the LAYERS come back (the
   log retires; the working copy wins). Same for a clone-stamp edit.
4. Run an AI action (Remove Background) on a photo that has a log, edit,
   reload → the AI result comes back, not the pre-AI image.
5. Flip the flag back off → everything still opens from the working copy.
