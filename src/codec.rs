/// Codec — encode/decode, thumbnail generation.
///
/// PNG encoding uses the `png` crate. JPEG/WebP/AVIF encoding is handled
/// on the JS side via `canvas.toBlob()` — no need to ship those encoders
/// in the WASM binary.

use crate::core::ImageBuffer;

/// Encode the image buffer as PNG bytes.
pub fn export_png(buf: &ImageBuffer) -> Vec<u8> {
    let mut output = Vec::new();
    let mut encoder = png::Encoder::new(&mut output, buf.width, buf.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    if let Ok(mut writer) = encoder.write_header() {
        let _ = writer.write_image_data(&buf.data);
    }
    output
}

/// Compute thumbnail dimensions that fit within `max_px` on the longest side.
pub fn thumb_dims(w: u32, h: u32, max_px: u32) -> (u32, u32) {
    if w == 0 || h == 0 || max_px == 0 {
        return (1, 1);
    }
    let longest = w.max(h);
    if longest <= max_px {
        return (w, h);
    }
    let scale = max_px as f64 / longest as f64;
    let tw = ((w as f64 * scale).round() as u32).max(1);
    let th = ((h as f64 * scale).round() as u32).max(1);
    (tw, th)
}

/// Generate a bilinearly-scaled thumbnail.
pub fn thumbnail_data(buf: &ImageBuffer, max_px: u32) -> (Vec<u8>, u32, u32) {
    let (tw, th) = thumb_dims(buf.width, buf.height, max_px);
    let mut out = vec![0u8; (tw * th * 4) as usize];
    let sx = buf.width as f64 / tw as f64;
    let sy = buf.height as f64 / th as f64;
    for ty in 0..th {
        for tx in 0..tw {
            let fx = (tx as f64 + 0.5) * sx - 0.5;
            let fy = (ty as f64 + 0.5) * sy - 0.5;
            let [r, g, b, a] = buf.sample_bilinear(fx, fy);
            let di = ((ty * tw + tx) * 4) as usize;
            out[di]     = r;
            out[di + 1] = g;
            out[di + 2] = b;
            out[di + 3] = a;
        }
    }
    (out, tw, th)
}
