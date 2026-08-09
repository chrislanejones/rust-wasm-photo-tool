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

**ONE PORT PER DOCUMENT.** Every mutation *of the document the user is editing*
reaches the engine through a single message queue.

> **Corrected 2026-08-07, during Stage 1.** This originally read "every mutation
> reaches the engine through a single message queue", and that version causes a
> regression rather than preventing one. Two modules legitimately build their
> own engine for a document the user is NOT editing — `lib/exportImage.ts`
> (compositing a saved edit during a batch export) and
> `features/tools/settings/BatchSettings.tsx`. They are separate documents with
> their own lifetimes and no op log. Routing them through the live port would
> put their ops in the live document's log — undo would replay edits to a photo
> nobody opened — and would serialise a 40-photo batch behind the open photo,
> which is the stall this arc exists to remove. A structural test written
> against the uncorrected wording flags both as violations, and the obvious fix
> is that regression, made by someone trusting the test.

`OpLog::append` records arrival order — there is no sequence number anywhere in
`Op` — and a `MessagePort` is FIFO, so one port means postMessage order *is*
append order and the log is byte-identical to today's. Two ports, or any path
that reaches the engine outside the queue, and that guarantee is gone silently.

**This is the thing to test, not to remember** — and as of Stage 1 it is tested:
`app/src/lib/engine/engineOwnership.contract.test.ts` fails on a second writer
to the live handle, on an engine constructed outside the owner and outside the
declared throwaway allowlist, and on an assignment that bypasses the port seam.
All three were mutation-tested rather than assumed.

### Stages

Stages 1 and 2 change **no behaviour and introduce no worker**. They are worth
shipping even if the rest is abandoned, which is the point of ordering them
first.

| # | Stage | Ships | Reversible by |
|---|---|---|---|
| **0** | **OPEN-C first** — the registry↔routes↔palette↔ShortcutModal↔dispatch contract test | a test, no product change | n/a |
| **1** | **One port, no worker.** ✅ **DONE 2026-08-07.** `lib/engine/port.ts` is the named Stage-3 swap point (identity today); `engineOwnership.contract.test.ts` fails on a second writer, an undeclared engine, or a bypassed seam. NOT the ~152-call-site rewrite first imagined — the ownership invariant already held (`toolRef` created once, assigned only in `useEngineCore`), so the missing piece was the seam and the guard, not churn | no behaviour change | plain revert |
| **2** | **The read-modify-write sites.** ✅ **DONE 2026-08-07 — 9 → 3, all FEED sites gone.** Two engine methods absorbed the decisions: `flatten_text_annotations` returns whether it flattened, and `blur_whole_image` computes its own geometry. Four JS guards deleted. The 3 remaining are 2 that dissolve at Stage 4 (`flushToCanvas`) and 1 false positive (`align_annotation`'s return is a mutation's result, not stale-able state) | no behaviour change | revert **+ `build:wasm`** |
| **3** | **The worker exists, off by default.** ✅ **DONE 2026-08-07.** `workers/engine.worker.ts` (own wasm instance, one-at-a-time FIFO `drain()`) + `lib/engine/workerClient.ts` (request ids, 30 s timeout that also withdraws the queued call, `failAll` on crash). All four gaps the Phase 3 spike had are closed. Deliberately **not** Comlink — see the file header; Comlink gives correct results with no ordering promise, and arrival order *is* the op log. Flag `ih_engine_worker`, default OFF. The build emits **no worker chunk**, because nothing imports it yet — that is the honest status, not an oversight | nothing user-visible | flag stays off |
| **3.5** | **The async conversions — 168 → 138 as of v7.84.** ADDED 2026-08-07, **recounted 2026-08-08 — the old figures were an undercount, see below.** `scripts/engine-call-audit.mjs` now counts 290 call sites: 101 fire-and-forget (a postMessage suffices), **162 value-consumed** (each needs a Promise *and* a call-site restructure), 27 hot-path. Until these are done the Stage 3 flag can never be turned on, so Stage 3's worker is scaffolding. Batches by file, value-consumed only — `editPersistence` 18, `useEngineCore` 17, `useSelectionActions` 15, `openraster/export` 13, `useLayers` 13, `useEditPersistence` 12. Same flag, still OFF. **a1 (measurable gate) v7.79 · a2 (text-metrics cache) v7.80 · a3 (one-call save capture) v7.84.** a3 also found the category this ADR missed — see "ATOMIC CAPTURE" below, and triage every remaining file against it before converting | nothing user-visible | flag stays off |
| **4** | **Canvas transfer.** **SCOPE CORRECTED 2026-08-08 — it is not just the `width`/`height` assignments; see "Stage 4's real scope" below.** Three subsystems must leave the main canvas first (engine flush, the arrow/shapes/crop rubber-band preview, lossy export), and canvas element *identity* has to be owned. Still flagged | nothing user-visible | **NOT by the flag alone** — see the kill-switch note |
| **5** | **Measure, then flip.** A/B the 470 ms freeze against master. Default ON only if it is actually gone, with `ih_engine_worker=0` as the kill switch | the feature | kill switch |

**Why 3.5 exists.** It was not in the original list, and its absence is the
kind of gap this ADR's own pre-mortem warns about: Stage 3 ships a worker, Stage
5 flips a flag, and nothing in between owned the work that makes the flag
flippable. Discovered while starting Stage 3 — the seam was ready and the call
sites were not. Note the two counts are different lists and neither subsumes the
other: **Stage 2 fixed 6 read-modify-WRITE sequences** (a read whose value
informs a later mutation, 9 → 3); **Stage 3.5 is the 162 plain value-consumed
READS**, which were never in that count. Reducing one did not reduce the other.

**The recount, 2026-08-08 — the audit was undercounting by a third.**
`engine-call-audit.mjs` matched engine calls by receiver name and only knew
three literal names (`toolRef.current`, `tool`, `engine`). The dominant shape in
this codebase is an alias — `const t = toolRef.current; t.width()` — and every
one of those was invisible. That hid **93 of 290 call sites (33%)**, including
`editPersistence.ts` entirely and most of `useTransforms`, `useLayers` and
`usePaintTool`. The script now resolves per-file aliases; the header records the
gap that is still open (handles arriving as typed parameters).

The per-file batching numbers in the old table were the worst casualty, because
they mixed totals with the value-consumed subset. `useTransforms` was listed as
the second-biggest job at 25; it has **20 sites of which only 3 are
value-consumed** — 17 are fire-and-forget, so it is one of the cheapest files,
not the second-hardest. The genuinely biggest file, `editPersistence.ts` at 18
value-consumed, was not in the list at all. **Anyone batching Stage 3.5 off the
old numbers would have started in close to the wrong place.**

**The part of 3.5 that had no answer — ANSWERED 2026-08-08.** It needs neither
a mirrored snapshot nor a new mechanism. The paragraph that used to sit here
was wrong in both directions: it counted a site that is not a render read, and
missed two that are.

The claim was: *three of the 121 are read during render — `selection_preview`,
`measure_text` and `text_ink_offset` in `CanvasArea` — so they need a
synchronous local answer, a mirrored snapshot or a layout cache.* What is
actually there:

| Site | Method | Render read? | Reads engine state? | What it needs |
|---|---|---|---|---|
| `CanvasArea.tsx:688` | `selection_preview` | **No** | yes | Nothing special — it sits inside a `requestAnimationFrame` callback, which can `await`. An ordinary Stage-3.5 conversion |
| `CanvasArea.tsx:2018` | `measure_text` | Yes | **No — pure** | A memo cache. `self` is never touched |
| `CanvasArea.tsx:2185` | `text_ink_offset` | Yes | **No — pure** | Same cache |
| `AppShell.tsx:2882` | `export_width_excluding_background` | Yes | yes | Lift out of render (see below) |
| `AppShell.tsx:2888` | `export_height_excluding_background` | Yes | yes | Same |

**The two text metrics are pure functions.** `measure_text` is
`crate::text::measure(text, font_size, bold)` (src/lib.rs:3457 → src/text.rs:220)
and `text_ink_offset` is `crate::layer::annotation_ink_offset(...)`
(src/annotations.rs:1131 → src/layer.rs:649). Both targets are **free
functions**; both wrappers take `&self` purely as a wasm-bindgen calling
convention and read no field. That collapses the problem the old paragraph
described. A *mirror* of engine state has to be invalidated whenever the engine
changes — that cost is what made this look hard. A *cache of a pure function
keyed on its arguments can never go stale*, so there is nothing to invalidate
and nothing to keep in step. The scalar mirror
(tag `abandoned/scalar-mirror`) is not rehabilitated by this; it is not needed.

**The two AppShell reads were never counted, and they are the expensive ones.**
They are JSX prop values on `<ShareButton>`, so they evaluate whenever AppShell
renders. Each one calls `composite_excluding_background()`, which composites
every layer into a full-document RGBA buffer and then runs `tight_bbox` over it
— **a whole-image composite to return one integer**, twice per render.

They are guarded by a ternary on the `exportCanvasBackground` preference, and
its default ("Include canvas") takes the other branch, so the default path
costs nothing. With the preference set to "Photo only" the guard opens:

Measured twice, on different builds and by different methods. Both confirm it;
**take the production row as the user-facing number.**

| Build | Method | `Include canvas` (default) | `Photo only` |
|---|---|---|---|
| dev, 2.9 MP | count calls via prototype patch | **0** calls | **24** composites, 525.7 ms of engine time |
| **production, 3.0 MP** | `PerformanceObserver` long tasks | **0** long tasks, 0 ms | **2** long tasks, **105 ms** blocked |

The two figures are not the same measurement and should not be reconciled into
one. The dev run instruments every call and sums total engine time; the
production run counts only tasks over 50 ms, so it is a floor on total work and
a fair estimate of *perceptible* blocking. Dev also double-renders under
StrictMode, so its call count overstates production.

What matches exactly is the shape: **zero on the default preference, one
composite per zoom click on `Photo only`.** That is the defect.

Instrumentation detail worth keeping: the dev run's first result was 0 calls,
which is also what a broken probe returns — a control call proving the patch
intercepted came before the zero was trusted. A single call costs **29.7 ms**
in wasm at 2.9 MP.

⚠️ **Correction 2026-08-08 — an earlier version of this paragraph said the
native bench's 41.6 + 39.1 ms at 12 MP meant this "scales several-fold on a
large photo". That is wrong: a 12 MP document cannot exist in this app.**
`makeWorkingCopy` downscales every import to `WORKING_MAX_EDGE = 2048` on the
long edge (`lib/workingCopy.ts`), and no caller overrides it — so the engine
document tops out around 2048² plus the canvas border, roughly **4.3 MP**. The
2.9–3.0 MP figures measured here are already near the practical ceiling, not a
small sample of a much worse case. The defect was real and worth fixing; its
worst case is ~1.5× what was measured, not fivefold.

The native bench numbers are still valid as engine cost per megapixel — they
just describe a document size the app will not hand you.

**That is a live defect on master, not a worker problem**, and it is
independent of this ADR — a user who picks "Photo only" pays a whole-image
composite twice on every AppShell render, for two integers only read while the
export dialog is open. The fix is to lift them out of render (an effect keyed
on the open dialog, or two more fields on `syncState`, which already publishes
`width`/`height` right beside them and which both call sites already fall back
to). Either shape is `await`-able, so under the worker these become ordinary
Stage-3.5 conversions too. **Do not add them to `syncState` naively** —
`syncState` runs after every mutation, and hanging two full composites off it
would be far worse than the bug.

### The category this ADR missed — ATOMIC CAPTURE (found 2026-08-09, a3)

**Before converting any file, ask whether its engine reads form one coherent
picture. If they do, they cannot be converted call-by-call at all.**

This ADR addresses two hazards: op-log **ordering** (Stage 1's one-port
invariant) and **read-modify-write** (Stage 2). There is a third, and Stage
3.5's instruction — "make every value-consuming call async" — actively builds it.

The save path reads ~18 values to describe one document: canvas PNG and size,
every undo and redo snapshot, the live overlays, the layer stack.
`useEditPersistence.ts` already said what depended on that:

> "Everything above reads the engine, and there is not a single `await` in it.
> That is load-bearing, not incidental. […] If anyone ever adds an `await` above
> this line, detaching stops being safe and this comment is the reason why."

`detachCloudUpload` returns as soon as the local write lands rather than
blocking ~13s on the network, and that is only safe because the bytes were
already captured. Yield midway and a photo switch completes underneath: the
second half of the archive describes the **incoming** photo, stored under the
**outgoing** photo's key.

**Today this hides.** `await` on a synchronous value yields only to the
microtask queue, so DOM events cannot interleave and a converted sequence looks
fine. Behind the worker every await is a real round trip, and a switch, stroke
or undo lands mid-capture. Nothing throws. The archive is simply wrong, in the
cloud copy where the local guard cannot see it.

**The fix is not to guard the sequence — it is to remove it.** `capture_state()`
(v7.82, `src/capture.rs`) returns the whole picture in one call; `&self` cannot
be mutated while it runs, so atomicity is structural rather than a comment
nobody can enforce. v7.84 moved both save paths onto it and deleted ~32
conversions instead of turning each into a hazard.

**Triage rule for the remaining sites.** For each file, before converting:

| Question | If yes |
|---|---|
| Do these reads describe one document state that is then written, uploaded or archived? | Do NOT convert individually — give the engine one call, as a3 did |
| Does an existing comment say the absence of `await` matters? | Believe it, and read why before touching anything |
| Do reads already interleave with `await` today? | Pre-existing; note it, do not silently make it worse |

`lib/openraster/export.ts` is the next one to look at with this lens: it already
interleaves `await import("jszip")` between its reads AND mutates the live
document mid-export (`set_active_layer` + `flatten_text_annotations`). That is a
pre-existing problem, not one Stage 3.5 would introduce, but it should not be
swept through as a routine conversion.

**Net: zero of the five need a synchronous engine read across the boundary**,
so the ordering worry that put this paragraph here is resolved — nothing in
3.5 has to wait for a new mechanism to be designed first.

### Stage 4's real scope — investigated 2026-08-08

`transferControlToOffscreen()` is permanent **for the element it is called on**.
Afterwards, on the main thread, `getContext()`, `toBlob()`/`toDataURL()` and any
`width`/`height` **assignment** all throw `InvalidStateError`. Reads of
`width`/`height`, `getBoundingClientRect`, styles and events keep working.

Audited every main-thread touch of the main canvas (129 of them). Three
subsystems break, and **the stage list only ever named one**:

| Subsystem | Sites | In the stage list? | Why it breaks |
|---|---|---|---|
| Engine flush | `useEngineCore` 199, 260, 343, 425 + the `width`/`height` assignments | yes | intended — it moves with the engine |
| **Rubber-band preview** (arrow / shapes / crop) | `useDrawingTools` 731, 771, 821 | **no** | `getImageData` on mousedown, `putImageData` + preview draw **per pointermove**, on the main canvas |
| **Lossy export** (JPEG / WebP / AVIF) | `useExport` 58, 86 | **no** | `canvas.toBlob()` reads pixels back off the element. PNG is unaffected — it goes through `export_png()` |

**This retires measured finding #5.** That finding reads *"The main canvas has
exactly one writer (`useEngineCore`). Every overlay either draws to its own
canvas or is SVG; `CanvasArea` only measures."* `useDrawingTools` is a second
writer and it writes on every pointermove — `ctx.putImageData(preSnapshot, 0, 0)`
followed by `drawArrowPreview`/`drawShapePreview`. `CanvasArea` measuring only
is still true; the single-writer claim is not.

It is also a standing violation of the project invariant *"the engine owns
pixels — no canvas 2D pixel manipulation in React land"*. Stage 4 is where that
debt comes due: the preview has to move to its own overlay canvas or into the
engine before the main canvas can be transferred.

### The one-way door, and why the flag is not enough

The stage table used to say Stage 4 was reversible by "flag stays off". For a
page **load** that is true — no transfer happens with the flag off. But
`ih_engine_worker=0` is specified as a *runtime kill switch*, and once the
element is transferred, nothing can give its 2D context back. **A kill switch
flipped mid-session cannot restore the main-thread path on that element.**

The fix is cheap and the codebase already runs it: **never transfer the
long-lived element — key the `<canvas>` on the mode so switching remounts it.**
A remounted element is a new DOM node and was never transferred.

`CanvasArea.tsx:528–556` already documents and handles exactly this: *"The
`<canvas>` DOM element gets re-created whenever the surrounding tool wrapper
changes... WASM still holds the pixels but they need to be re-blitted"*, with a
`useEffect` that re-flushes on ref change, dimension change and container
resize. Losing the bitmap on a remount is already normal and already recovered
from, because the engine owns the pixels.

⚠️ **That same behaviour is a hazard in the other direction, and it is the
sharpest thing on this page.** The canvas element is re-created on ordinary tool
switches — not just on a mode flip. In worker mode a remount leaves the worker
holding the OffscreenCanvas of a **detached** element: it keeps drawing, nothing
throws, and the user sees a blank canvas. So Stage 4 must own canvas element
*identity* — every remount re-transfers and the worker drops the stale handle —
and that is a larger job than moving the `width`/`height` assignments.

**Recommended ordering**, since none of it needs the worker to exist:

| # | Work | Ships on its own? |
|---|---|---|
| 1 | Move the rubber-band preview off the main canvas | yes — also pays down the pixels-in-React-land invariant |
| 2 | Route lossy export through the engine like PNG already is | yes |
| 3 | Make canvas element identity explicit and remount-safe | yes |
| 4 | Then transfer | needs 1–3 |

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

5. ~~**The main canvas has exactly one writer** (`useEngineCore`). Every overlay
   either draws to its own canvas or is SVG; `CanvasArea` only measures.~~
   **RETIRED 2026-08-08 — this is false and it was load-bearing.**
   `useDrawingTools` (731, 771, 821) takes a 2D context on the main canvas and
   writes to it on every pointermove to draw the arrow/shapes/crop rubber-band
   preview. `useExport` (58, 86) reads pixels back off it via `toBlob` for the
   lossy formats. The `CanvasArea`-only-measures half is still true. See
   "Stage 4's real scope" — this finding is cited as the reason canvas transfer
   is "unusually clean here", and that conclusion does not survive it.

## The decision to make

**Latency was the assumed risk and it is not real. The real cost is 117
synchronous reads becoming asynchronous, in a codebase where some of them run
during render.** Any option must be judged on that, not on milliseconds.

### Option A — Full migration: engine + canvas both in the worker

Move the engine and `transferControlToOffscreen()` the main canvas.

- **For:** the main thread stops doing pixel work entirely; the 470 ms freeze
  becomes a spinner that actually spins. ~~Canvas transfer is unusually clean
  here because of the single-writer finding.~~ **That clause is withdrawn —
  finding #5 was retired 2026-08-08.** Transfer is not clean here: two
  subsystems outside the engine still need a 2D context on the main canvas.
  The decision for A stands (it rested on the OffscreenCanvas and op-ordering
  measurements, not on this), but Stage 4 is more expensive than it looked.
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
