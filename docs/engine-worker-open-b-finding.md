# OPEN-B — zoom and pan under `transferControlToOffscreen`

**Answer: they survive intact. 11 of 11 checks pass.** Measured 2026-08-07
against v7.73 (`8e18278`), Chrome on Windows. Harness: `spike/open-b.html` +
`spike/open-b.worker.js`.

ADR-024 flagged this honestly: *"whether the overlays' visual alignment survives
is argued from structure, not observed — none of them were changed or run
against a transferred canvas."* This runs it.

## Why it was a real question

The app splits two things that usually move together:

| | Owner | Value |
|---|---|---|
| **Display size** | CSS — `.main-canvas { max-width: 100%; max-height: 100% }` (`styles.css:430`) | fits the viewport |
| **Backing store** | `flushToCanvas` — `canvas.width = t.width()` | image resolution |
| **Zoom / pan** | CSS — `transform: translate(Xpx, Ypx) scale(Z)` (`CanvasArea.tsx:1262`) | user-driven |

`transferControlToOffscreen` hands the drawing buffer to a worker. The worry
was that it also takes the element's layout behaviour with it.

The harness reproduces that exact split — the app's real CSS rules copied
verbatim, a 1600×1200 backing store in a 400×300 stage — and reads numbers back
from the DOM rather than looking at the screen.

## Results

| # | Check | Got | Verdict |
|---|---|---|---|
| 1 | CSS fit before transfer | 400.0×300.0 | PASS |
| 2 | Backing store before transfer | 1600×1200 | PASS |
| 3 | `transferControlToOffscreen()` | ok | PASS |
| 4 | Main-thread `getContext` after transfer | **throws `InvalidStateError`** | PASS |
| 5 | Main-thread `canvas.width = 800` | **throws `InvalidStateError`**, stays 1600 | PASS |
| 6 | CSS fit after transfer | 400.0×300.0 — **unchanged** | PASS |
| 7 | Zoom `scale(2)` → rect width | 800.0 (exactly 2×) | PASS |
| 8 | Pan `translate(37px)` → rect shift | 37.0 | PASS |
| 9 | Worker sets backing store 800×600 | 800×600 | PASS |
| 10 | Display size after worker resize | 400.0×300.0 — **did not move** | PASS |
| 11 | Worker pixel readback | the drawn colour | PASS |

## What each one settles

**Rows 6, 7, 8, 10 are the answer.** CSS fit, zoom and pan are element-level
layout and compositing. They never involved the drawing context, so handing the
context away changes nothing about them. Row 10 is the sharpest: the worker
resized the backing store from 1600×1200 to 800×600 and the element's on-screen
size **did not move at all**. The split holds.

**Rows 4 and 5 confirm the concrete work item** rather than finding a problem.
After transfer the main thread cannot get a context and cannot set
`canvas.width` — both throw `InvalidStateError`, not fail silently, which is the
good case. ADR-024 already named this: *"those assignments (useEngineCore ~lines
240, 324, 406) must move into the worker as messages. This is the concrete work
item, not a blocker."* Confirmed as stated, and the worker doing it (row 9)
works.

**Row 8 corrected the test, not the app.** The first run expected 74 px
(37 × zoom 2) and printed CHECK. It was wrong: `translate(...) scale(...)`
composes as T×S, so a point maps `p → T(S(p))` — the scale applies in the
element's own space and the translate then moves the result in the parent's.
Pan is 37 **screen** pixels. The app writes its transform in exactly this order,
so pan does not accelerate as you zoom in. The expectation was the error; the
comment is left in the harness.

## Caveats — what this does not cover

- **One browser.** Chrome on Windows only. `OffscreenCanvas` and
  `transferControlToOffscreen` are Baseline, but Safari has its own history with
  `desynchronized`.
- **No overlays.** `SelectionOverlay`, `HistogramView`, `LassoOverlay` and the
  SVG guides were not run against a transferred canvas. Phase 0's structural
  argument for them is strong — they own their own canvas or are SVG, and none
  reads a context from the main canvas — but it is still an argument, not a
  measurement.
- **No engine.** The harness draws a grid with plain 2D calls. It proves the
  canvas plumbing, not that `stamp_tool` is happy inside a worker (Phase 3
  already showed a wasm instance booting in one, separately).
- **`desynchronized: true`** was requested in the worker and not verified to be
  honoured on an `OffscreenCanvas`. It is a latency hint, so a silent downgrade
  costs smoothness, not correctness.

## Where this leaves ADR-024

| Open question | State |
|---|---|
| OPEN-A — popup OAuth under COOP | dead unless wasm threads return, which this project rejected once |
| **OPEN-B — zoom/pan under transfer** | **answered — survives, 11/11** |
| OPEN-C — contract test first | sequencing, unchanged |
| **OPEN-D — op-log / undo ordering** | **answered — safe by construction; 9 read-modify-write sites** |

Both measurable unknowns are now closed, and both point the same way. OPEN-D
found that the worst read-modify-write sequence is `flushToCanvas` reading
`width`/`height` and then recompositing — a sequence that **stops crossing the
boundary entirely** under Option A. OPEN-B finds no cost to Option A on the
canvas side.

**Nothing here picks an option — that is Chris's call and ADR-024 stays DRAFT.**
But the two reasons to prefer B over A were the OffscreenCanvas unknowns and the
fear of async ordering, and neither survived measurement.
