/// Pure-Rust text rendering using Liberation Sans (Arial-metric compatible).
///
/// Replaces the JS OffscreenCanvas pipeline for both the text tool and red
/// stamp presets. The browser is no longer involved in font rasterisation —
/// everything runs inside the WASM binary.
///
/// Two public entry points:
///   render_text       — plain multi-line text (text tool)
///   render_stamp_label — bordered, slightly-rotated stamp label (red stamps)

use ab_glyph::{Font, FontRef, PxScale, ScaleFont};

// Embedded fonts — compiled into the WASM binary.
static FONT_REGULAR: &[u8] = include_bytes!("fonts/LiberationSans-Regular.ttf");
static FONT_BOLD: &[u8] = include_bytes!("fonts/LiberationSans-Bold.ttf");

pub struct RenderedText {
    pub pixels: Vec<u8>, // RGBA, row-major
    pub width: u32,
    pub height: u32,
}

// ── Helpers ────────────────────────────────────────────────────────────────

/// Lay out one line of text and return its advance width in pixels.
fn line_width(line: &str, font: &ab_glyph::FontRef, scale: PxScale) -> f32 {
    let sf = font.as_scaled(scale);
    let mut w = 0.0f32;
    let mut prev = None;
    for c in line.chars() {
        let gid = sf.glyph_id(c);
        if let Some(p) = prev {
            w += sf.kern(p, gid);
        }
        w += sf.h_advance(gid);
        prev = Some(gid);
    }
    w
}

/// Rasterise one line of text into `pixels` at (start_x, baseline_y).
fn rasterise_line(
    line: &str,
    font: &ab_glyph::FontRef,
    scale: PxScale,
    start_x: f32,
    baseline_y: f32,
    canvas_w: u32,
    canvas_h: u32,
    r: u8, g: u8, b: u8,
    alpha_mul: f32, // 0.0–1.0
    pixels: &mut Vec<u8>,
) {
    use ab_glyph::point;
    let sf = font.as_scaled(scale);
    let mut x = start_x;
    let mut prev = None;

    for c in line.chars() {
        let gid = sf.glyph_id(c);
        if let Some(p) = prev {
            x += sf.kern(p, gid);
        }
        let glyph = gid.with_scale_and_position(scale, point(x, baseline_y));
        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|px, py, cov| {
                let dx = bounds.min.x as i32 + px as i32;
                let dy = bounds.min.y as i32 + py as i32;
                if dx >= 0 && dy >= 0 {
                    let dx = dx as u32;
                    let dy = dy as u32;
                    if dx < canvas_w && dy < canvas_h {
                        let idx = ((dy * canvas_w + dx) * 4) as usize;
                        let a = ((cov * alpha_mul) * 255.0).round() as u8;
                        // Porter-Duff over compositing onto transparent buffer
                        let ea = pixels[idx + 3] as f32 / 255.0;
                        let na = a as f32 / 255.0;
                        let out_a = na + ea * (1.0 - na);
                        if out_a > 0.0 {
                            pixels[idx]     = ((r as f32 * na + pixels[idx] as f32 * ea * (1.0 - na)) / out_a).round() as u8;
                            pixels[idx + 1] = ((g as f32 * na + pixels[idx + 1] as f32 * ea * (1.0 - na)) / out_a).round() as u8;
                            pixels[idx + 2] = ((b as f32 * na + pixels[idx + 2] as f32 * ea * (1.0 - na)) / out_a).round() as u8;
                            pixels[idx + 3] = (out_a * 255.0).round() as u8;
                        }
                    }
                }
            });
        }
        x += sf.h_advance(gid);
        prev = Some(gid);
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

/// Render multi-line text into an RGBA pixel buffer.
/// `dest_x/dest_y` in the caller is the top-left corner of the rendered block.
pub fn render_text(
    text: &str,
    font_size: f32,
    r: u8, g: u8, b: u8,
    bold: bool,
) -> RenderedText {
    let font_data = if bold { FONT_BOLD } else { FONT_REGULAR };
    let font = FontRef::try_from_slice(font_data).expect("embedded font is valid");
    let scale = PxScale::from(font_size);
    let sf = font.as_scaled(scale);

    let lines: Vec<&str> = text.lines().collect();
    let line_height = font_size * 1.3;
    let ascent = sf.ascent();

    let max_w = lines.iter().map(|l| line_width(l, &font, scale)).fold(0.0f32, f32::max);
    let pad = (font_size * 0.25).ceil() as u32;

    let canvas_w = (max_w.ceil() as u32 + pad * 2).max(1);
    let canvas_h = ((lines.len() as f32 * line_height).ceil() as u32 + pad * 2).max(1);

    let mut pixels = vec![0u8; (canvas_w * canvas_h * 4) as usize];

    for (i, line) in lines.iter().enumerate() {
        let baseline_y = pad as f32 + i as f32 * line_height + ascent;
        rasterise_line(
            line, &font, scale,
            pad as f32, baseline_y,
            canvas_w, canvas_h,
            r, g, b, 1.0,
            &mut pixels,
        );
    }

    RenderedText { pixels, width: canvas_w, height: canvas_h }
}

/// Render a stamp label (e.g. "REJECTED") with a border rect, at `font_size`,
/// and rotate the whole result by -5 degrees.
/// The caller scales the result to brush size via `resize_bilinear`.
pub fn render_stamp_label(
    label: &str,
    font_size: f32,
    r: u8, g: u8, b: u8,
) -> RenderedText {
    let font = FontRef::try_from_slice(FONT_BOLD).expect("embedded font is valid");
    let scale = PxScale::from(font_size);
    let sf = font.as_scaled(scale);

    let text_w = line_width(label, &font, scale).ceil() as u32;
    let text_h = font_size.ceil() as u32;
    let ascent = sf.ascent();

    let pad: u32 = (font_size * 0.4).ceil() as u32;
    let canvas_w = text_w + pad * 2;
    let canvas_h = text_h + pad * 2;

    let mut pixels = vec![0u8; (canvas_w * canvas_h * 4) as usize];

    // Border rect (3px wide)
    let border = 3u32;
    for y in 0..canvas_h {
        for x in 0..canvas_w {
            let on_border = x < border || x >= canvas_w - border
                || y < border || y >= canvas_h - border;
            if on_border {
                let idx = ((y * canvas_w + x) * 4) as usize;
                pixels[idx]     = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
                pixels[idx + 3] = 220; // ~86% opacity
            }
        }
    }

    // Text centred, 85% opacity
    let text_start_x = pad as f32;
    let baseline_y = pad as f32 + ascent;
    rasterise_line(
        label, &font, scale,
        text_start_x, baseline_y,
        canvas_w, canvas_h,
        r, g, b, 0.85,
        &mut pixels,
    );

    // Rotate -5 degrees
    rotate_pixels(&pixels, canvas_w, canvas_h, -5.0)
}

/// Returns the (width, height) in pixels that `render_text` would produce,
/// without allocating a full pixel buffer. Used by the JS UI to size the
/// text-input bounding box before the user commits.
pub fn measure(text: &str, font_size: f32, bold: bool) -> (u32, u32) {
    let font_bytes = if bold { FONT_BOLD } else { FONT_REGULAR };
    let font = FontRef::try_from_slice(font_bytes)
        .unwrap_or_else(|_| FontRef::try_from_slice(FONT_REGULAR).expect("regular font"));
    let scale = PxScale::from(font_size);
    let sf = font.as_scaled(scale);

    let lines: Vec<&str> = text.split('\n').collect();
    let max_w = lines
        .iter()
        .map(|l| line_width(l, &font, scale))
        .fold(0.0f32, f32::max);

    let ascent = sf.ascent();
    let descent = sf.descent();
    let line_gap = sf.line_gap();
    let line_height = ascent - descent + line_gap;

    let total_h = if lines.is_empty() {
        font_size
    } else {
        ascent - descent + (lines.len() as f32 - 1.0) * line_height
    };

    let padding = (font_size * 0.25).ceil();
    (
        (max_w.max(8.0) + padding * 2.0).ceil() as u32,
        (total_h.max(font_size) + padding * 2.0).ceil() as u32,
    )
}

/// Rotate an RGBA pixel buffer by `angle_deg` degrees (positive = CCW).
/// The output is sized to the bounding box of the rotated image.
fn rotate_pixels(data: &[u8], w: u32, h: u32, angle_deg: f32) -> RenderedText {
    let angle = angle_deg * std::f32::consts::PI / 180.0;
    let cos = angle.cos();
    let sin = angle.sin();

    // Bounding box of rotated rectangle
    let new_w = (w as f32 * cos.abs() + h as f32 * sin.abs()).ceil() as u32 + 2;
    let new_h = (w as f32 * sin.abs() + h as f32 * cos.abs()).ceil() as u32 + 2;

    let mut out = vec![0u8; (new_w * new_h * 4) as usize];

    let cx = w as f32 / 2.0;
    let cy = h as f32 / 2.0;
    let ncx = new_w as f32 / 2.0;
    let ncy = new_h as f32 / 2.0;

    for ny in 0..new_h {
        for nx in 0..new_w {
            // Inverse rotate to find source pixel
            let dx = nx as f32 - ncx;
            let dy = ny as f32 - ncy;
            let src_x = dx * cos + dy * sin + cx;
            let src_y = -dx * sin + dy * cos + cy;

            let x0 = src_x.floor() as i32;
            let y0 = src_y.floor() as i32;
            if x0 < 0 || y0 < 0 || x0 + 1 >= w as i32 || y0 + 1 >= h as i32 {
                continue;
            }
            let x0 = x0 as u32;
            let y0 = y0 as u32;
            let fx = src_x - src_x.floor();
            let fy = src_y - src_y.floor();

            let sample = |x: u32, y: u32| -> [f32; 4] {
                let i = ((y * w + x) * 4) as usize;
                [data[i] as f32, data[i+1] as f32, data[i+2] as f32, data[i+3] as f32]
            };
            let p00 = sample(x0, y0);
            let p10 = sample(x0+1, y0);
            let p01 = sample(x0, y0+1);
            let p11 = sample(x0+1, y0+1);

            let lerp = |a: f32, b: f32, t: f32| a + (b - a) * t;
            let blerp = |a: f32, b: f32, c: f32, d: f32| lerp(lerp(a, b, fx), lerp(c, d, fx), fy);

            let oi = ((ny * new_w + nx) * 4) as usize;
            for ch in 0..4 {
                out[oi + ch] = blerp(p00[ch], p10[ch], p01[ch], p11[ch]).round() as u8;
            }
        }
    }

    RenderedText { pixels: out, width: new_w, height: new_h }
}
