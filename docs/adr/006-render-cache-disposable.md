# ADR-006: Working copies become a disposable render cache; truth is original + op log
Date: 2026-07-02 (backfilled)   Status: draft

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
