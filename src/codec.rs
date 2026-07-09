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

/// Decode PNG bytes to straight (non-premultiplied) RGBA8 pixels, normalizing
/// whatever color type the source PNG actually uses (RGB, RGBA, indexed,
/// grayscale, grayscale+alpha, 16-bit…) — the inverse of `export_png`, which
/// always writes 8-bit RGBA. `png` never stores premultiplied alpha (the
/// spec forbids it), so straight alpha falls out of the decode for free; the
/// only work here is expanding every other color type up to 4 channels.
/// Returns `(pixels, width, height)`.
pub fn decode_png(bytes: &[u8]) -> Result<(Vec<u8>, u32, u32), png::DecodingError> {
    let mut decoder = png::Decoder::new(bytes);
    // EXPAND resolves palette/tRNS/sub-8-bit-grayscale up to plain 8-bit
    // channels; STRIP_16 folds 16-bit samples down to 8. After this, the only
    // color types `next_frame` can report are Grayscale, GrayscaleAlpha, Rgb,
    // Rgba — never Indexed.
    decoder.set_transformations(png::Transformations::normalize_to_color8());
    let mut reader = decoder.read_info()?;
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf)?;
    buf.truncate(info.buffer_size());
    let rgba = to_straight_rgba8(&buf, info.width, info.height, info.color_type);
    Ok((rgba, info.width, info.height))
}

/// Expand a decoded (post-`normalize_to_color8`) pixel buffer of any color
/// type to straight RGBA8. `color_type` is always one of Grayscale /
/// GrayscaleAlpha / Rgb / Rgba here — see `decode_png`.
fn to_straight_rgba8(src: &[u8], w: u32, h: u32, color_type: png::ColorType) -> Vec<u8> {
    let n = (w as usize) * (h as usize);
    let mut out = vec![0u8; n * 4];
    match color_type {
        png::ColorType::Rgba => {
            let take = (n * 4).min(src.len());
            out[..take].copy_from_slice(&src[..take]);
        }
        png::ColorType::Rgb => {
            for i in 0..n.min(src.len() / 3) {
                out[i * 4] = src[i * 3];
                out[i * 4 + 1] = src[i * 3 + 1];
                out[i * 4 + 2] = src[i * 3 + 2];
                out[i * 4 + 3] = 255;
            }
        }
        png::ColorType::GrayscaleAlpha => {
            for i in 0..n.min(src.len() / 2) {
                let g = src[i * 2];
                out[i * 4] = g;
                out[i * 4 + 1] = g;
                out[i * 4 + 2] = g;
                out[i * 4 + 3] = src[i * 2 + 1];
            }
        }
        png::ColorType::Grayscale => {
            for i in 0..n.min(src.len()) {
                let g = src[i];
                out[i * 4] = g;
                out[i * 4 + 1] = g;
                out[i * 4 + 2] = g;
                out[i * 4 + 3] = 255;
            }
        }
        png::ColorType::Indexed => {
            // `normalize_to_color8` (EXPAND) always resolves indexed images
            // to Rgb/Rgba before `next_frame` returns — this arm only exists
            // to keep the match exhaustive, and never actually runs.
        }
    }
    out
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
            out[di] = r;
            out[di + 1] = g;
            out[di + 2] = b;
            out[di + 3] = a;
        }
    }
    (out, tw, th)
}

#[cfg(test)]
mod decode_tests {
    use super::*;

    #[test]
    fn round_trips_rgba_with_semi_transparent_pixels_byte_identical() {
        // Opaque red, fully transparent (but non-zero RGB, to catch any
        // accidental premultiply-on-decode), and a semi-transparent blue —
        // exactly the case a premultiplied/straight-alpha mismatch would flip.
        let pixels: Vec<u8> = vec![
            255, 0, 0, 255, // opaque red
            10, 20, 30, 0, // fully transparent, non-zero RGB
            0, 0, 255, 128, // semi-transparent blue
            0, 255, 0, 255, // opaque green
        ];
        let buf = ImageBuffer {
            width: 2,
            height: 2,
            data: pixels.clone(),
        };
        let encoded = export_png(&buf);
        let (decoded, w, h) = decode_png(&encoded).expect("valid PNG decodes");
        assert_eq!((w, h), (2, 2));
        assert_eq!(decoded, pixels, "RGBA round-trip must be byte-identical");
    }

    #[test]
    fn round_trips_rgb_without_alpha_as_opaque() {
        let mut output = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut output, 1, 1);
            encoder.set_color(png::ColorType::Rgb);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(&[10, 20, 30]).unwrap();
        }
        let (decoded, w, h) = decode_png(&output).expect("valid PNG decodes");
        assert_eq!((w, h), (1, 1));
        assert_eq!(decoded, vec![10, 20, 30, 255]);
    }

    #[test]
    fn round_trips_grayscale_alpha() {
        let mut output = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut output, 1, 1);
            encoder.set_color(png::ColorType::GrayscaleAlpha);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(&[200, 64]).unwrap();
        }
        let (decoded, _, _) = decode_png(&output).expect("valid PNG decodes");
        assert_eq!(decoded, vec![200, 200, 200, 64]);
    }

    #[test]
    fn corrupt_bytes_return_err_not_panic() {
        let garbage = [0u8, 1, 2, 3, 4, 5, 6, 7];
        assert!(decode_png(&garbage).is_err());
    }
}
