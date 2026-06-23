// src/filters.rs

pub fn adjust_brightness(data: &mut [u8], delta: f64) {
    let d = (delta.clamp(-1.0, 1.0) * 255.0).round() as i32;
    for i in (0..data.len()).step_by(4) {
        data[i]     = (data[i]     as i32 + d).clamp(0, 255) as u8;
        data[i + 1] = (data[i + 1] as i32 + d).clamp(0, 255) as u8;
        data[i + 2] = (data[i + 2] as i32 + d).clamp(0, 255) as u8;
    }
}

pub fn adjust_contrast(data: &mut [u8], factor: f64) {
    let f = factor.clamp(0.0, 4.0);
    for i in (0..data.len()).step_by(4) {
        for c in 0..3 {
            let v = data[i + c] as f64 / 255.0;
            let adj = ((v - 0.5) * f + 0.5).clamp(0.0, 1.0);
            data[i + c] = (adj * 255.0).round() as u8;
        }
    }
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
    let max_x = ((cx + brush_radius).ceil()  as i32).min(w - 1);
    let min_y = ((cy - brush_radius).floor() as i32).max(0);
    let max_y = ((cy + brush_radius).ceil()  as i32).min(h - 1);

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

    // Pass 1: Horizontal blur into a temp buffer
    let h_pass = &mut scratch_b[..needed];
    for ry in 0..bh {
        for rx in 0..bw {
            let mut r = 0.0f32;
            let mut g = 0.0f32;
            let mut b = 0.0f32;
            let mut a = 0.0f32;

            for ki in -kr..=kr {
                let sx = (rx as i32 + ki).clamp(0, bw as i32 - 1) as usize;
                let si = (ry * bw + sx) * 4;
                let weight = kernel[(ki + kr) as usize];
                r += region[si]     as f32 * weight;
                g += region[si + 1] as f32 * weight;
                b += region[si + 2] as f32 * weight;
                a += region[si + 3] as f32 * weight;
            }

            let di = (ry * bw + rx) * 4;
            h_pass[di]     = r.round().clamp(0.0, 255.0) as u8;
            h_pass[di + 1] = g.round().clamp(0.0, 255.0) as u8;
            h_pass[di + 2] = b.round().clamp(0.0, 255.0) as u8;
            h_pass[di + 3] = a.round().clamp(0.0, 255.0) as u8;
        }
    }

    // Pass 2: Vertical blur from h_pass into region
    for ry in 0..bh {
        for rx in 0..bw {
            let mut r = 0.0f32;
            let mut g = 0.0f32;
            let mut b = 0.0f32;
            let mut a = 0.0f32;

            for ki in -kr..=kr {
                let sy = (ry as i32 + ki).clamp(0, bh as i32 - 1) as usize;
                let si = (sy * bw + rx) * 4;
                let weight = kernel[(ki + kr) as usize];
                r += h_pass[si]     as f32 * weight;
                g += h_pass[si + 1] as f32 * weight;
                b += h_pass[si + 2] as f32 * weight;
                a += h_pass[si + 3] as f32 * weight;
            }

            let di = (ry * bw + rx) * 4;
            region[di]     = r.round().clamp(0.0, 255.0) as u8;
            region[di + 1] = g.round().clamp(0.0, 255.0) as u8;
            region[di + 2] = b.round().clamp(0.0, 255.0) as u8;
            region[di + 3] = a.round().clamp(0.0, 255.0) as u8;
        }
    }

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

            let (mut sr, mut sg, mut sb, mut sa, mut n) = (0u64, 0u64, 0u64, 0u64, 0u64);
            for yy in cy0..=cy1 {
                for xx in cx0..=cx1 {
                    let i = ((yy * w + xx) * 4) as usize;
                    sr += data[i] as u64;
                    sg += data[i + 1] as u64;
                    sb += data[i + 2] as u64;
                    sa += data[i + 3] as u64;
                    n += 1;
                }
            }
            if n > 0 {
                let avg = [(sr / n) as u8, (sg / n) as u8, (sb / n) as u8, (sa / n) as u8];
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

