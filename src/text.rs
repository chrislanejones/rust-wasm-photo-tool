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
    r: u8,
    g: u8,
    b: u8,
    alpha_mul: f32, // 0.0–1.0
    pixels: &mut [u8],
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
                            pixels[idx] = ((r as f32 * na + pixels[idx] as f32 * ea * (1.0 - na))
                                / out_a)
                                .round() as u8;
                            pixels[idx + 1] = ((g as f32 * na
                                + pixels[idx + 1] as f32 * ea * (1.0 - na))
                                / out_a)
                                .round() as u8;
                            pixels[idx + 2] = ((b as f32 * na
                                + pixels[idx + 2] as f32 * ea * (1.0 - na))
                                / out_a)
                                .round() as u8;
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
pub fn render_text(text: &str, font_size: f32, r: u8, g: u8, b: u8, bold: bool) -> RenderedText {
    let font_data = if bold { FONT_BOLD } else { FONT_REGULAR };
    let font = FontRef::try_from_slice(font_data).expect("embedded font is valid");
    let scale = PxScale::from(font_size);
    let sf = font.as_scaled(scale);

    let lines: Vec<&str> = text.lines().collect();
    let line_height = font_size * 1.3;
    let ascent = sf.ascent();

    let max_w = lines
        .iter()
        .map(|l| line_width(l, &font, scale))
        .fold(0.0f32, f32::max);
    let pad = (font_size * 0.25).ceil() as u32;

    let canvas_w = (max_w.ceil() as u32 + pad * 2).max(1);
    let canvas_h = ((lines.len() as f32 * line_height).ceil() as u32 + pad * 2).max(1);

    let mut pixels = vec![0u8; (canvas_w * canvas_h * 4) as usize];

    for (i, line) in lines.iter().enumerate() {
        let baseline_y = pad as f32 + i as f32 * line_height + ascent;
        rasterise_line(
            line,
            &font,
            scale,
            pad as f32,
            baseline_y,
            canvas_w,
            canvas_h,
            r,
            g,
            b,
            1.0,
            &mut pixels,
        );
    }

    RenderedText {
        pixels,
        width: canvas_w,
        height: canvas_h,
    }
}

/// Render a stamp label (e.g. "REJECTED") with a border rect, at `font_size`,
/// and rotate the whole result by -5 degrees.
/// The caller scales the result to brush size via `resize_bilinear`.
pub fn render_stamp_label(
    label: &str,
    font_size: f32,
    r: u8,
    g: u8,
    b: u8,
    angle_deg: f32,
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
            let on_border =
                x < border || x >= canvas_w - border || y < border || y >= canvas_h - border;
            if on_border {
                let idx = ((y * canvas_w + x) * 4) as usize;
                pixels[idx] = r;
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
        label,
        &font,
        scale,
        text_start_x,
        baseline_y,
        canvas_w,
        canvas_h,
        r,
        g,
        b,
        0.85,
        &mut pixels,
    );

    // Rotate by the caller-supplied tilt (red stamps default to -5°).
    rotate_pixels(&pixels, canvas_w, canvas_h, angle_deg)
}

/// The horizontal padding `measure`/`render_text` add on EACH side of the
/// glyph ink. Callers converting a user-facing box width into a content width
/// must subtract twice this — exported so the conversion cannot drift from the
/// layout it is compensating for.
pub fn side_padding(font_size: f32) -> f32 {
    (font_size * 0.25).ceil()
}

/// Greedy word-wrap: re-break `text` so no line's ink exceeds `max_w` px,
/// preserving the author's own newlines as hard breaks.
///
/// Returns a plain `\n`-delimited string, which is the ONLY reason this
/// feature is cheap: `measure`, `render_text` and the tile builder all already
/// split on `\n`, so wrapping is a pre-pass rather than a second layout engine.
/// Nothing downstream needs to know wrapping happened.
///
/// `max_w` is the CONTENT width (glyph ink), not the padded box — see
/// [`side_padding`]. A non-positive `max_w` returns the text unchanged, which
/// is what `wrap_width == 0` (the pre-v8.40 default, and every restored v2
/// annotation) means: no wrapping, size the box to the text.
///
/// Greedy, not Knuth-Plass: this has to agree EXACTLY with what the overlay
/// previews and what replay rebuilds, and "obvious and reproducible" beats
/// "optimal" for that. A single word longer than `max_w` is left overlong on
/// its own line rather than broken mid-word — hyphenation is a typographic
/// decision, and silently splitting a URL or a name would be worse than one
/// line sticking out.
pub fn wrap(text: &str, font_size: f32, bold: bool, max_w: f32) -> String {
    // `<= 0.0` rather than `!(max_w > 0.0)`: clippy rightly objects to negated
    // comparisons on partially-ordered floats. NaN falls through to the
    // no-wrap branch either way, which is the safe answer for a bad width.
    if max_w.is_nan() || max_w <= 0.0 || text.is_empty() {
        return text.to_string();
    }
    let font_bytes = if bold { FONT_BOLD } else { FONT_REGULAR };
    let font = FontRef::try_from_slice(font_bytes)
        .unwrap_or_else(|_| FontRef::try_from_slice(FONT_REGULAR).expect("regular font"));
    let scale = PxScale::from(font_size);

    let mut out = String::with_capacity(text.len() + 16);
    for (i, para) in text.split('\n').enumerate() {
        if i > 0 {
            out.push('\n');
        }
        // A paragraph that already fits is emitted VERBATIM — no re-spacing,
        // no lost indentation, no trimmed trailing space. This is what makes
        // the function idempotent by construction (every line it emits fits,
        // so a second pass copies them through) and what keeps it from
        // rewriting text the user never asked it to touch. The unit test for
        // "   " caught the earlier version silently deleting whitespace.
        if line_width(para, &font, scale) <= max_w {
            out.push_str(para);
            continue;
        }
        // Only a paragraph that genuinely must break gets its inter-word runs
        // normalised to single spaces — that is inherent to re-breaking, and
        // the alternative (carrying original runs across a break) puts stray
        // leading spaces at the start of wrapped lines.
        let mut line = String::new();
        for word in para.split_whitespace() {
            let candidate = if line.is_empty() {
                word.to_string()
            } else {
                format!("{line} {word}")
            };
            if line_width(&candidate, &font, scale) <= max_w || line.is_empty() {
                line = candidate;
            } else {
                out.push_str(&line);
                out.push('\n');
                line = word.to_string();
            }
        }
        out.push_str(&line);
    }
    out
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

/// Rotate an RGBA pixel buffer by `angle_deg` degrees. Positive is CLOCKWISE
/// in screen coords (y-down) — the same direction as CSS `rotate(+deg)`, so
/// callers pass the angle as-is to match the live preview (no negation).
/// The output is sized to the bounding box of the rotated image.
pub(crate) fn rotate_pixels(data: &[u8], w: u32, h: u32, angle_deg: f32) -> RenderedText {
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
                [
                    data[i] as f32,
                    data[i + 1] as f32,
                    data[i + 2] as f32,
                    data[i + 3] as f32,
                ]
            };
            let p00 = sample(x0, y0);
            let p10 = sample(x0 + 1, y0);
            let p01 = sample(x0, y0 + 1);
            let p11 = sample(x0 + 1, y0 + 1);

            let lerp = |a: f32, b: f32, t: f32| a + (b - a) * t;
            let blerp = |a: f32, b: f32, c: f32, d: f32| lerp(lerp(a, b, fx), lerp(c, d, fx), fy);

            let oi = ((ny * new_w + nx) * 4) as usize;
            for ch in 0..4 {
                out[oi + ch] = blerp(p00[ch], p10[ch], p01[ch], p11[ch]).round() as u8;
            }
        }
    }

    RenderedText {
        pixels: out,
        width: new_w,
        height: new_h,
    }
}

#[cfg(test)]
mod wrap_tests {
    use super::*;

    /// Ink width of one already-broken line, the same way `wrap` measures it.
    fn w(line: &str, size: f32) -> f32 {
        let font = FontRef::try_from_slice(FONT_REGULAR).unwrap();
        line_width(line, &font, PxScale::from(size))
    }

    #[test]
    fn zero_width_is_a_no_op_the_pre_wrap_default() {
        let t = "the quick brown fox jumps over the lazy dog";
        assert_eq!(wrap(t, 24.0, false, 0.0), t, "wrap_width 0 = do not wrap");
        assert_eq!(wrap(t, 24.0, false, -5.0), t, "negative is also inert");
    }

    #[test]
    fn breaks_only_where_it_must_and_every_line_fits() {
        let t = "the quick brown fox jumps over the lazy dog";
        let max = 120.0;
        let out = wrap(t, 24.0, false, max);
        assert!(out.contains('\n'), "long text at a narrow width must break");
        for line in out.split('\n') {
            // A single overlong WORD is the one allowed exception.
            let single_word = !line.trim().contains(' ');
            assert!(
                w(line, 24.0) <= max || single_word,
                "line {line:?} is {} px, over the {max} px limit",
                w(line, 24.0)
            );
        }
        // No words invented or lost.
        assert_eq!(
            out.split_whitespace().collect::<Vec<_>>(),
            t.split_whitespace().collect::<Vec<_>>(),
        );
    }

    #[test]
    fn a_word_longer_than_the_box_is_left_whole_not_hyphenated() {
        let t = "antidisestablishmentarianism";
        let out = wrap(t, 32.0, false, 20.0);
        assert_eq!(out, t, "never split mid-word — a URL or name would break");
    }

    #[test]
    fn authors_own_newlines_stay_hard_breaks() {
        let t = "line one\nline two";
        // Wide enough that no automatic break is needed.
        let out = wrap(t, 16.0, false, 10_000.0);
        assert_eq!(out, t, "hard breaks survive, and none are added");
        assert_eq!(out.matches('\n').count(), 1);
    }

    #[test]
    fn wrapping_is_idempotent_rewrapping_its_own_output_changes_nothing() {
        // Load-bearing: the overlay previews wrapped text and the engine
        // re-wraps on every rebuild. A non-idempotent breaker would creep the
        // layout on each keystroke.
        let t = "the quick brown fox jumps over the lazy dog and keeps running";
        let once = wrap(t, 20.0, false, 150.0);
        let twice = wrap(&once, 20.0, false, 150.0);
        assert_eq!(once, twice);
    }

    #[test]
    fn empty_and_whitespace_do_not_panic() {
        assert_eq!(wrap("", 24.0, false, 100.0), "");
        assert_eq!(wrap("   ", 24.0, false, 100.0), "   ");
        assert_eq!(wrap("\n\n", 24.0, false, 100.0), "\n\n");
    }

    #[test]
    fn text_that_already_fits_is_returned_byte_for_byte() {
        // The whitespace-eating bug the test above caught: wrapping must not
        // rewrite text it did not need to break.
        for t in ["  indented", "trailing  ", "a  double  space", "plain"] {
            assert_eq!(wrap(t, 16.0, false, 5_000.0), t, "mangled {t:?}");
        }
    }

    #[test]
    fn a_wider_box_yields_fewer_lines_the_whole_point_of_reflow() {
        let t = "the quick brown fox jumps over the lazy dog";
        let narrow = wrap(t, 24.0, false, 100.0).matches('\n').count();
        let wide = wrap(t, 24.0, false, 400.0).matches('\n').count();
        assert!(narrow > wide, "narrow={narrow} wide={wide}");
    }

    #[test]
    fn side_padding_matches_what_measure_actually_adds() {
        // measure() adds `(font_size * 0.25).ceil()` per side; if that drifts,
        // every box-width -> content-width conversion silently misaligns.
        let size = 24.0;
        let (boxed, _) = measure("x", size, false);
        let ink = w("x", size).max(8.0);
        let derived = (boxed as f32 - ink).ceil() / 2.0;
        assert!(
            (derived - side_padding(size)).abs() <= 1.0,
            "side_padding {} vs derived {derived}",
            side_padding(size)
        );
    }
}
