//! Yet Another Image App — WASM Processing Layer
//!
//! Single `.wasm` binary, internally organized as Rust modules:
//!
//! - `core`      — ImageBuffer (pixel data, bilinear sampling)
//! - `history`   — Undo / redo snapshot system
//! - `stamp`     — Clone stamp brush engine
//! - `transform` — Flip, rotate, copy/paste regions
//! - `filters`   — Brightness, contrast (future: blur, sharpen)
//! - `codec`     — PNG encoding, thumbnail generation
//!
//! The JS side imports `ImageHorseTool` — the API surface is unchanged.

use wasm_bindgen::prelude::*;

mod core;
mod history;
mod stamp;
mod transform;
mod filters;
mod codec;
mod drawing;
mod text;

use crate::core::ImageBuffer;
use crate::history::{History, Snapshot};
use crate::stamp::StampState;

/// Maximum number of gallery photos allowed for a given account tier.
///
/// Single source of truth for the gallery cap, shared by the upload gate
/// (`handleAddPhotos`) and the gallery UI on the JS side.
///
/// - `"demo"`     — anonymous / not signed in → **12**
/// - `"loggedIn"` — free account             → **24**
/// - `"paid"`     — Pro (coming soon)         → **100**
///
/// Unknown tiers fall back to the most restrictive demo limit.
#[wasm_bindgen]
pub fn photo_limit(tier: &str) -> u32 {
    match tier {
        "loggedIn" => 24,
        "paid" => 100,
        _ => 12,
    }
}

/// Web-performance indicators for the Resize &amp; Compress panel.
///
/// Returns `[lighthouse_score, web_performance_gain]`, both in `0..=100`:
///
/// - **Web Performance Gain** — how much smaller the delivered image will be
///   vs. the *original upload* (`orig_bytes`), accounting for everything done so
///   far plus the pending resize + quality: `1 - projected_bytes / orig_bytes`.
///   A freshly uploaded, untouched photo reads `+0%`; resizing, lowering
///   quality, or running Auto Compress (which shrinks `cur_bytes`) all push it
///   up.
/// - **PageSpeed Insights Score** — a Google-PSI-style score derived from the
///   *projected delivered byte size*, mapped through a log-normal curve (the
///   same curve family Lighthouse uses to score its metrics), then adjusted
///   for the three image audits PSI actually runs:
///   - "Efficiently encode images" — the byte projection scales with quality.
///   - "Serve images in next-gen formats" — `cur_format`/`new_format` fold the
///     typical compression ratio of the target codec into the projection
///     (PNG photos ≈ 2.6× JPEG, WebP ≈ 0.8×, AVIF ≈ 0.6×), so switching the
///     Format dropdown to WebP/AVIF raises the score like PSI's audit would.
///   - "Properly size images" — output wider than 1920 px (the widest common
///     desktop display) accrues a linear penalty: those pixels can't be seen
///     and PSI flags them as pure waste.
///
/// Format codes: 0 = PNG, 1 = JPEG, 2 = WebP, 3 = AVIF, other = unknown (1.0).
///
/// `cur_bytes` is the current on-disk size of the active photo and `orig_bytes`
/// the immutable size at upload. Passing `0` for either (size unknown) yields a
/// `0` rather than a misleading perfect value.
#[wasm_bindgen]
pub fn web_perf_metrics(
    cur_w: u32,
    cur_h: u32,
    cur_bytes: f64,
    orig_bytes: f64,
    new_w: u32,
    new_h: u32,
    quality: u32,
    cur_format: u8,
    new_format: u8,
) -> Vec<f64> {
    let cur_area = (cur_w as f64) * (cur_h as f64);
    let new_area = (new_w as f64) * (new_h as f64);
    let area_ratio = if cur_area > 0.0 { new_area / cur_area } else { 1.0 };
    let quality_ratio = (quality as f64 / 100.0).clamp(0.0, 1.0);

    // Typical photographic bytes-per-pixel relative to JPEG at equal visual
    // quality. Grounded in Lighthouse's "next-gen formats" savings estimates
    // (WebP ~25-34% smaller than JPEG, AVIF ~40-50%) and PNG's 2-4× cost for
    // photos.
    fn format_weight(code: u8) -> f64 {
        match code {
            0 => 2.6,  // PNG
            1 => 1.0,  // JPEG
            2 => 0.8,  // WebP
            3 => 0.6,  // AVIF
            _ => 1.0,  // unknown
        }
    }
    let format_ratio = format_weight(new_format) / format_weight(cur_format);

    // Estimated delivered size after the pending resize + re-encode, on top of
    // whatever the current file already is (e.g. after Auto Compress).
    let projected_bytes =
        (cur_bytes * area_ratio * quality_ratio * format_ratio).max(0.0);

    // "Properly size images": pixels beyond a 1920px-wide display are waste.
    // Score-only penalty (the bytes still ship, so savings stays honest).
    // Linear (not quadratic) so 4K originals are nudged, not cliffed.
    const MAX_USEFUL_WIDTH: f64 = 1920.0;
    let scored_bytes = if (new_w as f64) > MAX_USEFUL_WIDTH {
        projected_bytes * (new_w as f64 / MAX_USEFUL_WIDTH)
    } else {
        projected_bytes
    };

    // Byte savings vs. the *original upload*, so progress accumulates across
    // resize, quality and Auto Compress instead of resetting to the current file.
    let savings = if orig_bytes > 0.0 {
        ((1.0 - projected_bytes / orig_bytes) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    let score = if cur_bytes > 0.0 {
        // Unknown source size → don't pretend the image is perfectly optimized.
        lighthouse_score(scored_bytes)
    } else {
        0.0
    };

    vec![score, savings]
}

/// Map a projected transfer size (bytes) to a 0..=100 Lighthouse-style score
/// using a log-normal curve, the way Lighthouse scores its metrics. `GOOD` is
/// the size that earns ~90 and `MEDIAN` the size that earns 50; heavier images
/// fall off smoothly toward 0.
fn lighthouse_score(bytes: f64) -> f64 {
    // Control points: a well-optimized web image vs. a heavy one.
    const GOOD: f64 = 100_000.0; // ~100 KB → score ~90
    const MEDIAN: f64 = 500_000.0; // ~500 KB → score 50
    // erfc(-Z_P90)/2 = 0.9, i.e. Z_P90 = -erfc⁻¹(1.8); sigma is chosen so that
    // score(GOOD) lands on 0.9 and score(MEDIAN) on 0.5.
    const Z_P90: f64 = 0.906_193_802_436_823_2;

    if bytes <= 0.0 {
        return 100.0;
    }
    let sqrt2 = std::f64::consts::SQRT_2;
    let sigma = (MEDIAN.ln() - GOOD.ln()) / (sqrt2 * Z_P90);
    let z = (bytes.ln() - MEDIAN.ln()) / (sqrt2 * sigma);
    (0.5 * erfc(z) * 100.0).clamp(0.0, 100.0)
}

/// Complementary error function via the Abramowitz &amp; Stegun 7.1.26
/// rational approximation (|error| &lt; 1.5e-7) — enough for UI scoring.
fn erfc(x: f64) -> f64 {
    1.0 - erf(x)
}

fn erf(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let t = 1.0 / (1.0 + 0.327_591_1 * x);
    let y = 1.0
        - (((((1.061_405_429 * t - 1.453_152_027) * t) + 1.421_413_741) * t - 0.284_496_736) * t
            + 0.254_829_592)
            * t
            * (-x * x).exp();
    sign * y
}

/// A live (non-destructive) text annotation that sits in an overlay
/// composited over the main pixel buffer on render. Annotations are
/// re-editable until `flatten_text_annotations` burns them into pixels
/// (used at export time and on explicit flatten).
///
/// `Clone` is derived so each history snapshot can carry an independent
/// copy of the annotation list (so undo/redo restores the overlay too).
#[derive(Clone)]
pub struct TextAnnotation {
    pub id: u32,
    pub text: String,
    pub x: i32,       // unrotated top-left in canvas coords
    pub y: i32,
    pub font_size: f32,
    pub r: u8, pub g: u8, pub b: u8,
    pub bold: bool,
    pub rotation_deg: f64,
    // cached pre-rendered tile (rotated): updated whenever the annotation changes.
    // Arc so history snapshots can clone the annotation list cheaply (the tile
    // bytes are shared, not deep-copied per snapshot).
    pub tile_pixels: std::sync::Arc<Vec<u8>>,
    pub tile_w: u32,
    pub tile_h: u32,
    pub tile_offset_x: i32,  // offset of tile origin from (x,y) due to rotation expanding bounds
    pub tile_offset_y: i32,
    // Text background (optional fill behind the text)
    pub background_kind: u8,   // 0 = None, 1 = Rect, 2 = SpeechBubble
    pub bg_r: u8, pub bg_g: u8, pub bg_b: u8, pub bg_a: u8,
    pub bg_padding: u32,
    pub bg_corner_radius: u32,
    pub bg_tail: u8,           // 0 none, 1 Left, 2 Right, 3 TopLeft, 4 BottomRight, 5 BottomLeft
}

/// A live (non-destructive) shape/arrow annotation. Mirrors `TextAnnotation`:
/// shapes sit in an overlay and are re-selectable / movable until
/// `flatten_text_annotations` (which also flattens shapes) burns them into the
/// pixel buffer at export. Geometry is stored as the two drag endpoints in
/// canvas coords — exactly what `draw_shape` / `draw_arrow` consume — so the
/// committed pixels match the live preview without a tile cache (shape
/// rasterisation is cheap, unlike text).
///
/// `Clone` is derived so each history snapshot carries an independent copy
/// (undo/redo restores the overlay too).
#[derive(Clone)]
pub struct ShapeAnnotation {
    pub id: u32,
    /// 0=rect, 1=circle, 2=line, 3=handCircle, 4=arrow.
    pub kind: u8,
    pub x0: f64, pub y0: f64,   // start point (canvas coords)
    pub x1: f64, pub y1: f64,   // end point
    pub r: u8, pub g: u8, pub b: u8,
    pub stroke_width: f64,
    /// Arrows only: 0=single-headed, 1=double-headed. Ignored for shapes.
    pub arrow_style: u8,
}

#[wasm_bindgen]
pub struct ImageHorseTool {
    buf: ImageBuffer,
    hist: History,
    stamp: StampState,
    zoom: f64,
    // Scratch buffers reused across blur_region calls to avoid per-stroke allocation.
    blur_scratch_a: Vec<u8>,
    blur_scratch_b: Vec<u8>,
    // Cached Gaussian kernel keyed on intensity — blur strokes call into us
    // many times per second with the same intensity, so rebuilding the kernel
    // on every dab is wasted work.
    blur_kernel_cache: Option<(u32, Vec<f32>)>,
    text_annotations: Vec<TextAnnotation>,
    next_text_id: u32,
    /// Live shape/arrow overlay — non-destructive, re-selectable. See
    /// `ShapeAnnotation`.
    shape_annotations: Vec<ShapeAnnotation>,
    next_shape_id: u32,
    /// When a shape is being edited via the JS Figma-style overlay, it is
    /// suppressed from `render_with_annotations` so the live preview doesn't
    /// double up with the committed pixels. `None` when nothing is editing.
    editing_shape_id: Option<u32>,
}

/// Escape a string as a JSON string body (without surrounding quotes).
fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out
}

/// Build a complete TextAnnotation (config + pre-rendered tile) ready to
/// either push onto the live overlay list or onto a history snapshot's
/// annotation vector. Centralizes the tile-rebuild logic so add/update
/// and snapshot-restore all share the same path.
fn build_text_annotation(
    id: u32,
    text: &str,
    font_size: f32,
    r: u8, g: u8, b: u8,
    bold: bool,
    x: i32,
    y: i32,
    rotation_deg: f64,
    background_kind: u8,
    bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8,
    bg_padding: u32,
    bg_corner_radius: u32,
    bg_tail: u8,
) -> TextAnnotation {
    let (tile_pixels, tile_w, tile_h, tile_offset_x, tile_offset_y) =
        build_annotation_tile(
            text, font_size, r, g, b, bold, rotation_deg,
            background_kind,
            bg_r, bg_g, bg_b, bg_a,
            bg_padding, bg_corner_radius, bg_tail,
        );
    TextAnnotation {
        id,
        text: text.to_string(),
        x, y,
        font_size,
        r, g, b,
        bold,
        rotation_deg,
        tile_pixels: std::sync::Arc::new(tile_pixels),
        tile_w, tile_h,
        tile_offset_x, tile_offset_y,
        background_kind,
        bg_r, bg_g, bg_b, bg_a,
        bg_padding,
        bg_corner_radius,
        bg_tail,
    }
}

/// Serialize a list of annotations to the JSON format consumed by JS.
/// Tile dimensions are included so the JS overlay can lay out chevrons
/// and selection rectangles without a Rust round-trip per frame.
fn annotations_to_json(anns: &[TextAnnotation]) -> String {
    let mut out = String::from("[");
    for (i, a) in anns.iter().enumerate() {
        if i > 0 { out.push(','); }
        out.push_str(&format!(
            "{{\"id\":{},\"text\":\"{}\",\"x\":{},\"y\":{},\"font_size\":{},\"r\":{},\"g\":{},\"b\":{},\"bold\":{},\"rotation_deg\":{},\"tile_w\":{},\"tile_h\":{},\"tile_offset_x\":{},\"tile_offset_y\":{},\"background_kind\":{},\"bg_r\":{},\"bg_g\":{},\"bg_b\":{},\"bg_a\":{},\"bg_padding\":{},\"bg_corner_radius\":{},\"bg_tail\":{}}}",
            a.id,
            json_escape(&a.text),
            a.x, a.y,
            a.font_size,
            a.r, a.g, a.b,
            a.bold,
            a.rotation_deg,
            a.tile_w, a.tile_h,
            a.tile_offset_x, a.tile_offset_y,
            a.background_kind,
            a.bg_r, a.bg_g, a.bg_b, a.bg_a,
            a.bg_padding, a.bg_corner_radius, a.bg_tail,
        ));
    }
    out.push(']');
    out
}

/// Serialize a list of shape annotations to JSON for the JS overlay /
/// Reselect list. Geometry is the raw endpoint pair; the JS side derives
/// bounding boxes the same way Rust's `draw_shape` does.
fn shapes_to_json(shapes: &[ShapeAnnotation]) -> String {
    let mut out = String::from("[");
    for (i, s) in shapes.iter().enumerate() {
        if i > 0 { out.push(','); }
        out.push_str(&format!(
            "{{\"id\":{},\"kind\":{},\"x0\":{},\"y0\":{},\"x1\":{},\"y1\":{},\"r\":{},\"g\":{},\"b\":{},\"stroke_width\":{},\"arrow_style\":{}}}",
            s.id, s.kind,
            s.x0, s.y0, s.x1, s.y1,
            s.r, s.g, s.b,
            s.stroke_width,
            s.arrow_style,
        ));
    }
    out.push(']');
    out
}

/// Euclidean distance from point (px,py) to the segment (ax,ay)-(bx,by).
/// Used for hit-testing line/arrow annotations.
fn point_segment_distance(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let dx = bx - ax;
    let dy = by - ay;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-6 {
        return ((px - ax).powi(2) + (py - ay).powi(2)).sqrt();
    }
    let t = (((px - ax) * dx + (py - ay) * dy) / len_sq).clamp(0.0, 1.0);
    let cx = ax + t * dx;
    let cy = ay + t * dy;
    ((px - cx).powi(2) + (py - cy).powi(2)).sqrt()
}

/// Composite one shape annotation directly into `data` (RGBA, w×h) using the
/// same drawing primitives as the instant-commit path, so the live overlay and
/// the flattened pixels are identical.
fn render_shape_into(data: &mut [u8], w: u32, h: u32, s: &ShapeAnnotation) {
    let color = [s.r, s.g, s.b, 255];
    if s.kind == 4 {
        crate::drawing::draw_arrow(
            data, w, h,
            s.x0, s.y0, s.x1, s.y1,
            color, s.stroke_width, s.arrow_style as u32,
        );
    } else {
        crate::drawing::draw_shape(
            data, w, h,
            s.x0, s.y0, s.x1, s.y1,
            s.kind as u32, color, s.stroke_width,
        );
    }
}

impl ImageHorseTool {
    /// Push a history snapshot of the current buffer + both overlay layers
    /// (text + shapes). Replaces the long inline `push_snapshot(...)` calls so
    /// every history-creating action records the shape overlay too.
    fn snap(&mut self, label: &str) {
        self.hist.push_snapshot(
            label,
            &self.buf.data,
            self.buf.width,
            self.buf.height,
            self.text_annotations.clone(),
            self.shape_annotations.clone(),
        );
    }
}

/// Build the cached tile (rotated if needed) for an annotation's current
/// text / font / colour / rotation, optionally including a filled
/// background (rect or speech bubble). Returns (pixels, w, h, off_x, off_y).
/// `off_x/off_y` are the offsets of the rotated bounding box relative to
/// the unrotated top-left (x,y) so that rotation pivots around the centre
/// of the unrotated tile.
///
/// `background_kind`: 0 = none, 1 = filled rounded rect, 2 = rounded rect
/// with a small triangular tail.
fn build_annotation_tile(
    text: &str,
    font_size: f32,
    r: u8, g: u8, b: u8,
    bold: bool,
    rotation_deg: f64,
    background_kind: u8,
    bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8,
    bg_padding: u32,
    bg_corner_radius: u32,
    bg_tail: u8,
) -> (Vec<u8>, u32, u32, i32, i32) {
    let rendered = crate::text::render_text(text, font_size, r, g, b, bold);
    let raw_w = rendered.width;
    let raw_h = rendered.height;

    // If no background, the historical fast-path applies.
    if background_kind == 0 {
        if rotation_deg.abs() < 0.5 {
            return (rendered.pixels, raw_w, raw_h, 0, 0);
        }
        let rotated = crate::text::rotate_pixels(
            &rendered.pixels,
            raw_w,
            raw_h,
            -(rotation_deg as f32),
        );
        let cx = raw_w as i32 / 2;
        let cy = raw_h as i32 / 2;
        let off_x = cx - rotated.width as i32 / 2;
        let off_y = cy - rotated.height as i32 / 2;
        return (rotated.pixels, rotated.width, rotated.height, off_x, off_y);
    }

    // Background path: expand the tile by `bg_padding` on all sides, and
    // by ~TAIL_EXTENT (16 px on the tail axis, 12 px on the perpendicular)
    // when there's a speech-bubble tail.
    const TAIL_LEN: u32 = 32;     // how far the tail sticks out
    const TAIL_HALF: u32 = 16;    // half-width of the tail base
    let (tail_l, tail_r, tail_t, tail_b) = if background_kind == 2 {
        match bg_tail {
            1 => (TAIL_LEN, 0, 0, 0),                          // Left
            2 => (0, TAIL_LEN, 0, 0),                          // Right
            3 => (0, 0, TAIL_LEN, 0),                          // TopLeft (extends up)
            4 => (0, TAIL_LEN, 0, TAIL_LEN),                   // BottomRight
            5 => (TAIL_LEN, 0, 0, TAIL_LEN),                   // BottomLeft
            _ => (0, 0, 0, 0),
        }
    } else {
        (0, 0, 0, 0)
    };
    let pad = bg_padding;
    let tile_w = raw_w + pad * 2 + tail_l + tail_r;
    let tile_h = raw_h + pad * 2 + tail_t + tail_b;
    let mut tile = vec![0u8; (tile_w * tile_h * 4) as usize];

    // Background rect occupies the padded text area inside the tile.
    let rect_x0 = tail_l as i32;
    let rect_y0 = tail_t as i32;
    let rect_x1 = (tail_l + raw_w + pad * 2) as i32;
    let rect_y1 = (tail_t + raw_h + pad * 2) as i32;

    crate::drawing::fill_rounded_rect(
        &mut tile, tile_w, tile_h,
        rect_x0, rect_y0, rect_x1, rect_y1,
        bg_corner_radius,
        bg_r, bg_g, bg_b, bg_a,
    );

    // Optional speech-bubble tail. The tail attaches to the rect's edge
    // and extends outward; size ~ TAIL_LEN x (TAIL_HALF*2).
    if background_kind == 2 && bg_tail != 0 {
        let rx0 = rect_x0 as f64;
        let ry0 = rect_y0 as f64;
        let rx1 = rect_x1 as f64;
        let ry1 = rect_y1 as f64;
        let _mid_x = (rx0 + rx1) * 0.5;
        let mid_y = (ry0 + ry1) * 0.5;
        let hf = TAIL_HALF as f64;
        let tl = TAIL_LEN as f64;
        let (p1, p2, p3) = match bg_tail {
            1 => ((rx0, mid_y - hf), (rx0, mid_y + hf), (rx0 - tl, mid_y)),
            2 => ((rx1, mid_y - hf), (rx1, mid_y + hf), (rx1 + tl, mid_y)),
            3 => ((rx0 + hf, ry0), (rx0 + hf * 3.0, ry0), (rx0, ry0 - tl)),
            4 => ((rx1 - hf, ry1), (rx1 - hf * 3.0, ry1), (rx1, ry1 + tl)),
            5 => ((rx0 + hf, ry1), (rx0 + hf * 3.0, ry1), (rx0, ry1 + tl)),
            _ => ((0.0, 0.0), (0.0, 0.0), (0.0, 0.0)),
        };
        crate::drawing::fill_triangle_public(
            &mut tile, tile_w, tile_h,
            p1, p2, p3,
            bg_r, bg_g, bg_b, bg_a,
        );
    }

    // Composite the text on top of the background. The text sits inside
    // the rect with `pad` margin.
    let text_dx = (tail_l + pad) as i32;
    let text_dy = (tail_t + pad) as i32;
    crate::transform::paste_region(
        &mut tile,
        tile_w as i32,
        tile_h as i32,
        &rendered.pixels,
        raw_w,
        raw_h,
        text_dx,
        text_dy,
    );

    if rotation_deg.abs() < 0.5 {
        return (tile, tile_w, tile_h, 0, 0);
    }
    // Rotate the composed tile (background + text together).
    let rotated = crate::text::rotate_pixels(&tile, tile_w, tile_h, -(rotation_deg as f32));
    let cx = tile_w as i32 / 2;
    let cy = tile_h as i32 / 2;
    let off_x = cx - rotated.width as i32 / 2;
    let off_y = cy - rotated.height as i32 / 2;
    (rotated.pixels, rotated.width, rotated.height, off_x, off_y)
}

#[wasm_bindgen]
impl ImageHorseTool {
    // ── Constructor & dimensions ─────────────────────────────────────────

    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> ImageHorseTool {
        ImageHorseTool {
            buf: ImageBuffer::new(width, height),
            hist: History::new(),
            stamp: StampState::new(),
            zoom: 1.0,
            blur_scratch_a: Vec::new(),
            blur_scratch_b: Vec::new(),
            blur_kernel_cache: None,
            text_annotations: Vec::new(),
            next_text_id: 1,
            shape_annotations: Vec::new(),
            next_shape_id: 1,
            editing_shape_id: None,
        }
    }

    pub fn width(&self) -> u32 {
        self.buf.width
    }

    pub fn height(&self) -> u32 {
        self.buf.height
    }

    // ── Image loading ───────────────────────────────────────────────────

    pub fn load_image(&mut self, pixels: &[u8]) {
        if self.buf.load(pixels) {
            self.hist.clear();
            self.stamp.stroke_counter = 0;
            self.stamp.source_x = None;
            self.stamp.source_y = None;
            self.text_annotations.clear();
            self.next_text_id = 1;
            self.shape_annotations.clear();
            self.next_shape_id = 1;
            self.editing_shape_id = None;
        }
    }

    pub fn get_image_data(&self) -> Vec<u8> {
        self.buf.data.clone()
    }

    /// Returns true if any pixel in the current buffer has alpha < 255.
    pub fn has_transparency(&self) -> bool {
        self.buf.data.chunks_exact(4).any(|px| px[3] < 255)
    }

    pub fn data_ptr(&self) -> *const u8 {
        self.buf.data.as_ptr()
    }

    pub fn data_len(&self) -> usize {
        self.buf.data.len()
    }

    // ── Zoom ────────────────────────────────────────────────────────────

    pub fn set_zoom(&mut self, z: f64) {
        self.zoom = z.clamp(0.1, 10.0);
    }

    pub fn get_zoom(&self) -> f64 {
        self.zoom
    }

    pub fn adjust_zoom(&mut self, delta: f64) {
        let factor = if delta > 0.0 { 1.1 } else { 1.0 / 1.1 };
        self.zoom = (self.zoom * factor).clamp(0.1, 10.0);
    }

    // ── Stamp tool settings ─────────────────────────────────────────────

    pub fn set_source(&mut self, x: i32, y: i32) {
        self.stamp.set_source(x, y);
    }

    pub fn has_source(&self) -> bool {
        self.stamp.has_source()
    }

    pub fn set_brush_size(&mut self, size: u32) {
        self.stamp.set_brush_size(size);
    }

    pub fn get_brush_size(&self) -> u32 {
        self.stamp.brush_size
    }

    pub fn set_hardness(&mut self, h: f64) {
        self.stamp.set_hardness(h);
    }

    pub fn set_opacity(&mut self, o: f64) {
        self.stamp.set_opacity(o);
    }

    pub fn set_spacing(&mut self, s: f64) {
        self.stamp.set_spacing(s);
    }

    // ── Stroke lifecycle ────────────────────────────────────────────────

    pub fn begin_stroke(&mut self, dest_x: f64, dest_y: f64) {
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        let anns = self.text_annotations.clone();
        let shapes = self.shape_annotations.clone();
        self.stamp.begin_stroke(
            &mut self.buf.data,
            w,
            h,
            &mut self.hist.redo_stack,
            dest_x,
            dest_y,
            anns,
            shapes,
        );
    }

    pub fn continue_stroke(&mut self, dest_x: f64, dest_y: f64) {
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        self.stamp
            .continue_stroke(&mut self.buf.data, w, h, dest_x, dest_y);
    }

    pub fn end_stroke(&mut self) {
        self.stamp
            .end_stroke(&mut self.hist.undo_stack, history::MAX_HISTORY);
    }

    // ── History ─────────────────────────────────────────────────────────

    pub fn undo(&mut self) -> bool {
        let anns = std::mem::take(&mut self.text_annotations);
        let shapes = std::mem::take(&mut self.shape_annotations);
        if let Some((data, w, h, restored_anns, restored_shapes)) =
            self.hist.undo(&self.buf.data, self.buf.width, self.buf.height, anns, shapes)
        {
            self.buf.data = data;
            self.buf.width = w;
            self.buf.height = h;
            self.text_annotations = restored_anns;
            self.shape_annotations = restored_shapes;
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        let anns = std::mem::take(&mut self.text_annotations);
        let shapes = std::mem::take(&mut self.shape_annotations);
        if let Some((data, w, h, restored_anns, restored_shapes)) =
            self.hist.redo(&self.buf.data, self.buf.width, self.buf.height, anns, shapes)
        {
            self.buf.data = data;
            self.buf.width = w;
            self.buf.height = h;
            self.text_annotations = restored_anns;
            self.shape_annotations = restored_shapes;
            true
        } else {
            false
        }
    }

    pub fn undo_count(&self) -> usize {
        self.hist.undo_count()
    }

    pub fn redo_count(&self) -> usize {
        self.hist.redo_count()
    }

    pub fn history_labels(&self) -> String {
        self.hist.labels()
    }

    pub fn jump_to_history(&mut self, target_index: usize) -> bool {
        self.hist.jump_to(
            target_index,
            &mut self.buf.data,
            &mut self.buf.width,
            &mut self.buf.height,
            &mut self.text_annotations,
            &mut self.shape_annotations,
        )
    }

    pub fn delete_history_entry(&mut self, index: usize) -> bool {
        self.hist.delete_entry(index)
    }

    pub fn clear_history(&mut self) {
        self.hist.clear();
    }

    // ── History snapshot serialization (for JS-side persistence) ────────────

    pub fn undo_snapshot_count(&self) -> usize {
        self.hist.undo_stack.len()
    }

    pub fn redo_snapshot_count(&self) -> usize {
        self.hist.redo_stack.len()
    }

    pub fn get_undo_snapshot_png(&self, index: usize) -> Vec<u8> {
        match self.hist.undo_stack.get(index) {
            None => Vec::new(),
            Some(snap) => {
                let tmp = ImageBuffer { width: snap.width, height: snap.height, data: snap.data.clone() };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_undo_snapshot_label(&self, index: usize) -> String {
        self.hist.undo_stack.get(index).map(|s| s.label.clone()).unwrap_or_default()
    }

    pub fn get_redo_snapshot_png(&self, index: usize) -> Vec<u8> {
        match self.hist.redo_stack.get(index) {
            None => Vec::new(),
            Some(snap) => {
                let tmp = ImageBuffer { width: snap.width, height: snap.height, data: snap.data.clone() };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_redo_snapshot_label(&self, index: usize) -> String {
        self.hist.redo_stack.get(index).map(|s| s.label.clone()).unwrap_or_default()
    }

    /// Append a raw-RGBA snapshot to the undo stack (used when restoring a
    /// session). Annotations start empty — the JS side adds them one by one
    /// with `push_annotation_to_undo_snapshot` after this returns.
    pub fn inject_undo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        self.hist.undo_stack.push_back(Snapshot {
            label: label.to_string(),
            data: data.to_vec(),
            width: w,
            height: h,
            annotations: Vec::new(),
            shapes: Vec::new(),
        });
    }

    /// Append a raw-RGBA snapshot to the redo stack (used when restoring a session).
    pub fn inject_redo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        self.hist.redo_stack.push(Snapshot {
            label: label.to_string(),
            data: data.to_vec(),
            width: w,
            height: h,
            annotations: Vec::new(),
            shapes: Vec::new(),
        });
    }

    /// Per-snapshot annotation state as JSON. Mirrors `get_text_annotations`
    /// so JS can read snapshot overlays with the same parser. Used by the
    /// persistence layer for round-trip saves.
    pub fn get_undo_snapshot_annotations(&self, index: usize) -> String {
        match self.hist.undo_stack.get(index) {
            None => String::from("[]"),
            Some(snap) => annotations_to_json(&snap.annotations),
        }
    }

    pub fn get_redo_snapshot_annotations(&self, index: usize) -> String {
        match self.hist.redo_stack.get(index) {
            None => String::from("[]"),
            Some(snap) => annotations_to_json(&snap.annotations),
        }
    }

    /// Push one annotation onto the undo-snapshot at `snap_idx`. The tile is
    /// rebuilt from the config so the persistence layer doesn't have to store
    /// pre-rotated tile bytes. Returns false if the index is out of range.
    pub fn push_annotation_to_undo_snapshot(
        &mut self,
        snap_idx: usize,
        text: &str,
        font_size: f32,
        r: u8, g: u8, b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u8,
    ) -> bool {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id, text, font_size, r, g, b, bold, x, y, rotation_deg,
            background_kind, bg_r, bg_g, bg_b, bg_a,
            bg_padding, bg_corner_radius, bg_tail,
        );
        match self.hist.undo_stack.get_mut(snap_idx) {
            None => false,
            Some(snap) => { snap.annotations.push(ann); true }
        }
    }

    pub fn push_annotation_to_redo_snapshot(
        &mut self,
        snap_idx: usize,
        text: &str,
        font_size: f32,
        r: u8, g: u8, b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u8,
    ) -> bool {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id, text, font_size, r, g, b, bold, x, y, rotation_deg,
            background_kind, bg_r, bg_g, bg_b, bg_a,
            bg_padding, bg_corner_radius, bg_tail,
        );
        match self.hist.redo_stack.get_mut(snap_idx) {
            None => false,
            Some(snap) => { snap.annotations.push(ann); true }
        }
    }

    // ── Codec ───────────────────────────────────────────────────────────

    pub fn export_png(&self) -> Vec<u8> {
        codec::export_png(&self.buf)
    }

    pub fn thumbnail_width(&self, max_px: u32) -> u32 {
        codec::thumb_dims(self.buf.width, self.buf.height, max_px).0
    }

    pub fn thumbnail_height(&self, max_px: u32) -> u32 {
        codec::thumb_dims(self.buf.width, self.buf.height, max_px).1
    }

    pub fn thumbnail_data(&self, max_px: u32) -> Vec<u8> {
        codec::thumbnail_data(&self.buf, max_px).0
    }

    // ── Transforms ──────────────────────────────────────────────────────

    pub fn flip_horizontal(&mut self) {
        self.snap("Flip H");
        let w = self.buf.width as usize;
        let h = self.buf.height as usize;
        transform::flip_horizontal(&mut self.buf.data, w, h);
        if let Some(sx) = self.stamp.source_x {
            self.stamp.source_x = Some(self.buf.width as i32 - 1 - sx);
        }
    }

    pub fn flip_vertical(&mut self) {
        self.snap("Flip V");
        let w = self.buf.width as usize;
        let h = self.buf.height as usize;
        transform::flip_vertical(&mut self.buf.data, w, h);
        if let Some(sy) = self.stamp.source_y {
            self.stamp.source_y = Some(self.buf.height as i32 - 1 - sy);
        }
    }

    pub fn rotate_90_cw(&mut self) {
        self.snap("Rotate 90° CW");
        let (new_data, new_w, new_h) =
            transform::rotate_90_cw(&self.buf.data, self.buf.width as usize, self.buf.height as usize);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn rotate_90_ccw(&mut self) {
        self.snap("Rotate 90° CCW");
        let (new_data, new_w, new_h) =
            transform::rotate_90_ccw(&self.buf.data, self.buf.width as usize, self.buf.height as usize);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.snap("Crop");
        let (new_data, new_w, new_h) =
            transform::crop(&self.buf.data, self.buf.width, self.buf.height, x, y, w, h);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    /// Preview crop overlay in WASM.
    /// Saves a snapshot, applies darkening overlay + dashed border.
    /// Call cancel_crop_preview() or apply_crop_from_preview() when done.
    pub fn preview_crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.snap("Crop Preview");
        transform::apply_crop_overlay(
            &mut self.buf.data,
            self.buf.width,
            self.buf.height,
            x, y, w, h,
            0.5,
        );
        transform::draw_crop_border(
            &mut self.buf.data,
            self.buf.width,
            self.buf.height,
            x, y, w, h,
            [255, 255, 255, 200],
            5,
            5,
        );
    }

    /// Remove the crop preview (undo the snapshot pushed by preview_crop).
    pub fn cancel_crop_preview(&mut self) -> bool {
        self.undo()
    }

    /// Apply crop after preview: undo preview first, then crop for real.
    pub fn apply_crop_from_preview(&mut self, x: u32, y: u32, w: u32, h: u32) {
        let anns = std::mem::take(&mut self.text_annotations);
        let shapes = std::mem::take(&mut self.shape_annotations);
        if let Some((data, bw, bh, restored_anns, restored_shapes)) =
            self.hist.undo(&self.buf.data, self.buf.width, self.buf.height, anns, shapes)
        {
            self.buf.data = data;
            self.buf.width = bw;
            self.buf.height = bh;
            self.text_annotations = restored_anns;
            self.shape_annotations = restored_shapes;
        }
        self.crop(x, y, w, h);
    }

    pub fn copy_region(&self, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
        transform::copy_region(&self.buf.data, self.buf.width as i32, self.buf.height as i32, x, y, w, h)
    }

    pub fn paste_region(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
    ) {
        self.snap("Paste");
        transform::paste_region(
            &mut self.buf.data,
            self.buf.width as i32,
            self.buf.height as i32,
            pixels,
            src_w,
            src_h,
            dest_x,
            dest_y,
        );
    }

    // ── Resize ───────────────────────────────────────────────────────────

    pub fn resize(&mut self, new_w: u32, new_h: u32) {
        self.resize_with_filter(new_w, new_h, 1);
    }

    /// Resize with a selectable resampling filter.
    /// 0 = nearest, 1 = bilinear, 2 = catmull-rom, 3 = lanczos3.
    /// Unknown codes fall back to bilinear.
    pub fn resize_with_filter(&mut self, new_w: u32, new_h: u32, filter: u8) {
        if new_w == 0 || new_h == 0 {
            return;
        }
        self.snap("Resize");
        let resized = match filter {
            0 => transform::resize_nearest(
                &self.buf.data,
                self.buf.width,
                self.buf.height,
                new_w,
                new_h,
            ),
            2 => transform::resize_catmull_rom(
                &self.buf.data,
                self.buf.width,
                self.buf.height,
                new_w,
                new_h,
            ),
            3 => transform::resize_lanczos3(
                &self.buf.data,
                self.buf.width,
                self.buf.height,
                new_w,
                new_h,
            ),
            _ => transform::resize_bilinear(
                &self.buf.data,
                self.buf.width,
                self.buf.height,
                new_w,
                new_h,
            ),
        };
        self.buf.data = resized;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    /// Record a "Compress" entry in the history without changing pixels.
    /// Used when Apply Compression & Resize re-encodes at a new quality or
    /// format but the dimensions are unchanged — the stored file changed, so
    /// the action should appear in the History panel even though undoing it
    /// is a visual no-op.
    pub fn push_compress_marker(&mut self) {
        self.snap("Compress");
    }

    // ── Filters ─────────────────────────────────────────────────────────

    pub fn adjust_brightness(&mut self, delta: f64) {
        self.snap("Brightness");
        filters::adjust_brightness(&mut self.buf.data, delta);
    }

    pub fn adjust_contrast(&mut self, factor: f64) {
        self.snap("Contrast");
        filters::adjust_contrast(&mut self.buf.data, factor);
    }

    // ── Gaussian Blur (WASM) ──────────────────────────────────────
    // Call from JS:  tool.blur_region(cx, cy, brush_radius, intensity)
    // brush_radius = half the brush-size slider value
    // intensity    = the blur-intensity slider value (1..20)
    pub fn blur_region(
        &mut self,
        cx: f64,
        cy: f64,
        brush_radius: f64,
        intensity: u32,
    ) {
        let clamped = intensity.clamp(1, 30);
        // Cache the Gaussian kernel keyed on intensity — a single blur stroke
        // hits this many times per second with the same intensity.
        let needs_rebuild = match &self.blur_kernel_cache {
            Some((cached_i, _)) => *cached_i != clamped,
            None => true,
        };
        if needs_rebuild {
            self.blur_kernel_cache =
                Some((clamped, filters::build_gaussian_kernel(clamped)));
        }
        let kernel = &self.blur_kernel_cache.as_ref().unwrap().1;
        filters::gaussian_blur_region(
            &mut self.buf.data,
            self.buf.width,
            self.buf.height,
            cx,
            cy,
            brush_radius,
            intensity,
            &mut self.blur_scratch_a,
            &mut self.blur_scratch_b,
            kernel,
        );
    }
 
    /// Begin a blur stroke — saves undo snapshot once
    pub fn begin_blur_stroke(&mut self) {
        self.snap("Blur");
    }
 
    // Note: No end_blur_stroke needed — the snapshot is already saved.
    // Just call blur_region() repeatedly during the stroke, then
    // the next begin_blur_stroke() or other action creates a new snapshot.
     // ── Drawing: Arrows ─────────────────────────────────────────
    /// Save undo snapshot before drawing an arrow/shape.
    /// Call once on mousedown, then draw_arrow/draw_shape on mouseup.
    pub fn begin_draw_stroke(&mut self, label: &str) {
        self.snap(label);
    }
 
    /// Draw an arrow onto the image buffer.
    /// style: 0 = single-headed, 1 = double-headed
    /// color_hex: CSS hex like "#ef4444"
    pub fn draw_arrow(
        &mut self,
        from_x: f64, from_y: f64,
        to_x: f64, to_y: f64,
        color_hex: &str,
        stroke_width: f64,
        style: u32,
    ) {
        let color = drawing::parse_hex_color(color_hex);
        drawing::draw_arrow(
            &mut self.buf.data,
            self.buf.width, self.buf.height,
            from_x, from_y, to_x, to_y,
            color, stroke_width, style,
        );
    }
 
    // ── Drawing: Shapes ─────────────────────────────────────────
    /// Draw a shape onto the image buffer.
    /// shape: 0=rect, 1=circle, 2=line
    /// color_hex: CSS hex like "#ef4444"
    pub fn draw_shape(
        &mut self,
        from_x: f64, from_y: f64,
        to_x: f64, to_y: f64,
        shape: u32,
        color_hex: &str,
        stroke_width: f64,
    ) {
        let color = drawing::parse_hex_color(color_hex);
        drawing::draw_shape(
            &mut self.buf.data,
            self.buf.width, self.buf.height,
            from_x, from_y, to_x, to_y,
            shape, color, stroke_width,
        );
    }

    // ── Live shape/arrow annotations (non-destructive, re-selectable) ────
    // These replace the instant-bake draw_shape/draw_arrow path. Shapes live
    // as an overlay (like text) so they can be reselected, moved, restyled,
    // and deleted via the Reselect list until flattened at export.

    pub fn shape_annotation_count(&self) -> usize {
        self.shape_annotations.len()
    }

    /// Add a new shape/arrow annotation. `kind`: 0=rect,1=circle,2=line,
    /// 3=handCircle,4=arrow. Pushes an "Add Shape"/"Add Arrow" snapshot so
    /// undo removes it. Returns the new id.
    pub fn add_shape_annotation(
        &mut self,
        kind: u8,
        x0: f64, y0: f64,
        x1: f64, y1: f64,
        color_hex: &str,
        stroke_width: f64,
        arrow_style: u8,
    ) -> u32 {
        self.snap(if kind == 4 { "Add Arrow" } else { "Add Shape" });
        let c = drawing::parse_hex_color(color_hex);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.shape_annotations.push(ShapeAnnotation {
            id,
            kind,
            x0, y0, x1, y1,
            r: c[0], g: c[1], b: c[2],
            stroke_width,
            arrow_style,
        });
        id
    }

    /// Restore a persisted shape annotation WITHOUT pushing history (used by
    /// the load path — the undo/redo stacks are injected separately). Colour is
    /// passed as raw r,g,b (the persisted JSON stores bytes, not hex). Returns
    /// the new id.
    pub fn restore_shape_annotation(
        &mut self,
        kind: u8,
        x0: f64, y0: f64,
        x1: f64, y1: f64,
        r: u8, g: u8, b: u8,
        stroke_width: f64,
        arrow_style: u8,
    ) -> u32 {
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.shape_annotations.push(ShapeAnnotation {
            id, kind, x0, y0, x1, y1, r, g, b, stroke_width, arrow_style,
        });
        id
    }

    /// Update an existing shape annotation in full (geometry + style). Pushes
    /// an "Edit Shape" snapshot so undo restores the prior values. Used when a
    /// drag/resize or panel restyle of a selected shape is committed.
    pub fn update_shape_annotation(
        &mut self,
        id: u32,
        kind: u8,
        x0: f64, y0: f64,
        x1: f64, y1: f64,
        color_hex: &str,
        stroke_width: f64,
        arrow_style: u8,
    ) -> bool {
        if !self.shape_annotations.iter().any(|s| s.id == id) {
            return false;
        }
        self.snap("Edit Shape");
        let c = drawing::parse_hex_color(color_hex);
        if let Some(s) = self.shape_annotations.iter_mut().find(|s| s.id == id) {
            s.kind = kind;
            s.x0 = x0; s.y0 = y0; s.x1 = x1; s.y1 = y1;
            s.r = c[0]; s.g = c[1]; s.b = c[2];
            s.stroke_width = stroke_width;
            s.arrow_style = arrow_style;
        }
        true
    }

    /// Remove a shape annotation. Pushes a "Delete Shape" snapshot so undo
    /// restores it. Returns true if found.
    pub fn remove_shape_annotation(&mut self, id: u32) -> bool {
        if !self.shape_annotations.iter().any(|s| s.id == id) {
            return false;
        }
        self.snap("Delete Shape");
        self.shape_annotations.retain(|s| s.id != id);
        if self.editing_shape_id == Some(id) {
            self.editing_shape_id = None;
        }
        true
    }

    /// Mark a shape as being edited (suppressed from render so the JS overlay
    /// preview is the only thing drawn). Pass -1 to clear. No history.
    pub fn set_editing_shape(&mut self, id: i32) {
        self.editing_shape_id = if id < 0 { None } else { Some(id as u32) };
    }

    /// JSON dump of all shape annotations (metadata only). Used by the JS
    /// overlay for hit-testing and by the Reselect list.
    pub fn get_shape_annotations(&self) -> String {
        shapes_to_json(&self.shape_annotations)
    }

    /// Hit-test shape annotations against a canvas-space point. Iterates
    /// newest-first (last-added wins). Returns the id, or -1. Lines/arrows use
    /// distance-to-segment; closed shapes use a padded bounding box.
    pub fn shape_annotation_at(&self, x: f64, y: f64) -> i32 {
        for s in self.shape_annotations.iter().rev() {
            let pad = (s.stroke_width * 0.5).max(6.0);
            let hit = if s.kind == 2 || s.kind == 4 {
                // line / arrow → distance to the segment
                point_segment_distance(x, y, s.x0, s.y0, s.x1, s.y1) <= pad + 4.0
            } else {
                // rect / circle / handCircle → padded bounding box
                let minx = s.x0.min(s.x1) - pad;
                let maxx = s.x0.max(s.x1) + pad;
                let miny = s.y0.min(s.y1) - pad;
                let maxy = s.y0.max(s.y1) + pad;
                x >= minx && x <= maxx && y >= miny && y <= maxy
            };
            if hit {
                return s.id as i32;
            }
        }
        -1
    }

    /// Stamp raw RGBA emoji pixels onto the image buffer at (dest_x, dest_y).
    /// The JS side renders the emoji to an OffscreenCanvas, extracts the pixels,
    /// and passes them here for alpha-compositing onto the WASM buffer.
    /// This keeps compositing in Rust (fast) while JS handles text rendering
    /// (which needs browser font/emoji support).
    pub fn stamp_pixels(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
    ) {
        self.snap("Emoji");
        transform::paste_region(
            &mut self.buf.data,
            self.buf.width as i32,
            self.buf.height as i32,
            pixels,
            src_w,
            src_h,
            dest_x,
            dest_y,
        );
    }
    /// Like stamp_pixels but scales the source to `target_size × target_size`
    /// first (bilinear), then composites it centered on (dest_x, dest_y).
    /// Pushes "Red Stamp" to history (not "Emoji").
    pub fn stamp_red(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
        target_size: u32,
    ) {
        self.snap("Red Stamp");
        // Scale stamp to target_size preserving aspect ratio
        let scale = target_size as f64 / src_w.max(src_h) as f64;
        let new_w = ((src_w as f64 * scale).round() as u32).max(1);
        let new_h = ((src_h as f64 * scale).round() as u32).max(1);
        let scaled = transform::resize_bilinear(pixels, src_w, src_h, new_w, new_h);
        // Center on dest
        let cx = dest_x - (new_w as i32 / 2);
        let cy = dest_y - (new_h as i32 / 2);
        transform::paste_region(
            &mut self.buf.data,
            self.buf.width as i32,
            self.buf.height as i32,
            &scaled,
            new_w,
            new_h,
            cx,
            cy,
        );
    }

    /// DEPRECATED: prefer `add_text_annotation` + `flatten_text_annotations`
    /// for the re-editable overlay flow. Kept as a one-shot direct-to-pixels
    /// fallback for callers that don't need re-edit.
    ///
    /// Render text entirely in Rust (Liberation Sans, embedded font) and
    /// composite it onto the image buffer at (dest_x, dest_y).
    /// Replaces the JS OffscreenCanvas → stamp_pixels pipeline for the text tool.
    /// `dest_x/dest_y` is the top-left corner of the unrotated text block.
    /// `angle_deg` rotates the rendered text clockwise (positive) around its centre.
    pub fn commit_text(
        &mut self,
        text: &str,
        font_size: f32,
        r: u8, g: u8, b: u8,
        bold: bool,
        dest_x: i32,
        dest_y: i32,
        angle_deg: f32,
    ) {
        let rendered = crate::text::render_text(text, font_size, r, g, b, bold);
        self.snap("Text");

        if angle_deg.abs() < 0.5 {
            transform::paste_region(
                &mut self.buf.data,
                self.buf.width as i32,
                self.buf.height as i32,
                &rendered.pixels,
                rendered.width,
                rendered.height,
                dest_x,
                dest_y,
            );
        } else {
            // Rotate around the text centre.  CSS rotate() is CW, rotate_pixels is CCW,
            // so negate the angle.
            let cx = dest_x + rendered.width as i32 / 2;
            let cy = dest_y + rendered.height as i32 / 2;
            let rotated = crate::text::rotate_pixels(&rendered.pixels, rendered.width, rendered.height, -angle_deg);
            let paste_x = cx - rotated.width as i32 / 2;
            let paste_y = cy - rotated.height as i32 / 2;
            transform::paste_region(
                &mut self.buf.data,
                self.buf.width as i32,
                self.buf.height as i32,
                &rotated.pixels,
                rotated.width,
                rotated.height,
                paste_x,
                paste_y,
            );
        }
    }

    /// Returns [width, height] in pixels of the text as rendered by `commit_text`,
    /// without modifying the image buffer. Used to size the text-input handle box.
    pub fn measure_text(&self, text: &str, font_size: f32, bold: bool) -> Vec<u32> {
        let (w, h) = crate::text::measure(text, font_size, bold);
        vec![w, h]
    }

    /// Render a stamp label (e.g. "REJECTED") in Rust, scale it to
    /// `target_size`, and composite it centred on (dest_x, dest_y).
    /// Replaces the JS OffscreenCanvas → stamp_red pipeline for red stamps.
    pub fn commit_red_stamp(
        &mut self,
        label: &str,
        r: u8, g: u8, b: u8,
        dest_x: i32,
        dest_y: i32,
        target_size: u32,
    ) {
        let font_size = 48.0f32;
        let rendered = crate::text::render_stamp_label(label, font_size, r, g, b);
        // Scale to target_size preserving aspect ratio
        let scale = target_size as f64 / rendered.width.max(rendered.height) as f64;
        let new_w = ((rendered.width as f64 * scale).round() as u32).max(1);
        let new_h = ((rendered.height as f64 * scale).round() as u32).max(1);
        let scaled = transform::resize_bilinear(&rendered.pixels, rendered.width, rendered.height, new_w, new_h);
        self.snap("Red Stamp");
        transform::paste_region(
            &mut self.buf.data,
            self.buf.width as i32,
            self.buf.height as i32,
            &scaled,
            new_w,
            new_h,
            dest_x - new_w as i32 / 2,
            dest_y - new_h as i32 / 2,
        );
    }

    // ── Paint / Brush Tool ──────────────────────────────────────

    pub fn paint_begin(&mut self) {
        self.snap("Paint");
    }

    pub fn paint_dab(
        &mut self,
        cx: f64, cy: f64, radius: f64,
        r: u8, g: u8, b: u8, opacity: f64,
    ) {
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        let data = &mut self.buf.data;
        let brush_alpha = opacity.clamp(0.0, 1.0) as f32;
        let r_f32 = radius as f32;
        let r_sq = r_f32 * r_f32;
        let min_x = ((cx - radius).floor() as i32).max(0);
        let max_x = ((cx + radius).ceil() as i32).min(w - 1);
        let min_y = ((cy - radius).floor() as i32).max(0);
        let max_y = ((cy + radius).ceil() as i32).min(h - 1);

        // Hoisted invariants: hardened-zone radius² (no sqrt/falloff inside)
        // and channel locals for the source brush colour.
        let inv_radius = if r_f32 > 0.0 { 1.0_f32 / r_f32 } else { 1.0 };
        let hard_r = r_f32 * 0.7;
        let hard_r_sq = hard_r * hard_r;
        let sr = r as f32 / 255.0;
        let sg = g as f32 / 255.0;
        let sb = b as f32 / 255.0;
        let cx_f32 = cx as f32;
        let cy_f32 = cy as f32;

        for py in min_y..=max_y {
            for px in min_x..=max_x {
                let dx = px as f32 - cx_f32;
                let dy = py as f32 - cy_f32;
                let dist_sq = dx * dx + dy * dy;
                if dist_sq > r_sq { continue; }
                let edge = if r_f32 > 1.0 {
                    if dist_sq <= hard_r_sq {
                        1.0
                    } else {
                        let norm = dist_sq.sqrt() * inv_radius;
                        let t = (norm - 0.7) / 0.3;
                        (1.0 - t * t).max(0.0)
                    }
                } else { 1.0 };
                let sa = brush_alpha * edge;
                let idx = ((py * w + px) * 4) as usize;
                if idx + 3 >= data.len() { continue; }
                // Porter-Duff source-over
                let da = data[idx + 3] as f32 / 255.0;
                let out_a = sa + da * (1.0 - sa);
                data[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
                if out_a > 1e-6 {
                    let src_rgb = [sr, sg, sb];
                    for c in 0..3usize {
                        let dv = data[idx + c] as f32 / 255.0;
                        let ov = (src_rgb[c] * sa + dv * da * (1.0 - sa)) / out_a;
                        data[idx + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                    }
                }
            }
        }
    }

    pub fn paint_stroke_to(
        &mut self,
        x0: f64, y0: f64, x1: f64, y1: f64,
        radius: f64, r: u8, g: u8, b: u8, opacity: f64,
    ) {
        let dx = x1 - x0;
        let dy = y1 - y0;
        let dist = (dx * dx + dy * dy).sqrt();
        let step = (radius * 0.25).max(1.0);
        let steps = (dist / step).ceil() as u32;
        for i in 0..=steps {
            let t = if steps == 0 { 1.0 } else { i as f64 / steps as f64 };
            self.paint_dab(x0 + dx * t, y0 + dy * t, radius, r, g, b, opacity);
        }
    }

    // ── Color picker helpers ─────────────────────────────────────────────

    /// Returns [r, g, b, a] for the pixel at (x, y), clamped to image bounds.
    pub fn get_pixel(&self, x: i32, y: i32) -> Vec<u8> {
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        if w == 0 || h == 0 || x < 0 || y < 0 || x >= w || y >= h {
            return vec![0, 0, 0, 255];
        }
        let idx = (y as usize * self.buf.width as usize + x as usize) * 4;
        self.buf.data[idx..idx + 4].to_vec()
    }

    /// Returns a flat RGBA grid of (2*radius+1)² pixels centred on (cx, cy).
    /// Out-of-bounds pixels are returned as opaque black.
    pub fn get_pixel_region(&self, cx: i32, cy: i32, radius: i32) -> Vec<u8> {
        let side = 2 * radius + 1;
        let mut out = Vec::with_capacity((side * side * 4) as usize);
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        for row in 0..side {
            for col in 0..side {
                let px = cx - radius + col;
                let py = cy - radius + row;
                if w == 0 || h == 0 || px < 0 || py < 0 || px >= w || py >= h {
                    out.extend_from_slice(&[0, 0, 0, 255]);
                } else {
                    let idx = (py as usize * self.buf.width as usize + px as usize) * 4;
                    out.extend_from_slice(&self.buf.data[idx..idx + 4]);
                }
            }
        }
        out
    }

    // ── Live text annotations (non-destructive overlay) ─────────────────
    // Annotations live as Rust state, get composited onto the buffer for
    // display via `render_with_annotations`, and are burnt into pixels
    // (one history snapshot) by `flatten_text_annotations` before export.

    /// Number of live (uncommitted) text annotations. Cheap getter so JS
    /// can decide whether to do the overlay-aware flush.
    pub fn text_annotation_count(&self) -> usize {
        self.text_annotations.len()
    }

    /// Add a new text annotation. Pre-renders the rotated tile, stores it,
    /// returns the new annotation's id. Pushes an "Add Text" history snapshot
    /// so undo restores the state with this annotation absent.
    pub fn add_text_annotation(
        &mut self,
        text: &str,
        font_size: f32,
        r: u8, g: u8, b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u8,
    ) -> u32 {
        self.snap("Add Text");
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id, text, font_size, r, g, b, bold, x, y, rotation_deg,
            background_kind, bg_r, bg_g, bg_b, bg_a,
            bg_padding, bg_corner_radius, bg_tail,
        );
        self.text_annotations.push(ann);
        id
    }

    /// Update an existing annotation in place. Returns true if found.
    /// Pushes an "Edit Text" history snapshot so undo restores prior values.
    pub fn update_text_annotation(
        &mut self,
        id: u32,
        text: &str,
        font_size: f32,
        r: u8, g: u8, b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8, bg_g: u8, bg_b: u8, bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u8,
    ) -> bool {
        let Some(idx) = self.text_annotations.iter().position(|a| a.id == id) else {
            return false;
        };
        self.snap("Edit Text");
        let (tile_pixels, tile_w, tile_h, tile_offset_x, tile_offset_y) =
            build_annotation_tile(
                text, font_size, r, g, b, bold, rotation_deg,
                background_kind,
                bg_r, bg_g, bg_b, bg_a,
                bg_padding, bg_corner_radius, bg_tail,
            );
        let a = &mut self.text_annotations[idx];
        a.text = text.to_string();
        a.font_size = font_size;
        a.r = r; a.g = g; a.b = b;
        a.bold = bold;
        a.x = x; a.y = y;
        a.rotation_deg = rotation_deg;
        a.tile_pixels = std::sync::Arc::new(tile_pixels);
        a.tile_w = tile_w;
        a.tile_h = tile_h;
        a.tile_offset_x = tile_offset_x;
        a.tile_offset_y = tile_offset_y;
        a.background_kind = background_kind;
        a.bg_r = bg_r; a.bg_g = bg_g; a.bg_b = bg_b; a.bg_a = bg_a;
        a.bg_padding = bg_padding;
        a.bg_corner_radius = bg_corner_radius;
        a.bg_tail = bg_tail;
        true
    }

    /// Remove an annotation. Returns true if found. Pushes a "Delete Text"
    /// history snapshot so undo restores the removed annotation.
    pub fn remove_text_annotation(&mut self, id: u32) -> bool {
        if !self.text_annotations.iter().any(|a| a.id == id) {
            return false;
        }
        self.snap("Delete Text");
        self.text_annotations.retain(|a| a.id != id);
        true
    }

    /// JSON dump of all annotations (metadata only — tile pixels stay in
    /// Rust). Used by the JS overlay for hit-testing bounds and by
    /// editPersistence for round-tripping across photo switches.
    pub fn get_text_annotations(&self) -> String {
        annotations_to_json(&self.text_annotations)
    }

    /// Hit-test annotations against a canvas-space point. Iterates
    /// newest-first (last-added wins on overlap). Returns the id, or -1.
    /// (Sentinel -1 is used because wasm-bindgen Option support is uneven.)
    pub fn text_annotation_at(&self, x: i32, y: i32) -> i32 {
        for a in self.text_annotations.iter().rev() {
            let tx = a.x + a.tile_offset_x;
            let ty = a.y + a.tile_offset_y;
            if x >= tx && y >= ty
                && x < tx + a.tile_w as i32
                && y < ty + a.tile_h as i32
            {
                return a.id as i32;
            }
        }
        -1
    }

    /// Returns the main buffer with all annotation overlays composited on top:
    /// shapes/arrows first, then text tiles. The shape currently being edited
    /// (if any) is skipped so the JS overlay preview is the only thing drawn
    /// for it. Used by the display canvas blit so on-screen matches export.
    pub fn render_with_annotations(&self) -> Vec<u8> {
        if self.text_annotations.is_empty() && self.shape_annotations.is_empty() {
            return self.buf.data.clone();
        }
        let mut out = self.buf.data.clone();
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        // Shapes underneath.
        for s in &self.shape_annotations {
            if self.editing_shape_id == Some(s.id) { continue; }
            render_shape_into(&mut out, self.buf.width, self.buf.height, s);
        }
        // Text on top.
        for a in &self.text_annotations {
            transform::paste_region(
                &mut out,
                w, h,
                a.tile_pixels.as_ref(),
                a.tile_w, a.tile_h,
                a.x + a.tile_offset_x,
                a.y + a.tile_offset_y,
            );
        }
        out
    }

    /// Burn all overlays (shapes + text) into the main buffer with a single
    /// history snapshot, then clear both overlay lists. Used at export time
    /// and when the user explicitly wants to flatten.
    pub fn flatten_text_annotations(&mut self) {
        if self.text_annotations.is_empty() && self.shape_annotations.is_empty() {
            return;
        }
        self.snap("Flatten");
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        // Shapes first (underneath the text), then text tiles on top.
        let shapes = std::mem::take(&mut self.shape_annotations);
        for s in &shapes {
            render_shape_into(&mut self.buf.data, self.buf.width, self.buf.height, s);
        }
        // Drain so we move tile pixels rather than cloning per annotation.
        let anns = std::mem::take(&mut self.text_annotations);
        for a in &anns {
            transform::paste_region(
                &mut self.buf.data,
                w, h,
                a.tile_pixels.as_ref(),
                a.tile_w, a.tile_h,
                a.x + a.tile_offset_x,
                a.y + a.tile_offset_y,
            );
        }
        self.editing_shape_id = None;
    }
}

/// Stateless: composite `src` onto a copy of `target` at (dx, dy) with `opacity` (0.0..=1.0).
/// Returns the new buffer. Used by the bulk-logo feature to stamp a logo onto many photos
/// without disturbing the active canvas state.
///
/// `target` is `tw*th*4` RGBA bytes, `src` is `sw*sh*4` RGBA bytes. If lengths don't match,
/// `target` is returned unchanged.
#[wasm_bindgen]
pub fn composite_pixels(
    target: &[u8],
    tw: u32,
    th: u32,
    src: &[u8],
    sw: u32,
    sh: u32,
    dx: i32,
    dy: i32,
    opacity: f64,
) -> Vec<u8> {
    let expected_target = (tw as usize) * (th as usize) * 4;
    let expected_src = (sw as usize) * (sh as usize) * 4;
    if target.len() != expected_target {
        return target.to_vec();
    }
    let mut out = target.to_vec();
    if src.len() != expected_src {
        return out;
    }
    let op = opacity.clamp(0.0, 1.0);
    if (op - 1.0).abs() < 1e-6 {
        transform::paste_region(&mut out, tw as i32, th as i32, src, sw, sh, dx, dy);
    } else if op > 0.0 {
        // Pre-scale src alpha by opacity so paste_region's alpha-compositing applies it.
        let mut scaled = src.to_vec();
        let mut i = 3;
        while i < scaled.len() {
            scaled[i] = ((scaled[i] as f64) * op).round().clamp(0.0, 255.0) as u8;
            i += 4;
        }
        transform::paste_region(&mut out, tw as i32, th as i32, &scaled, sw, sh, dx, dy);
    }
    out
}

/// Stateless bilinear resize of an RGBA buffer. Used by the batch-logo feature
/// to scale logos to a target width without round-tripping through OffscreenCanvas.
#[wasm_bindgen]
pub fn resize_pixels(
    pixels: &[u8],
    old_w: u32,
    old_h: u32,
    new_w: u32,
    new_h: u32,
) -> Vec<u8> {
    transform::resize_bilinear(pixels, old_w, old_h, new_w, new_h)
}

/// Stateless: encode an RGBA pixel buffer as PNG bytes. Used by the batch-logo
/// feature to skip the `OffscreenCanvas` → `convertToBlob` round-trip when
/// persisting composited photos.
#[wasm_bindgen]
pub fn encode_png_pixels(pixels: &[u8], width: u32, height: u32) -> Vec<u8> {
    let tmp = crate::core::ImageBuffer {
        width,
        height,
        data: pixels.to_vec(),
    };
    codec::export_png(&tmp)
}

/// Parse a CSS-ish color string into RGBA bytes. Accepts:
///   #rgb, #rgba, #rrggbb, #rrggbbaa
///   rgb(r, g, b)       — components 0–255 or 0–255 (no percentages)
///   rgba(r, g, b, a)   — alpha is 0.0–1.0 OR 0–255 (we sniff which)
///
/// Returns a 4-byte `Vec<u8>` `[r, g, b, a]` on success, or an empty vec on
/// any parse failure. Used by the color-swatch picker so the JS side doesn't
/// have to maintain its own regex.
#[wasm_bindgen]
pub fn parse_color(input: &str) -> Vec<u8> {
    let s = input.trim();
    if s.is_empty() {
        return Vec::new();
    }

    // ── Hex ────────────────────────────────────────────────────────────
    if let Some(hex) = s.strip_prefix('#') {
        return parse_hex(hex).map(|c| c.to_vec()).unwrap_or_default();
    }

    // ── Functional notation: rgb(...) / rgba(...) ──────────────────────
    let lower = s.to_ascii_lowercase();
    let (has_alpha, body) = if let Some(rest) = lower.strip_prefix("rgba(") {
        (true, rest)
    } else if let Some(rest) = lower.strip_prefix("rgb(") {
        (false, rest)
    } else {
        return Vec::new();
    };
    let Some(body) = body.strip_suffix(')') else {
        return Vec::new();
    };

    // Allow comma OR whitespace separators (CSS Color 4); split on either.
    let parts: Vec<&str> = body
        .split(|c: char| c == ',' || c == '/' || c.is_whitespace())
        .filter(|p| !p.is_empty())
        .collect();

    let expected = if has_alpha { 4 } else { 3 };
    if parts.len() != expected {
        return Vec::new();
    }

    let r = parse_component(parts[0]);
    let g = parse_component(parts[1]);
    let b = parse_component(parts[2]);
    let a = if has_alpha {
        parse_alpha(parts[3])
    } else {
        Some(255u8)
    };
    match (r, g, b, a) {
        (Some(r), Some(g), Some(b), Some(a)) => vec![r, g, b, a],
        _ => Vec::new(),
    }
}

/// Parse a hex string (no leading `#`). Returns `[r,g,b,a]` on success.
fn parse_hex(hex: &str) -> Option<[u8; 4]> {
    fn h(c: u8) -> Option<u8> {
        match c {
            b'0'..=b'9' => Some(c - b'0'),
            b'a'..=b'f' => Some(c - b'a' + 10),
            b'A'..=b'F' => Some(c - b'A' + 10),
            _ => None,
        }
    }
    let bytes = hex.as_bytes();
    match bytes.len() {
        3 => {
            let r = h(bytes[0])?;
            let g = h(bytes[1])?;
            let b = h(bytes[2])?;
            Some([r * 17, g * 17, b * 17, 255])
        }
        4 => {
            let r = h(bytes[0])?;
            let g = h(bytes[1])?;
            let b = h(bytes[2])?;
            let a = h(bytes[3])?;
            Some([r * 17, g * 17, b * 17, a * 17])
        }
        6 => {
            let r = (h(bytes[0])? << 4) | h(bytes[1])?;
            let g = (h(bytes[2])? << 4) | h(bytes[3])?;
            let b = (h(bytes[4])? << 4) | h(bytes[5])?;
            Some([r, g, b, 255])
        }
        8 => {
            let r = (h(bytes[0])? << 4) | h(bytes[1])?;
            let g = (h(bytes[2])? << 4) | h(bytes[3])?;
            let b = (h(bytes[4])? << 4) | h(bytes[5])?;
            let a = (h(bytes[6])? << 4) | h(bytes[7])?;
            Some([r, g, b, a])
        }
        _ => None,
    }
}

/// 0–255 integer, with optional trailing `%` (0–100).
fn parse_component(s: &str) -> Option<u8> {
    let s = s.trim();
    if let Some(pct) = s.strip_suffix('%') {
        let v: f32 = pct.trim().parse().ok()?;
        if !(0.0..=100.0).contains(&v) {
            return None;
        }
        Some((v * 2.55).round().clamp(0.0, 255.0) as u8)
    } else {
        let v: f32 = s.parse().ok()?;
        if !(0.0..=255.0).contains(&v) {
            return None;
        }
        Some(v.round().clamp(0.0, 255.0) as u8)
    }
}

/// Alpha: 0.0–1.0 OR 0–255 (sniffed by `>1`) OR `N%` (0–100).
fn parse_alpha(s: &str) -> Option<u8> {
    let s = s.trim();
    if let Some(pct) = s.strip_suffix('%') {
        let v: f32 = pct.trim().parse().ok()?;
        if !(0.0..=100.0).contains(&v) {
            return None;
        }
        return Some((v * 2.55).round().clamp(0.0, 255.0) as u8);
    }
    let v: f32 = s.parse().ok()?;
    if v < 0.0 {
        return None;
    }
    if v <= 1.0 {
        Some((v * 255.0).round().clamp(0.0, 255.0) as u8)
    } else if v <= 255.0 {
        Some(v.round() as u8)
    } else {
        None
    }
}

/// Snap a free drag to a locked aspect ratio. The user starts a drag at
/// (`start_x`, `start_y`) and the cursor is currently at (`end_x`, `end_y`);
/// this returns the rect that respects `ratio_w` : `ratio_h`, anchored at
/// the start corner and growing toward the cursor's quadrant. The longer
/// drag axis "leads" — the perpendicular axis is sized to match the ratio,
/// so the box always reaches at least as far as the cursor in the leading
/// direction. The result is clipped to the image bounds. Returns
/// `[x, y, w, h]` as a `Uint32Array`, or an empty array on invalid input.
#[wasm_bindgen]
pub fn constrain_crop_to_ratio(
    start_x: i32,
    start_y: i32,
    end_x: i32,
    end_y: i32,
    ratio_w: u32,
    ratio_h: u32,
    image_w: u32,
    image_h: u32,
) -> Vec<u32> {
    if ratio_w == 0 || ratio_h == 0 || image_w == 0 || image_h == 0 {
        return Vec::new();
    }
    let r = ratio_w as f64 / ratio_h as f64;
    // Signed deltas tell us which quadrant the cursor's in.
    let dx = (end_x - start_x) as f64;
    let dy = (end_y - start_y) as f64;
    let sign_x = if dx < 0.0 { -1.0 } else { 1.0 };
    let sign_y = if dy < 0.0 { -1.0 } else { 1.0 };
    let adx = dx.abs();
    let ady = dy.abs();

    // Pick the leading axis: whichever produces the larger ratio-matched
    // rect. |dx|/|dy| > r → width is the binding constraint; else height.
    let (mut w, mut h) = if ady == 0.0 || (adx / ady.max(1e-9)) > r {
        (adx, adx / r)
    } else {
        (ady * r, ady)
    };
    if w < 1.0 || h < 1.0 {
        return vec![start_x.max(0) as u32, start_y.max(0) as u32, 1, 1];
    }

    // Anchor at start, extend in cursor's direction.
    let mut x0 = start_x as f64;
    let mut y0 = start_y as f64;
    if sign_x < 0.0 { x0 -= w; }
    if sign_y < 0.0 { y0 -= h; }

    // Clip to image: if the rect runs off the edge, scale uniformly so the
    // ratio is preserved instead of letting one side get cut.
    let iw = image_w as f64;
    let ih = image_h as f64;
    // Recompute fully-clipped bounds with ratio preservation.
    let max_x = if sign_x >= 0.0 { iw - x0 } else { x0 + w };
    let max_y = if sign_y >= 0.0 { ih - y0 } else { y0 + h };
    let avail_w = max_x.min(iw).max(0.0);
    let avail_h = max_y.min(ih).max(0.0);
    if w > avail_w {
        let scale = avail_w / w;
        w *= scale;
        h *= scale;
        if sign_x < 0.0 { x0 = start_x as f64 - w; }
    }
    if h > avail_h {
        let scale = avail_h / h;
        w *= scale;
        h *= scale;
        if sign_y < 0.0 { y0 = start_y as f64 - h; }
    }
    // Final hard clamp (handles negative start positions).
    let x = x0.max(0.0).min(iw - 1.0);
    let y = y0.max(0.0).min(ih - 1.0);
    let w_u = w.floor().clamp(1.0, iw - x) as u32;
    let h_u = h.floor().clamp(1.0, ih - y) as u32;
    vec![x as u32, y as u32, w_u, h_u]
}

/// Compute the largest centred rectangle with the given aspect ratio that
/// fits inside an `image_w` × `image_h` image. Used by the Crop tool's
/// ratio buttons (1:1, 4:3, 16:9, …) so the JS side doesn't reinvent the
/// math. Returns `[x, y, w, h]` as a `Uint32Array`. Any non-positive input
/// returns an empty array.
#[wasm_bindgen]
pub fn compute_aspect_crop(
    image_w: u32,
    image_h: u32,
    ratio_w: u32,
    ratio_h: u32,
) -> Vec<u32> {
    if image_w == 0 || image_h == 0 || ratio_w == 0 || ratio_h == 0 {
        return Vec::new();
    }
    let iw = image_w as f64;
    let ih = image_h as f64;
    let r = ratio_w as f64 / ratio_h as f64;
    let image_r = iw / ih;
    let (cw, ch) = if r > image_r {
        // Ratio wider than image → bounded by image width
        (iw, iw / r)
    } else {
        // Ratio taller or equal → bounded by image height
        (ih * r, ih)
    };
    let cw_u = cw.floor().clamp(1.0, iw) as u32;
    let ch_u = ch.floor().clamp(1.0, ih) as u32;
    let x = (image_w - cw_u) / 2;
    let y = (image_h - ch_u) / 2;
    vec![x, y, cw_u, ch_u]
}