# ADR-024 — Moving the engine into a Web Worker

**Status: DRAFT — findings only. No option is chosen.**
Date: 2026-07-27. Supersedes nothing. Measurements in
`docs/engine-worker-feasibility.md`.

## Context

Every call into `stamp_tool` runs on the main thread today. A 12-megapixel
sharpen blocks it for ~470 ms, and during that time nothing paints, no pointer
event is handled, and no spinner animates. The motivation for moving the engine
into a worker is responsiveness, not throughput.

Phase 0 was a measurement night. What it found changes the shape of the
decision.

## What was measured

1. **No `SharedArrayBuffer` is required.** A worker owning its own wasm
   instance and exchanging transferable `ArrayBuffer`s needs no shared memory,
   so no COOP/COEP headers. The app ships no threads today — `threads` is an
   optional Cargo feature and the shipped build passes only
   `--features tiles,patchmatch`, so the "rayon-parallel blur" is scalar in the
   binary users run. Cross-origin isolation only comes back if wasm *threads*
   are wanted later, which this project already tried and rejected (8–31×
   slower).

2. **Isolation would work anyway.** Under `COOP: same-origin` +
   `COEP: require-corp` the production build is `crossOriginIsolated`, gets
   `SharedArrayBuffer`, boots the engine, loads Clerk, and logs no errors.
   Popup-based OAuth sign-in was *not* exercised (OPEN-A).

3. **206 call sites** — 77 fire-and-forget, **117 value-consumed synchronously**,
   12 hot-path, across 32 files. The 117 are the job.

4. **The boundary costs 0.100 ms** median (p95 0.300 ms) — 0.6% of a 60fps
   frame. Carrying a 48 MB transferable adds 0.5 ms. Latency is not the problem.

5. **The main canvas has exactly one writer** (`useEngineCore`). Every overlay
   either draws to its own canvas or is SVG; `CanvasArea` only measures.

## The decision to make

**Latency was the assumed risk and it is not real. The real cost is 117
synchronous reads becoming asynchronous, in a codebase where some of them run
during render.** Any option must be judged on that, not on milliseconds.

### Option A — Full migration: engine + canvas both in the worker

Move the engine and `transferControlToOffscreen()` the main canvas.

- **For:** the main thread stops doing pixel work entirely; the 470 ms freeze
  becomes a spinner that actually spins. Canvas transfer is unusually clean here
  because of the single-writer finding.
- **Against:** all 117 rewrites, plus moving `canvas.width/height` assignments
  into the worker, plus a real message protocol (ids, queueing, cancellation,
  errors). The two `CanvasArea` render-time reads (`measure_text`,
  `text_ink_offset`) cannot simply be awaited.

### Option B — Engine in the worker, canvas stays on the main thread

Worker owns pixels; each flush transfers a buffer back to be drawn.

- **For:** avoids the OffscreenCanvas unknowns (OPEN-B) entirely. Overlays and
  zoom/pan logic are untouched. Still removes the freeze.
- **Against:** a buffer copy out of wasm memory per flush (measured at 53 ms for
  48 MB — real, though it overlaps nothing today either). Still all 117 rewrites.

### Option C — Cold-path only

Only long operations (filters, resize, export, PatchMatch, OCR) move; brush
strokes, selection preview and text layout stay synchronous on the main thread.

- **For:** buys most of the benefit for a fraction of the risk. The audit shows
  the pain is concentrated in batch/serialisation files —
  `useSelectionActions`, `editPersistence`, `openraster/export`, `useLayers`
  hold 63 of the 117 and can `await` freely. The 12 hot-path sites, which are
  the awkward ones, would not move at all.
- **Against:** two engines' worth of state to keep coherent, or a rule about
  which calls may run where. That rule is exactly the kind of undocumented
  boundary that produced the paid-tier and share-link bugs.

### The idea worth stealing regardless of option

`width`, `height`, `layer_count`, `active_layer_id` and friends are cheap
scalars. **A state snapshot mirrored to the main thread on every change removes
them from the async problem entirely** — those call sites read a plain local
object and never become async. It also solves the two render-time reads in
`CanvasArea`, which have no other clean answer.

> **CORRECTED 2026-08-06 — this said "~25 of the 117". The measured number is
> 8.** Phase 1a went and counted (`ca47935`, preserved as the tag
> `abandoned/scalar-mirror`, written up in
> `docs/engine-worker-scalar-mirror-finding.md`). Two things it found change
> this section rather than just its arithmetic:
>
> - **The mirror already exists and already has exactly one publisher.**
>   `syncState()` in `useEngineCore.ts` is the sole writer and already
>   publishes `width`, `height`, `layers`, `activeLayerId`, `undoCount`,
>   `redoCount`, `zoom` and `hasTransparency`. The pre-mortem below worries
>   about a mirror that drifts because nothing owns it; that risk is already
>   retired, and the section should be read with that in mind.
> - **The consumers cannot reach it.** Of 38 value-consumed scalar sites, 14
>   are plain modules with no hook context — they receive the engine handle as
>   a parameter. Repointing is what is expensive, not mirroring.
>
> The brief that opened Phase 1a set its own bar: *"117 → ~90 is a different
> project than 117 → 112."* The achievable number is **117 → 109**, which
> lands on the wrong side of it. Phase 1a stopped there deliberately and built
> nothing.

## Pre-mortem — it is six months later and this went badly

- **The snapshot drifted.** The mirrored state and the engine disagreed after
  some path forgot to publish. Symptoms were geometric and intermittent. This is
  the third instance of the same failure in this codebase (Convex tier vs UI
  tier; rail vocabulary vs canvas vocabulary) — the mirror needs one publisher
  and a test, from day one.
- **Option C's boundary was never written down.** "Cold path" was obvious to
  whoever built it and to nobody afterwards; calls migrated across the line one
  PR at a time until both engines held state.
- **The 117 were done mechanically.** Each `await` was correct in isolation, but
  operations that used to complete between two paint frames now interleave, and
  the op-log recorded them in an order the undo stack could not reproduce.
  **The op-log and persisted formats were explicitly out of scope for Phase 0
  and remain the least-understood risk.**
- **Nobody measured after.** The freeze moved rather than disappeared, because
  the flush path still runs on the main thread and it was never the engine that
  was slow.

## Recommendation

None, per the brief. But the sequencing observation from the feasibility doc
belongs here too: **the 117 rewrites will touch dispatch and tool state, and #1's
contract test — the registry↔routes↔palette↔ShortcutModal↔dispatch drift guard —
is worth more before that than after it.**

## Open questions

- **OPEN-A** — does popup OAuth sign-in survive `COOP: same-origin`? Only
  matters if threads are ever pursued.
- **OPEN-B** — does zoom/pan survive canvas transfer? Today the element is
  CSS-sized while its backing store stays at image resolution; that split is
  unverified under transfer.
- **OPEN-C** — sequencing: close #1's safety net before opening this?
- **OPEN-D** — what happens to the op-log and undo ordering when operations
  become asynchronous? Untouched by Phase 0 by instruction, and the largest
  remaining unknown.
