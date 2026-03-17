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
fn build_gaussian_kernel(radius: u32) -> Vec<f64> {
    let r = radius as i32;
    let sigma = (radius as f64).max(1.0) / 2.0;
    let two_sigma_sq = 2.0 * sigma * sigma;
    let mut kernel = Vec::with_capacity((2 * r + 1) as usize);
    let mut sum = 0.0;

    for i in -r..=r {
        let val = (-(i * i) as f64 / two_sigma_sq).exp();
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
) {
    let w = width as i32;
    let h = height as i32;
    let kr = intensity.clamp(1, 30) as i32;
    let kernel = build_gaussian_kernel(intensity.clamp(1, 30));

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

    // Extract the bounding-box region into a temp buffer
    let mut region = vec![0u8; bw * bh * 4];
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
    let mut h_pass = vec![0u8; bw * bh * 4];
    for ry in 0..bh {
        for rx in 0..bw {
            let mut r = 0.0f64;
            let mut g = 0.0f64;
            let mut b = 0.0f64;
            let mut a = 0.0f64;

            for ki in -kr..=kr {
                let sx = (rx as i32 + ki).clamp(0, bw as i32 - 1) as usize;
                let si = (ry * bw + sx) * 4;
                let weight = kernel[(ki + kr) as usize];
                r += region[si]     as f64 * weight;
                g += region[si + 1] as f64 * weight;
                b += region[si + 2] as f64 * weight;
                a += region[si + 3] as f64 * weight;
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
            let mut r = 0.0f64;
            let mut g = 0.0f64;
            let mut b = 0.0f64;
            let mut a = 0.0f64;

            for ki in -kr..=kr {
                let sy = (ry as i32 + ki).clamp(0, bh as i32 - 1) as usize;
                let si = (sy * bw + rx) * 4;
                let weight = kernel[(ki + kr) as usize];
                r += h_pass[si]     as f64 * weight;
                g += h_pass[si + 1] as f64 * weight;
                b += h_pass[si + 2] as f64 * weight;
                a += h_pass[si + 3] as f64 * weight;
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

/// Compress/encode image data to JPEG bytes at a given quality (0.0 - 1.0).
/// Returns the raw JPEG bytes for blob construction on the JS side.
/// Uses a simple approach: convert RGBA to RGB, then encode.
pub fn compress_to_jpeg(
    data: &[u8],
    width: u32,
    height: u32,
    quality: f64,
) -> Vec<u8> {
    // For now, return raw RGBA data sized down.
    // Full JPEG encoding would require pulling in `image` crate.
    // The JS side can use canvas.toBlob for actual format encoding.
    // This function is a placeholder for future pure-WASM JPEG encoding.
    let _ = (data, width, height, quality);
    Vec::new()
}