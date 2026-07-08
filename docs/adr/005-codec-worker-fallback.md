# ADR-005: Encoding and thumbnailing move to a worker, with mandatory main-thread fallback
Date: 2026-07-02 (backfilled)   Status: draft

## Context
Export encoding and thumbnail generation run on the main thread;
large images block the UI for hundreds of ms. Full engine-in-worker
is the eventual goal but requires the registry refactor first.

## Decision
One module Web Worker (Comlink-wrapped) owns encodeImage and
makeThumbnail via OffscreenCanvas. Pixel buffers cross as
transferables only. Existing main-thread paths remain; on worker
construction/first-call failure, callers fall back silently with a
single console.warn.

## Consequences
+ Export/import stop blocking the UI; worst overnight-deploy outcome
  is "fallback fired, app behaves as before".
- Two code paths exist until the fallback is retired.
- Transfer semantics: callers needing pixels afterward must copy
  before transfer — easy to get wrong silently.

## Alternatives rejected
Engine-in-worker now — touches the flush path mid-refactor;
SharedArrayBuffer pool — needs COOP/COEP, unproven with Clerk.

## Pre-mortem
Mistake most likely because the fallback masked a broken worker for
weeks, shipping none of the intended benefit.
Early warning: the console.warn appearing in QC runs and being ignored.
