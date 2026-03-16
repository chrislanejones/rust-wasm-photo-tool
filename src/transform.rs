/// Geometric transforms — flip, rotate, copy/paste regions.
///
/// All functions operate on raw RGBA pixel buffers. The `push_snapshot`
/// calls happen in the lib.rs glue layer before calling these.

/// Flip the image horizontally (mirror left↔right) in-place.
pub fn flip_horizontal(data: &mut [u8], w: usize, h: usize) {
    for y in 0..h {
        for x in 0..w / 2 {
            let a = (y * w + x) * 4;
            let b = (y * w + (w - 1 - x)) * 4;
            for c in 0..4 {
                data.swap(a + c, b + c);
            }
        }
    }
}

/// Flip the image vertically (mirror top↔bottom) in-place.
pub fn flip_vertical(data: &mut [u8], w: usize, h: usize) {
    for y in 0..h / 2 {
        for x in 0..w {
            let a = (y * w + x) * 4;
            let b = ((h - 1 - y) * w + x) * 4;
            for c in 0..4 {
                data.swap(a + c, b + c);
            }
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
    let x = x.min(img_w);
    let y = y.min(img_h);
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
            let sa = pixels[si + 3] as f64 / 255.0;
            let da = data[di + 3] as f64 / 255.0;
            let out_a = sa + da * (1.0 - sa);
            if out_a > 1e-6 {
                for c in 0..3 {
                    let sv = pixels[si + c] as f64 / 255.0;
                    let dv = data[di + c] as f64 / 255.0;
                    let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
                    data[di + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                }
            }
            data[di + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }
}