/// Codec — encode/decode, thumbnail generation.
///
/// PNG encoding uses the `png` crate. JPEG/WebP/AVIF encoding is handled
/// on the JS side via `canvas.toBlob()` — no need to ship those encoders
/// in the WASM binary.
use crate::core::ImageBuffer;

/// Encode the image buffer as PNG bytes, in the smallest of three lossless
/// layouts the pixels allow (10-27-2026):
///
/// - **Indexed** when the image uses 256 RGBA colors or fewer — logos, icons,
///   line art. One byte per pixel plus a palette and a `tRNS` alpha table.
/// - **RGB** when every pixel is opaque — photos. The alpha channel was a
///   constant 255 on every pixel, a quarter of the raw data.
/// - **RGBA** otherwise.
///
/// Always writing RGBA made a 900×900, 66-color logo come out of a crop to
/// 728×606 BIGGER than the upload (28,477 → 28,683 B): the upload was already
/// RGBA, so cutting 46% of the pixels could not pay for nothing else being
/// saved. The same export as an indexed PNG is 14,182 B. All three layouts
/// decode to the identical RGBA (`decode_png` normalizes them), so the choice
/// is invisible to every reader.
pub fn export_png(buf: &ImageBuffer) -> Vec<u8> {
    let pixels = buf.data.chunks_exact(4);
    if let Some(palette) = small_palette(&buf.data) {
        let indices: Vec<u8> = pixels
            .map(|p| {
                let c = u32::from_be_bytes([p[0], p[1], p[2], p[3]]);
                // Every color was collected from these same pixels, so the
                // search cannot miss; 0 keeps a non-panicking fallback.
                palette.binary_search(&c).map_or(0, |i| i as u8)
            })
            .collect();
        let mut plte = Vec::with_capacity(palette.len() * 3);
        let mut trns = Vec::with_capacity(palette.len());
        for c in &palette {
            let [r, g, b, a] = c.to_be_bytes();
            plte.extend_from_slice(&[r, g, b]);
            trns.push(a);
        }
        // tRNS may stop at the last non-opaque entry; the rest read as 255.
        while trns.last() == Some(&255) {
            trns.pop();
        }
        return encode(buf, png::ColorType::Indexed, &indices, |e| {
            // Row filters predict a byte from its neighbor, which means nothing
            // for palette indices. Measured on the 728×606 logo: Adaptive
            // 17,225 B, NoFilter 14,182 B. `Compression::High` was WORSE
            // (16,929 B) whatever filter was asked for, so it stays Balanced.
            e.set_filter(png::Filter::NoFilter);
            e.set_palette(plte);
            if !trns.is_empty() {
                e.set_trns(trns);
            }
        });
    }
    if buf.data.chunks_exact(4).all(|p| p[3] == 255) {
        let rgb: Vec<u8> = pixels.flat_map(|p| [p[0], p[1], p[2]]).collect();
        return encode(buf, png::ColorType::Rgb, &rgb, |_| {});
    }
    encode(buf, png::ColorType::Rgba, &buf.data, |_| {})
}

/// The image's distinct RGBA colors, sorted, when there are 256 or fewer;
/// `None` the moment a 257th appears (a photo finds it within a few pixels).
/// A sorted `Vec`, not a `HashMap`, for the binary-size reason in `fonts.rs`.
pub(crate) fn small_palette(data: &[u8]) -> Option<Vec<u32>> {
    let mut colors: Vec<u32> = Vec::new();
    let mut last = None;
    for p in data.chunks_exact(4) {
        let c = u32::from_be_bytes([p[0], p[1], p[2], p[3]]);
        // Runs of one color are the common case in flat art; skip the search.
        if last == Some(c) {
            continue;
        }
        last = Some(c);
        if let Err(i) = colors.binary_search(&c) {
            if colors.len() == 256 {
                return None;
            }
            colors.insert(i, c);
        }
    }
    Some(colors)
}

fn encode(
    buf: &ImageBuffer,
    color: png::ColorType,
    data: &[u8],
    configure: impl FnOnce(&mut png::Encoder<&mut Vec<u8>>),
) -> Vec<u8> {
    let mut output = Vec::new();
    let mut encoder = png::Encoder::new(&mut output, buf.width, buf.height);
    encoder.set_color(color);
    encoder.set_depth(png::BitDepth::Eight);
    configure(&mut encoder);
    if let Ok(mut writer) = encoder.write_header() {
        let _ = writer.write_image_data(data);
    }
    output
}

/// Encode as PNG with the `Fast` deflate (fdeflate) instead of the default
/// `Balanced`. For the autosave path only: `capture_state` encodes the canvas,
/// every layer and every new undo snapshot after each edit, and at `Balanced` that
/// held the engine worker for 1–4 s per save on a 2048 px document (measured
/// 10-14-2026). Still a standard PNG that every decoder reads; the files are
/// somewhat larger. User-facing exports keep [`export_png`].
pub fn export_png_fast(buf: &ImageBuffer) -> Vec<u8> {
    let mut output = Vec::new();
    let mut encoder = png::Encoder::new(&mut output, buf.width, buf.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.set_compression(png::Compression::Fast);
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
    // png 0.18 reads through `BufRead + Seek`; a Cursor over the slice is both.
    let mut decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    // EXPAND resolves palette/tRNS/sub-8-bit-grayscale up to plain 8-bit
    // channels; STRIP_16 folds 16-bit samples down to 8. After this, the only
    // color types `next_frame` can report are Grayscale, GrayscaleAlpha, Rgb,
    // Rgba — never Indexed.
    decoder.set_transformations(png::Transformations::normalize_to_color8());
    let mut reader = decoder.read_info()?;
    // None when width × height × channels would overflow usize: refuse it as
    // a decode error instead of panicking on an impossible allocation.
    let size = reader
        .output_buffer_size()
        .ok_or(png::DecodingError::LimitsExceeded)?;
    let mut buf = vec![0u8; size];
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
        let (decoded, w, h) = decode_png(&encoded).expect("valid PNG decodes"); // allow: rust-panic
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
            let mut writer = encoder.write_header().unwrap(); // allow: rust-panic
            writer.write_image_data(&[10, 20, 30]).unwrap(); // allow: rust-panic
        }
        let (decoded, w, h) = decode_png(&output).expect("valid PNG decodes"); // allow: rust-panic
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
            let mut writer = encoder.write_header().unwrap(); // allow: rust-panic
            writer.write_image_data(&[200, 64]).unwrap(); // allow: rust-panic
        }
        let (decoded, _, _) = decode_png(&output).expect("valid PNG decodes"); // allow: rust-panic
        assert_eq!(decoded, vec![200, 200, 200, 64]);
    }

    #[test]
    fn corrupt_bytes_return_err_not_panic() {
        let garbage = [0u8, 1, 2, 3, 4, 5, 6, 7];
        assert!(decode_png(&garbage).is_err());
    }

    /// `n` pixels, each its own color, every alpha `a`.
    fn distinct(n: u32, a: u8) -> ImageBuffer {
        let data = (0..n)
            .flat_map(|i| [(i % 251) as u8, (i / 251) as u8, 7, a])
            .collect();
        ImageBuffer {
            width: n,
            height: 1,
            data,
        }
    }

    fn color_type(png_bytes: &[u8]) -> png::ColorType {
        png::Decoder::new(std::io::Cursor::new(png_bytes))
            .read_info()
            .expect("valid PNG") // allow: rust-panic
            .info()
            .color_type
    }

    fn assert_lossless(buf: &ImageBuffer, want: png::ColorType) {
        let encoded = export_png(buf);
        assert_eq!(color_type(&encoded), want);
        let (decoded, w, h) = decode_png(&encoded).expect("valid PNG"); // allow: rust-panic
        assert_eq!((w, h), (buf.width, buf.height));
        assert_eq!(decoded, buf.data, "{want:?} must round-trip byte-identical");
    }

    #[test]
    fn few_colors_write_indexed_with_alpha() {
        assert_lossless(&distinct(256, 128), png::ColorType::Indexed);
    }

    #[test]
    fn opaque_many_colors_write_rgb() {
        assert_lossless(&distinct(257, 255), png::ColorType::Rgb);
    }

    #[test]
    fn translucent_many_colors_stay_rgba() {
        assert_lossless(&distinct(257, 128), png::ColorType::Rgba);
    }

    #[test]
    fn transparent_pixels_keep_their_hidden_rgb() {
        // Fully transparent pixels with different RGB are different colors:
        // folding them would change what an un-premultiplied reader sees.
        let buf = ImageBuffer {
            width: 3,
            height: 1,
            data: vec![10, 20, 30, 0, 0, 0, 0, 0, 255, 255, 255, 255],
        };
        assert_lossless(&buf, png::ColorType::Indexed);
    }

    #[test]
    fn flat_art_is_smaller_than_rgba() {
        // 64×64 of four flat quadrants: the logo case.
        let data = (0..64 * 64)
            .flat_map(|i| {
                let (x, y) = (i % 64, i / 64);
                match (x < 32, y < 32) {
                    (true, true) => [200, 30, 40, 255],
                    (false, true) => [0, 0, 0, 0],
                    (true, false) => [90, 90, 90, 255],
                    (false, false) => [255, 255, 255, 128],
                }
            })
            .collect();
        let buf = ImageBuffer {
            width: 64,
            height: 64,
            data,
        };
        let old = encode(&buf, png::ColorType::Rgba, &buf.data, |_| {});
        assert!(export_png(&buf).len() < old.len());
    }
}
