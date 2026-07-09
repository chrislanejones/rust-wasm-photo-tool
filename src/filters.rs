// src/filters.rs

// Brightness / contrast are SIMD128-accelerated (with a bit-/visually-identical
// scalar fallback) in `simd_color`; these are thin delegators so existing call
// sites (`filters::adjust_brightness` / `adjust_contrast`) are unchanged.
pub fn adjust_brightness(data: &mut [u8], delta: f64) {
    crate::simd::color::adjust_brightness(data, delta);
}

pub fn adjust_contrast(data: &mut [u8], factor: f64) {
    crate::simd::color::adjust_contrast(data, factor);
}

pub fn adjust_saturation(data: &mut [u8], factor: f64) {
    crate::simd::color::adjust_saturation(data, factor);
}

pub fn adjust_shadows(data: &mut [u8], amount: f64) {
    crate::simd::color::adjust_shadows(data, amount);
}

pub fn adjust_highlights(data: &mut [u8], amount: f64) {
    crate::simd::color::adjust_highlights(data, amount);
}

/// Unsharp-mask sharpen over the WHOLE buffer (not a brush region): blur a
/// copy with a small fixed-radius Gaussian (reusing the existing separable
/// `simd::blur` passes — no second blur implementation), then combine
/// `orig + amount * (orig - blurred)` per RGB channel (alpha untouched).
/// `amount` 0 = identity; the caller clamps to a sane UI range.
///
/// One-shot (slider-commit) call, not a per-frame hot path: the two
/// full-buffer scratch `Vec`s are unavoidable here (`blur_horizontal`/
/// `blur_vertical` need input/output buffers distinct from `data`, same as
/// `gaussian_blur_region`'s scratch buffers) but are allocated once per call,
/// not per pixel.
pub fn sharpen(data: &mut [u8], width: u32, height: u32, amount: f64) {
    const RADIUS: u32 = 2;
    let len = data.len();
    if len == 0 {
        return;
    }
    let kernel = build_gaussian_kernel(RADIUS);
    let kr = RADIUS as i32;
    let w = width as usize;
    let h = height as usize;

    let mut h_pass = vec![0u8; len];
    let mut blurred = vec![0u8; len];
    crate::simd::blur::blur_horizontal(data, &mut h_pass, w, h, kr, &kernel);
    crate::simd::blur::blur_vertical(&h_pass, &mut blurred, w, h, kr, &kernel);
    crate::simd::color::unsharp_combine(data, &blurred, amount);
}

/// Build a 1D Gaussian kernel of the given radius.
/// Kernel size = 2*radius + 1.
pub fn build_gaussian_kernel(radius: u32) -> Vec<f32> {
    let r = radius as i32;
    let sigma = (radius as f32).max(1.0) / 2.0;
    let two_sigma_sq = 2.0 * sigma * sigma;
    let mut kernel = Vec::with_capacity((2 * r + 1) as usize);
    let mut sum = 0.0_f32;

    for i in -r..=r {
        let val = (-(i * i) as f32 / two_sigma_sq).exp();
        kernel.push(val);
        sum += val;
    }

    // Normalize
    for v in kernel.iter_mut() {
        *v /= sum;
    }

    kernel
}

/// Apply a Gaussian blur to a circular region of the image buffer.
/// `cx`, `cy`: center of the blur brush in pixel coords
/// `brush_radius`: radius of the circular area to blur
/// `intensity`: blur kernel radius (higher = more blurry, 1..20)
///
/// Two-pass separable Gaussian: horizontal then vertical.
/// Only processes pixels within the circular brush area for performance.
pub fn gaussian_blur_region(
    data: &mut [u8],
    width: u32,
    height: u32,
    cx: f64,
    cy: f64,
    brush_radius: f64,
    intensity: u32,
    scratch_a: &mut Vec<u8>,
    scratch_b: &mut Vec<u8>,
    kernel: &[f32],
) {
    let w = width as i32;
    let h = height as i32;
    let kr = intensity.clamp(1, 30) as i32;

    // Bounding box of the brush circle
    let min_x = ((cx - brush_radius).floor() as i32).max(0);
    let max_x = ((cx + brush_radius).ceil() as i32).min(w - 1);
    let min_y = ((cy - brush_radius).floor() as i32).max(0);
    let max_y = ((cy + brush_radius).ceil() as i32).min(h - 1);

    let bw = (max_x - min_x + 1) as usize;
    let bh = (max_y - min_y + 1) as usize;

    if bw == 0 || bh == 0 {
        return;
    }

    // Reuse caller-supplied scratch buffers — grow if needed, never reallocate on shrink.
    let needed = bw * bh * 4;
    scratch_a.resize(needed, 0);
    scratch_b.resize(needed, 0);
    let region = &mut scratch_a[..needed];
    for ry in 0..bh {
        let sy = min_y + ry as i32;
        for rx in 0..bw {
            let sx = min_x + rx as i32;
            let si = ((sy * w + sx) * 4) as usize;
            let di = (ry * bw + rx) * 4;
            region[di..di + 4].copy_from_slice(&data[si..si + 4]);
        }
    }

    // Pass 1: Horizontal blur region → h_pass. Pass 2: vertical h_pass → region.
    // Both passes are SIMD128-accelerated on wasm (one f32x4 multiply-add per RGBA
    // pixel) with a bit-identical scalar fallback on other targets. See simd_blur.
    let h_pass = &mut scratch_b[..needed];
    crate::simd::blur::blur_horizontal(region, h_pass, bw, bh, kr, kernel);
    crate::simd::blur::blur_vertical(h_pass, region, bw, bh, kr, kernel);

    // Write back only pixels inside the circular brush
    let br_sq = brush_radius * brush_radius;
    for ry in 0..bh {
        let py = min_y + ry as i32;
        for rx in 0..bw {
            let px = min_x + rx as i32;
            let dx = px as f64 - cx;
            let dy = py as f64 - cy;
            if dx * dx + dy * dy > br_sq {
                continue;
            }
            let si = (ry * bw + rx) * 4;
            let di = ((py * w + px) * 4) as usize;
            data[di..di + 4].copy_from_slice(&region[si..si + 4]);
        }
    }
}

/// Pixelate (mosaic) a circular brush region. Cells are snapped to a global
/// `block`×`block` grid so repeated dabs land on the same squares; each cell is
/// averaged over the part that lies within the image, then written back to the
/// cell pixels that fall inside the brush circle. `block_size` is clamped to
/// 2..=128.
pub fn pixelate_region(
    data: &mut [u8],
    width: u32,
    height: u32,
    cx: f64,
    cy: f64,
    brush_radius: f64,
    block_size: u32,
) {
    let w = width as i32;
    let h = height as i32;
    let block = block_size.clamp(2, 128) as i32;
    let br_sq = brush_radius * brush_radius;

    let min_x = ((cx - brush_radius).floor() as i32).max(0);
    let max_x = ((cx + brush_radius).ceil() as i32).min(w - 1);
    let min_y = ((cy - brush_radius).floor() as i32).max(0);
    let max_y = ((cy + brush_radius).ceil() as i32).min(h - 1);
    if min_x > max_x || min_y > max_y {
        return;
    }

    // Walk grid-aligned cells covering the brush bbox.
    let mut by = (min_y / block) * block;
    while by <= max_y {
        let mut bx = (min_x / block) * block;
        while bx <= max_x {
            let cx0 = bx.max(0);
            let cy0 = by.max(0);
            let cx1 = (bx + block - 1).min(w - 1);
            let cy1 = (by + block - 1).min(h - 1);

            // SIMD-accelerated per-cell channel accumulation (bit-identical
            // scalar fallback in simd_color); the average + circle writeback stay
            // here.
            let (sums, n) = crate::simd::color::cell_channel_sums(
                data,
                w as usize,
                cx0 as usize,
                cy0 as usize,
                cx1 as usize,
                cy1 as usize,
            );
            // checked_div folds the `n != 0` guard into the division
            // (clippy::manual_checked_ops); empty cells are skipped.
            if let (Some(r), Some(g), Some(b), Some(a)) = (
                sums[0].checked_div(n),
                sums[1].checked_div(n),
                sums[2].checked_div(n),
                sums[3].checked_div(n),
            ) {
                let avg = [r as u8, g as u8, b as u8, a as u8];
                for yy in cy0..=cy1 {
                    for xx in cx0..=cx1 {
                        let dx = xx as f64 - cx;
                        let dy = yy as f64 - cy;
                        if dx * dx + dy * dy > br_sq {
                            continue;
                        }
                        let i = ((yy * w + xx) * 4) as usize;
                        data[i..i + 4].copy_from_slice(&avg);
                    }
                }
            }
            bx += block;
        }
        by += block;
    }
}

/// Paint an opaque solid colour over a circular brush region (redaction).
pub fn redact_region(
    data: &mut [u8],
    width: u32,
    height: u32,
    cx: f64,
    cy: f64,
    brush_radius: f64,
    r: u8,
    g: u8,
    b: u8,
) {
    let w = width as i32;
    let h = height as i32;
    let br_sq = brush_radius * brush_radius;
    let min_x = ((cx - brush_radius).floor() as i32).max(0);
    let max_x = ((cx + brush_radius).ceil() as i32).min(w - 1);
    let min_y = ((cy - brush_radius).floor() as i32).max(0);
    let max_y = ((cy + brush_radius).ceil() as i32).min(h - 1);
    let fill = [r, g, b, 255];
    for yy in min_y..=max_y {
        for xx in min_x..=max_x {
            let dx = xx as f64 - cx;
            let dy = yy as f64 - cy;
            if dx * dx + dy * dy > br_sq {
                continue;
            }
            let i = ((yy * w + xx) * 4) as usize;
            data[i..i + 4].copy_from_slice(&fill);
        }
    }
}

#[cfg(test)]
mod sharpen_tests {
    use super::*;

    fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&rgba);
        }
        v
    }

    #[test]
    fn sharpen_amount_zero_is_identity() {
        let mut data = solid(4, 4, [10, 20, 30, 255]);
        let before = data.clone();
        sharpen(&mut data, 4, 4, 0.0);
        assert_eq!(data, before);
    }

    #[test]
    fn sharpen_flat_image_is_unchanged() {
        // A uniform-colour image blurs to itself (every kernel tap samples the
        // same value, edge-clamped or not), so `orig - blurred == 0`
        // everywhere and the unsharp-mask combine is a no-op regardless of
        // `amount`.
        let mut data = solid(6, 6, [80, 120, 200, 255]);
        let before = data.clone();
        sharpen(&mut data, 6, 6, 1.5);
        assert_eq!(data, before);
    }

    #[test]
    fn sharpen_empty_buffer_does_not_panic() {
        let mut data: Vec<u8> = Vec::new();
        sharpen(&mut data, 0, 0, 1.0);
        assert!(data.is_empty());
    }
}
