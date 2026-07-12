# ADR-006: Working copies become a disposable render cache; truth is original + op log
Date: 2026-07-02 (backfilled)   Status: draft
Blocked on: dogfooding + shipping. As of 2026-07-11
(`feat/tile-wiring-oplog-undo`, unmerged) the persistence layer
exists end to end: Dexie v2 adds opLogs/keyframes (additive; ADR-012
document model), the debounced write path commits chunks + keyframes
+ manifest in one transaction, and restore replays from the base
keyframe — persist→reload→restore proven byte-identical at the
engine level (src/ops_engine_parity.rs). USE_OPLOG_PERSISTENCE ships
OFF; the working-copy path remains the fallback. Flip to Accepted
after the real-gallery check + a dogfooding period.

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

## Alternatives rejected
Keep flattened-copy-as-truth — simplest, but every listed defect is
inherent to it.

## Pre-mortem
Mistake most likely because GC was deferred indefinitely and storage
growth surfaced as user-visible quota errors.
Early warning: Storage pane totals growing after photo deletions.
