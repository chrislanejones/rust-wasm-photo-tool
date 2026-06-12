/// Geometric transforms — flip, rotate, copy/paste regions.
///
/// All functions operate on raw RGBA pixel buffers. The `push_snapshot`
/// calls happen in the lib.rs glue layer before calling these.

/// Flip the image horizontally (mirror left↔right) in-place.
/// Swaps a 4-byte RGBA pixel as a single 32-bit unit rather than four
/// independent u8 swaps to cut the bounds-check + writeback overhead.
pub fn flip_horizontal(data: &mut [u8], w: usize, h: usize) {
    for y in 0..h {
        let row_start = y * w * 4;
        let row = &mut data[row_start..row_start + w * 4];
        for x in 0..w / 2 {
            let a = x * 4;
            let b = (w - 1 - x) * 4;
            let tmp: [u8; 4] = row[a..a + 4].try_into().unwrap();
            let other: [u8; 4] = row[b..b + 4].try_into().unwrap();
            row[a..a + 4].copy_from_slice(&other);
            row[b..b + 4].copy_from_slice(&tmp);
        }
    }
}

/// Flip the image vertically (mirror top↔bottom) in-place.
/// Swaps whole rows via two non-overlapping mutable slices and a 4-byte
/// pixel swap; faster than per-channel byte swaps.
pub fn flip_vertical(data: &mut [u8], w: usize, h: usize) {
    let row_bytes = w * 4;
    for y in 0..h / 2 {
        let top = y * row_bytes;
        let bot = (h - 1 - y) * row_bytes;
        // Use split_at_mut to obtain two disjoint mutable slices.
        let (lo, hi) = data.split_at_mut(bot);
        let top_row = &mut lo[top..top + row_bytes];
        let bot_row = &mut hi[..row_bytes];
        for x in 0..w {
            let off = x * 4;
            let tmp: [u8; 4] = top_row[off..off + 4].try_into().unwrap();
            let other: [u8; 4] = bot_row[off..off + 4].try_into().unwrap();
            top_row[off..off + 4].copy_from_slice(&other);
            bot_row[off..off + 4].copy_from_slice(&tmp);
        }
    }
}

/// Rotate 90° clockwise. Returns (new_data, new_width, new_height).
pub fn rotate_90_cw(data: &[u8], old_w: usize, old_h: usize) -> (Vec<u8>, u32, u32) {
    let new_w = old_h;
    let new_h = old_w;
    let mut out = vec![0u8; new_w * new_h * 4];
    for oy in 0..old_h {
        for ox in 0..old_w {
            let si = (oy * old_w + ox) * 4;
            let nx = old_h - 1 - oy;
            let ny = ox;
            let di = (ny * new_w + nx) * 4;
            out[di..di + 4].copy_from_slice(&data[si..si + 4]);
        }
    }
    (out, new_w as u32, new_h as u32)
}

/// Rotate 90° counter-clockwise. Returns (new_data, new_width, new_height).
pub fn rotate_90_ccw(data: &[u8], old_w: usize, old_h: usize) -> (Vec<u8>, u32, u32) {
    let new_w = old_h;
    let new_h = old_w;
    let mut out = vec![0u8; new_w * new_h * 4];
    for oy in 0..old_h {
        for ox in 0..old_w {
            let si = (oy * old_w + ox) * 4;
            let nx = oy;
            let ny = old_w - 1 - ox;
            let di = (ny * new_w + nx) * 4;
            out[di..di + 4].copy_from_slice(&data[si..si + 4]);
        }
    }
    (out, new_w as u32, new_h as u32)
}

/// Crop the image to a rectangle. Returns (new_data, crop_w, crop_h).
/// Clamps to image bounds.
pub fn crop(data: &[u8], img_w: u32, img_h: u32, x: u32, y: u32, w: u32, h: u32) -> (Vec<u8>, u32, u32) {
    if img_w == 0 || img_h == 0 {
        return (Vec::new(), 0, 0);
    }
    let x = x.min(img_w - 1);
    let y = y.min(img_h - 1);
    let w = w.min(img_w - x).max(1);
    let h = h.min(img_h - y).max(1);
    let mut out = vec![0u8; (w * h * 4) as usize];
    for ry in 0..h {
        let src_row = ((y + ry) * img_w + x) as usize * 4;
        let dst_row = (ry * w) as usize * 4;
        let row_bytes = w as usize * 4;
        out[dst_row..dst_row + row_bytes]
            .copy_from_slice(&data[src_row..src_row + row_bytes]);
    }
    (out, w, h)
}

/// Copy a rectangular region out of the image. Pixels outside bounds are 0.
pub fn copy_region(data: &[u8], img_w: i32, img_h: i32, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
    let mut out = vec![0u8; (w * h * 4) as usize];
    for ry in 0..h as i32 {
        for rx in 0..w as i32 {
            let sx = x + rx;
            let sy = y + ry;
            let di = ((ry * w as i32 + rx) * 4) as usize;
            if sx >= 0 && sx < img_w && sy >= 0 && sy < img_h {
                let si = ((sy * img_w + sx) * 4) as usize;
                out[di..di + 4].copy_from_slice(&data[si..si + 4]);
            }
        }
    }
    out
}

/// Alpha-composite `pixels` (src_w × src_h RGBA) onto `data` at (dest_x, dest_y).
pub fn paste_region(
    data: &mut [u8],
    img_w: i32,
    img_h: i32,
    pixels: &[u8],
    src_w: u32,
    src_h: u32,
    dest_x: i32,
    dest_y: i32,
) {
    if pixels.len() != (src_w * src_h * 4) as usize {
        return;
    }
    for sy in 0..src_h as i32 {
        for sx in 0..src_w as i32 {
            let dx = dest_x + sx;
            let dy = dest_y + sy;
            if dx < 0 || dx >= img_w || dy < 0 || dy >= img_h {
                continue;
            }
            let si = ((sy * src_w as i32 + sx) * 4) as usize;
            let di = ((dy * img_w + dx) * 4) as usize;
            // Opaque-source fast path: skip per-channel blending when src
            // alpha is 255 — a memcpy of the four bytes is enough.
            let src_alpha = pixels[si + 3];
            if src_alpha == 255 {
                data[di..di + 4].copy_from_slice(&pixels[si..si + 4]);
                continue;
            }
            let sa = src_alpha as f32 / 255.0;
            let da = data[di + 3] as f32 / 255.0;
            let out_a = sa + da * (1.0 - sa);
            if out_a > 1e-6 {
                for c in 0..3 {
                    let sv = pixels[si + c] as f32 / 255.0;
                    let dv = data[di + c] as f32 / 255.0;
                    let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
                    data[di + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                }
            }
            data[di + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }
}

/// Resize the image using bilinear interpolation.
/// Returns (new_data, new_w, new_h). Minimum dimension is 1×1.
pub fn resize_bilinear(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    let nw = new_w.max(1);
    let nh = new_h.max(1);
    let mut out = vec![0u8; (nw * nh * 4) as usize];
    let sx = old_w as f32 / nw as f32;
    let sy = old_h as f32 / nh as f32;

    for ty in 0..nh {
        for tx in 0..nw {
            let fx = (tx as f32 + 0.5) * sx - 0.5;
            let fy = (ty as f32 + 0.5) * sy - 0.5;

            let x0 = fx.floor() as i32;
            let y0 = fy.floor() as i32;
            let frac_x = fx - fx.floor();
            let frac_y = fy - fy.floor();

            let sample = |xi: i32, yi: i32| -> [f32; 4] {
                let xi = xi.clamp(0, old_w as i32 - 1) as usize;
                let yi = yi.clamp(0, old_h as i32 - 1) as usize;
                let idx = (yi * old_w as usize + xi) * 4;
                [
                    data[idx] as f32,
                    data[idx + 1] as f32,
                    data[idx + 2] as f32,
                    data[idx + 3] as f32,
                ]
            };

            let p00 = sample(x0, y0);
            let p10 = sample(x0 + 1, y0);
            let p01 = sample(x0, y0 + 1);
            let p11 = sample(x0 + 1, y0 + 1);

            let di = ((ty * nw + tx) * 4) as usize;
            for c in 0..4 {
                let top = p00[c] + (p10[c] - p00[c]) * frac_x;
                let bot = p01[c] + (p11[c] - p01[c]) * frac_x;
                let val = top + (bot - top) * frac_y;
                out[di + c] = val.round().clamp(0.0, 255.0) as u8;
            }
        }
    }
    out
}

// ── Resampling filters (Squoosh-style separable two-pass) ──────────────────
//
// Each filtered resize precomputes, once per axis, the source-window start
// index and normalized kernel weights for every output pixel (they repeat
// across rows/columns), then runs a horizontal pass into an f32 intermediate
// buffer (old_h × new_w) followed by a vertical pass into the output. When
// minifying, the kernel is stretched by the scale ratio so every covered
// source pixel contributes (this is what Squoosh's Rust resizer does, and it
// avoids aliasing on downscale). All accumulation is f32; the final write
// clamps to [0, 255], which is enough to contain Lanczos ringing at edges.

#[inline]
fn sinc(x: f32) -> f32 {
    if x == 0.0 {
        1.0
    } else {
        let p = std::f32::consts::PI * x;
        p.sin() / p
    }
}

/// Lanczos windowed sinc, a = 3. Zero outside |x| < 3.
#[inline]
fn lanczos3_kernel(x: f32) -> f32 {
    let x = x.abs();
    if x < 3.0 {
        sinc(x) * sinc(x / 3.0)
    } else {
        0.0
    }
}

/// Catmull-Rom cubic (B = 0, C = 0.5). Standard piecewise form:
///   |x| <= 1:  1.5|x|³ − 2.5|x|² + 1
///   1 < |x| < 2: −0.5|x|³ + 2.5|x|² − 4|x| + 2
#[inline]
fn catmull_rom_kernel(x: f32) -> f32 {
    let x = x.abs();
    if x < 1.0 {
        (1.5 * x - 2.5) * x * x + 1.0
    } else if x < 2.0 {
        ((-0.5 * x + 2.5) * x - 4.0) * x + 2.0
    } else {
        0.0
    }
}

/// Per-output-pixel source window for one axis: (start index, normalized
/// weights). `support` is the kernel half-width in source pixels at 1:1
/// (2 for Catmull-Rom, 3 for Lanczos3); it is scaled up when minifying.
fn precompute_weights(
    old_size: u32,
    new_size: u32,
    support: f32,
    kernel: impl Fn(f32) -> f32,
) -> Vec<(usize, Vec<f32>)> {
    let ratio = old_size as f32 / new_size as f32;
    let filter_scale = ratio.max(1.0);
    let scaled_support = support * filter_scale;

    let mut windows = Vec::with_capacity(new_size as usize);
    for i in 0..new_size {
        let center = (i as f32 + 0.5) * ratio - 0.5;
        let start = ((center - scaled_support).floor() as i64).max(0) as usize;
        let end =
            ((center + scaled_support).ceil() as i64).min(old_size as i64 - 1).max(0) as usize;
        let mut weights = Vec::with_capacity(end - start + 1);
        let mut sum = 0.0f32;
        for j in start..=end {
            let w = kernel((j as f32 - center) / filter_scale);
            weights.push(w);
            sum += w;
        }
        if sum != 0.0 {
            for w in &mut weights {
                *w /= sum;
            }
        }
        windows.push((start, weights));
    }
    windows
}

/// Shared separable two-pass resize used by Catmull-Rom and Lanczos3.
fn resize_separable(
    data: &[u8],
    old_w: u32,
    old_h: u32,
    new_w: u32,
    new_h: u32,
    support: f32,
    kernel: impl Fn(f32) -> f32 + Copy,
) -> Vec<u8> {
    let nw = new_w.max(1) as usize;
    let nh = new_h.max(1) as usize;
    let ow = old_w as usize;
    let oh = old_h as usize;

    // ── Horizontal pass: (old_h × new_w), kept in f32 to avoid double rounding.
    let h_windows = precompute_weights(old_w, nw as u32, support, kernel);
    let mut mid = vec![0f32; oh * nw * 4];
    for y in 0..oh {
        let row = &data[y * ow * 4..(y + 1) * ow * 4];
        let out_row = &mut mid[y * nw * 4..(y + 1) * nw * 4];
        for (tx, (start, weights)) in h_windows.iter().enumerate() {
            let mut acc = [0f32; 4];
            for (k, &w) in weights.iter().enumerate() {
                let si = (start + k) * 4;
                acc[0] += row[si] as f32 * w;
                acc[1] += row[si + 1] as f32 * w;
                acc[2] += row[si + 2] as f32 * w;
                acc[3] += row[si + 3] as f32 * w;
            }
            out_row[tx * 4..tx * 4 + 4].copy_from_slice(&acc);
        }
    }

    // ── Vertical pass: (new_h × new_w) → u8 with a [0, 255] clamp.
    let v_windows = precompute_weights(old_h, nh as u32, support, kernel);
    let mut out = vec![0u8; nh * nw * 4];
    for (ty, (start, weights)) in v_windows.iter().enumerate() {
        for tx in 0..nw {
            let mut acc = [0f32; 4];
            for (k, &w) in weights.iter().enumerate() {
                let si = ((start + k) * nw + tx) * 4;
                acc[0] += mid[si] * w;
                acc[1] += mid[si + 1] * w;
                acc[2] += mid[si + 2] * w;
                acc[3] += mid[si + 3] * w;
            }
            let di = (ty * nw + tx) * 4;
            for c in 0..4 {
                out[di + c] = acc[c].round().clamp(0.0, 255.0) as u8;
            }
        }
    }
    out
}

/// Resize using nearest-neighbor sampling. Returns the new RGBA buffer.
/// Minimum dimension is 1×1.
pub fn resize_nearest(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    let nw = new_w.max(1) as usize;
    let nh = new_h.max(1) as usize;
    let ow = old_w as usize;
    let mut out = vec![0u8; nw * nh * 4];
    let sx = old_w as f32 / nw as f32;
    let sy = old_h as f32 / nh as f32;
    for ty in 0..nh {
        let syi = ((((ty as f32 + 0.5) * sy) as i64).max(0) as usize).min(old_h as usize - 1);
        let src_row = syi * ow * 4;
        let dst_row = ty * nw * 4;
        for tx in 0..nw {
            let sxi = ((((tx as f32 + 0.5) * sx) as i64).max(0) as usize).min(ow - 1);
            let si = src_row + sxi * 4;
            let di = dst_row + tx * 4;
            out[di..di + 4].copy_from_slice(&data[si..si + 4]);
        }
    }
    out
}

/// Resize with the Catmull-Rom cubic kernel (B=0, C=0.5). 4-tap per axis at
/// 1:1; the window widens proportionally when minifying. Separable two-pass.
pub fn resize_catmull_rom(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    resize_separable(data, old_w, old_h, new_w, new_h, 2.0, catmull_rom_kernel)
}

/// Resize with the Lanczos3 windowed-sinc kernel (a=3). 6-tap per axis at
/// 1:1; the window widens proportionally when minifying. Separable two-pass.
pub fn resize_lanczos3(data: &[u8], old_w: u32, old_h: u32, new_w: u32, new_h: u32) -> Vec<u8> {
    resize_separable(data, old_w, old_h, new_w, new_h, 3.0, lanczos3_kernel)
}

/// Apply a crop preview overlay: darkens all pixels OUTSIDE the given rectangle.
/// `opacity` controls how dark the overlay is (0.0 = invisible, 1.0 = fully black).
/// Call this on a copy of the buffer (or undo after) — it modifies pixels in place.
pub fn apply_crop_overlay(
    data: &mut [u8],
    img_w: u32,
    img_h: u32,
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
    opacity: f64,
) {
    let alpha = opacity.clamp(0.0, 1.0);
    let inv = 1.0 - alpha;
 
    let cx_end = (crop_x + crop_w).min(img_w);
    let cy_end = (crop_y + crop_h).min(img_h);
 
    for y in 0..img_h {
        for x in 0..img_w {
            // Skip pixels inside the crop rectangle
            if x >= crop_x && x < cx_end && y >= crop_y && y < cy_end {
                continue;
            }
            let idx = ((y * img_w + x) * 4) as usize;
            if idx + 2 < data.len() {
                // Darken RGB channels, preserve alpha
                data[idx]     = (data[idx]     as f64 * inv).round() as u8;
                data[idx + 1] = (data[idx + 1] as f64 * inv).round() as u8;
                data[idx + 2] = (data[idx + 2] as f64 * inv).round() as u8;
            }
        }
    }
}

/// Draw a dashed rectangle border for the crop selection.
/// `dash_len` and `gap_len` control the dash pattern.
pub fn draw_crop_border(
    data: &mut [u8],
    img_w: u32,
    img_h: u32,
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
    color: [u8; 4],
    dash_len: u32,
    gap_len: u32,
) {
    let cx_end = (crop_x + crop_w).min(img_w);
    let cy_end = (crop_y + crop_h).min(img_h);
    let pattern = dash_len + gap_len;
 
    // Helper: set pixel if in bounds and on a dash
    let set_pixel = |data: &mut [u8], x: u32, y: u32, pos: u32| {
        if x >= img_w || y >= img_h { return; }
        if pos % pattern >= dash_len { return; } // in gap
        let idx = ((y * img_w + x) * 4) as usize;
        if idx + 3 < data.len() {
            data[idx]     = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    };
 
    // Top edge
    for x in crop_x..cx_end {
        set_pixel(data, x, crop_y, x - crop_x);
    }
    // Bottom edge
    for x in crop_x..cx_end {
        set_pixel(data, x, cy_end.saturating_sub(1), x - crop_x);
    }
    // Left edge
    for y in crop_y..cy_end {
        set_pixel(data, crop_x, y, y - crop_y);
    }
    // Right edge
    for y in crop_y..cy_end {
        set_pixel(data, cx_end.saturating_sub(1), y, y - crop_y);
    }
}
