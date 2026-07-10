# ADR-011: Parallel kernels via wasm-bindgen-rayon, gated on COOP/COEP

Date: 2026-07-10   Status: Draft

## Context

ADR-009 spiked COOP: same-origin + COEP: credentialless against a live headless
Clerk sign-in and found no blocker — `crossOriginIsolated` becomes `true`,
`SharedArrayBuffer` is available, `stamp_tool` still loads, Clerk's modal still
renders. That cleared the precondition `wasm-bindgen-rayon` needs. This ADR is
the first kernel built on that clearance: the two-pass Gaussian blur
(`src/simd/blur.rs`), parallelized row-wise with rayon on top of the existing
SIMD128 inner loop. Native criterion (22 logical cores here) measures
**7.85×** at 2048×2048 r8 and **7.86×** at 4096×4096 r8 — consistent across a
4× change in pixel count, which reads as a real, stable ceiling (memory
bandwidth / thread-pool overhead) rather than a fixed-cost artifact that would
shrink at larger sizes.

## Decision

Add rayon + `wasm-bindgen-rayon` behind a new `threads` cargo feature, off by
default. `blur_horizontal_parallel`/`blur_vertical_parallel` reuse the exact
per-row SIMD128/scalar math the sequential passes use (SIMD is the inner loop,
one `f32x4` multiply-add per tap; rayon is the outer loop, one task per output
row) — every future parallel kernel follows this shape and ships with a
byte-identical-output test against its sequential counterpart, non-negotiably
(no approximation, no reordering that changes rounding). Blur is the pilot
kernel; resize/denoise are the anticipated next candidates.

## Consequences

+ A measured, reproducible native speedup (7.85–7.86×) for the pilot kernel,
  with a load-bearing test suite (`simd::blur::threaded_tests`, 60→63 tests)
  proving output parity across sizes including 1px/1-row/sub-thread-count
  images — not just the two benchmark sizes.
+ The default (non-threads) wasm build is provably unaffected: `pkg/*.wasm`
  is byte-for-byte the same size (642,054 B) before and after, confirmed via
  `twiggy diff` (0 bytes changed across every code/data item). This cost a
  deliberate design change mid-session — see "Alternatives rejected".
+ Fails loudly, not silently, when misused: `cargo build --features threads
  --target wasm32-unknown-unknown` on the stable toolchain here produces
  wasm-bindgen-rayon's own `compile_error!` ("did you forget to enable
  atomics and bulk-memory") rather than a broken artifact.
- **Needs COOP/COEP response headers to activate for real** — not shipped by
  this ADR, not shipped by this repo at all yet. That's ADR-009's remaining
  open items (real Clerk credential round-trip, OAuth popup path, Netlify
  header delivery) plus a nightly toolchain + `-Z build-std=panic_abort,std`
  wasm32+atomics build, neither of which exists in this environment. Separate,
  later, human decision.
- **Native bench is a proxy, not the real number.** OS threads via rayon are a
  legitimate stand-in for "does splitting rows across a pool help
  algorithmically," but there is no native "SIMD" leg to compare against —
  `core::arch::wasm32` intrinsics don't exist off wasm32, full stop. The
  native bench therefore compares scalar-sequential vs. scalar+rayon, not
  scalar vs. SIMD vs. SIMD+rayon. The real three-way number is deferred to
  Task D's gated in-browser microbench (`bench_blur_threaded`, feature-detects
  `crossOriginIsolated` + the export's presence, reports "unavailable" with an
  honest reason otherwise) — pending someone actually flipping the headers on.
- **Every future parallel kernel inherits the byte-identical-test requirement**
  — real cost, not boilerplate: a kernel whose per-row/per-tile output isn't
  provably order-independent (e.g. anything with a running/carried state
  across rows) cannot use this pattern as-is and needs its own analysis.

## Alternatives rejected

- **Shared row-level helper between the sequential and parallel entry
  points** (tried first, reverted): behaviorally identical, structurally
  nicer (byte-identity "by construction" instead of by duplicated math), but
  it changed the default build's SIMD codegen shape enough under
  `opt-level=3`+`lto=true`+`codegen-units=1` to grow the shipped `.wasm` by
  +363 B even with zero new code executing — the extra indirection didn't
  fully inline away. Rejected in favor of duplicating the per-row math inside
  a `#[cfg(feature = "threads")]`-only module, which costs Rust source lines,
  not shipped bytes, and keeps the "default build byte-for-byte unchanged"
  invariant a provable fact instead of an optimizer-dependent hope.
- **A native x86 SIMD implementation purely to complete a three-way bench**:
  would have let native criterion report "SIMD gave Nx, threads gave Mx" as
  literally asked, but the task's own brief says "take the existing SIMD128
  blur," not "write a second one for x86" — an unrequested, permanent new
  code path just to make a bench chart complete. Rejected; the gap is logged
  plainly instead, and Task D's in-browser hook is the real mechanism for
  that three-way number when headers land.
- **`rayon`'s `web_spin_lock` feature**: not something to decide either way —
  `wasm-bindgen-rayon` already requires it on its own `rayon` dependency, and
  Cargo unifies features across a single resolved dependency version, so it's
  enabled in the `threads` build regardless of what this crate's own `rayon`
  dependency line requests. Noted as a fact affecting the native bench
  numbers above, not a choice made here.

## Pre-mortem

It is six months later and this decision was a mistake. Most likely reason:
someone flips COOP/COEP headers on in production to unlock this work, and it
breaks the "Continue with Google" OAuth popup (ADR-009 flagged this
specifically as untested) — `window.opener` gets severed, sign-in silently
degrades for Google users while email/password keeps working, and it isn't
caught until a support report comes in, because generic uptime/error-rate
monitoring doesn't distinguish auth methods. A second plausible failure: the
next kernel someone parallelizes this way (resize, most likely) turns out to
be memory-bandwidth-bound like blur — real speedup, but nowhere near
core-count-linear — and gets shipped anyway on the assumption "rayon = free
speedup," disappointing whoever sized the feature against a bigger number.

Early warning sign to watch for: any "Sign in with Google" failure report
landing right after a COOP/COEP rollout (not a general Clerk outage) — that's
the specific, previously-flagged failure mode, not a new one. For the second
risk: any future parallel-kernel PR that skips reporting its actual measured
speedup ratio (just says "added rayon") — the byte-identical test is
mandatory and enforced by review; the honest speedup number should be too.
