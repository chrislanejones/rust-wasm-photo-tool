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
| **3.5** | **The async conversions — 168 → 59 as of v8.5, and THE TARGET IS 5, NOT 0 (see below).** ADDED 2026-08-07, **recounted 2026-08-08 — the old figures were an undercount, see below.** ⚠️ **This figure goes stale every batch; `scripts/engine-call-audit.mjs` is the authority and `engineAsyncMigration.contract.test.ts` pins it. If they disagree with this line, they are right.** `scripts/engine-call-audit.mjs` now counts 290 call sites: 101 fire-and-forget (a postMessage suffices), **162 value-consumed** (each needs a Promise *and* a call-site restructure), 27 hot-path. Until these are done the Stage 3 flag can never be turned on, so Stage 3's worker is scaffolding. The per-file batch list that used to sit here named six files; **four of them have since shipped** (`editPersistence` and `useEditPersistence` v7.84, `useLayers` v7.85, `useEngineCore` v7.90) and it was read as outstanding work for days after they were done. It is deliberately not replaced with another hand-written list — run the audit, which prints remaining-by-file. Same flag, still OFF. **a1 (measurable gate) v7.79 · a2 (text-metrics cache) v7.80 · a3 (one-call save capture) v7.84 · a4 (one-call pixels+dimensions capture) v7.88 — 121 → 103 · a5 (one-call UI-state capture) v7.90 — 103 → 94 · a7 (the hit-test capture) v7.94 — 93 → 92 · a7 cont. (the OpenRaster captures) v7.95 — 92 → 87 · **a8 scoping v7.97 — 87 → 81, RECLASSIFICATION not work** · **a8 batch 1 v7.98 — 81 → 76, `useHistory.ts` 5 → 0** (four truthy traps, same shape as `useLayers`; the ratchet was mutation-tested and DOES catch a dropped `await`, 5/5) · **a8 batch 2 v7.99 — 76 → 74** (`loadImageFromPixels`'s two reads) · **a8 scoping pass 2 v8.0 — 74 → 80, the number went UP** (19 discrete actions came back from a10; hot 32 → 13) · **a8 batch 3 v8.1 — 80 → 77** (`useTransforms`; also fixed two literal NUL bytes that made `textMetricsCache.ts` invisible to every grep, and found that **`textMetricsCache`'s 3 sites cannot be awaited at all** — they run in React's render pass and their documented resolution, `primeTextMetrics()`, was never written) · **a8 scoping pass 3 v8.2 — 77 → 73**: four sites in `lib/tilesFlush.ts` and `lib/oplogPersistence.ts` are called from `flushToCanvas` ACROSS A FILE BOUNDARY (`syncOplog`, `isLogTrustworthy`). The enclosing-name test only sees a function's OWN name, so a hot caller in another module is invisible to it — a new SHAPE of miss, not a new instance of an old one. · **a8 batch 4 v8.3 — 73 → 67**: the export layer (`useExport` 4→0, `lib/exportImage` 2→0). `generateThumbnailUrl` needed a RESTRUCTURE not an await — it checked its result inside a manual `new Promise` executor, where an async callee turns the guard into a truthy trap. · **a8 batch 5 v8.4 — 67 → 63**: clipboard copy + single export converted; `getHistogram` RECLASSIFIED — `HistogramView.sample()` calls it inside a `requestAnimationFrame` loop and it is a full composite pass (measured: 11,182,080 samples). **Third cross-file hot caller** after `syncOplog` and `isLogTrustworthy`. · **a8 batch 6 v8.5 — 63 → 59**: the four single-call files that needed no restructuring — `copy_region_composited` (Copy Selection), `capture_state` in BOTH save paths, and `export_png` (OCR). Three sat in already-async functions and one in a plain click handler. Picked deliberately as the batch with no rearranging in it; the three single-call files still left (`useExportDimensions`'s effect, and `useColorPicker`/`useCloneStamp`, whose `onMouseDown` handlers share the `Stamp["onMouseDown"]` type slot and so cannot be converted independently) each need it. **a7 also withdrew one of its own two sites**: `useTextTool`'s hit-test-then-look-up has `commitText()` MUTATING between the two reads, so it is not an atomic capture at all and must not be converted — `docs/engine-worker-capture-sweep.md` is corrected, and the rule it yields is that **two sites with the same read sequence are not the same problem; what sits between the reads is part of the pattern.** a3 also found the category this ADR missed — see "ATOMIC CAPTURE" below, and triage every remaining file against it before converting | nothing user-visible | flag stays off |
**a11.0 CLOSED 2026-08-10 — the last OPEN-B gap.** A real `stamp_tool` running
inside a transferred-canvas worker: it works, `desynchronized` survives with wasm
in the same worker, and the flush costs **22.1 ms at 3.1 MP — the same as the
main thread**, which is the number Option A's whole argument over B rested on and
had never been measured. Warm in-worker `adjust_sharpen` is 392 ms against the
main thread's 419 ms: no worker penalty. Full record and the Stage 5 baseline in
`docs/engine-worker-a11-0-finding.md`.

**a11 IS COMPLETE, 2026-08-10.** a11.1 (canvas identity, v7.91), a11.2 (the
staleness rule + protocol slot, v7.91) and a11.3 (the canvas keyed on the mode,
which repairs the runtime kill switch, v7.92) all shipped. a11.0 validated the
approach. a11.4 folded into a12. **Stage 4's prerequisites are 1 ✅ 2 ✅ 3 ✅, and
the transfer is now gated on Stage 3.5 alone.**

a12 inherits three hard requirements from a11.0 — warm the worker before the
flip hands it work, terminate the losing instance, and do not model the flush as
free. All three are set out under Stage 5 below.

| **4** | **Canvas transfer.** **SCOPE CORRECTED 2026-08-08 — it is not just the `width`/`height` assignments; see "Stage 4's real scope" below.** Three subsystems had to leave the main canvas first: the rubber-band preview ✅ **v7.76**, lossy export ✅ **v7.77**, and the engine flush — which does not need converting because it *dissolves* under Option A (see "Why A" above). So the only thing left before the transfer is canvas element **identity**, which is a larger job than it sounds — see "Stage 4's real scope" below. Still flagged | nothing user-visible | **NOT by the flag alone** — see the kill-switch note |
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

**THE FULL SWEEP IS DONE — see `docs/engine-worker-capture-sweep.md` (a6, 2026-08-09).**
Every file under `app/src` was checked against this rule in one pass. Headline:
**the capture seam is nearly exhausted.** Four captures remain worth converting
(~11 sites) — two in `openraster/export.ts`, one in `AppShell`, one in
`useTextTool` — plus two low-stakes ones. Everything else is ordinary
one-at-a-time work, hot-path work deferred to a10, or reads that dissolve at
Stage 4. Expect the gate to move slowly from here; the compressible part is gone.

The sweep also named a second capture shape: **hit-test then look up** — an id
from `*_annotation_at()` indexed into a list from `get_*_annotations()`. An id is
only meaningful against the list it was drawn from.

**Files already triaged against this rule (2026-08-09), so the next session
does not have to re-derive them:**

| File | Verdict |
|---|---|
| `lib/editPersistence.ts` | atomic capture — **fixed** v7.84 via `capture_state()` |
| `hooks/useEditPersistence.ts` | atomic capture — **fixed** v7.84, same call |
| `hooks/useLayers.ts` | independent mutations, no shared picture — **converted** v7.85 |
| `app/session/useSelectionActions.ts` | contains a per-pointermove hot path — reclassified v7.86, belongs in a10 |

### a8 scoping — the hot/ordinary split was wrong six times (v7.97)

Six live per-mouse-move sites sat in the ordinary a8 queue, where the next batch
would have added an `await` to a frame path: `blurMove` (blur brush),
`useColorPicker.onMouseMove` (eyedropper magnifier), `useTextTool.onCanvasHover`,
`handleLassoMove`'s first read, and two of the three branches in
`usePaintTool.onMouseMove`.

Detection was `HOT_FILE && HOT_CTX` — a hand-maintained file allowlist AND a
keyword in a ±6-line window — and it failed three ways: the allowlist omits
`AppShell`; the keyword list knows `pointermove` but not `mousemove`; and the
window cannot see the handler it is inside. That last one **split one function
across two categories twice** — in `handleLassoMove` the only thing marking line
132 hot is the substring "preview" inside `setLassoPreview`, while the comment
above it saying "recomputed on every mouse-move … inside a frame budget" is
invisible because comments are blanked first.

Now also classified by the enclosing function name from the AST, matching the
TRAILING camelCase segment (any-segment matching pulled in `moveLayer`, a
discrete reorder where `move` is the leading verb). Pinned in both directions by
two contract tests, 4/4 mutants killed.

**✅ THE MIRROR PROBLEM IS CLOSED (v8.0).** The same window rule produced false
positives the other way, and they were worse: of the 21 sites it ALONE called
hot, **19 were discrete once-per-gesture actions** — `onMouseDown`, `onMouseUp`,
`commitEdit`, `cancelEdit`, `applyCrop`, `dropPin`, `clearCloneSource`,
`selectShape`, `beginLayerResize`, `begin`, `commit`, `cancel`,
`handleSelectionClick`, `handleDeleteSelection`, `handleNewLayerFromSelection`.
Parked in a10 — where work goes to be done LAST — they were invisible to a8.

**`HOT_FILE && HOT_CTX` is retired outright.** A rule right 2 times out of 21 is
noise, not a heuristic. Hot is now the enclosing-function-name test plus a
two-entry `HOT_BY_CALLER` list, each justified by reading the CALLER — because
both genuine ones wear discrete names: `usePastePlacementTool.update` is invoked
from `CanvasArea`'s `onMove` PointerEvent listener, and
`useMagicEraserTool.pushOverlay` from inside `requestAnimationFrame`.

**Corrected numbers, which is what a8/a10 must be scoped off:**

| | Headline before | Actual |
|---|---|---|
| a10 (hot path, last) | 27 | **13** |
| Stage 3.5 gate | 74 | **80** (75 convertible above the floor of 5) |

The contract test now pins the hot queue's entry condition in both directions,
so nothing can be quietly parked in a10 again. 4/4 mutants killed.
| `hooks/useExport.ts` | atomic capture — **fixed** v7.88 via `capture_composite()` / `capture_thumbnail()` |
| `lib/openraster/export.ts` | thumbnail triple **fixed** v7.88; both layer-stack captures **fixed** v7.95 via `capture_layer_stack()` (7 reads → 2); the file **still interleaves `await import("jszip")` between the metadata and the layer PNGs, and still mutates mid-export** — unchanged and still open |
| `hooks/useEngineCore.ts` | `syncState`'s eleven reads are one atomic capture — **fixed** v7.90 via `capture_ui_state()`. `flushToCanvas`'s remaining reads dissolve at Stage 4 and must NOT be converted |

### ⚠️ THE GATE'S TARGET IS 5, NOT 0 (found v7.99)

This ADR states two things that cannot both be true:

- **Stage 3.5**: *"Until these are done the Stage 3 flag can never be turned
  on"* — the gate must reach 0, and Stage 4 is now gated on Stage 3.5 alone.
- **The triage row above**: *"`flushToCanvas`'s remaining reads dissolve at
  Stage 4 and must NOT be converted."*

Five sites (`useEngineCore.ts` `flushToCanvas`) sit inside the gate, can only
leave it when Stage 4 lands, and Stage 4 waits on the gate. **The floor is 5.**

**The deadlock is not the real risk — the PRESSURE is.** A session grinding
toward zero meets five stubborn sites and converts them to finish the job,
putting an `await` on the per-frame blit. That is the regression this arc exists
to prevent, and the same shape as the six per-mouse-move sites v7.97 pulled out
of the queue. The prohibition previously lived only here, in prose the gate
contradicted.

`engineAsyncMigration.contract.test.ts` now carries a `DISSOLVES_AT_STAGE_4`
allowlist keyed by **file + handler** (never line numbers — they drift). It
asserts the exempt count is exactly 5, ratchets on `remaining − exempt` as the
reachable target, and fails if an entry ever stops matching a real site. 4/4
mutants killed, including "convert one" and "convert all five".

**So Stage 3.5 is DONE when `remaining − 5` reaches 0**, and those five dissolve
as part of Stage 4 itself. Do not read a gate of 5 as unfinished work.

**Also recorded: `syncState`'s last site is not a casual conversion.** Awaiting
its `capture_ui_state()` makes `syncState` async across **74 call sites**, all of
which currently rely on it completing synchronously. It is its own batch.
| `app/AppShell.tsx` | triaged v7.88 — its two atomic captures (`persistActiveCanvas`, ShareButton) are **fixed**; the remaining sites are independent single reads |
| `app/session/useCanvasActions.ts` | two exclude-background captures — **fixed** v7.88 |
| `lib/exportImage.ts` | throwaway engine, so no correctness risk — converted v7.88 for the 3× work saving |

`useExport.ts` had two three-read captures where the pixels and the dimensions
that describe them must come from the same state:

```
exportBlob        get_image_data() + width() + height()
generateThumbnail thumbnail_width(n) + thumbnail_height(n) + thumbnail_data(n)
```

Convert those individually and a resize landing between the reads encodes one
state's pixels at another state's dimensions — a corrupt or failed encode, from
three lines that look entirely routine. The fix (v7.88) is the same shape as
`capture_state`: `capture_composite()` and `capture_thumbnail(max_px)` in
`src/capture.rs`, each returning an `RgbaCapture { width, height, rgba }`.
Both are aggregations of the getters they replace, so there is no second
definition of "the composite" to drift.

Worth noting for the pattern: `codec::thumbnail_data` **already** computed and
returned all three values together. The split into three `#[wasm_bindgen]`
wrappers discarded two of them at the boundary and made every caller recompute
them. Some of these captures are not new engine work at all — they are
re-exposing something the engine never stopped knowing.

**`lib/openraster/export.ts` was partially converted, deliberately.** The file
still interleaves `await import("jszip")` between reads AND mutates the live
document mid-export (`set_active_layer` + `flatten_text_annotations`); that is
pre-existing and remains open. But its thumbnail triple sits *immediately after
two real awaits* (`await import("stamp_tool")`, `await mod.default()`), which
makes it the likeliest interleave in the file, and it feeds
`encode_png_pixels(data, w, h)` — a function that reads the buffer at whatever
dimensions it is handed. That one sequence moved to `capture_thumbnail()`.

The reason it was not left for later is worth recording: **`useExport`'s
thumbnail half is unreachable.** Nothing has ever read `generateThumbnail` or
`generateThumbnailUrl` — `git log --all -G "\.generateThumbnail"` returns no
commits, so this is a spec awaiting a consumer, not a broken wire (contrast
`useRealTier`). Every user-visible thumbnail comes from a Dexie `thumbBlob`
produced by `lib/workingCopy.ts`. So converting only `useExport` would have
hardened a path that never runs; `openraster/export.ts` is where
`capture_thumbnail()` actually executes in production.

**a7 finished the two remaining captures in this file (v7.95), and the choice of
engine call is the point.** Both wanted only fields `capture_ui_state()` already
returns, so reusing it would have needed no new engine code. It was rejected on
COST: `UiStateCapture.has_transparency` is `self.get_image_data()
.chunks_exact(4).any(...)`, and `get_image_data()` is `composite_layers(...)` —
a full composite of the document built from scratch, allocated, then scanned.
`capture_layer_stack()` touches no pixels at all. **Split the captures by what
they cost, not by what they are called.**

That also surfaced a fact worth knowing independently: every `syncState()`
composited the whole document and scanned it to answer one boolean.

**✅ FIXED v7.96, and the fix was a deletion.** `has_transparency` came off
`UiStateCapture` entirely, because **nothing consumed it** — `CanvasArea` was its
only reader and stopped gating on it in `5e46921` (2026-06-27) when the
checkerboard became unconditional CSS. Six weeks of computing a discarded
boolean. Measured on the production build, 1385×2068: `syncState` **30.9 ms →
0.0 ms**, `capture_ui_state` **29.1 → 0.0**, other ten fields 0.0 throughout.

No cache, so no invalidation contract — which is the point. The obvious fix here
was a cached-and-invalidated flag, and that would have meant inventing a
"correct" for a consumer that does not exist, in a codebase that has already been
bitten by two-publishers-one-state. `has_transparency()` stays on
`ImageHorseTool` for a caller that genuinely wants it, now documented as
expensive.

**The generalisable bit: before optimising a hot read, check whether anything
reads it.** This is the second thing the migration found that was a real
user-facing win and not a migration step (the first was the 3.45× exclude-
background composite, v7.88). Both were getters recomputing a whole-document
product to answer a small question; this one answered it for nobody.

**The third capture shape — the exclude-background composite. FIXED v7.88.**
`capture_composite_excluding_background()` now serves all of it. It turned out
to be FOUR sites, not the two first spotted — `useCanvasActions` has one for
the clipboard copy and another for the download, and the download's is the
worst of the set because its dimensions outlive the encode and are stamped into
the exported file's EXIF. The reads were:

```
get_image_data_excluding_background() + export_width_excluding_background()
                                      + export_height_excluding_background()
```

Three reads, one document state, fed straight to an encoder — the same hazard
as `exportBlob`. `exportImage.ts`'s copy runs on a throwaway engine (the
one-port allowlist above), so only the live-engine sites are a correctness
risk; the wasted work was real in all of them.

**This one is also a performance fix, and that is the part worth generalising.**
Each of those three getters calls `composite_excluding_background()` internally
— a full-document composite, a `tight_bbox` scan and a crop — and discards two
of its three results. The split form therefore did all of that three times to
answer one question. Measured in the browser on a 1385×2068 document:

| Form | Time |
|---|---|
| three getters | 69.1 ms |
| one `capture_composite_excluding_background()` | **20.0 ms** |
| | **3.45× faster** |

So unlike `capture_composite` and `capture_thumbnail`, this method is NOT
written as an aggregation of the three public getters — that would preserve the
3× cost. It calls the private helper once and keeps all three values. Same
single definition underneath, so nothing can drift.

**Verified end to end** (Netlify-equivalent production build, fresh port): with
"Photo only" set, the exported JPEG's SOF header reads **1365×2048** — the
capture's cropped size, not the document's 1385×2068 — and the old pixel getter
recorded **zero** calls on the export path.

**Still reading the split getters, and correctly so:**
`app/session/useExportDimensions.ts` calls `export_width/height_excluding_background()`
to label the Share button. That is not a capture — no pixels are paired with it
— so it stays separate. It is, however, still two full composites to produce two
integers, which its own header already documents. Handing it this method would
trade that for one composite plus an 11 MB pixel clone it would throw away;
the right fix is a dimensions-only call. Parked, not done.

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

### ⚠️ ELEMENT REMOUNT ≠ COMPONENT REMOUNT — read this before touching a11

**This single fact has caused two real bugs in two days, in two different
sub-steps, and both passed every gate.** It is the load-bearing fact of the
whole a11 arc.

The `<canvas>` element and the `CanvasArea` component are re-created by
*different* events:

| Event | Component remounts? | Element remounts? | Effects re-run? |
|---|---|---|---|
| Ordinary tool switch (compress → brush → crop) | no | **no** | no |
| Crossing the **Batch** boundary (`activeTool === "emoji"`) | **yes** | **yes** | **yes** |
| A change to the `<canvas>`'s React `key` (a11.3's flag flip) | **no** | **yes** | **NO** |

That last row is the trap. A keyed element is replaced by React while the
component around it is merely re-rendered, so nothing in `CanvasArea` runs
again — and the recovery everyone assumes is automatic does not happen.

**Bug 1 (a11.1).** `useCanvasIdentity` was called inside `CanvasArea`, so the
generation counter was destroyed by the very event it counts. The browser showed
five distinct canvas elements and a generation still reading 1. Fixed by moving
ownership to `AppShell`, which does not remount.

**Bug 2 (a11.3).** Keying the `<canvas>` on the engine mode remounted the
element, but `CanvasArea`'s re-blit effect never re-ran — every one of its
dependencies was unchanged, and `canvasRef` is a `useRef` whose object identity
never changes. Result: a blank canvas on every flag flip. Fixed by putting the
surface key in that effect's dependency array.

**Neither was caught by `tsc`, eslint, the unit suite or the production build.**
Both were caught by driving the real app and reading the generation counter.
Anything in a11 that changes when or how the canvas element is created must be
verified that way — the gates cannot see this class of bug.

**a11.4 walks straight back into it** — and is smaller than scoped. Checked
2026-08-10 (`docs/engine-worker-a11-0-finding.md`): a11.3's `surfaceKey` in the
re-blit dependency array IS a11.4's trigger, arriving by a different route, so
the effect now re-runs on both remount causes. What remains is the destination —
`flushToCanvas` calls `getContext("2d")` and assigns `canvas.width`, both of
which throw after transfer, so the re-blit must become a message to the worker.
That is the `flushToCanvas` dissolution this ADR already assigns to Stage 4.
**Fold a11.4 into a12**; it cannot be built or verified before the transfer
exists, and would otherwise be a third guard with no traffic.

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

| # | Work | Status | Ships on its own? |
|---|---|---|---|
| 1 | Move the rubber-band preview off the main canvas | ✅ **DONE v7.76** (`2319255`) | yes — also paid down the pixels-in-React-land invariant |
| 2 | Route lossy export through the engine like PNG already is | ✅ **DONE v7.77** (`84d5353`) | yes |
| 3 | Make canvas element identity explicit and remount-safe | ⬜ **OPEN — the only one left** | yes |
| 4 | Then transfer | ⬜ blocked on 3 | needs 1–3 |

**Status added 2026-08-09.** The table shipped with no status column and was
read for weeks as four sessions of work; two of them had already shipped. That
is the same failure as the Stage 3.5 header below — a plan that records what to
do and never records what got done drifts into overstating the remaining work,
and the overstatement is what makes people defer starting.

Verified rather than assumed, at 63e4239:

| Claim | Evidence |
|---|---|
| 1 is done | `useDrawingTools.ts` draws the rubber band on `previewRef`, a separate overlay; its own comment says the full-canvas `preSnapshot` copy it replaced is gone |
| 2 is done | `useExport.ts` header: *"EVERY format now reads the engine, never the `<canvas>`"*; `encodeRgba` entered the file at v7.77 |
| 2 stays done | The only `.toBlob(` calls left in `app/src` are `ObjectRemovalModal.tsx:143` and `rasterizeSvg.ts:86`, both on canvases those files create themselves. Neither touches the main canvas, so a grep for `toBlob` does not reopen this |

Stage 5's gate is the pre-mortem's last line: *"Nobody measured after. The
freeze moved rather than disappeared."* The flip does not happen on the
strength of the architecture being correct; it happens on a measured frame
timeline showing the main thread idle during a 12-megapixel sharpen.

The flag follows the house pattern — `ih_tiles_flush`, `ih_oplog_undo`,
`ih_patchmatch` all shipped this way and all still carry a kill switch.

### Three constraints a11.0 measured — design inputs, not footnotes

All three come from `docs/engine-worker-a11-0-finding.md` (2026-08-10). They are
repeated here because they constrain Stage 5 and a12 specifically, and a number
sitting in a findings doc is a number nobody reads at the moment it matters.

**1. THE FLIP MUST WARM THE WORKER BEFORE HANDING IT WORK.**

| `adjust_sharpen` @ 3.1 MP | ms |
|---|---|
| worker, cold first call | **715** |
| worker, warm steady state | 392 |
| main thread, warm | 419 |

A lazy flip whose next user action is a sharpen delivers **715 ms against the
419 ms it replaced** — a regression on the exact operation the migration exists
to fix, as the user's first impression of the feature. Steady state is fine
(0.94× the main thread). Warm the instance during the flip, before it is given
real work.

**2. WORKER TERMINATION IS A CORRECTNESS REQUIREMENT, NOT HOUSEKEEPING.**

wasm linear memory only ever grows; it is never returned. A flip has both
instances alive (~75 MB for a 3.1 MP document, which is fine and bounded by the
2048-long-edge working copy) — but if the dead side is left running, the tab's
floor rises permanently and never comes back down. The only thing that reclaims
it is terminating the worker outright, which frees the whole instance. a12 must
tear down the losing side, and that is a hard requirement.

**3. THE FLUSH IS NOT FREE — 22 ms at 3.1 MP.**

Measured in-worker at **22.14 ms**, against **23.86 ms** on the main thread, so
there is no worker penalty and Option A's central claim holds. But 22 ms exceeds
a 60 fps frame budget (16.7 ms). Fine for a per-operation flush; not something
Stage 5 should model as zero. Note this is the SLOW path (`get_image_data` +
`putImageData`) measured deliberately rather than the zero-copy
`data_ptr`/`data_len` route, so it is a ceiling, not a typical cost.

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
