# ADR-030: GPU acceleration runs in JS beside the engine, not as `wgpu` inside it
Date: 2026-08-04   Status: draft

## Context

Phase 0 of the GPU arc: prove a WebGPU compute pass can reproduce an engine
filter exactly, before anything depends on it. The repo's standing invariant is
"the engine owns pixels — anything touching image data goes through
`stamp_tool`", which points at pulling `wgpu` into the Rust crate.

One number rules that out for now. `scripts/deploy-sentinel.sh` fails any deploy
whose wasm falls outside **700–800 KB**, and the crate is at **761,213 B** —
about 39 KB of headroom. `wgpu` plus its shader-translation layer is far larger
than that, so taking it means raising the band, and the band is the check that
caught five weeks of featureless production builds. That is a decision in its
own right, not a side effect of a spike.

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

+ Zero wasm growth: the crate is untouched at 761,213 B, and the deploy sentinel
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

Not applied here; this ADR measures, it does not build.

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
