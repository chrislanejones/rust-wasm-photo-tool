//! Explicit WebAssembly SIMD128 acceleration for the per-pixel colour filters
//! `filters::adjust_brightness` and `filters::adjust_contrast`.
//!
//! Both fall back to a bit-/visually-identical scalar implementation when
//! SIMD128 is unavailable (e.g. native `cargo test`), so callers can invoke them
//! unconditionally. Inputs are `u8` 0..=255 RGBA; the alpha channel is left
//! untouched by both adjustments.
//!
//!   * Brightness adds a clamped integer `delta` to R/G/B. SIMD does it 16 bytes
//!     (4 pixels) at a time: widen u8→i16, add a per-pixel `[d, d, d, 0]` delta
//!     (alpha gets 0), then `u8x16_narrow_i16x8` to saturate back into 0..=255 —
//!     **bit-identical** to the scalar `(c + d).clamp(0, 255)`.
//!   * Contrast maps each channel `((v/255 - 0.5)*f + 0.5).clamp(0,1) * 255`,
//!     done per pixel on `f32x4` lanes (alpha lane restored from the source, so
//!     it passes through unchanged). The accumulator is clamped to [0, 255] and
//!     non-negative, so `round()` == `trunc(x + 0.5)` and the saturating narrow
//!     matches the scalar clamp; results match scalar to within f32 precision
//!     (visually identical — the suite's correctness baseline is the scalar path).

// ── Public API: target-dispatched at compile time ─────────────────────────────

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn adjust_brightness(data: &mut [u8], delta: f64) {
    let d = (delta.clamp(-1.0, 1.0) * 255.0).round() as i32;
    unsafe { simd::brightness(data, d) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn adjust_brightness(data: &mut [u8], delta: f64) {
    scalar::brightness(data, delta)
}

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn adjust_contrast(data: &mut [u8], factor: f64) {
    let f = factor.clamp(0.0, 4.0) as f32;
    unsafe { simd::contrast(data, f) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn adjust_contrast(data: &mut [u8], factor: f64) {
    scalar::contrast(data, factor)
}

/// Sum each RGBA channel over the inclusive cell `[cx0..=cx1] × [cy0..=cy1]` of a
/// `w`-wide RGBA buffer, returning `([sumR,sumG,sumB,sumA], pixel_count)`. Used by
/// `filters::pixelate_region` for the per-cell average. The SIMD path accumulates
/// the four channels in a `u32x4` (sums stay < u32::MAX for the ≤128² cells the
/// caller produces), so the `sum / n` average is bit-identical to the u64 scalar.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn cell_channel_sums(
    data: &[u8],
    w: usize,
    cx0: usize,
    cy0: usize,
    cx1: usize,
    cy1: usize,
) -> ([u64; 4], u64) {
    unsafe { simd::cell_channel_sums(data, w, cx0, cy0, cx1, cy1) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn cell_channel_sums(
    data: &[u8],
    w: usize,
    cx0: usize,
    cy0: usize,
    cx1: usize,
    cy1: usize,
) -> ([u64; 4], u64) {
    scalar::cell_channel_sums(data, w, cx0, cy0, cx1, cy1)
}

/// Complement every byte of `buf` (`255 - x`). Used by `layer::invert_layer_mask`.
/// Bit-identical: `255 - x` never underflows for `x` in 0..=255, so the wrapping
/// `i8x16_sub` produces the exact byte.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn invert_u8(buf: &mut [u8]) {
    unsafe { simd::invert_u8(buf) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn invert_u8(buf: &mut [u8]) {
    scalar::invert_u8(buf)
}

// ── Scalar reference (native builds + correctness baseline) ───────────────────

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
mod scalar {
    pub fn brightness(data: &mut [u8], delta: f64) {
        let d = (delta.clamp(-1.0, 1.0) * 255.0).round() as i32;
        for i in (0..data.len()).step_by(4) {
            data[i] = (data[i] as i32 + d).clamp(0, 255) as u8;
            data[i + 1] = (data[i + 1] as i32 + d).clamp(0, 255) as u8;
            data[i + 2] = (data[i + 2] as i32 + d).clamp(0, 255) as u8;
        }
    }

    pub fn contrast(data: &mut [u8], factor: f64) {
        let f = factor.clamp(0.0, 4.0);
        for i in (0..data.len()).step_by(4) {
            for c in 0..3 {
                let v = data[i + c] as f64 / 255.0;
                let adj = ((v - 0.5) * f + 0.5).clamp(0.0, 1.0);
                data[i + c] = (adj * 255.0).round() as u8;
            }
        }
    }

    pub fn cell_channel_sums(
        data: &[u8],
        w: usize,
        cx0: usize,
        cy0: usize,
        cx1: usize,
        cy1: usize,
    ) -> ([u64; 4], u64) {
        let (mut sr, mut sg, mut sb, mut sa, mut n) = (0u64, 0u64, 0u64, 0u64, 0u64);
        for yy in cy0..=cy1 {
            for xx in cx0..=cx1 {
                let i = (yy * w + xx) * 4;
                sr += data[i] as u64;
                sg += data[i + 1] as u64;
                sb += data[i + 2] as u64;
                sa += data[i + 3] as u64;
                n += 1;
            }
        }
        ([sr, sg, sb, sa], n)
    }

    pub fn invert_u8(buf: &mut [u8]) {
        for m in buf.iter_mut() {
            *m = 255 - *m;
        }
    }
}

// ── Explicit SIMD128 implementation (wasm) ────────────────────────────────────

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
mod simd {
    use super::super::pixel::{load_px, store_px};
    use core::arch::wasm32::*;

    /// Add clamped integer `d` to R/G/B (alpha untouched), 4 pixels per step.
    pub unsafe fn brightness(data: &mut [u8], d: i32) {
        let d16 = d as i16;
        // Per-pixel delta laid over two pixels' worth of i16 lanes: R,G,B get d,
        // alpha gets 0. Reused for both the low and high pixel pairs of a block.
        let delta = i16x8(d16, d16, d16, 0, d16, d16, d16, 0);
        let len = data.len();
        let mut i = 0;
        while i + 16 <= len {
            let px = v128_load(data.as_ptr().add(i) as *const v128);
            let lo = i16x8_add(i16x8_extend_low_u8x16(px), delta);
            let hi = i16x8_add(i16x8_extend_high_u8x16(px), delta);
            let out = u8x16_narrow_i16x8(lo, hi);
            v128_store(data.as_mut_ptr().add(i) as *mut v128, out);
            i += 16;
        }
        // Tail: fewer than 4 pixels left — scalar, identical math.
        while i + 4 <= len {
            *data.get_unchecked_mut(i) = (*data.get_unchecked(i) as i32 + d).clamp(0, 255) as u8;
            *data.get_unchecked_mut(i + 1) =
                (*data.get_unchecked(i + 1) as i32 + d).clamp(0, 255) as u8;
            *data.get_unchecked_mut(i + 2) =
                (*data.get_unchecked(i + 2) as i32 + d).clamp(0, 255) as u8;
            i += 4;
        }
    }

    /// Per-channel contrast on `f32x4` lanes; alpha lane restored from source.
    pub unsafe fn contrast(data: &mut [u8], f: f32) {
        let inv255 = f32x4_splat(1.0 / 255.0);
        let half = f32x4_splat(0.5);
        let fv = f32x4_splat(f);
        let v255 = f32x4_splat(255.0);
        let zero = f32x4_splat(0.0);
        let one = f32x4_splat(1.0);
        let len = data.len();
        let mut i = 0;
        while i + 4 <= len {
            let px = load_px(data, i); // [r, g, b, a] as f32x4
                                       // adj = clamp((v/255 - 0.5) * f + 0.5, 0, 1)
            let v = f32x4_mul(px, inv255);
            let adj = f32x4_add(f32x4_mul(f32x4_sub(v, half), fv), half);
            let adj = f32x4_pmin(one, f32x4_pmax(zero, adj));
            // out = adj * 255, then keep alpha = original (px lane 3).
            let out = f32x4_mul(adj, v255);
            let out = f32x4_replace_lane::<3>(out, f32x4_extract_lane::<3>(px));
            // store_px rounds (non-negative) + clamps; alpha (integer) round-trips.
            store_px(data, i, out);
            i += 4;
        }
    }

    /// `u32x4` per-pixel accumulation of a cell's channel sums. Each pixel widens
    /// u8→u32 ([r,g,b,a]) and adds into the accumulator; ≤128² cells keep every
    /// lane < u32::MAX, so the extracted sums equal the u64 scalar sums exactly.
    pub unsafe fn cell_channel_sums(
        data: &[u8],
        w: usize,
        cx0: usize,
        cy0: usize,
        cx1: usize,
        cy1: usize,
    ) -> ([u64; 4], u64) {
        let mut acc = u32x4_splat(0);
        let mut n = 0u64;
        for yy in cy0..=cy1 {
            for xx in cx0..=cx1 {
                let i = (yy * w + xx) * 4;
                let raw = v128_load32_zero(data.as_ptr().add(i) as *const u32);
                let u16s = u16x8_extend_low_u8x16(raw);
                let u32s = u32x4_extend_low_u16x8(u16s);
                acc = u32x4_add(acc, u32s);
                n += 1;
            }
        }
        let sums = [
            u32x4_extract_lane::<0>(acc) as u64,
            u32x4_extract_lane::<1>(acc) as u64,
            u32x4_extract_lane::<2>(acc) as u64,
            u32x4_extract_lane::<3>(acc) as u64,
        ];
        (sums, n)
    }

    pub unsafe fn invert_u8(buf: &mut [u8]) {
        let ff = u8x16_splat(255);
        let len = buf.len();
        let mut i = 0;
        while i + 16 <= len {
            let v = v128_load(buf.as_ptr().add(i) as *const v128);
            v128_store(buf.as_mut_ptr().add(i) as *mut v128, i8x16_sub(ff, v));
            i += 16;
        }
        while i < len {
            *buf.get_unchecked_mut(i) = 255 - *buf.get_unchecked(i);
            i += 1;
        }
    }
}
