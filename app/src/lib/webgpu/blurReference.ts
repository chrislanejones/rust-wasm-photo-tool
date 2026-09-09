// A deliberate, line-by-line port of the engine's separable Gaussian blur.
// This is the ORACLE the GPU shader is checked against, so it exists to be
// obviously faithful rather than fast. Do not optimise it.
//
// Ported from:
//   src/filters.rs        build_gaussian_kernel()
//   src/simd/blur.rs      blur_horizontal() / blur_vertical() (scalar fallback,
//                         which the SIMD path is documented to match bit-for-bit)
//
// Three details decide whether the GPU output can ever match, and all three are
// easy to get wrong:
//
//   1. sigma = max(radius, 1) / 2      — not radius/3, not a fixed sigma.
//   2. Edges CLAMP to the last valid pixel (`.clamp(0, w-1)`), they do not wrap
//      and are not treated as transparent.
//   3. **The intermediate pass is quantised back to u8.** Rust rounds and
//      clamps to u8 after the horizontal pass, then reads those u8s for the
//      vertical pass. A GPU version that keeps f32 between passes produces a
//      subtly different — and arguably better — image, which is still WRONG for
//      our purposes: it would not match the CPU path, so the two renderers
//      would disagree about the same document.
//
// Rounding: the SIMD path stores via `f32x4_add(acc, 0.5)` then a truncating
// convert, so `Math.trunc(fround(x + 0.5))` is the faithful form. `f32::round()`
// in the scalar fallback agrees with it for the non-negative values a normalised
// kernel produces.
//
// ⚠️ THIS FILE WAS WRONG FOR ITS WHOLE LIFE, in a way its own header could not
// see. It claimed to be a "line-by-line port", and it was — of the OPERATIONS.
// It was not a port of the PRECISION. The crate accumulates in f32; JavaScript
// has no f32 arithmetic, so `r += src[i] * wt` accumulated at DOUBLE precision
// and disagreed with the engine wherever a sum landed near a .5 tie.
//
// Measured against the live engine on 2026-09-09: ~15 differing bytes per
// megapixel at delta 1, and ZERO at 64x64 — which was the largest case in
// `gpuBlurSelfTest`. The harness's biggest test was the biggest size at which
// the bug was invisible, which is why this survived from the beginning.
//
// TWO fixes were needed and neither alone was enough:
//   1. `Math.fround` on every multiply and every add (3 bytes -> 1 at 256²).
//   2. The kernel comes from the ENGINE (`gaussian_kernel`), not from a port.
//      `build_gaussian_kernel` calls `f32::exp`, and `Math.fround(Math.exp(x))`
//      is the correctly-rounded f64 result rather than f32's own exp. That gap
//      is NOT closable in JavaScript, and it grows with kernel length: exact at
//      radius 1, 4 bytes per megapixel at radius 30.
//
// So the kernel is treated as an INPUT rather than a thing to re-derive. That
// is also what makes this an oracle for the SHADER: both take the same kernel,
// so a difference is arithmetic, which is the only thing under test.

/** The engine's kernel, once resolved. See `setEngineKernel`. */
let engineKernel: ((radius: number) => Float32Array) | null = null;

/**
 * Hand this module the engine's `gaussian_kernel` export.
 *
 * ⚠️ NOT named `useEngineKernel`, which is what it was first called. In a React
 * codebase the `use` prefix means "hook", and eslint's rules-of-hooks correctly
 * errored on it being called from a plain async function.
 *
 * ⚠️ CALL THIS BEFORE COMPARING ANYTHING. Without it the fallback below is used,
 * and the fallback CANNOT be bit-exact — see the header. It is kept so this file
 * still works in jsdom, where there is no engine, for the tests that only need a
 * plausible kernel rather than the engine's one.
 */
export function setEngineKernel(fn: (radius: number) => Float32Array): void {
  engineKernel = fn;
}

/** True when the engine's kernel is in use, i.e. when a delta of 0 is meaningful. */
export function hasEngineKernel(): boolean {
  return engineKernel !== null;
}

const F = Math.fround;

/**
 * `build_gaussian_kernel` — length 2*radius+1, normalised to sum 1.
 *
 * Prefers the ENGINE's kernel. The fround-emulated fallback is as close as
 * JavaScript can get and is still not exact, because `f32::exp` has no JS
 * equivalent: exact at radius 1, ~4 bytes per megapixel adrift at radius 30.
 */
export function buildGaussianKernel(radius: number): Float32Array {
  const r = Math.trunc(radius);
  if (engineKernel) return engineKernel(r);
  const sigma = F(Math.max(r, 1) / 2);
  const twoSigmaSq = F(2 * F(sigma * sigma));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = F(Math.exp(F(-F(i * i) / twoSigmaSq)));
    k[i + r] = v;
    sum = F(sum + v);
  }
  for (let i = 0; i < k.length; i++) k[i] = F(k[i] / sum);
  return k;
}

/** Matches `intensity.clamp(1, 30)` in `gaussian_blur_region`. */
export function clampRadius(intensity: number): number {
  return Math.min(30, Math.max(1, Math.trunc(intensity)));
}

function pass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  kr: number,
  kernel: Float32Array,
  horizontal: boolean,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // f32 accumulators, emulated. The crate uses `0.0f32` and a plain
      // `+=`; JavaScript's `+=` is f64, which is the bug this file had.
      let r = 0, g = 0, b = 0, a = 0;
      for (let ki = -kr; ki <= kr; ki++) {
        // Clamp to edge — the only boundary rule the engine uses.
        const sx = horizontal ? Math.min(w - 1, Math.max(0, x + ki)) : x;
        const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + ki));
        const si = (sy * w + sx) * 4;
        const wt = kernel[ki + kr];
        r = F(r + F(src[si] * wt));
        g = F(g + F(src[si + 1] * wt));
        b = F(b + F(src[si + 2] * wt));
        a = F(a + F(src[si + 3] * wt));
      }
      const di = (y * w + x) * 4;
      // Round + clamp to u8 HERE, between passes. See note 3 above.
      // `trunc(fround(x + 0.5))` mirrors `simd/pixel.rs::store_px`, which adds
      // 0.5 in f32 lanes and then truncate-converts. Not `Math.round`, which
      // does the add at f64.
      dst[di] = Math.min(255, Math.max(0, Math.trunc(F(r + 0.5))));
      dst[di + 1] = Math.min(255, Math.max(0, Math.trunc(F(g + 0.5))));
      dst[di + 2] = Math.min(255, Math.max(0, Math.trunc(F(b + 0.5))));
      dst[di + 3] = Math.min(255, Math.max(0, Math.trunc(F(a + 0.5))));
    }
  }
}

/**
 * Full-image separable Gaussian, CPU, matching the engine.
 *
 * The engine blurs a circular brush region; this blurs a whole rectangle. That
 * is the same two passes over a different extent — the brush's circular
 * write-back mask is applied by the caller in Rust, after the blur. Comparing
 * whole rectangles keeps the oracle simple and still exercises every edge.
 */
export function gaussianBlurCpu(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
): Uint8ClampedArray {
  const kr = clampRadius(intensity);
  const kernel = buildGaussianKernel(kr);
  const hPass = new Uint8ClampedArray(rgba.length);
  const out = new Uint8ClampedArray(rgba.length);
  pass(rgba, hPass, width, height, kr, kernel, true);
  pass(hPass, out, width, height, kr, kernel, false);
  return out;
}
