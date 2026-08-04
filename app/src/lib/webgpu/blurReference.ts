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
// Rounding: Rust's `f32::round()` is half-away-from-zero. All values here are
// non-negative, so `Math.round` (half-up) agrees on every input we produce.

/** `build_gaussian_kernel` — length 2*radius+1, normalised to sum 1. */
export function buildGaussianKernel(radius: number): Float32Array {
  const r = Math.trunc(radius);
  const sigma = Math.max(r, 1) / 2;
  const twoSigmaSq = 2 * sigma * sigma;
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / twoSigmaSq);
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
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
      let r = 0, g = 0, b = 0, a = 0;
      for (let ki = -kr; ki <= kr; ki++) {
        // Clamp to edge — the only boundary rule the engine uses.
        const sx = horizontal ? Math.min(w - 1, Math.max(0, x + ki)) : x;
        const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + ki));
        const si = (sy * w + sx) * 4;
        const wt = kernel[ki + kr];
        r += src[si] * wt;
        g += src[si + 1] * wt;
        b += src[si + 2] * wt;
        a += src[si + 3] * wt;
      }
      const di = (y * w + x) * 4;
      // Round + clamp to u8 HERE, between passes. See note 3 above.
      dst[di] = Math.min(255, Math.max(0, Math.round(r)));
      dst[di + 1] = Math.min(255, Math.max(0, Math.round(g)));
      dst[di + 2] = Math.min(255, Math.max(0, Math.round(b)));
      dst[di + 3] = Math.min(255, Math.max(0, Math.round(a)));
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
