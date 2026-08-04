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
