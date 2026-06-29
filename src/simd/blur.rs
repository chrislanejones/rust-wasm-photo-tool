//! Explicit WebAssembly SIMD128 acceleration for the separable Gaussian blur
//! region passes used by `filters::gaussian_blur_region`.
//!
//! Strategy: every kernel tap touches one RGBA pixel, whose four channels map
//! naturally onto the four lanes of an `f32x4`. So the inner accumulation that
//! the scalar path does as four independent `f32` multiply-adds collapses into a
//! single vector multiply-add. The 4-wide parallelism comes from the *channels*,
//! not from batching pixels — which means every load/store stays in-bounds with
//! no tail handling, and the rounding/clamp math is bit-identical to scalar:
//!
//!   * inputs are 0..=255 and kernel weights sum to 1, so each accumulator is in
//!     [0.0, 255.0+ε] (always non-negative);
//!   * for non-negative `x`, `x.round()` == `floor(x + 0.5)`, which is exactly
//!     `trunc(x + 0.5)`; the signed/unsigned narrowing then saturates into
//!     0..=255, matching the scalar `.clamp(0.0, 255.0)`.
//!
//! Both passes fall back to a scalar implementation when SIMD128 is unavailable
//! (e.g. native `cargo test`), so callers can invoke them unconditionally.

// ── Public API: target-dispatched at compile time ─────────────────────────────

/// Horizontal blur pass: convolve `region` (bw×bh RGBA) along x into `h_pass`.
/// `kr` is the kernel radius; `kernel` holds `2*kr+1` normalized weights.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn blur_horizontal(
    region: &[u8],
    h_pass: &mut [u8],
    bw: usize,
    bh: usize,
    kr: i32,
    kernel: &[f32],
) {
    unsafe { simd::blur_horizontal(region, h_pass, bw, bh, kr, kernel) }
}

/// Vertical blur pass: convolve `h_pass` (bw×bh RGBA) along y into `region`.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn blur_vertical(
    h_pass: &[u8],
    region: &mut [u8],
    bw: usize,
    bh: usize,
    kr: i32,
    kernel: &[f32],
) {
    unsafe { simd::blur_vertical(h_pass, region, bw, bh, kr, kernel) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn blur_horizontal(
    region: &[u8],
    h_pass: &mut [u8],
    bw: usize,
    bh: usize,
    kr: i32,
    kernel: &[f32],
) {
    scalar::blur_horizontal(region, h_pass, bw, bh, kr, kernel)
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn blur_vertical(
    h_pass: &[u8],
    region: &mut [u8],
    bw: usize,
    bh: usize,
    kr: i32,
    kernel: &[f32],
) {
    scalar::blur_vertical(h_pass, region, bw, bh, kr, kernel)
}

// ── Scalar reference (native builds + correctness baseline) ───────────────────

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
mod scalar {
    pub fn blur_horizontal(
        region: &[u8],
        h_pass: &mut [u8],
        bw: usize,
        bh: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        for ry in 0..bh {
            for rx in 0..bw {
                let (mut r, mut g, mut b, mut a) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
                for ki in -kr..=kr {
                    let sx = (rx as i32 + ki).clamp(0, bw as i32 - 1) as usize;
                    let si = (ry * bw + sx) * 4;
                    let w = kernel[(ki + kr) as usize];
                    r += region[si] as f32 * w;
                    g += region[si + 1] as f32 * w;
                    b += region[si + 2] as f32 * w;
                    a += region[si + 3] as f32 * w;
                }
                let di = (ry * bw + rx) * 4;
                h_pass[di] = r.round().clamp(0.0, 255.0) as u8;
                h_pass[di + 1] = g.round().clamp(0.0, 255.0) as u8;
                h_pass[di + 2] = b.round().clamp(0.0, 255.0) as u8;
                h_pass[di + 3] = a.round().clamp(0.0, 255.0) as u8;
            }
        }
    }

    pub fn blur_vertical(
        h_pass: &[u8],
        region: &mut [u8],
        bw: usize,
        bh: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        for ry in 0..bh {
            for rx in 0..bw {
                let (mut r, mut g, mut b, mut a) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
                for ki in -kr..=kr {
                    let sy = (ry as i32 + ki).clamp(0, bh as i32 - 1) as usize;
                    let si = (sy * bw + rx) * 4;
                    let w = kernel[(ki + kr) as usize];
                    r += h_pass[si] as f32 * w;
                    g += h_pass[si + 1] as f32 * w;
                    b += h_pass[si + 2] as f32 * w;
                    a += h_pass[si + 3] as f32 * w;
                }
                let di = (ry * bw + rx) * 4;
                region[di] = r.round().clamp(0.0, 255.0) as u8;
                region[di + 1] = g.round().clamp(0.0, 255.0) as u8;
                region[di + 2] = b.round().clamp(0.0, 255.0) as u8;
                region[di + 3] = a.round().clamp(0.0, 255.0) as u8;
            }
        }
    }
}

// ── Explicit SIMD128 implementation (wasm) ────────────────────────────────────

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
mod simd {
    use super::super::pixel::{load_px, store_px};
    use core::arch::wasm32::*;

    pub unsafe fn blur_horizontal(
        region: &[u8],
        h_pass: &mut [u8],
        bw: usize,
        bh: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        for ry in 0..bh {
            for rx in 0..bw {
                let mut acc = f32x4_splat(0.0);
                for ki in -kr..=kr {
                    let sx = (rx as i32 + ki).clamp(0, bw as i32 - 1) as usize;
                    let si = (ry * bw + sx) * 4;
                    let w = f32x4_splat(*kernel.get_unchecked((ki + kr) as usize));
                    acc = f32x4_add(acc, f32x4_mul(load_px(region, si), w));
                }
                store_px(h_pass, (ry * bw + rx) * 4, acc);
            }
        }
    }

    pub unsafe fn blur_vertical(
        h_pass: &[u8],
        region: &mut [u8],
        bw: usize,
        bh: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        for ry in 0..bh {
            for rx in 0..bw {
                let mut acc = f32x4_splat(0.0);
                for ki in -kr..=kr {
                    let sy = (ry as i32 + ki).clamp(0, bh as i32 - 1) as usize;
                    let si = (sy * bw + rx) * 4;
                    let w = f32x4_splat(*kernel.get_unchecked((ki + kr) as usize));
                    acc = f32x4_add(acc, f32x4_mul(load_px(h_pass, si), w));
                }
                store_px(region, (ry * bw + rx) * 4, acc);
            }
        }
    }
}
