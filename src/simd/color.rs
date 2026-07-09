//! Explicit WebAssembly SIMD128 acceleration for the per-pixel colour filters
//! `filters::adjust_brightness`, `filters::adjust_contrast`,
//! `filters::adjust_saturation`, `filters::adjust_shadows`,
//! `filters::adjust_highlights`, and the unsharp-mask combine step behind
//! `filters::sharpen`.
//!
//! All fall back to a bit-/visually-identical scalar implementation when
//! SIMD128 is unavailable (e.g. native `cargo test`), so callers can invoke them
//! unconditionally. Inputs are `u8` 0..=255 RGBA; the alpha channel is left
//! untouched by every adjustment below.
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
//!   * Saturation lerps each channel toward the pixel's own perceptual luminance
//!     `L = 0.299R + 0.587G + 0.114B` (ITU-R BT.601 — the same weights already
//!     used by `annotations::render_pin` for text-contrast decisions): `L + (c -
//!     L) * factor`. `factor` 0 = grey, 1 = unchanged, >1 = more saturated.
//!   * Shadows/Highlights are luminance-masked additive brightness shifts: the
//!     same delta is added to R, G, and B (never scaled per-channel), so hue is
//!     preserved and only luminance moves. Shadows peaks in dark tones
//!     (`weight = (1 - L)²`), Highlights peaks in bright tones (`weight = L²`)
//!     and inverts the sign (positive `amount` recovers/darkens blown
//!     highlights). Both use the same BT.601 `L`, normalized to 0..1.
//!   * The unsharp-mask combine (`unsharp_combine`) computes
//!     `orig + amount * (orig - blurred)` per RGB channel from a pre-blurred
//!     buffer (see `filters::sharpen`, which reuses the existing separable
//!     Gaussian blur passes in `simd::blur`); alpha is copied through
//!     unchanged, not sharpened.

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

/// Saturation: lerp each channel toward the pixel's own BT.601 luminance.
/// `factor` 0 = grayscale, 1 = unchanged, >1 = more saturated.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn adjust_saturation(data: &mut [u8], factor: f64) {
    let f = factor.clamp(0.0, 4.0) as f32;
    unsafe { simd::saturation(data, f) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn adjust_saturation(data: &mut [u8], factor: f64) {
    scalar::saturation(data, factor)
}

/// Shadows: additive brightness shift that peaks in dark tones and tapers to
/// ~0 in bright tones. `amount` is a raw 0..=255-scale delta (positive lifts
/// shadows); the same delta is applied to R/G/B so hue is preserved.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn adjust_shadows(data: &mut [u8], amount: f64) {
    let a = amount.clamp(-255.0, 255.0) as f32;
    unsafe { simd::shadows(data, a) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn adjust_shadows(data: &mut [u8], amount: f64) {
    scalar::shadows(data, amount)
}

/// Highlights: additive brightness shift that peaks in bright tones and
/// tapers to ~0 in dark tones. Positive `amount` RECOVERS (darkens) blown
/// highlights (the sign is inverted relative to Shadows' `amount`).
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn adjust_highlights(data: &mut [u8], amount: f64) {
    let a = amount.clamp(-255.0, 255.0) as f32;
    unsafe { simd::highlights(data, a) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn adjust_highlights(data: &mut [u8], amount: f64) {
    scalar::highlights(data, amount)
}

/// Unsharp-mask combine: `data[c] = data[c] + amount * (data[c] - blurred[c])`
/// per RGB channel (alpha copied through unchanged). `blurred` must be the
/// same length as `data` (a pre-blurred copy of it — see `filters::sharpen`).
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
pub fn unsharp_combine(data: &mut [u8], blurred: &[u8], amount: f64) {
    let a = amount.max(0.0) as f32;
    unsafe { simd::unsharp_combine(data, blurred, a) }
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
pub fn unsharp_combine(data: &mut [u8], blurred: &[u8], amount: f64) {
    scalar::unsharp_combine(data, blurred, amount)
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

    /// ITU-R BT.601 perceptual luminance — the same weights used by
    /// `annotations::render_pin` for text-contrast decisions.
    #[inline]
    fn luminance(r: f64, g: f64, b: f64) -> f64 {
        0.299 * r + 0.587 * g + 0.114 * b
    }

    pub fn saturation(data: &mut [u8], factor: f64) {
        let f = factor.clamp(0.0, 4.0);
        for i in (0..data.len()).step_by(4) {
            let r = data[i] as f64;
            let g = data[i + 1] as f64;
            let b = data[i + 2] as f64;
            let l = luminance(r, g, b);
            data[i] = (l + (r - l) * f).round().clamp(0.0, 255.0) as u8;
            data[i + 1] = (l + (g - l) * f).round().clamp(0.0, 255.0) as u8;
            data[i + 2] = (l + (b - l) * f).round().clamp(0.0, 255.0) as u8;
        }
    }

    pub fn shadows(data: &mut [u8], amount: f64) {
        let amt = amount.clamp(-255.0, 255.0);
        for i in (0..data.len()).step_by(4) {
            let r = data[i] as f64;
            let g = data[i + 1] as f64;
            let b = data[i + 2] as f64;
            let l = luminance(r, g, b) / 255.0;
            let weight = (1.0 - l) * (1.0 - l);
            let delta = amt * weight;
            data[i] = (r + delta).round().clamp(0.0, 255.0) as u8;
            data[i + 1] = (g + delta).round().clamp(0.0, 255.0) as u8;
            data[i + 2] = (b + delta).round().clamp(0.0, 255.0) as u8;
        }
    }

    pub fn highlights(data: &mut [u8], amount: f64) {
        let amt = amount.clamp(-255.0, 255.0);
        for i in (0..data.len()).step_by(4) {
            let r = data[i] as f64;
            let g = data[i + 1] as f64;
            let b = data[i + 2] as f64;
            let l = luminance(r, g, b) / 255.0;
            let weight = l * l;
            let delta = -amt * weight;
            data[i] = (r + delta).round().clamp(0.0, 255.0) as u8;
            data[i + 1] = (g + delta).round().clamp(0.0, 255.0) as u8;
            data[i + 2] = (b + delta).round().clamp(0.0, 255.0) as u8;
        }
    }

    /// Unsharp-mask combine: `data[c] += amount * (data[c] - blurred[c])` for
    /// RGB only; alpha is left untouched. `blurred` is a pre-blurred copy of
    /// `data` (see `filters::sharpen`).
    pub fn unsharp_combine(data: &mut [u8], blurred: &[u8], amount: f64) {
        let amt = amount.max(0.0);
        for i in (0..data.len()).step_by(4) {
            for c in 0..3 {
                let orig = data[i + c] as f64;
                let blur = blurred[i + c] as f64;
                data[i + c] = (orig + amt * (orig - blur)).round().clamp(0.0, 255.0) as u8;
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

    /// Per-pixel BT.601 luminance: lane-multiply against `[0.299, 0.587,
    /// 0.114, 0.0]` (alpha weight zeroed) and sum the three colour lanes.
    /// Three lane-extracts + two adds is cheap next to the surrounding
    /// load/store and keeps this in lockstep with the scalar `f64` formula
    /// (to within f32 precision).
    #[inline]
    unsafe fn luminance(px: v128) -> f32 {
        let weights = f32x4(0.299, 0.587, 0.114, 0.0);
        let w = f32x4_mul(px, weights);
        f32x4_extract_lane::<0>(w) + f32x4_extract_lane::<1>(w) + f32x4_extract_lane::<2>(w)
    }

    /// Saturation: `L + (c - L) * f` per RGB channel; alpha lane algebraically
    /// cancels to the source alpha (`a - a = 0`, `0 * f + a = a`).
    pub unsafe fn saturation(data: &mut [u8], f: f32) {
        let fv = f32x4_splat(f);
        let len = data.len();
        let mut i = 0;
        while i + 4 <= len {
            let px = load_px(data, i);
            let l = luminance(px);
            let lv = f32x4_replace_lane::<3>(f32x4_splat(l), f32x4_extract_lane::<3>(px));
            let diff = f32x4_sub(px, lv);
            let out = f32x4_add(lv, f32x4_mul(diff, fv));
            store_px(data, i, out);
            i += 4;
        }
    }

    /// Shadows: `c + amount * (1 - L/255)²` per RGB channel; alpha untouched.
    pub unsafe fn shadows(data: &mut [u8], amt: f32) {
        let inv255 = 1.0 / 255.0;
        let len = data.len();
        let mut i = 0;
        while i + 4 <= len {
            let px = load_px(data, i);
            let l = luminance(px) * inv255;
            let w = (1.0 - l) * (1.0 - l);
            let delta = amt * w;
            let dv = f32x4(delta, delta, delta, 0.0);
            store_px(data, i, f32x4_add(px, dv));
            i += 4;
        }
    }

    /// Highlights: `c - amount * (L/255)²` per RGB channel; alpha untouched.
    pub unsafe fn highlights(data: &mut [u8], amt: f32) {
        let inv255 = 1.0 / 255.0;
        let len = data.len();
        let mut i = 0;
        while i + 4 <= len {
            let px = load_px(data, i);
            let l = luminance(px) * inv255;
            let w = l * l;
            let delta = -amt * w;
            let dv = f32x4(delta, delta, delta, 0.0);
            store_px(data, i, f32x4_add(px, dv));
            i += 4;
        }
    }

    /// Unsharp-mask combine: `orig + amount * (orig - blurred)` per RGB
    /// channel; alpha lane restored from `data` (never sharpened).
    pub unsafe fn unsharp_combine(data: &mut [u8], blurred: &[u8], amt: f32) {
        let av = f32x4_splat(amt);
        let len = data.len();
        let mut i = 0;
        while i + 4 <= len {
            let orig = load_px(data, i);
            let bl = load_px(blurred, i);
            let diff = f32x4_sub(orig, bl);
            let out = f32x4_add(orig, f32x4_mul(diff, av));
            let out = f32x4_replace_lane::<3>(out, f32x4_extract_lane::<3>(orig));
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

// ── Tests (native target → exercise the scalar reference path, which is the
// correctness baseline the SIMD path is documented to match) ───────────────

#[cfg(test)]
mod color_tests {
    use super::*;

    #[test]
    fn saturation_zero_collapses_to_luminance() {
        let mut data = vec![200u8, 100, 50, 255];
        adjust_saturation(&mut data, 0.0);
        // BT.601 luminance of (200,100,50) = 0.299*200 + 0.587*100 + 0.114*50
        // = 124.2 → rounds to 124.
        assert_eq!(data, vec![124, 124, 124, 255]);
    }

    #[test]
    fn saturation_one_is_identity() {
        let mut data = vec![200u8, 100, 50, 255];
        adjust_saturation(&mut data, 1.0);
        assert_eq!(data, vec![200, 100, 50, 255]);
    }

    #[test]
    fn saturation_above_one_pushes_away_from_luminance() {
        let mut data = vec![200u8, 100, 50, 255];
        adjust_saturation(&mut data, 2.0);
        // L + (c - L) * 2 = 2c - L = 2c - 124.2, clamped/rounded per channel.
        assert_eq!(data, vec![255, 76, 0, 255], "clamped both directions");
    }

    #[test]
    fn shadows_lifts_dark_pixels_and_spares_bright_ones() {
        let mut data = vec![0u8, 0, 0, 255, 255, 255, 255, 255];
        adjust_shadows(&mut data, 100.0);
        assert_eq!(
            &data[0..4],
            &[100, 100, 100, 255],
            "black lifted by the full amount (weight = 1)"
        );
        assert_eq!(
            &data[4..8],
            &[255, 255, 255, 255],
            "white untouched (weight ~ 0)"
        );
    }

    #[test]
    fn highlights_recovers_bright_pixels_and_spares_dark_ones() {
        let mut data = vec![0u8, 0, 0, 255, 255, 255, 255, 255];
        adjust_highlights(&mut data, 100.0);
        assert_eq!(&data[0..4], &[0, 0, 0, 255], "black untouched (weight = 0)");
        assert_eq!(
            &data[4..8],
            &[155, 155, 155, 255],
            "white darkened/recovered by the full amount (weight = 1)"
        );
    }

    #[test]
    fn shadows_and_highlights_preserve_alpha() {
        let mut data = vec![10u8, 20, 30, 128];
        adjust_shadows(&mut data, 50.0);
        assert_eq!(data[3], 128, "shadows leaves alpha untouched");
        adjust_highlights(&mut data, 50.0);
        assert_eq!(data[3], 128, "highlights leaves alpha untouched");
    }

    #[test]
    fn shadows_and_highlights_zero_amount_is_identity() {
        let mut data = vec![10u8, 90, 200, 255];
        let before = data.clone();
        adjust_shadows(&mut data, 0.0);
        assert_eq!(data, before);
        adjust_highlights(&mut data, 0.0);
        assert_eq!(data, before);
    }

    #[test]
    fn unsharp_combine_amplifies_the_difference_from_blurred() {
        let mut data = vec![100u8, 100, 100, 200];
        let blurred = vec![80u8, 80, 80, 200];
        unsharp_combine(&mut data, &blurred, 1.0);
        // 100 + 1.0 * (100 - 80) = 120 on RGB; alpha untouched.
        assert_eq!(data, vec![120, 120, 120, 200]);
    }

    #[test]
    fn unsharp_combine_zero_amount_is_identity() {
        let mut data = vec![100u8, 90, 80, 255];
        let blurred = vec![50u8, 40, 30, 255];
        unsharp_combine(&mut data, &blurred, 0.0);
        assert_eq!(data, vec![100, 90, 80, 255]);
    }
}
