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

// ── Rayon-parallel path (feature `threads`) ────────────────────────────────────
//
// Everything below this line is gated behind `#[cfg(feature = "threads")]` (or
// nested inside something that is), so the default (non-threads) build's
// compiled bytes are provably unaffected — nothing above this comment changed,
// and none of what follows is even compiled in when `threads` is off. Verified
// each session by diffing `pkg/*.wasm` before/after this file existed (see
// SESSION_LOG.md on `feat/rayon-parallel-blur`).
//
// This deliberately DUPLICATES the per-row math of `scalar::blur_*`/
// `simd::blur_*` above (in `threaded::scalar_row`/`threaded::simd_row`) rather
// than extracting a helper shared with the sequential functions. A
// shared-helper refactor was tried first: behaviorally identical, but it
// changed the default build's SIMD codegen shape enough under
// `opt-level=3`+`lto=true`+`codegen-units=1` to grow the shipped `.wasm` by
// +363 bytes even with the new code never executing — the extra indirection
// didn't fully inline away. Duplication costs ~90 lines of Rust source that
// only exist under `threads`; it costs zero bytes in the artifact every user
// actually downloads.
//
// SIMD composes with threads exactly as advertised: each row is computed by
// the SAME per-row SIMD/scalar math as the sequential passes (one `f32x4`
// multiply-add per kernel tap), just handed out one row per rayon task
// instead of iterated in a single thread. Every row's output depends only on
// its own inputs (`region`/`h_pass`, both read-only during a pass) — no row's
// write depends on another row's write — so parallelizing the row loop
// cannot change what any individual row computes. That's *why* the
// byte-identical tests below hold structurally, not by coincidence.

#[cfg(feature = "threads")]
pub fn blur_horizontal_parallel(
    region: &[u8],
    h_pass: &mut [u8],
    bw: usize,
    bh: usize,
    kr: i32,
    kernel: &[f32],
) {
    use rayon::prelude::*;
    if bw == 0 {
        return;
    }
    h_pass
        .par_chunks_mut(bw * 4)
        .take(bh)
        .enumerate()
        .for_each(|(ry, out_row)| threaded::horizontal_row(region, out_row, bw, ry, kr, kernel));
}

#[cfg(feature = "threads")]
pub fn blur_vertical_parallel(
    h_pass: &[u8],
    region: &mut [u8],
    bw: usize,
    bh: usize,
    kr: i32,
    kernel: &[f32],
) {
    use rayon::prelude::*;
    if bw == 0 {
        return;
    }
    region
        .par_chunks_mut(bw * 4)
        .take(bh)
        .enumerate()
        .for_each(|(ry, out_row)| threaded::vertical_row(h_pass, out_row, bw, bh, ry, kr, kernel));
}

#[cfg(feature = "threads")]
mod threaded {
    //! Per-row math for the parallel path. Dispatches to SIMD128 on
    //! wasm32+simd128, scalar everywhere else — same target-dispatch as the
    //! sequential entry points above, just operating on one row's slice
    //! (`out_row`, exactly `bw * 4` bytes) instead of the full buffer.

    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    pub fn horizontal_row(
        region: &[u8],
        out_row: &mut [u8],
        bw: usize,
        ry: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        unsafe { simd_row::horizontal_row(region, out_row, bw, ry, kr, kernel) }
    }

    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    pub fn vertical_row(
        h_pass: &[u8],
        out_row: &mut [u8],
        bw: usize,
        bh: usize,
        ry: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        unsafe { simd_row::vertical_row(h_pass, out_row, bw, bh, ry, kr, kernel) }
    }

    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    pub fn horizontal_row(
        region: &[u8],
        out_row: &mut [u8],
        bw: usize,
        ry: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        scalar_row::horizontal_row(region, out_row, bw, ry, kr, kernel)
    }

    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    pub fn vertical_row(
        h_pass: &[u8],
        out_row: &mut [u8],
        bw: usize,
        bh: usize,
        ry: usize,
        kr: i32,
        kernel: &[f32],
    ) {
        scalar_row::vertical_row(h_pass, out_row, bw, bh, ry, kr, kernel)
    }

    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    mod scalar_row {
        /// Duplicate of `super::super::scalar::blur_horizontal`'s inner body,
        /// computing exactly one output row (`ry`) into `out_row`.
        pub fn horizontal_row(
            region: &[u8],
            out_row: &mut [u8],
            bw: usize,
            ry: usize,
            kr: i32,
            kernel: &[f32],
        ) {
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
                let di = rx * 4;
                out_row[di] = r.round().clamp(0.0, 255.0) as u8;
                out_row[di + 1] = g.round().clamp(0.0, 255.0) as u8;
                out_row[di + 2] = b.round().clamp(0.0, 255.0) as u8;
                out_row[di + 3] = a.round().clamp(0.0, 255.0) as u8;
            }
        }

        /// Duplicate of `super::super::scalar::blur_vertical`'s inner body,
        /// computing exactly one output row (`ry`) into `out_row`.
        pub fn vertical_row(
            h_pass: &[u8],
            out_row: &mut [u8],
            bw: usize,
            bh: usize,
            ry: usize,
            kr: i32,
            kernel: &[f32],
        ) {
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
                let di = rx * 4;
                out_row[di] = r.round().clamp(0.0, 255.0) as u8;
                out_row[di + 1] = g.round().clamp(0.0, 255.0) as u8;
                out_row[di + 2] = b.round().clamp(0.0, 255.0) as u8;
                out_row[di + 3] = a.round().clamp(0.0, 255.0) as u8;
            }
        }
    }

    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    mod simd_row {
        use super::super::super::pixel::{load_px, store_px};
        use core::arch::wasm32::*;

        /// Duplicate of `super::super::simd::blur_horizontal`'s inner body,
        /// computing exactly one output row (`ry`) into `out_row`.
        pub unsafe fn horizontal_row(
            region: &[u8],
            out_row: &mut [u8],
            bw: usize,
            ry: usize,
            kr: i32,
            kernel: &[f32],
        ) {
            for rx in 0..bw {
                let mut acc = f32x4_splat(0.0);
                for ki in -kr..=kr {
                    let sx = (rx as i32 + ki).clamp(0, bw as i32 - 1) as usize;
                    let si = (ry * bw + sx) * 4;
                    let w = f32x4_splat(*kernel.get_unchecked((ki + kr) as usize));
                    acc = f32x4_add(acc, f32x4_mul(load_px(region, si), w));
                }
                store_px(out_row, rx * 4, acc);
            }
        }

        /// Duplicate of `super::super::simd::blur_vertical`'s inner body,
        /// computing exactly one output row (`ry`) into `out_row`.
        pub unsafe fn vertical_row(
            h_pass: &[u8],
            out_row: &mut [u8],
            bw: usize,
            bh: usize,
            ry: usize,
            kr: i32,
            kernel: &[f32],
        ) {
            for rx in 0..bw {
                let mut acc = f32x4_splat(0.0);
                for ki in -kr..=kr {
                    let sy = (ry as i32 + ki).clamp(0, bh as i32 - 1) as usize;
                    let si = (sy * bw + rx) * 4;
                    let w = f32x4_splat(*kernel.get_unchecked((ki + kr) as usize));
                    acc = f32x4_add(acc, f32x4_mul(load_px(h_pass, si), w));
                }
                store_px(out_row, rx * 4, acc);
            }
        }
    }
}

// ── Tests: parallel path must be byte-identical to the sequential path ────────

#[cfg(all(test, feature = "threads"))]
mod threaded_tests {
    use super::*;

    /// Deterministic pseudo-random RGBA buffer (xorshift64), independent of
    /// any code under test.
    fn make_buffer(w: usize, h: usize, seed: u64) -> Vec<u8> {
        let mut s = seed | 1;
        let mut out = vec![0u8; w * h * 4];
        for b in out.iter_mut() {
            s ^= s >> 12;
            s ^= s << 25;
            s ^= s >> 27;
            *b = (s.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 33) as u8;
        }
        out
    }

    /// Run the full two-pass blur both sequentially and in parallel from the
    /// same source buffer, returning (sequential, parallel) final outputs.
    fn run_both(w: usize, h: usize, radius: u32) -> (Vec<u8>, Vec<u8>) {
        let kernel = crate::filters::build_gaussian_kernel(radius);
        let kr = radius as i32;
        let data = make_buffer(w, h, 0xC0FF_EE12_3456_789A ^ (w as u64) << 32 ^ h as u64);
        let len = w * h * 4;

        let mut h_seq = vec![0u8; len];
        let mut out_seq = vec![0u8; len];
        blur_horizontal(&data, &mut h_seq, w, h, kr, &kernel);
        blur_vertical(&h_seq, &mut out_seq, w, h, kr, &kernel);

        let mut h_par = vec![0u8; len];
        let mut out_par = vec![0u8; len];
        blur_horizontal_parallel(&data, &mut h_par, w, h, kr, &kernel);
        blur_vertical_parallel(&h_par, &mut out_par, w, h, kr, &kernel);

        (out_seq, out_par)
    }

    #[test]
    fn parallel_matches_sequential_across_sizes_incl_edge_cases() {
        // (width, height, radius) — deliberately includes: a single pixel, a
        // single row, sizes that are NOT multiples of common thread counts
        // (2/4/8/16), and images smaller than a typical thread count (so some
        // threads in the pool get zero rows to work on).
        let cases: &[(usize, usize, u32)] = &[
            (1, 1, 1),
            (1, 1, 5),
            (3, 1, 2), // 1 row, narrower than most thread pools
            (1, 7, 3), // 1px wide, several rows
            (2, 2, 1), // smaller than a typical thread count
            (5, 5, 2),
            (17, 13, 4), // not a multiple of 2/4/8/16
            (33, 129, 6),
            (64, 64, 8),
            (256, 3, 3), // wide, very short
        ];
        for &(w, h, r) in cases {
            let (seq, par) = run_both(w, h, r);
            assert_eq!(seq, par, "byte mismatch at {w}x{h} radius {r}");
        }
    }

    #[test]
    fn parallel_zero_size_is_a_safe_no_op() {
        let kernel = crate::filters::build_gaussian_kernel(2);
        let mut h_pass: Vec<u8> = Vec::new();
        let mut out: Vec<u8> = Vec::new();
        // 0×0: nothing to do, must not panic.
        blur_horizontal_parallel(&[], &mut h_pass, 0, 0, 2, &kernel);
        blur_vertical_parallel(&h_pass, &mut out, 0, 0, 2, &kernel);
        // 0-width, nonzero height: still must not panic (this is exactly the
        // case `par_chunks_mut` would panic on without the `bw == 0` guard).
        let mut h_pass2: Vec<u8> = Vec::new();
        blur_horizontal_parallel(&[], &mut h_pass2, 0, 4, 2, &kernel);
    }

    #[test]
    fn parallel_matches_sequential_at_realistic_brush_sizes() {
        // Mirrors gaussian_blur_region's typical bounding-box scale (a brush
        // dab), at the default-ish radius used by the effects brush.
        for &(w, h) in &[(40usize, 40usize), (128, 96), (200, 1)] {
            let (seq, par) = run_both(w, h, 8);
            assert_eq!(seq, par, "byte mismatch at brush size {w}x{h}");
        }
    }
}
