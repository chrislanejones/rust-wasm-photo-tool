# ADR-030: GPU acceleration runs in JS beside the engine, not as `wgpu` inside it
Date: 2026-08-04   Status: draft

## Context

Phase 0 of the GPU arc: prove a WebGPU compute pass can reproduce an engine
filter exactly, before anything depends on it. The repo's standing invariant is
"the engine owns pixels — anything touching image data goes through
`stamp_tool`", which points at pulling `wgpu` into the Rust crate.

One number rules that out for now. `scripts/deploy-sentinel.sh` fails any deploy
whose wasm falls outside **800,000–840,000 B**, and the crate is at
**816,971 B** — about 23 KB of headroom. `wgpu` plus its shader-translation
layer is far larger than that, so taking it means raising the band, and the
band is the check that caught five weeks of featureless production builds. That
is a decision in its own right, not a side effect of a spike.

⚠️ Those two figures were **700–800 KB / 761,213 B** until 2026-09-09, which was
the band ADR-037 set and the size the crate was at in August. ADR-045 narrowed
the band and the crate has grown since. The conclusion never moved — `wgpu` has
never been within an order of magnitude of fitting — but the arithmetic
supporting it was stale, and this ADR's own pre-mortem names "the sentinel band
is widened for an unrelated reason" as the way the argument quietly dies. An
argument resting on wrong figures is one edit away from becoming a wrong one.
`detect.ts` carried the corrected numbers from 2026-09-05; this file did not.

## Decision

GPU work lives in `app/src/lib/webgpu/`, in TypeScript, and the engine hands it
pixels. The engine still owns the buffer and remains the only writer; a GPU pass
is a pure function from RGBA bytes to RGBA bytes.

It is gated by `ih_webgpu`, an **opt-in** flag (`localStorage.setItem("ih_webgpu","1")`),
not the defaults-ON-with-`"0"`-kill pattern the shipped flags use — nothing here
has run on hardware other than one Intel Xe-LPG laptop.

Correctness is defined as **byte-identical to the CPU path**, not "looks right",
and is enforced by an in-browser harness (`window.__ihGpuBlurSelfTest()`)
comparing the shader against a faithful port of the Rust blur.

## Consequences

+ Zero wasm growth: the crate is untouched at 816,971 B, and the deploy sentinel
  band does not have to move.
+ Phase 0 is proven, not assumed: five cases, **max channel delta 0** across
  41,128 channels on Intel Xe-LPG, including an all-clamp 5×5 at radius 12 and
  the radius-30 ceiling.
+ The oracle is reusable — any future GPU filter gets checked the same way.
- **The "engine owns pixels" invariant is bent.** Pixels round-trip WASM → JS →
  GPU → JS. Defensible while a GPU pass is a pure function, and a real problem
  the moment one wants to keep state on the device between operations.
- Two implementations of one filter now exist and must agree forever. The
  harness is the only thing stopping them drifting, and it does not run in CI —
  there is no WebGPU in jsdom or on GitHub's runners.
- The spike carries a hand-written `webgpu-types.d.ts` instead of
  `@webgpu/types`, so the type surface is partial and can be subtly wrong.
  ⚠️ **That file's own tripwire has now fired.** Its header says "if you find
  yourself widening this file rather than deleting it, that is the signal to
  take the dependency instead" — and shipping the device cache required adding
  `GPUDevice.lost`, because the narrow surface did not have it. One widening is
  not yet a pattern, so the dependency is not taken here; a second one should
  settle it. Left as an open decision rather than a silent habit.

## Alternatives rejected

1. **`wgpu` inside `stamp_tool`.** Honours the invariant; does not fit in 39 KB
   of sentinel headroom. Revisit only as a deliberate "raise the band" decision.
2. **WebGL2 instead of WebGPU.** Much wider support, but compute-via-fragment-
   shader makes a two-pass separable blur awkward and the readback path worse.
   Not worth it while this is opt-in.
3. **Keep f32 between the two passes.** Cheaper and produces a marginally better
   image — and wrong. The engine rounds to u8 between passes, so a float
   intermediate makes the same document render differently depending on which
   path drew it. Measured: 400/400 random images differ, max delta 1, ~21% of
   channels. Pinned by a test.

## Measurements — 2026-09-07 (Intel Xe-LPG, Chrome 149, production build)

Phase 0 said speed work starts once the harness reports max channel delta 0.
It does, on this hardware, so these are the numbers. Method: the engine's own
`blur_region` (the shipped SIMD path) against the WGSL shader copied verbatim
out of `gpuBlur.ts`, same inputs, parity re-verified first. Medians of 5.

**Parity re-confirmed:** the five `selfTest.ts` cases, **max channel delta 0**,
41,128 channels. Nothing below is timing a shader that disagrees.

### One image, radius 5

| Size | Engine SIMD | GPU (device reused) | Speedup | GPU dispatch only | Transfer-only control |
|---|---|---|---|---|---|
| 512×512 | 31.5 ms | **5.9 ms** | 5.3× | 0.26 ms | 4.7 ms |
| 1024×1024 | 93.3 ms | **8.0 ms** | 11.7× | 1.57 ms | 6.3 ms |
| 2048×2048 | 512.4 ms | **29.1 ms** | 17.6× | 6.49 ms | 23.2 ms |

**There is no crossover.** The GPU wins at N=1, at every size tested. The
question this ADR was waiting on turns out to have an uninteresting answer.

### Transfer, counted honestly (medians, ms)

| Size | alloc | upload | encode | submit→map | read copy | dispatch |
|---|---|---|---|---|---|---|
| 512×512 | 0.0 | 0.8 | 0.1 | 4.7 | 0.5 | 0.26 |
| 1024×1024 | 0.0 | 0.7 | 0.2 | 5.6 | 1.6 | 1.57 |
| 2048×2048 | 0.0 | 2.5 | 0.1 | 20.7 | 6.2 | 6.49 |

Dispatch is **6.5 ms of a 29.1 ms** call at 2048² — the other 78% is moving
bytes and waiting for the queue. A no-dispatch control (upload + read back,
nothing computed) costs 23.2 ms at 2048², which is the floor any GPU design
pays. **The shader is not the cost. The boundary is.**

Two costs sit on top of that in a real integration, and both are already
measured elsewhere in this repo's history:

| Boundary crossing (1024², 4 MB) | Cost |
|---|---|
| `get_image_data()` — copy out of wasm | 2.5 ms |
| `load_image()` — copy back into wasm | 2.1 ms |

That is **+4.6 ms**, taking 1024² from 8.0 to ~12.6 ms — still 7.4× ahead of
93.3 ms. It is an upper bound: `data_ptr`/`data_len` already exist and the
engine's zero-copy flush path avoids the read side. (The bundled glue does not
re-export `memory`, so the zero-copy variant could not be timed from a console;
that measurement is still owed.)

### Batch — the gallery question

40 images at 512×512, radius 5:

| N | CPU | GPU, one submit each | GPU, one submit total | Batch speedup |
|---|---|---|---|---|
| 1 | 31.6 ms | 7.8 ms | **5.5 ms** | 5.7× |
| 5 | 115.3 ms | 27.6 ms | **22.8 ms** | 5.1× |
| 10 | 307.7 ms | 109.4 ms | **40.5 ms** | 7.6× |
| 20 | 580.8 ms | 149.7 ms | **74.0 ms** | 7.8× |
| 40 | 1217.2 ms | 288.5 ms | **136.5 ms** | 8.9× |

Batching one shader across many images roughly doubles the win (4× → 9×) by
amortising submit/map round trips. It does not change the sign, because the
sign was never in doubt. Batch is a real direction, not a precondition.

### Radius — the number that actually decides this

| Radius (1024²) | CPU | GPU | GPU dispatch | Speedup |
|---|---|---|---|---|
| 1 | 49.4 ms | 7.4 ms | 1.1 ms | 6.7× |
| 5 | 132.8 ms | 11.5 ms | 1.6 ms | 11.5× |
| 20 | 443.3 ms | 11.0 ms | 3.8 ms | 40.3× |
| 30 | 645.3 ms | 12.0 ms | 5.2 ms | **53.8×** |

CPU cost is linear in radius; the GPU stays flat at ~11–12 ms because it never
stops being transfer-bound. **The heavier the blur, the more lopsided it gets** —
at the documented radius-30 ceiling the engine takes 0.65 s and the GPU 12 ms.
Radius 30 at 2048² is where a user waits half a second today.

### Two defects the benchmark found in `gpuBlur.ts`

**1. It creates and destroys a `GPUDevice` on every call.** The header calls
this "wasteful and intentional", which was right for Phase 0 and is now the
dominant cost at small sizes:

| 1024², radius 5 | Total | of which device setup |
|---|---|---|
| As shipped (device per call) | 44.7 ms | 25.9 ms |
| Device + pipeline reused | **8.0 ms** | 0 |

5.6× left on the floor. As-shipped still beats the engine's 93.3 ms, so this is
a headroom note, not a correctness one.

**2. The `midBuf` → `midAsSrc` copy is unnecessary.** The comment says `mid` is
"COPY_SRC only, so it cannot also be the read source of pass 2" — but a buffer
created with plain `STORAGE` binds as `read_write` in pass 1 and `read` in
pass 2 with no copy at all. Verified: **max channel delta 0** without it. That
is one full-image GPU-to-GPU copy per blur, deleted for free.

### Acted on — 2026-09-09

The three items above that this ADR raised but deliberately did not build.
Nothing here changes a default: `ih_webgpu` is still opt-in and the GPU path
is still reachable only from the self-test.

| Raised | Where | Status |
|---|---|---|
| Device created per call — 25.9 ms of a 44.7 ms call | Defect 1 | **Shipped** (#92) |
| `midBuf` → `midAsSrc` copy is unnecessary | Defect 2 | **Shipped** (#92) |
| `GpuStatus` should refuse a software adapter | Hazard, below | **Shipped** (#94) |

**The device cache brought a failure mode with it.** A `GPUDevice` can be lost —
driver reset, GPU reset, some platforms on tab background — and a *cached*
device that has been lost fails every later call, which is strictly worse than
the per-call version it replaced. So `device.lost` is wired before the context
is published, and a loss drops the cache so the next call re-acquires. That path
is exercised rather than assumed: `device.destroy()` resolves `device.lost`, and
the harness run reads **warm 4.7 ms → destroyed 53.8 ms → warm again 4.6 ms**,
max channel delta 0 throughout, on `intel/xe-lpg`. The middle number is the
re-acquisition; without the loss handling that run throws.

**The software-adapter refusal is now the product's, not just the harness's.**
The guard was only ever in `scripts/webgpu-blur-bench.js`, which protected the
*measurement*. The user was left with the mirror-image bug: set `ih_webgpu=1` on
a machine with no GPU and you silently got a slower editor with no way to tell.
`probeWebGpu` now returns `ok: false` with the adapter named in the reason, so
the Feature Flags panel reads `unavailable — software adapter
(google/swiftshader) …` instead of `available`.

It matches `swiftshader`, `llvmpipe` and `lavapipe` as substrings of
`"<vendor>/<architecture>"`, lowercased, rather than as exact field pairs. Only
`google/swiftshader` has been observed; for the Mesa names, *which field they
land in* is a guess, and a guess about the field is how a check ends up never
firing. Microsoft's WARP is deliberately **not** matched — `warp` is four
characters, too short to substring safely — so a Windows machine with no GPU
still falls through. That gap is written down rather than closed with a match
that might be wrong.

Pinned by `detect.test.ts`, which asserts on `GpuStatus` out of the real
`probeWebGpu` rather than on the matcher, and killed three mutants: the guard
never firing, the guard always firing, and — the one that matters — the matcher
left correct with its call site cut.

### Where a GPU blur could actually plug in

The measurements above time a **whole-image** blur, because that is what
`gaussianBlurGpu` does: it takes a buffer and a size, and has no region or
bounding-box concept at all. The engine's blur is region-based. So before any
integration question, the routes have to be separated:

| Route | Engine entry | Shape | In the op log? |
|---|---|---|---|
| Effects **brush**, live drag | `effect_move` → `apply_effect_dab` → `blur_region` | many dabs, radius = brush | **Yes** — `Op::Blur { points, … }` at `effect_up` |
| **Whole-image** blur, Effects panel | `applyGlobalBlur` → `blur_whole_image` | one call, radius = `max(w,h)` | **No** |
| **Replay** on undo/reload | `ops.rs` `Op::Blur` → one `gaussian_blur_region` per dab | pure Rust, synchronous | it *is* the log |

Three things follow, and they point the opposite way to what the speedups
suggest.

**The GPU can only serve the middle row.** The brush path stamps dabs far below
the transfer floor — an upload-and-read-back control with nothing computed costs
23.2 ms at 2048² — and `gaussianBlurGpu` cannot express a dab anyway. The replay
path is synchronous Rust inside wasm and cannot await a JS promise without
restructuring replay itself. Whole-image blur is the whole of the opportunity.

**That is also the good news.** Whole-image blur is not recorded as an op, so a
GPU implementation of it inherits **no replay-parity obligation** — there is no
CPU replay of that operation to disagree with. This ADR's sharpest consequence
("two implementations of one filter must agree forever, and no CI can check it")
applies to the *brush*, which is the path the GPU cannot take. The two do not
overlap.

**Unrecorded is not unsafe here.** `blur_whole_image` calls `snap("Blur")`, so
snapshot undo has an entry, and the log's composite-hash check (ADR-013) catches
the divergence on the next undo and hands over. That is the designed fallback,
not a hole.

⚠️ **Not verified:** what a reload does with a whole-image blur — that is the
archive/pixel persistence path, not the op log, and it was not measured here.
Anyone taking the integration further should start by answering it, because "the
GPU blur has no parity obligation" holds only for as long as that stays true.

### ⚠️ The measurement hazard that nearly produced a wrong answer

This was very nearly benchmarked on a **software rasterizer**, and the result
would have read as "WebGPU is not worth it".

Headless Chromium in WSL2 has no hardware adapter — `/dev/dri` does not exist
and the only Vulkan ICD that can initialize is `lvp` (lavapipe). What it does
have is a fallback:

| Launch | `navigator.gpu` | `requestAdapter()` |
|---|---|---|
| `about:blank`, any flags | absent | — (not a secure context) |
| localhost, no flags | present | **null** — honest |
| localhost + `--enable-unsafe-webgpu` | present | **`google/swiftshader`** |

`detect.ts` reports `ok: true` for that adapter, because it only asks whether a
device came back. **A CPU rasterizer wearing a GPU label passes every check this
module makes**, and a benchmark run against it would have been CPU-vs-CPU with a
GPU column header. The numbers above were taken on a real `intel/xe-lpg` adapter
in Chrome on the host, confirmed by vendor string before anything was timed.

The product consequence is small but real: a user with no GPU who sets
`ih_webgpu=1` silently gets SwiftShader, which will lose to the SIMD engine.
`GpuStatus` should carry the adapter identity and refuse the fallback:

```ts
if (info?.vendor === "google" && info?.architecture === "swiftshader")
  return { ok: false, reason: "software adapter (SwiftShader) — slower than the engine" };
```

**Applied 2026-09-09** (#94), widened from the exact pair above to a substring
match — see "Acted on" for why the exact-pair form was the more fragile of the
two. The guard now exists twice: in `detect.ts` for the product and in
`webgpu-blur-bench.js` for the measurement. The bench script is pasted into a
console and cannot import, so the copies are kept in step by comment, which is
the weakest kind of link — if a third caller ever needs it, that is the moment
to move the list somewhere both can reach.

### What this does not settle

- **One machine, again.** Every number is Intel Xe-LPG, the same laptop as
  Phase 0. Discrete and Apple GPUs are unmeasured, and the transfer floor —
  which is what dominates — is exactly the number that moves most across
  hardware.
- **The CPU fallback never goes away.** WebGPU is absent or refused often
  enough that both paths ship forever. That is two implementations of every
  filter, agreeing byte-for-byte, with no CI able to check it — the cost this
  ADR's own pre-mortem already names, and it is unchanged by any speedup.
- **Nothing was timed inside the app.** These are console measurements against
  the engine and the shader directly. A real integration also pays scheduling,
  worker hops, and whatever the flush path costs.

The harness that produced this is `scripts/webgpu-blur-bench.js` — paste into a
console on a machine with a real adapter. It prints the adapter vendor first,
and refuses to report timings for a software adapter.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the harness
never ran again. It cannot run in CI — no WebGPU on the runners — so it only
executes when someone remembers to open a console on a machine with a GPU. The
two implementations drift, nobody notices because the GPU path is opt-in and
almost nobody has it on, and the first real report is a user whose exported
image does not match their screen. The wasm-size argument also has a shelf life:
if the sentinel band is ever widened for an unrelated reason, the main objection
to `wgpu` quietly evaporates without anyone revisiting this.

Early warning sign: a change to `src/filters.rs` or `src/simd/blur.rs` landing
without a corresponding change to `blurReference.ts`. Those two files are now a
matched pair and nothing enforces it — the cheapest guard would be a `guardrails`
step that greps for edits to one without the other.
