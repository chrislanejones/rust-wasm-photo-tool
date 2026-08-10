# a11.0 — a real engine inside a transferred-canvas worker

**Run 2026-08-10 against v7.92 (`7a932fa`), production `pkg/`, Chrome, served by
`spike/coep-server.mjs` with COOP/COEP on (`crossOriginIsolated: true`).**
Harness: `spike/a11-0.html` + `spike/a11-0.worker.js`. No product code changed.

This closes the last gap `docs/engine-worker-open-b-finding.md` named: Phase 3
booted wasm in a worker, OPEN-B transferred a canvas to a worker, and **nothing
had ever held both at once**.

## Verdict: Option A works, and the flush is free

| # | Question | Answer |
|---|---|---|
| 1 | Does a real `stamp_tool` run in a transferred-canvas worker? | **Yes** |
| 2 | Does `desynchronized` survive with wasm in the same worker? | **Yes** |
| 3 | What does the flush cost from inside the worker? | **22.1 ms** at 3.1 MP — same as the main thread |
| 4 | What does memory look like during a flip? | **~75 MB** for a 3.1 MP document held twice |

Nothing here invalidates Option A. The one number that could have — a flush that
was expensive from inside a worker — came back identical to the main thread.

## Q1 — it works

| Step | Result |
|---|---|
| wasm `init()` in a worker that already owns the transferred canvas | 39.6 ms |
| `ImageHorseTool` constructed + 3.1 MP image loaded | 146.2 ms |
| Canvas backing store sized **from the worker** | 2048×1536 ✅ |
| Engine pixels present on the transferred surface | `rgba(220,40,40,255)` ✅ |
| `resize` driven from inside the worker | 1024×768 ✅ |

The pixel check is the load-bearing one and is deliberately falsifiable: the
engine's image is **red**, while OPEN-B's plain-2D harness painted **blue**.
Reading blue or empty would have meant the two halves were not actually
connected. It read red.

The canvas is adopted **before** wasm boots, on purpose — if instantiating a
module were going to disturb an already-transferred surface, that ordering is
what would expose it. It did not.

## Q2 — `desynchronized` survives

`getContextAttributes().desynchronized === true` with a wasm instance live in the
same worker. Previously verified 4/4 **without** wasm; the attribute is unchanged
by its presence.

## Q3 — the flush costs the same in a worker as on the main thread

This is the number Option A's argument over B rests on, and it had never been
measured.

| Path | Median (3.1 MP) |
|---|---|
| Flush **in the worker**, straight to the transferred canvas | **22.14 ms** |
| Flush **on the main thread**, same build, same image | 23.86 ms |

Breakdown of the in-worker flush:

| Stage | ms |
|---|---|
| `get_image_data()` (view over wasm memory) | 8.91 |
| copy into `ImageData` | 1.88 |
| `putImageData` onto the transferred canvas | 11.35 |
| **total** | **22.14** |

12.6 MB moved per flush, entirely inside the worker — which is the point: under
Option B this would have crossed a postMessage boundary.

**The slow path was measured on purpose.** `useEngineCore.flushToCanvas` has a
zero-copy route via `data_ptr`/`data_len`; this harness uses
`get_image_data` + `putImageData`, the fallback. Measuring the fast path would
have flattered the result. 22 ms is the honest ceiling.

**22 ms is longer than a 60 fps frame (16.7 ms).** That is fine for the cold path
this measures — a flush happens per operation, not per frame — but it is not
"free" and Stage 5 should not assume it is.

### The Stage 5 baseline, and a warm/cold trap

| Operation (3.1 MP) | Main thread | Worker |
|---|---|---|
| `adjust_sharpen(50)`, warm median | 418.8 ms | **392.1 ms** (0.94×) |
| `adjust_sharpen(50)`, **cold first call** | — | **715.4 ms** |

**There is no worker penalty.** The first harness run reported 786 ms and looked
like a 1.9× regression; it was a cold first call compared against a warm median.
Warmed and re-measured, the worker is marginally *faster* — within noise.

The cold figure is worth keeping rather than discarding: **the first engine
operation after a flip costs roughly 1.8× the steady-state one.** A user flipping
the flag and immediately sharpening pays that once.

Note also that 418 ms at 3.1 MP is close to ADR-024's headline "470 ms" figure,
which was taken at 12 MP. The two do not scale together, so the 470 ms number
should not be treated as a per-pixel rate.

## Q4 — the flip window

Measured in a **fresh page**, because wasm linear memory only ever grows and a
page that has already run the engine gives a meaningless baseline. The first
attempt at this was contaminated exactly that way and read 134 MB before
allocating anything.

| State | wasm linear memory |
|---|---|
| Fresh instance, no document | 1.2 MB |
| One 3.1 MP document | 37.4 MB |
| Two documents, same instance | 61.6 MB |

A flip has a main-thread instance and a worker instance alive at once, each with
its own linear memory and its own copy of the document: **≈ 75 MB** at 3.1 MP.
Not alarming, and it is bounded by the 2048-long-edge working copy.

**But wasm memory never shrinks.** The window only closes if the dead side is
actually torn down — terminating the worker frees its instance wholesale. A flip
that leaves the old worker alive raises the tab's floor permanently.

## a11.4 is smaller than scoped

The ADR flagged this to check, and it is right to have asked.

| Half of a11.4 | Status |
|---|---|
| **Trigger** — "element replaced → re-blit" | **Already done**, by a11.3 |
| **Routing** — "the *worker* redraws from the engine" | Not done, and it is a12's shape |

a11.3 put `surfaceKey` in the re-blit effect's dependency array, so the effect
now re-runs on both remount causes: a Batch crossing (component remounts) and a
flag flip (key changes). That is a11.4's trigger, arriving by a different route.

What remains is the *destination*. `flushToCanvas` calls `canvas.getContext("2d")`
and assigns `canvas.width` — both throw after `transferControlToOffscreen()`. So
the re-blit must become a message to the worker, which is precisely the
`flushToCanvas` dissolution ADR-024 already assigns to Stage 4. **Recommendation:
fold a11.4 into a12 rather than run it as its own session** — it cannot be built
or verified before the transfer exists, and it would otherwise be a third guard
with no traffic.

## Method notes

- Served under real COOP/COEP; `crossOriginIsolated` confirmed `true` in-page.
- Every value is read back from the worker or from wasm, never observed on screen.
- Warm/cold and fresh/contaminated were both caught by cross-checking against a
  same-conditions main-thread baseline. Neither would have been visible from the
  worker numbers alone, and both would have produced a confident wrong headline.
