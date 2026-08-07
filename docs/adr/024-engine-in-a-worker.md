# ADR-024 — Moving the engine into a Web Worker

**Status: ACCEPTED 2026-08-07 — Option A, staged.**
Date: 2026-07-27 (findings), decided 2026-08-07. Supersedes nothing.
Measurements in `docs/engine-worker-feasibility.md`,
`docs/engine-worker-open-b-finding.md`, `docs/engine-worker-open-d-finding.md`.

## Decision

**Move both the engine and the main canvas into a Web Worker (Option A), in
six stages, behind a flag, with each stage independently shippable and
reversible.** Chris's words: *"A, but staged — not cowboy mode."*

**Why A.** The two arguments for Option B over A were the OffscreenCanvas
unknowns and the fear that asynchronous operations would scramble undo
ordering. Both were measured on 2026-08-07 and neither survived: zoom/pan
survive transfer 11/11 across four browsers and two engines, overlays stay
pinned 9/9, `desynchronized` is honoured 4/4, and op-log ordering is safe by
construction on a single port. A is also the only option where the *worst*
read-modify-write site — `flushToCanvas` reading `width`/`height` and then
recompositing, per frame, in the hot path — **disappears** rather than needing
a careful rewrite: under A that sequence never crosses the boundary.

**Why not C.** Its cost is unchanged and it is the one this ADR's own
pre-mortem feared: *"'Cold path' was obvious to whoever built it and to nobody
afterwards; calls migrated across the line one PR at a time until both engines
held state."* That is the same failure shape as the paid-tier tier-mismatch and
the two "Layers and Canvas" surfaces. C buys time and charges rent.

### The invariant this decision rests on

**ONE PORT.** Every mutation reaches the engine through a single message queue.
`OpLog::append` records arrival order — there is no sequence number anywhere in
`Op` — and a `MessagePort` is FIFO, so one port means postMessage order *is*
append order and the log is byte-identical to today's. Two ports, or any path
that reaches the engine outside the queue, and that guarantee is gone silently.
This is the thing to test, not to remember.

### Stages

Stages 1 and 2 change **no behaviour and introduce no worker**. They are worth
shipping even if the rest is abandoned, which is the point of ordering them
first.

| # | Stage | Ships | Reversible by |
|---|---|---|---|
| **0** | **OPEN-C first** — the registry↔routes↔palette↔ShortcutModal↔dispatch contract test | a test, no product change | n/a |
| **1** | **One port, no worker.** Route every engine call through a single dispatch module, still synchronous. Add the test that fails if anything reaches the engine off-queue | no behaviour change | plain revert |
| **2** | **The 8 read-modify-write sites.** Make each read + dependent write one atomic request. Still synchronous, still no worker | no behaviour change | plain revert |
| **3** | **The worker exists, off by default.** Message protocol with the four things the Phase 3 spike lacked: request ids, queueing, cancellation, errors. Flag `ih_engine_worker`, default OFF, both paths live | nothing user-visible | flag stays off |
| **4** | **Canvas transfer.** `canvas.width`/`height` assignments (`useEngineCore` ~240, ~324, ~406) move into the worker as messages; flush moves with them. Still flagged | nothing user-visible | flag stays off |
| **5** | **Measure, then flip.** A/B the 470 ms freeze against master. Default ON only if it is actually gone, with `ih_engine_worker=0` as the kill switch | the feature | kill switch |

Stage 5's gate is the pre-mortem's last line: *"Nobody measured after. The
freeze moved rather than disappeared."* The flip does not happen on the
strength of the architecture being correct; it happens on a measured frame
timeline showing the main thread idle during a 12-megapixel sharpen.

The flag follows the house pattern — `ih_tiles_flush`, `ih_oplog_undo`,
`ih_patchmatch` all shipped this way and all still carry a kill switch.

### What is deliberately NOT decided here

- **Persisted formats are untouched.** The op log, the archive and the Dexie
  schema are unchanged by every stage above. If a stage starts to need a format
  change, that is a new ADR and the `dexie-migration` skill, not a step.
- **wasm threads stay rejected.** Nothing here needs `SharedArrayBuffer`, so
  nothing here needs COOP/COEP. OPEN-A only matters if that reverses.
- **No timeline.** This is a multi-session arc, not a night job.

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

> **Status 2026-08-07: both measurable unknowns are closed, and the decision is
> made — Option A, staged.** See Decision at the top. OPEN-B and OPEN-D were the
> two questions that could have killed an option. Neither did, and both pointed
> the same way. OPEN-C is now a stage rather than a question.

- **OPEN-A** — does popup OAuth sign-in survive `COOP: same-origin`? Only
  matters if threads are ever pursued, which this project tried and rejected
  (8–31× slower). **Effectively dead.**
- **OPEN-B** — ~~does zoom/pan survive canvas transfer?~~ **ANSWERED — yes.**
  `docs/engine-worker-open-b-finding.md`. 11/11 across four browsers and two
  engines (Blink ×3, Gecko), plus overlays 9/9 and `desynchronized` honoured
  4/4. CSS fit, zoom and pan are element-level layout and never involved the
  drawing context, so transferring it changes nothing. The worker resized the
  backing store 1600×1200 → 800×600 and the on-screen size did not move.
  Remaining gap: no engine in the harness, and no WebKit.
- **OPEN-C** — sequencing: close #1's safety net before opening this? Still
  open, and now the *only* thing in front of the migration besides the option
  choice itself.
- **OPEN-D** — ~~op-log and undo ordering under async~~ **ANSWERED — safe by
  construction.** `docs/engine-worker-open-d-finding.md`. `OpLog::append`
  records arrival order with no sequence number, `apply` is atomic, and a Worker
  port is FIFO — so **one port** means postMessage order equals append order.
  The risk is not ordering but **9 read-modify-write sequences**
  (`scripts/engine-rmw-audit.mjs`), not the 119 value-consumed reads. The worst
  is `flushToCanvas` reading `width`/`height` then recompositing — which stops
  crossing the boundary at all under Option A.

**What that does to the options.** The two reasons to prefer B over A were the
OffscreenCanvas unknowns and the fear of async ordering. Neither survived
measurement, and Option A additionally dissolves the worst read-modify-write
site rather than requiring it to be rewritten. Option C's cost is unchanged and
is the one the pre-mortem was most worried about — an undocumented boundary
that migrates one PR at a time until both engines hold state.

**Still DRAFT. No option is chosen here — that remains Chris's call.**
