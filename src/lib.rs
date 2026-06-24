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
mod settings;
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

/// Build a solid-color RGBA image and return it PNG-encoded.
///
/// Backs the upload dialog's "Blank Canvas" action so the blank surface is
/// produced entirely in Rust — no JS `<canvas>` allocation or `toBlob`
/// encode/decode round-trip. `r`/`g`/`b`/`a` are all `0..=255`; pass `a = 0`
/// for a fully transparent drawing surface, `a = 255` for an opaque fill.
#[wasm_bindgen]
pub fn blank_png(width: u32, height: u32, r: u8, g: u8, b: u8, a: u8) -> Vec<u8> {
    let px = (width as usize).saturating_mul(height as usize);
    let mut data = Vec::with_capacity(px.saturating_mul(4));
    for _ in 0..px {
        data.extend_from_slice(&[r, g, b, a]);
    }
    codec::export_png(&ImageBuffer {
        width,
        height,
        data,
    })
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
    pub bg_tail: u32,          // speech-bubble tail angle in degrees (0-359, CW from +x / east); only used when background_kind == 2
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
#[derive(Clone, Default)]
pub struct ShapeAnnotation {
    pub id: u32,
    /// 0=rect, 1=circle, 2=line, 3=handCircle, 4=arrow, 5=pin, 6=polyline,
    /// 7=bezier (cubic pen path; `points` holds the flat control sequence).
    pub kind: u8,
    pub x0: f64, pub y0: f64,   // start point / bbox corner (canvas coords)
    pub x1: f64, pub y1: f64,   // end point / opposite bbox corner
    pub r: u8, pub g: u8, pub b: u8,
    pub stroke_width: f64,
    /// Arrows only: 0=single-headed, 1=double-headed. Ignored for shapes.
    pub arrow_style: u8,
    /// Numbered callout pins (kind 5): the 1-based sequence index. 0 otherwise.
    pub number: u32,
    /// Pin label style (kind 5): 0 = number (1, 2, 3…), 1 = letter (A, B, C…).
    pub label_kind: u8,
    /// Freehand/polyline pens (kind 6): the vertex list. Empty otherwise. The
    /// bbox (x0,y0,x1,y1) is derived from these for hit-test / Reselect.
    pub points: Vec<(f64, f64)>,
    /// Interior fill: 0 = none, 1 = solid, 2 = linear gradient. Honoured only
    /// for rect (0) and circle (1); ignored for line/arrow/pin/polyline. The
    /// fill is painted BEFORE the stroke so the outline sits on top.
    pub fill_kind: u8,
    /// Solid fill colour, or gradient stop 0 (RGBA, straight alpha).
    pub fill_r: u8, pub fill_g: u8, pub fill_b: u8, pub fill_a: u8,
    /// Gradient stop 1 (RGBA). Used only when `fill_kind == 2`.
    pub fill2_r: u8, pub fill2_g: u8, pub fill2_b: u8, pub fill2_a: u8,
    /// Linear-gradient direction in degrees (0 = →, 90 = ↓, …). `fill_kind == 2`.
    pub fill_angle: u16,
    /// Mosaic block size in px for `fill_kind == 3` (pixelate). 0 → default 16.
    pub fill_block: u32,
}

/// A single Photoshop-style layer: an independent RGBA pixel buffer plus its
/// own live (non-destructive) text and shape annotations. Layers share the
/// canvas dimensions held on `ImageHorseTool`. The display canvas is the
/// composite of every visible layer, bottom → top, each blended source-over
/// scaled by `opacity`.
///
/// `Clone` is derived so each history snapshot can carry an independent copy of
/// the whole stack (undo/redo restores layer structure, pixels and overlays).
#[derive(Clone)]
pub struct Layer {
    pub id: u32,
    pub name: String,
    pub visible: bool,
    pub opacity: f64, // 0.0..=1.0
    pub buf: ImageBuffer,
    pub text_annotations: Vec<TextAnnotation>,
    pub shape_annotations: Vec<ShapeAnnotation>,
}

impl Layer {
    fn new(id: u32, name: String, width: u32, height: u32) -> Self {
        Layer {
            id,
            name,
            visible: true,
            opacity: 1.0,
            buf: ImageBuffer::new(width, height),
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        }
    }
}

#[wasm_bindgen]
pub struct ImageHorseTool {
    /// Layer stack, bottom (index 0) → top (last). Always non-empty.
    layers: Vec<Layer>,
    /// Index of the active layer in `layers` — receives all tool edits.
    active: usize,
    next_layer_id: u32,
    /// Canvas dimensions, shared by every layer.
    width: u32,
    height: u32,
    /// Cached composite of all visible layers; `data_ptr`/`data_len` expose
    /// this to JS for a zero-copy blit. Rebuilt by `recomposite()`.
    composite_cache: Vec<u8>,
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
    next_text_id: u32,
    next_shape_id: u32,
    /// When a shape is being edited via the JS Figma-style overlay, it is
    /// suppressed from the composite so the live preview doesn't double up with
    /// the committed pixels. `None` when nothing is editing.
    editing_shape_id: Option<u32>,
    /// Same idea for text: while a text annotation is open in the JS textarea
    /// overlay, suppress its baked tile from the composite so the user sees only
    /// the live overlay (not a doubled copy underneath). `None` when idle.
    editing_text_id: Option<u32>,
    /// Paint stroke-stabilizer trailing tip ("lazy mouse"). Set on stroke start;
    /// advances toward the cursor only when it pulls past the leash. `None` when
    /// no stabilized stroke is active.
    paint_stab_tip: Option<(f64, f64)>,
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
    bg_tail: u32,
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
        let mut pts = String::from("[");
        for (j, (x, y)) in s.points.iter().enumerate() {
            if j > 0 { pts.push(','); }
            pts.push_str(&format!("[{},{}]", x, y));
        }
        pts.push(']');
        out.push_str(&format!(
            "{{\"id\":{},\"kind\":{},\"x0\":{},\"y0\":{},\"x1\":{},\"y1\":{},\"r\":{},\"g\":{},\"b\":{},\"stroke_width\":{},\"arrow_style\":{},\"number\":{},\"label_kind\":{},\"fill_kind\":{},\"fill_r\":{},\"fill_g\":{},\"fill_b\":{},\"fill_a\":{},\"fill2_r\":{},\"fill2_g\":{},\"fill2_b\":{},\"fill2_a\":{},\"fill_angle\":{},\"fill_block\":{},\"points\":{}}}",
            s.id, s.kind,
            s.x0, s.y0, s.x1, s.y1,
            s.r, s.g, s.b,
            s.stroke_width,
            s.arrow_style,
            s.number,
            s.label_kind,
            s.fill_kind,
            s.fill_r, s.fill_g, s.fill_b, s.fill_a,
            s.fill2_r, s.fill2_g, s.fill2_b, s.fill2_a,
            s.fill_angle,
            s.fill_block,
            pts,
        ));
    }
    out.push(']');
    out
}

/// Flat [x0,y0,x1,y1,…] → Vec<(x,y)>.
fn flat_to_points(flat: &[f64]) -> Vec<(f64, f64)> {
    flat.chunks_exact(2).map(|c| (c[0], c[1])).collect()
}

/// Axis-aligned bounding box of a point list as (minx,miny,maxx,maxy).
fn points_bbox(pts: &[(f64, f64)]) -> (f64, f64, f64, f64) {
    if pts.is_empty() {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let (mut minx, mut miny) = pts[0];
    let (mut maxx, mut maxy) = pts[0];
    for &(x, y) in pts {
        minx = minx.min(x); maxx = maxx.max(x);
        miny = miny.min(y); maxy = maxy.max(y);
    }
    (minx, miny, maxx, maxy)
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
    // Interior fill (rect=0, circle=1 only), painted BEFORE the stroke so the
    // outline sits on top. fill_kind: 1 = solid, 2 = linear gradient.
    if (s.kind == 0 || s.kind == 1) && s.fill_kind != 0 {
        crate::drawing::fill_shape(
            data, w, h, s.kind,
            s.x0, s.y0, s.x1, s.y1,
            s.fill_kind,
            [s.fill_r, s.fill_g, s.fill_b, s.fill_a],
            [s.fill2_r, s.fill2_g, s.fill2_b, s.fill2_a],
            s.fill_angle,
            s.fill_block,
        );
    }
    match s.kind {
        4 => crate::drawing::draw_arrow(
            data, w, h,
            s.x0, s.y0, s.x1, s.y1,
            color, s.stroke_width, s.arrow_style as u32,
        ),
        5 => render_pin(data, w, h, s),
        6 => crate::drawing::draw_polyline(data, w, h, &s.points, color, s.stroke_width),
        7 => {
            let pts = crate::drawing::flatten_cubic_path(&s.points);
            if s.fill_kind != 0 {
                crate::drawing::fill_polygon(
                    data, w, h, &pts,
                    [s.fill_r, s.fill_g, s.fill_b, s.fill_a],
                );
            }
            crate::drawing::draw_polyline(data, w, h, &pts, color, s.stroke_width);
        }
        _ => crate::drawing::draw_shape(
            data, w, h,
            s.x0, s.y0, s.x1, s.y1,
            s.kind as u32, color, s.stroke_width,
        ),
    }
}

/// A pin's drawn label: `number` as a digit string (kind 0) or as a
/// spreadsheet-style letter sequence (kind 1): 1→A … 26→Z, 27→AA, 28→AB…
fn pin_label(number: u32, label_kind: u8) -> String {
    if label_kind != 1 {
        return number.to_string();
    }
    if number == 0 {
        return "?".to_string();
    }
    let mut n = number;
    let mut chars = Vec::new();
    while n > 0 {
        n -= 1;
        chars.push((b'A' + (n % 26) as u8) as char);
        n /= 26;
    }
    chars.iter().rev().collect()
}

/// Tight ink bounding box (min_x, min_y, max_x, max_y inclusive) of a rendered
/// RGBA tile — the extent of pixels with non-trivial alpha. Used to centre a
/// glyph by its *visual* mass rather than its padded line box, so a single
/// digit or letter lands dead-centre on the pin disc.
fn ink_bounds(pixels: &[u8], w: u32, h: u32) -> Option<(u32, u32, u32, u32)> {
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (w, h, 0u32, 0u32);
    let mut found = false;
    for y in 0..h {
        for x in 0..w {
            let a = pixels[((y * w + x) * 4 + 3) as usize];
            if a > 16 {
                found = true;
                if x < min_x { min_x = x; }
                if y < min_y { min_y = y; }
                if x > max_x { max_x = x; }
                if y > max_y { max_y = y; }
            }
        }
    }
    if found { Some((min_x, min_y, max_x, max_y)) } else { None }
}

/// Render a callout pin: a filled disc (from the bbox) with its label —
/// a number (1, 2, 3…) or a letter (A, B, C…) — centred on it in a
/// contrasting colour.
fn render_pin(data: &mut [u8], w: u32, h: u32, s: &ShapeAnnotation) {
    let cx = (s.x0 + s.x1) * 0.5;
    let cy = (s.y0 + s.y1) * 0.5;
    let radius = (s.x1 - s.x0).abs().min((s.y1 - s.y0).abs()) * 0.5;
    if radius < 1.0 { return; }
    crate::drawing::fill_circle(data, w, h, cx, cy, radius, [s.r, s.g, s.b, 255]);

    // Black or white label depending on fill luminance.
    let lum = 0.299 * s.r as f64 + 0.587 * s.g as f64 + 0.114 * s.b as f64;
    let (nr, ng, nb) = if lum > 140.0 { (20u8, 20u8, 20u8) } else { (255u8, 255u8, 255u8) };
    let label = pin_label(s.number, s.label_kind);
    // Shrink multi-character labels ("10", "AA") so they stay inside the disc.
    let chars = label.chars().count().max(1) as f64;
    let font_size = (radius * if chars <= 1.0 { 1.2 } else { 1.9 / chars }).max(9.0) as f32;
    let rendered = crate::text::render_text(&label, font_size, nr, ng, nb, true);
    // Centre by the glyph's visual ink box, not the padded line box, so it sits
    // dead-centre regardless of font ascent/descent padding.
    let (dx, dy) = match ink_bounds(&rendered.pixels, rendered.width, rendered.height) {
        Some((min_x, min_y, max_x, max_y)) => {
            let box_cx = (min_x + max_x + 1) as f64 * 0.5;
            let box_cy = (min_y + max_y + 1) as f64 * 0.5;
            ((cx - box_cx).round() as i32, (cy - box_cy).round() as i32)
        }
        None => (
            (cx - rendered.width as f64 * 0.5).round() as i32,
            (cy - rendered.height as f64 * 0.5).round() as i32,
        ),
    };
    crate::transform::paste_region(
        data, w as i32, h as i32,
        &rendered.pixels, rendered.width, rendered.height,
        dx, dy,
    );
}

impl ImageHorseTool {
    /// Build a history snapshot of the entire current layer stack.
    fn make_snapshot(&self, label: &str) -> Snapshot {
        Snapshot {
            label: label.to_string(),
            layers: self.layers.clone(),
            active: self.active,
            width: self.width,
            height: self.height,
        }
    }

    /// Push a full-stack history snapshot. Every history-creating action
    /// (pixel edits, annotation CRUD, transforms, layer structural ops) records
    /// the whole stack so undo/redo restores layers, pixels and overlays.
    fn snap(&mut self, label: &str) {
        let s = self.make_snapshot(label);
        self.hist.push(s);
    }

    /// Replace the live state with a snapshot's layer stack (used by undo/redo).
    fn restore_snapshot(&mut self, snap: Snapshot) {
        self.layers = snap.layers;
        self.active = snap.active.min(self.layers.len().saturating_sub(1));
        self.width = snap.width;
        self.height = snap.height;
        // Source point may now reference out-of-bounds pixels.
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }
}

/// Render one layer (its pixels with shapes + text overlays composited on top)
/// into a fresh RGBA buffer of `w×h`. The shape being edited (if any) is
/// skipped so the JS overlay preview is the only thing drawn for it.
fn render_layer(
    layer: &Layer,
    w: u32,
    h: u32,
    editing_shape_id: Option<u32>,
    editing_text_id: Option<u32>,
) -> Vec<u8> {
    let mut out = layer.buf.data.clone();
    let wi = w as i32;
    let hi = h as i32;
    // Shapes underneath.
    for s in &layer.shape_annotations {
        if editing_shape_id == Some(s.id) {
            continue;
        }
        render_shape_into(&mut out, w, h, s);
    }
    // Text on top.
    for a in &layer.text_annotations {
        if editing_text_id == Some(a.id) {
            continue;
        }
        crate::transform::paste_region(
            &mut out,
            wi,
            hi,
            a.tile_pixels.as_ref(),
            a.tile_w,
            a.tile_h,
            a.x + a.tile_offset_x,
            a.y + a.tile_offset_y,
        );
    }
    out
}

/// Blend `src` (RGBA, same `w×h` as `dst`) over `dst` source-over, with the
/// source alpha pre-scaled by `opacity` (0.0..=1.0).
fn blend_over(dst: &mut [u8], src: &[u8], opacity: f64) {
    let op = opacity.clamp(0.0, 1.0) as f32;
    if op <= 0.0 {
        return;
    }
    let n = dst.len().min(src.len());
    let mut i = 0;
    while i + 3 < n {
        let sa = src[i + 3] as f32 / 255.0 * op;
        if sa > 0.0 {
            let da = dst[i + 3] as f32 / 255.0;
            let out_a = sa + da * (1.0 - sa);
            if out_a > 1e-6 {
                for c in 0..3 {
                    let sv = src[i + c] as f32 / 255.0;
                    let dv = dst[i + c] as f32 / 255.0;
                    let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
                    dst[i + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                }
            }
            dst[i + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
        }
        i += 4;
    }
}

/// True if `layer` has no live overlays (so its composite is just its pixels).
fn layer_has_no_overlays(layer: &Layer) -> bool {
    layer.text_annotations.is_empty() && layer.shape_annotations.is_empty()
}

/// Composite an entire layer stack into `out` (reused across frames to avoid a
/// per-flush allocation), bottom → top. Hidden layers are skipped; each visible
/// layer is blended source-over scaled by its opacity. Includes a fast path for
/// the common single-visible-opaque-layer-with-no-overlays case (a straight
/// copy — what the old zero-copy blit did).
fn composite_layers_into(
    out: &mut Vec<u8>,
    layers: &[Layer],
    w: u32,
    h: u32,
    editing_shape_id: Option<u32>,
    editing_text_id: Option<u32>,
) {
    let n = (w as usize) * (h as usize) * 4;
    if out.len() != n {
        out.clear();
        out.resize(n, 0);
    }

    // Fast path: exactly one visible, fully-opaque layer with no overlays →
    // copy its pixels straight in. Avoids the zero-fill + per-pixel blend that
    // would otherwise run on every paint/stamp dab.
    let mut visible = layers.iter().filter(|l| l.visible);
    if let (Some(only), None) = (visible.next(), visible.next()) {
        if only.opacity >= 0.999 && layer_has_no_overlays(only) && only.buf.data.len() == n {
            out.copy_from_slice(&only.buf.data);
            return;
        }
    }

    out.iter_mut().for_each(|b| *b = 0);
    for layer in layers {
        if !layer.visible {
            continue;
        }
        let rendered = render_layer(layer, w, h, editing_shape_id, editing_text_id);
        blend_over(out, &rendered, layer.opacity);
    }
}

/// Allocating variant — composite a stack into a fresh buffer. Used by export /
/// thumbnail / snapshot-PNG paths that aren't on the per-frame hot path.
fn composite_layers(
    layers: &[Layer],
    w: u32,
    h: u32,
    editing_shape_id: Option<u32>,
    editing_text_id: Option<u32>,
) -> Vec<u8> {
    let mut out = Vec::new();
    composite_layers_into(&mut out, layers, w, h, editing_shape_id, editing_text_id);
    out
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
    bg_tail: u32,
) -> (Vec<u8>, u32, u32, i32, i32) {
    let rendered = crate::text::render_text(text, font_size, r, g, b, bold);
    let raw_w = rendered.width;
    let raw_h = rendered.height;

    // If no background, the historical fast-path applies.
    if background_kind == 0 {
        if rotation_deg.abs() < 0.5 {
            return (rendered.pixels, raw_w, raw_h, 0, 0);
        }
        // `rotate_pixels(+θ)` rotates clockwise in screen coords — the same
        // direction as the CSS `rotate(${rotation_deg}deg)` preview — so pass
        // the angle as-is (no negation) or the baked tile spins the wrong way.
        let rotated = crate::text::rotate_pixels(
            &rendered.pixels,
            raw_w,
            raw_h,
            rotation_deg as f32,
        );
        let cx = raw_w as i32 / 2;
        let cy = raw_h as i32 / 2;
        let off_x = cx - rotated.width as i32 / 2;
        let off_y = cy - rotated.height as i32 / 2;
        return (rotated.pixels, rotated.width, rotated.height, off_x, off_y);
    }

    // Background path: expand the tile by `bg_padding` on all sides. A
    // speech-bubble tail can point in any direction (`bg_tail` is an angle in
    // degrees), so reserve a uniform `TAIL_MARGIN` on every side — the tail
    // apex lands inside that margin no matter the angle.
    const TAIL_LEN: f64 = 46.0;    // how far the apex sticks out past the rect edge
    const TAIL_HALF: f64 = 16.0;   // half-width of the tail base
    let tail_margin: u32 = if background_kind == 2 {
        (TAIL_LEN.ceil() as u32) + (TAIL_HALF.ceil() as u32)
    } else {
        0
    };
    let pad = bg_padding;
    let tile_w = raw_w + pad * 2 + tail_margin * 2;
    let tile_h = raw_h + pad * 2 + tail_margin * 2;
    let mut tile = vec![0u8; (tile_w * tile_h * 4) as usize];

    // Background rect occupies the padded text area, inset by the tail margin.
    let rect_x0 = tail_margin as i32;
    let rect_y0 = tail_margin as i32;
    let rect_x1 = (tail_margin + raw_w + pad * 2) as i32;
    let rect_y1 = (tail_margin + raw_h + pad * 2) as i32;

    // Build the bubble as a single coverage mask (rect ∪ tail), then composite
    // the colour ONCE. This keeps the tail flush with the body — no AA seam at
    // the join, and translucent fills don't double up where the two overlap.
    let mut cov = vec![0f32; (tile_w * tile_h) as usize];
    crate::drawing::rounded_rect_coverage(
        &mut cov, tile_w, tile_h,
        rect_x0, rect_y0, rect_x1, rect_y1,
        bg_corner_radius,
    );

    // Speech-bubble tail at `bg_tail` degrees. Project a ray from the rect
    // centre (CW from +x, screen coords with y down) onto the bounding edge;
    // the exit point picks WHICH edge the tail leaves from. The base runs
    // straight ALONG that edge (not perpendicular to the ray) so it's always
    // flush — both base corners sit on the body. The base is clamped to the
    // straight part of the edge (off the rounded corners) and sunk
    // TAIL_OVERLAP into the body so it fuses with the rect in the mask. The
    // apex sits TAIL_LEN out, offset toward the chosen angle.
    if background_kind == 2 {
        const TAIL_OVERLAP: f64 = 4.0;
        let cx = (rect_x0 + rect_x1) as f64 * 0.5;
        let cy = (rect_y0 + rect_y1) as f64 * 0.5;
        let hw = (rect_x1 - rect_x0) as f64 * 0.5;
        let hh = (rect_y1 - rect_y0) as f64 * 0.5;

        let theta = (bg_tail as f64).to_radians();
        let dx = theta.cos();
        let dy = theta.sin();

        let tx = if dx.abs() > 1e-6 { hw / dx.abs() } else { f64::INFINITY };
        let ty = if dy.abs() > 1e-6 { hh / dy.abs() } else { f64::INFINITY };
        let t = tx.min(ty);
        let ex = cx + dx * t;
        let ey = cy + dy * t;

        let max_r = hw.min(hh);
        let rad_eff = (bg_corner_radius as f64).min(max_r);

        let (b1, b2, apex);
        if tx <= ty {
            // Left/right edge — vertical base running along the edge.
            let lo = rect_y0 as f64 + rad_eff + TAIL_HALF;
            let hi = rect_y1 as f64 - rad_eff - TAIL_HALF;
            let yc = if lo <= hi { ey.clamp(lo, hi) } else { cy };
            let inward = if dx >= 0.0 { -TAIL_OVERLAP } else { TAIL_OVERLAP };
            let bx = ex + inward;
            b1 = (bx, yc - TAIL_HALF);
            b2 = (bx, yc + TAIL_HALF);
            apex = (ex + dx * TAIL_LEN, yc + dy * TAIL_LEN);
        } else {
            // Top/bottom edge — horizontal base running along the edge.
            let lo = rect_x0 as f64 + rad_eff + TAIL_HALF;
            let hi = rect_x1 as f64 - rad_eff - TAIL_HALF;
            let xc = if lo <= hi { ex.clamp(lo, hi) } else { cx };
            let inward = if dy >= 0.0 { -TAIL_OVERLAP } else { TAIL_OVERLAP };
            let by = ey + inward;
            b1 = (xc - TAIL_HALF, by);
            b2 = (xc + TAIL_HALF, by);
            apex = (xc + dx * TAIL_LEN, ey + dy * TAIL_LEN);
        }

        crate::drawing::triangle_coverage(
            &mut cov, tile_w as i32, tile_h as i32,
            b1, b2, apex,
        );
    }

    crate::drawing::blend_coverage(&mut tile, &cov, bg_r, bg_g, bg_b, bg_a);

    // Composite the text on top of the background. The text sits inside
    // the rect with `pad` margin.
    let text_dx = (tail_margin + pad) as i32;
    let text_dy = (tail_margin + pad) as i32;
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
    // Rotate the composed tile (background + text together). Pass the angle
    // as-is: rotate_pixels(+θ) is clockwise, matching the CSS preview.
    let rotated = crate::text::rotate_pixels(&tile, tile_w, tile_h, rotation_deg as f32);
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
        let base = Layer::new(1, "Background".to_string(), width, height);
        ImageHorseTool {
            layers: vec![base],
            active: 0,
            next_layer_id: 2,
            width,
            height,
            composite_cache: Vec::new(),
            hist: History::new(),
            stamp: StampState::new(),
            zoom: 1.0,
            blur_scratch_a: Vec::new(),
            blur_scratch_b: Vec::new(),
            blur_kernel_cache: None,
            next_text_id: 1,
            next_shape_id: 1,
            editing_shape_id: None,
            editing_text_id: None,
            paint_stab_tip: None,
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    // ── Image loading ───────────────────────────────────────────────────

    /// Load a fresh image into a single Background layer, discarding any
    /// existing layer stack, history and overlays.
    pub fn load_image(&mut self, pixels: &[u8]) {
        let mut base = Layer::new(1, "Background".to_string(), self.width, self.height);
        if !base.buf.load(pixels) {
            return;
        }
        self.layers = vec![base];
        self.active = 0;
        self.next_layer_id = 2;
        self.hist.clear();
        self.stamp.stroke_counter = 0;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
        self.next_text_id = 1;
        self.next_shape_id = 1;
        self.editing_shape_id = None;
        self.editing_text_id = None;
    }

    /// Flattened composite of all visible layers (RGBA).
    pub fn get_image_data(&self) -> Vec<u8> {
        composite_layers(
            &self.layers,
            self.width,
            self.height,
            self.editing_shape_id,
            self.editing_text_id,
        )
    }

    /// Returns true if the flattened composite has any pixel with alpha < 255.
    pub fn has_transparency(&self) -> bool {
        self.get_image_data().chunks_exact(4).any(|px| px[3] < 255)
    }

    /// Recompute the cached composite that `data_ptr`/`data_len` expose. JS
    /// calls this before each zero-copy blit so the canvas reflects the full
    /// visible layer stack (pixels + overlays + opacity).
    pub fn recomposite(&mut self) {
        // Reuse the cache allocation across frames; take it out so we can pass
        // it as `&mut` alongside the immutable layer borrow.
        let mut cache = std::mem::take(&mut self.composite_cache);
        composite_layers_into(
            &mut cache,
            &self.layers,
            self.width,
            self.height,
            self.editing_shape_id,
            self.editing_text_id,
        );
        self.composite_cache = cache;
    }

    pub fn data_ptr(&self) -> *const u8 {
        self.composite_cache.as_ptr()
    }

    pub fn data_len(&self) -> usize {
        self.composite_cache.len()
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
        let w = self.width as i32;
        let h = self.height as i32;
        let snap = self.make_snapshot(&format!("Stamp {}", self.stamp.stroke_counter + 1));
        let active = self.active;
        let layer = &mut self.layers[active];
        self.stamp.begin_stroke(
            &mut layer.buf.data,
            w,
            h,
            &mut self.hist.redo_stack,
            dest_x,
            dest_y,
            snap,
        );
    }

    pub fn continue_stroke(&mut self, dest_x: f64, dest_y: f64) {
        let w = self.width as i32;
        let h = self.height as i32;
        self.stamp
            .continue_stroke(&mut self.layers[self.active].buf.data, w, h, dest_x, dest_y);
    }

    pub fn end_stroke(&mut self) {
        self.stamp.end_stroke(&mut self.hist);
    }

    /// Set the undo-history depth (clamped to 50–1000). Trims the oldest
    /// snapshots immediately if the cap is lowered. Driven by the General
    /// settings slider; persisted on the JS side and re-applied on load.
    pub fn set_max_history(&mut self, n: u32) {
        self.hist.set_max_history(n as usize);
    }

    // ── History ─────────────────────────────────────────────────────────

    pub fn undo(&mut self) -> bool {
        let current = self.make_snapshot("Current State");
        if let Some(snap) = self.hist.undo(current) {
            self.restore_snapshot(snap);
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        let current = self.make_snapshot("Current State");
        if let Some(snap) = self.hist.redo(current) {
            self.restore_snapshot(snap);
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
        let current = self.hist.undo_count();
        if target_index == current {
            return false;
        }
        if target_index < current {
            for _ in 0..(current - target_index) {
                if !self.undo() {
                    break;
                }
            }
        } else {
            for _ in 0..(target_index - current) {
                if !self.redo() {
                    break;
                }
            }
        }
        true
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
                let data = composite_layers(&snap.layers, snap.width, snap.height, None, None);
                let tmp = ImageBuffer { width: snap.width, height: snap.height, data };
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
                let data = composite_layers(&snap.layers, snap.width, snap.height, None, None);
                let tmp = ImageBuffer { width: snap.width, height: snap.height, data };
                codec::export_png(&tmp)
            }
        }
    }

    pub fn get_redo_snapshot_label(&self, index: usize) -> String {
        self.hist.redo_stack.get(index).map(|s| s.label.clone()).unwrap_or_default()
    }

    /// Append a raw-RGBA snapshot to the undo stack (used when restoring a
    /// session). The snapshot is reconstructed as a single Background layer;
    /// annotations start empty — the JS side adds them one by one with
    /// `push_annotation_to_undo_snapshot` after this returns. (Multi-layer
    /// history is not yet persisted; restored snapshots are single-layer.)
    pub fn inject_undo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        let layer = Layer {
            id: 1,
            name: "Background".to_string(),
            visible: true,
            opacity: 1.0,
            buf: ImageBuffer { width: w, height: h, data: data.to_vec() },
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        };
        self.hist.undo_stack.push_back(Snapshot {
            label: label.to_string(),
            layers: vec![layer],
            active: 0,
            width: w,
            height: h,
        });
    }

    /// Append a raw-RGBA snapshot to the redo stack (used when restoring a session).
    pub fn inject_redo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        let layer = Layer {
            id: 1,
            name: "Background".to_string(),
            visible: true,
            opacity: 1.0,
            buf: ImageBuffer { width: w, height: h, data: data.to_vec() },
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        };
        self.hist.redo_stack.push(Snapshot {
            label: label.to_string(),
            layers: vec![layer],
            active: 0,
            width: w,
            height: h,
        });
    }

    /// Per-snapshot annotation state as JSON (active layer's text annotations).
    /// Mirrors `get_text_annotations` so JS can read snapshot overlays with the
    /// same parser. Used by the persistence layer for round-trip saves.
    pub fn get_undo_snapshot_annotations(&self, index: usize) -> String {
        match self.hist.undo_stack.get(index).and_then(|s| s.layers.get(s.active)) {
            None => String::from("[]"),
            Some(layer) => annotations_to_json(&layer.text_annotations),
        }
    }

    pub fn get_redo_snapshot_annotations(&self, index: usize) -> String {
        match self.hist.redo_stack.get(index).and_then(|s| s.layers.get(s.active)) {
            None => String::from("[]"),
            Some(layer) => annotations_to_json(&layer.text_annotations),
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
        bg_tail: u32,
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
            Some(snap) => {
                let a = snap.active;
                match snap.layers.get_mut(a) {
                    Some(layer) => { layer.text_annotations.push(ann); true }
                    None => false,
                }
            }
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
        bg_tail: u32,
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
            Some(snap) => {
                let a = snap.active;
                match snap.layers.get_mut(a) {
                    Some(layer) => { layer.text_annotations.push(ann); true }
                    None => false,
                }
            }
        }
    }

    // ── Codec ───────────────────────────────────────────────────────────

    pub fn export_png(&self) -> Vec<u8> {
        let tmp = ImageBuffer {
            width: self.width,
            height: self.height,
            data: self.get_image_data(),
        };
        codec::export_png(&tmp)
    }

    pub fn thumbnail_width(&self, max_px: u32) -> u32 {
        codec::thumb_dims(self.width, self.height, max_px).0
    }

    pub fn thumbnail_height(&self, max_px: u32) -> u32 {
        codec::thumb_dims(self.width, self.height, max_px).1
    }

    pub fn thumbnail_data(&self, max_px: u32) -> Vec<u8> {
        let tmp = ImageBuffer {
            width: self.width,
            height: self.height,
            data: self.get_image_data(),
        };
        codec::thumbnail_data(&tmp, max_px).0
    }

    // ── Transforms ──────────────────────────────────────────────────────

    pub fn flip_horizontal(&mut self) {
        self.snap("Flip H");
        let w = self.width as usize;
        let h = self.height as usize;
        for layer in &mut self.layers {
            transform::flip_horizontal(&mut layer.buf.data, w, h);
        }
        if let Some(sx) = self.stamp.source_x {
            self.stamp.source_x = Some(self.width as i32 - 1 - sx);
        }
    }

    pub fn flip_vertical(&mut self) {
        self.snap("Flip V");
        let w = self.width as usize;
        let h = self.height as usize;
        for layer in &mut self.layers {
            transform::flip_vertical(&mut layer.buf.data, w, h);
        }
        if let Some(sy) = self.stamp.source_y {
            self.stamp.source_y = Some(self.height as i32 - 1 - sy);
        }
    }

    pub fn rotate_90_cw(&mut self) {
        self.snap("Rotate 90° CW");
        let (ow, oh) = (self.width as usize, self.height as usize);
        for layer in &mut self.layers {
            let (new_data, new_w, new_h) = transform::rotate_90_cw(&layer.buf.data, ow, oh);
            layer.buf.data = new_data;
            layer.buf.width = new_w;
            layer.buf.height = new_h;
        }
        std::mem::swap(&mut self.width, &mut self.height);
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn rotate_90_ccw(&mut self) {
        self.snap("Rotate 90° CCW");
        let (ow, oh) = (self.width as usize, self.height as usize);
        for layer in &mut self.layers {
            let (new_data, new_w, new_h) = transform::rotate_90_ccw(&layer.buf.data, ow, oh);
            layer.buf.data = new_data;
            layer.buf.width = new_w;
            layer.buf.height = new_h;
        }
        std::mem::swap(&mut self.width, &mut self.height);
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.snap("Crop");
        let (ow, oh) = (self.width, self.height);
        let mut nw = self.width;
        let mut nh = self.height;
        for layer in &mut self.layers {
            let (new_data, cw, ch) = transform::crop(&layer.buf.data, ow, oh, x, y, w, h);
            layer.buf.data = new_data;
            layer.buf.width = cw;
            layer.buf.height = ch;
            nw = cw;
            nh = ch;
        }
        self.width = nw;
        self.height = nh;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    /// Preview crop overlay in WASM.
    /// Saves a snapshot, applies darkening overlay + dashed border.
    /// Call cancel_crop_preview() or apply_crop_from_preview() when done.
    pub fn preview_crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.snap("Crop Preview");
        transform::apply_crop_overlay(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            x, y, w, h,
            0.5,
        );
        transform::draw_crop_border(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
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
        // Drop the preview snapshot/overlay, then crop the real pixels.
        self.undo();
        self.crop(x, y, w, h);
    }

    pub fn copy_region(&self, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
        transform::copy_region(&self.layers[self.active].buf.data, self.width as i32, self.height as i32, x, y, w, h)
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
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
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
        let (ow, oh) = (self.width, self.height);
        for layer in &mut self.layers {
            let resized = match filter {
                0 => transform::resize_nearest(&layer.buf.data, ow, oh, new_w, new_h),
                2 => transform::resize_catmull_rom(&layer.buf.data, ow, oh, new_w, new_h),
                3 => transform::resize_lanczos3(&layer.buf.data, ow, oh, new_w, new_h),
                _ => transform::resize_bilinear(&layer.buf.data, ow, oh, new_w, new_h),
            };
            layer.buf.data = resized;
            layer.buf.width = new_w;
            layer.buf.height = new_h;
        }
        self.width = new_w;
        self.height = new_h;
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
        filters::adjust_brightness(&mut self.layers[self.active].buf.data, delta);
    }

    pub fn adjust_contrast(&mut self, factor: f64) {
        self.snap("Contrast");
        filters::adjust_contrast(&mut self.layers[self.active].buf.data, factor);
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
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
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

    // ── Effects brush: pixelate (mosaic) + solid redaction ───────────────
    // Sibling modes of the blur brush. Same brush footprint (radius = half the
    // brush-size slider); each mode paints destructively into the active layer.

    /// Pixelate a circular brush region into `block_size`px mosaic squares.
    /// Call from JS: tool.pixelate_region(cx, cy, brush_radius, block_size)
    pub fn pixelate_region(&mut self, cx: f64, cy: f64, brush_radius: f64, block_size: u32) {
        filters::pixelate_region(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            cx,
            cy,
            brush_radius,
            block_size,
        );
    }

    /// Begin a pixelate stroke — saves undo snapshot once.
    pub fn begin_pixelate_stroke(&mut self) {
        self.snap("Pixelate");
    }

    /// Paint an opaque solid colour over a circular brush region (redaction).
    /// Call from JS: tool.redact_region(cx, cy, brush_radius, r, g, b)
    pub fn redact_region(&mut self, cx: f64, cy: f64, brush_radius: f64, r: u8, g: u8, b: u8) {
        filters::redact_region(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            cx,
            cy,
            brush_radius,
            r,
            g,
            b,
        );
    }

    /// Begin a redact stroke — saves undo snapshot once.
    pub fn begin_redact_stroke(&mut self) {
        self.snap("Redact");
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
            &mut self.layers[self.active].buf.data,
            self.width, self.height,
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
            &mut self.layers[self.active].buf.data,
            self.width, self.height,
            from_x, from_y, to_x, to_y,
            shape, color, stroke_width,
        );
    }

    // ── Live shape/arrow annotations (non-destructive, re-selectable) ────
    // These replace the instant-bake draw_shape/draw_arrow path. Shapes live
    // as an overlay (like text) so they can be reselected, moved, restyled,
    // and deleted via the Reselect list until flattened at export.

    pub fn shape_annotation_count(&self) -> usize {
        self.layers[self.active].shape_annotations.len()
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
        fill_kind: u8,
        fill_hex: &str,
        fill2_hex: &str,
        fill_angle: u16,
        fill_block: u32,
    ) -> u32 {
        self.snap(if kind == 4 { "Add Arrow" } else { "Add Shape" });
        let c = drawing::parse_hex_color(color_hex);
        let f = drawing::parse_hex_color(fill_hex);
        let f2 = drawing::parse_hex_color(fill2_hex);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id,
            kind,
            x0, y0, x1, y1,
            r: c[0], g: c[1], b: c[2],
            stroke_width,
            arrow_style,
            number: 0,
            label_kind: 0,
            points: Vec::new(),
            fill_kind,
            fill_r: f[0], fill_g: f[1], fill_b: f[2], fill_a: f[3],
            fill2_r: f2[0], fill2_g: f2[1], fill2_b: f2[2], fill2_a: f2[3],
            fill_angle,
            fill_block,
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
        fill_kind: u8,
        fill_r: u8, fill_g: u8, fill_b: u8, fill_a: u8,
        fill2_r: u8, fill2_g: u8, fill2_b: u8, fill2_a: u8,
        fill_angle: u16,
        fill_block: u32,
    ) -> u32 {
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind, x0, y0, x1, y1, r, g, b, stroke_width, arrow_style,
            number: 0, label_kind: 0, points: Vec::new(),
            fill_kind,
            fill_r, fill_g, fill_b, fill_a,
            fill2_r, fill2_g, fill2_b, fill2_a,
            fill_angle,
            fill_block,
        });
        id
    }

    /// Add a numbered callout pin (kind 5): a filled circle + centred number,
    /// stored as a circle-style bbox plus its label. Pushes "Add Pin".
    pub fn add_pin_annotation(
        &mut self,
        x0: f64, y0: f64, x1: f64, y1: f64,
        number: u32,
        color_hex: &str,
        label_kind: u8,
    ) -> u32 {
        self.snap("Add Pin");
        let c = drawing::parse_hex_color(color_hex);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind: 5, x0, y0, x1, y1,
            r: c[0], g: c[1], b: c[2],
            stroke_width: 0.0, arrow_style: 0,
            number, label_kind, points: Vec::new(),
            ..Default::default()
        });
        id
    }

    /// Restore a persisted pin WITHOUT pushing history. Colour is raw r,g,b.
    pub fn restore_pin_annotation(
        &mut self,
        x0: f64, y0: f64, x1: f64, y1: f64,
        number: u32, r: u8, g: u8, b: u8,
        label_kind: u8,
    ) -> u32 {
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind: 5, x0, y0, x1, y1, r, g, b,
            stroke_width: 0.0, arrow_style: 0,
            number, label_kind, points: Vec::new(),
            ..Default::default()
        });
        id
    }

    /// Add a freehand/polyline pen stroke (kind 6). `points` is a flat
    /// [x0,y0,x1,y1,…] array of vertices; the bbox is derived from it.
    /// Pushes "Add Pen".
    pub fn add_polyline_annotation(
        &mut self,
        points: &[f64],
        color_hex: &str,
        stroke_width: f64,
    ) -> u32 {
        self.snap("Add Pen");
        let c = drawing::parse_hex_color(color_hex);
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind: 6, x0, y0, x1, y1,
            r: c[0], g: c[1], b: c[2],
            stroke_width, arrow_style: 0,
            number: 0, points: pts,
            ..Default::default()
        });
        id
    }

    /// Restore a persisted polyline WITHOUT pushing history. Colour is raw r,g,b.
    pub fn restore_polyline_annotation(
        &mut self,
        points: &[f64],
        r: u8, g: u8, b: u8,
        stroke_width: f64,
    ) -> u32 {
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind: 6, x0, y0, x1, y1, r, g, b,
            stroke_width, arrow_style: 0,
            number: 0, points: pts,
            ..Default::default()
        });
        id
    }

    /// Add a Bézier pen path (kind 7). `points` is a flat cubic control
    /// sequence `[a0x,a0y, out0x,out0y, in1x,in1y, a1x,a1y, …]`. Pushes "Add Pen Path".
    pub fn add_bezier_annotation(
        &mut self,
        points: &[f64],
        color_hex: &str,
        stroke_width: f64,
        fill_kind: u8,
        fill_color_hex: &str,
    ) -> u32 {
        self.snap("Add Pen Path");
        let c = drawing::parse_hex_color(color_hex);
        let fc = drawing::parse_hex_color(fill_color_hex);
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind: 7, x0, y0, x1, y1,
            r: c[0], g: c[1], b: c[2],
            stroke_width, arrow_style: 0,
            number: 0, points: pts,
            fill_kind,
            fill_r: fc[0], fill_g: fc[1], fill_b: fc[2], fill_a: fc[3],
            ..Default::default()
        });
        id
    }

    /// Restore a persisted Bézier path WITHOUT pushing history. Raw r,g,b.
    pub fn restore_bezier_annotation(
        &mut self,
        points: &[f64],
        r: u8, g: u8, b: u8,
        stroke_width: f64,
        fill_kind: u8,
        fill_r: u8, fill_g: u8, fill_b: u8, fill_a: u8,
    ) -> u32 {
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active].shape_annotations.push(ShapeAnnotation {
            id, kind: 7, x0, y0, x1, y1, r, g, b,
            stroke_width, arrow_style: 0,
            number: 0, points: pts,
            fill_kind, fill_r, fill_g, fill_b, fill_a,
            ..Default::default()
        });
        id
    }

    /// Replace just the control points of an existing annotation (no history).
    /// Used for live drag-editing of a Bézier path's anchors/handles; the
    /// caller pushes one snapshot when the drag gesture ends.
    pub fn set_annotation_points(&mut self, id: u32, points: &[f64]) {
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        if let Some(s) = self.layers[self.active]
            .shape_annotations
            .iter_mut()
            .find(|s| s.id == id)
        {
            s.points = pts;
            s.x0 = x0; s.y0 = y0; s.x1 = x1; s.y1 = y1;
        }
    }

    /// Commit a reshape of an existing Bézier path: pushes one "Edit Pen Path"
    /// snapshot (so undo restores the prior shape), then replaces its control
    /// points. Style (colour / width / fill) is left untouched.
    pub fn update_bezier_annotation(&mut self, id: u32, points: &[f64]) {
        self.snap("Edit Pen Path");
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        if let Some(s) = self.layers[self.active]
            .shape_annotations
            .iter_mut()
            .find(|s| s.id == id)
        {
            s.points = pts;
            s.x0 = x0; s.y0 = y0; s.x1 = x1; s.y1 = y1;
        }
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
        fill_kind: u8,
        fill_hex: &str,
        fill2_hex: &str,
        fill_angle: u16,
        fill_block: u32,
    ) -> bool {
        if !self.layers[self.active].shape_annotations.iter().any(|s| s.id == id) {
            return false;
        }
        self.snap("Edit Shape");
        let c = drawing::parse_hex_color(color_hex);
        let f = drawing::parse_hex_color(fill_hex);
        let f2 = drawing::parse_hex_color(fill2_hex);
        if let Some(s) = self.layers[self.active].shape_annotations.iter_mut().find(|s| s.id == id) {
            s.kind = kind;
            s.x0 = x0; s.y0 = y0; s.x1 = x1; s.y1 = y1;
            s.r = c[0]; s.g = c[1]; s.b = c[2];
            s.stroke_width = stroke_width;
            s.arrow_style = arrow_style;
            s.fill_kind = fill_kind;
            s.fill_r = f[0]; s.fill_g = f[1]; s.fill_b = f[2]; s.fill_a = f[3];
            s.fill2_r = f2[0]; s.fill2_g = f2[1]; s.fill2_b = f2[2]; s.fill2_a = f2[3];
            s.fill_angle = fill_angle;
            s.fill_block = fill_block;
        }
        true
    }

    /// Remove a shape annotation. Pushes a "Delete Shape" snapshot so undo
    /// restores it. Returns true if found.
    pub fn remove_shape_annotation(&mut self, id: u32) -> bool {
        if !self.layers[self.active].shape_annotations.iter().any(|s| s.id == id) {
            return false;
        }
        self.snap("Delete Shape");
        self.layers[self.active].shape_annotations.retain(|s| s.id != id);
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

    /// Mark a text annotation as being edited in the JS textarea overlay: its
    /// baked tile is suppressed from the composite so the user sees only the
    /// live overlay (no doubled copy underneath). Pass -1 to clear. No history.
    pub fn set_editing_text(&mut self, id: i32) {
        self.editing_text_id = if id < 0 { None } else { Some(id as u32) };
    }

    /// JSON dump of all shape annotations (metadata only). Used by the JS
    /// overlay for hit-testing and by the Reselect list.
    pub fn get_shape_annotations(&self) -> String {
        shapes_to_json(&self.layers[self.active].shape_annotations)
    }

    /// Hit-test shape annotations against a canvas-space point. Iterates
    /// newest-first (last-added wins). Returns the id, or -1. Lines/arrows use
    /// distance-to-segment; closed shapes use a padded bounding box.
    pub fn shape_annotation_at(&self, x: f64, y: f64) -> i32 {
        for s in self.layers[self.active].shape_annotations.iter().rev() {
            let pad = (s.stroke_width * 0.5).max(6.0);
            let hit = if s.kind == 2 || s.kind == 4 {
                // line / arrow → distance to the segment
                point_segment_distance(x, y, s.x0, s.y0, s.x1, s.y1) <= pad + 4.0
            } else if s.kind == 6 {
                // polyline → distance to any segment
                s.points.windows(2).any(|p| {
                    point_segment_distance(x, y, p[0].0, p[0].1, p[1].0, p[1].1) <= pad + 4.0
                })
            } else {
                // rect / circle / handCircle / pin → padded bounding box
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
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
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
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
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
                &mut self.layers[self.active].buf.data,
                self.width as i32,
                self.height as i32,
                &rendered.pixels,
                rendered.width,
                rendered.height,
                dest_x,
                dest_y,
            );
        } else {
            // Rotate around the text centre. rotate_pixels(+θ) is clockwise,
            // matching the CSS `rotate(${angle}deg)` preview, so pass as-is.
            let cx = dest_x + rendered.width as i32 / 2;
            let cy = dest_y + rendered.height as i32 / 2;
            let rotated = crate::text::rotate_pixels(&rendered.pixels, rendered.width, rendered.height, angle_deg);
            let paste_x = cx - rotated.width as i32 / 2;
            let paste_y = cy - rotated.height as i32 / 2;
            transform::paste_region(
                &mut self.layers[self.active].buf.data,
                self.width as i32,
                self.height as i32,
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
        angle_deg: f32,
    ) {
        let font_size = 48.0f32;
        let rendered = crate::text::render_stamp_label(label, font_size, r, g, b, angle_deg);
        // Scale to target_size preserving aspect ratio
        let scale = target_size as f64 / rendered.width.max(rendered.height) as f64;
        let new_w = ((rendered.width as f64 * scale).round() as u32).max(1);
        let new_h = ((rendered.height as f64 * scale).round() as u32).max(1);
        let scaled = transform::resize_bilinear(&rendered.pixels, rendered.width, rendered.height, new_w, new_h);
        self.snap("Red Stamp");
        transform::paste_region(
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
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
        let w = self.width as i32;
        let h = self.height as i32;
        let data = &mut self.layers[self.active].buf.data;
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

    // ── Stroke stabilizer ("lazy mouse") ──────────────────────────────────
    // The brush tip trails the cursor on a `leash` (px). It only advances —
    // and paints — when the cursor pulls past the leash, so jiggles smaller
    // than the leash are absorbed. Larger leash = more smoothing.

    /// Begin a stabilized stroke with the tip anchored at the press point.
    pub fn paint_stab_begin(&mut self, x: f64, y: f64) {
        self.paint_stab_tip = Some((x, y));
    }

    /// Advance the stabilized tip toward `(raw_x, raw_y)` and paint the
    /// segment if it cleared the leash. Returns true when something was painted.
    pub fn paint_stab_to(
        &mut self,
        raw_x: f64, raw_y: f64, leash: f64,
        radius: f64, r: u8, g: u8, b: u8, opacity: f64,
    ) -> bool {
        let (tx, ty) = match self.paint_stab_tip {
            Some(t) => t,
            None => {
                self.paint_stab_tip = Some((raw_x, raw_y));
                return false;
            }
        };
        let dx = raw_x - tx;
        let dy = raw_y - ty;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist > leash && dist > 0.0 {
            let k = 1.0 - leash / dist; // fraction of the gap to close
            let nx = tx + dx * k;
            let ny = ty + dy * k;
            self.paint_stroke_to(tx, ty, nx, ny, radius, r, g, b, opacity);
            self.paint_stab_tip = Some((nx, ny));
            true
        } else {
            false
        }
    }

    /// Catch up: paint the final segment from the trailing tip to the real
    /// cursor so the stroke ends under the pointer, then clear the stabilizer.
    pub fn paint_stab_flush(
        &mut self,
        raw_x: f64, raw_y: f64,
        radius: f64, r: u8, g: u8, b: u8, opacity: f64,
    ) -> bool {
        let painted = if let Some((tx, ty)) = self.paint_stab_tip {
            if (tx - raw_x).abs() > 0.001 || (ty - raw_y).abs() > 0.001 {
                self.paint_stroke_to(tx, ty, raw_x, raw_y, radius, r, g, b, opacity);
                true
            } else {
                false
            }
        } else {
            false
        };
        self.paint_stab_tip = None;
        painted
    }

    // ── Color picker helpers ─────────────────────────────────────────────

    /// Returns [r, g, b, a] for the pixel at (x, y), clamped to image bounds.
    pub fn get_pixel(&self, x: i32, y: i32) -> Vec<u8> {
        let w = self.width as i32;
        let h = self.height as i32;
        if w == 0 || h == 0 || x < 0 || y < 0 || x >= w || y >= h {
            return vec![0, 0, 0, 255];
        }
        let idx = (y as usize * self.width as usize + x as usize) * 4;
        self.layers[self.active].buf.data[idx..idx + 4].to_vec()
    }

    /// Returns a flat RGBA grid of (2*radius+1)² pixels centred on (cx, cy).
    /// Out-of-bounds pixels are returned as opaque black.
    pub fn get_pixel_region(&self, cx: i32, cy: i32, radius: i32) -> Vec<u8> {
        let side = 2 * radius + 1;
        let mut out = Vec::with_capacity((side * side * 4) as usize);
        let w = self.width as i32;
        let h = self.height as i32;
        for row in 0..side {
            for col in 0..side {
                let px = cx - radius + col;
                let py = cy - radius + row;
                if w == 0 || h == 0 || px < 0 || py < 0 || px >= w || py >= h {
                    out.extend_from_slice(&[0, 0, 0, 255]);
                } else {
                    let idx = (py as usize * self.width as usize + px as usize) * 4;
                    out.extend_from_slice(&self.layers[self.active].buf.data[idx..idx + 4]);
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
        self.layers[self.active].text_annotations.len()
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
        bg_tail: u32,
    ) -> u32 {
        self.snap("Add Text");
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id, text, font_size, r, g, b, bold, x, y, rotation_deg,
            background_kind, bg_r, bg_g, bg_b, bg_a,
            bg_padding, bg_corner_radius, bg_tail,
        );
        self.layers[self.active].text_annotations.push(ann);
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
        bg_tail: u32,
    ) -> bool {
        let Some(idx) = self.layers[self.active].text_annotations.iter().position(|a| a.id == id) else {
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
        let a = &mut self.layers[self.active].text_annotations[idx];
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
        if !self.layers[self.active].text_annotations.iter().any(|a| a.id == id) {
            return false;
        }
        self.snap("Delete Text");
        self.layers[self.active].text_annotations.retain(|a| a.id != id);
        true
    }

    /// JSON dump of all annotations (metadata only — tile pixels stay in
    /// Rust). Used by the JS overlay for hit-testing bounds and by
    /// editPersistence for round-tripping across photo switches.
    pub fn get_text_annotations(&self) -> String {
        annotations_to_json(&self.layers[self.active].text_annotations)
    }

    /// Hit-test annotations against a canvas-space point. Iterates
    /// newest-first (last-added wins on overlap). Returns the id, or -1.
    /// (Sentinel -1 is used because wasm-bindgen Option support is uneven.)
    pub fn text_annotation_at(&self, x: i32, y: i32) -> i32 {
        for a in self.layers[self.active].text_annotations.iter().rev() {
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
        self.get_image_data()
    }

    /// Burn the active layer's overlays (shapes + text) into its pixel buffer
    /// with a single history snapshot, then clear that layer's overlay lists.
    pub fn flatten_text_annotations(&mut self) {
        let active = self.active;
        if self.layers[active].text_annotations.is_empty()
            && self.layers[active].shape_annotations.is_empty()
        {
            return;
        }
        self.snap("Flatten");
        let w = self.width;
        let h = self.height;
        let layer = &mut self.layers[active];
        // Shapes first (underneath the text), then text tiles on top.
        let shapes = std::mem::take(&mut layer.shape_annotations);
        for s in &shapes {
            render_shape_into(&mut layer.buf.data, w, h, s);
        }
        let anns = std::mem::take(&mut layer.text_annotations);
        for a in &anns {
            transform::paste_region(
                &mut layer.buf.data,
                w as i32,
                h as i32,
                a.tile_pixels.as_ref(),
                a.tile_w,
                a.tile_h,
                a.x + a.tile_offset_x,
                a.y + a.tile_offset_y,
            );
        }
        self.editing_shape_id = None;
    }

    // ── Layers ───────────────────────────────────────────────────────────

    pub fn layer_count(&self) -> usize {
        self.layers.len()
    }

    /// JSON array of the layer stack, bottom → top:
    /// `[{id,name,visible,opacity,active}]`.
    pub fn get_layers(&self) -> String {
        let mut out = String::from("[");
        for (i, l) in self.layers.iter().enumerate() {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                "{{\"id\":{},\"name\":\"{}\",\"visible\":{},\"opacity\":{},\"active\":{}}}",
                l.id,
                json_escape(&l.name),
                l.visible,
                l.opacity,
                i == self.active,
            ));
        }
        out.push(']');
        out
    }

    /// Add a new transparent layer directly above the active layer; it becomes
    /// the active layer. Returns its id. Pushes "Add Layer".
    pub fn add_layer(&mut self, name: &str) -> u32 {
        self.snap("Add Layer");
        let id = self.next_layer_id;
        self.next_layer_id = self.next_layer_id.wrapping_add(1).max(1);
        let display = if name.is_empty() {
            format!("Layer {}", id)
        } else {
            name.to_string()
        };
        let layer = Layer::new(id, display, self.width, self.height);
        let insert_at = self.active + 1;
        self.layers.insert(insert_at, layer);
        self.active = insert_at;
        id
    }

    /// Duplicate the layer with `id` (pixels + annotations), inserting the copy
    /// directly above it and making it active. Returns the new id (0 if not found).
    pub fn duplicate_layer(&mut self, id: u32) -> u32 {
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return 0;
        };
        self.snap("Duplicate Layer");
        let new_id = self.next_layer_id;
        self.next_layer_id = self.next_layer_id.wrapping_add(1).max(1);
        let mut copy = self.layers[idx].clone();
        copy.id = new_id;
        copy.name = format!("{} copy", self.layers[idx].name);
        self.layers.insert(idx + 1, copy);
        self.active = idx + 1;
        new_id
    }

    /// Remove the layer with `id`. Refuses to remove the last remaining layer.
    /// Pushes "Delete Layer". Returns true if removed.
    pub fn remove_layer(&mut self, id: u32) -> bool {
        if self.layers.len() <= 1 {
            return false;
        }
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        self.snap("Delete Layer");
        self.layers.remove(idx);
        if self.active >= self.layers.len() {
            self.active = self.layers.len() - 1;
        } else if self.active > idx {
            self.active -= 1;
        }
        true
    }

    /// Make the layer with `id` active. Returns true if found.
    pub fn set_active_layer(&mut self, id: u32) -> bool {
        if let Some(idx) = self.layers.iter().position(|l| l.id == id) {
            self.active = idx;
            self.editing_shape_id = None;
            true
        } else {
            false
        }
    }

    /// Id of the active layer (0 if the stack is somehow empty).
    pub fn active_layer_id(&self) -> u32 {
        self.layers.get(self.active).map(|l| l.id).unwrap_or(0)
    }

    pub fn set_layer_visible(&mut self, id: u32, visible: bool) -> bool {
        if let Some(l) = self.layers.iter_mut().find(|l| l.id == id) {
            l.visible = visible;
            true
        } else {
            false
        }
    }

    pub fn set_layer_opacity(&mut self, id: u32, opacity: f64) -> bool {
        if let Some(l) = self.layers.iter_mut().find(|l| l.id == id) {
            l.opacity = opacity.clamp(0.0, 1.0);
            true
        } else {
            false
        }
    }

    pub fn rename_layer(&mut self, id: u32, name: &str) -> bool {
        if let Some(l) = self.layers.iter_mut().find(|l| l.id == id) {
            l.name = name.to_string();
            true
        } else {
            false
        }
    }

    /// Move the layer with `id` to a new stack index (clamped). Bottom → top,
    /// so index 0 is the bottom of the stack. Pushes "Reorder Layer".
    pub fn move_layer(&mut self, id: u32, new_index: usize) -> bool {
        let Some(from) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        let to = new_index.min(self.layers.len() - 1);
        if from == to {
            return false;
        }
        self.snap("Reorder Layer");
        let layer = self.layers.remove(from);
        self.layers.insert(to, layer);
        // Keep the moved layer active so the UI selection follows it.
        self.active = to;
        true
    }

    /// Merge the layer with `id` down onto the layer directly below it (the
    /// lower layer keeps its id; the merged layer's rendered pixels are blended
    /// in with its opacity). Pushes "Merge Down". Returns true if merged.
    pub fn merge_down(&mut self, id: u32) -> bool {
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if idx == 0 {
            return false; // nothing below to merge into
        }
        self.snap("Merge Down");
        let w = self.width;
        let h = self.height;
        // Render the upper layer (with its overlays) and blend over the lower
        // layer's flattened pixels.
        let upper = render_layer(&self.layers[idx], w, h, None, None);
        let upper_opacity = self.layers[idx].opacity;
        {
            let lower = &mut self.layers[idx - 1];
            // Flatten the lower layer's own overlays first so the result is a
            // single pixel buffer.
            let lower_shapes = std::mem::take(&mut lower.shape_annotations);
            for s in &lower_shapes {
                render_shape_into(&mut lower.buf.data, w, h, s);
            }
            let lower_text = std::mem::take(&mut lower.text_annotations);
            for a in &lower_text {
                transform::paste_region(
                    &mut lower.buf.data,
                    w as i32,
                    h as i32,
                    a.tile_pixels.as_ref(),
                    a.tile_w,
                    a.tile_h,
                    a.x + a.tile_offset_x,
                    a.y + a.tile_offset_y,
                );
            }
            blend_over(&mut lower.buf.data, &upper, upper_opacity);
        }
        self.layers.remove(idx);
        if self.active >= idx {
            self.active = self.active.saturating_sub(1);
        }
        self.editing_shape_id = None;
        true
    }

    /// Flatten the entire stack into a single Background layer holding the
    /// composited pixels. Pushes "Flatten Image".
    pub fn flatten_all(&mut self) {
        if self.layers.len() == 1
            && self.layers[0].text_annotations.is_empty()
            && self.layers[0].shape_annotations.is_empty()
        {
            return;
        }
        self.snap("Flatten Image");
        let data = composite_layers(&self.layers, self.width, self.height, None, None);
        let id = self.layers[0].id;
        let mut base = Layer::new(id, "Background".to_string(), self.width, self.height);
        base.buf.data = data;
        self.layers = vec![base];
        self.active = 0;
        self.editing_shape_id = None;
    }

    // ── Layer persistence (serialize / restore) ──────────────────────────
    // These let the JS persistence layer round-trip the full layer stack
    // (pixels + per-layer overlays) across reloads. Serialization reads each
    // layer individually (not the active one); restore rebuilds the stack
    // without polluting history.

    /// PNG of a single layer's raw pixels (NOT composited, NOT including
    /// overlays — those serialize separately). Empty vec if index out of range.
    pub fn get_layer_png(&self, index: usize) -> Vec<u8> {
        match self.layers.get(index) {
            None => Vec::new(),
            Some(l) => codec::export_png(&l.buf),
        }
    }

    /// JSON of a specific layer's text annotations (mirrors `get_text_annotations`).
    pub fn get_layer_text_annotations(&self, index: usize) -> String {
        match self.layers.get(index) {
            None => String::from("[]"),
            Some(l) => annotations_to_json(&l.text_annotations),
        }
    }

    /// JSON of a specific layer's shape annotations (mirrors `get_shape_annotations`).
    pub fn get_layer_shape_annotations(&self, index: usize) -> String {
        match self.layers.get(index) {
            None => String::from("[]"),
            Some(l) => shapes_to_json(&l.shape_annotations),
        }
    }

    /// Begin rebuilding the layer stack from persisted data: empties the stack
    /// and clears history + id counters. Must be followed by one or more
    /// `push_restored_layer` calls and a `finish_layer_restore`.
    pub fn begin_layer_restore(&mut self) {
        self.layers.clear();
        self.hist.clear();
        self.editing_shape_id = None;
        self.editing_text_id = None;
        self.next_text_id = 1;
        self.next_shape_id = 1;
        self.next_layer_id = 1;
    }

    /// Append a restored layer (bottom → top order) from raw RGBA `pixels` and
    /// make it active so subsequent `restore_text_annotation` /
    /// `restore_shape_annotation` calls attach to it. The first restored layer
    /// establishes the canvas dimensions. No history. Returns the layer id.
    pub fn push_restored_layer(
        &mut self,
        pixels: &[u8],
        w: u32,
        h: u32,
        name: &str,
        visible: bool,
        opacity: f64,
    ) -> u32 {
        if self.layers.is_empty() {
            self.width = w;
            self.height = h;
        }
        let id = self.next_layer_id;
        self.next_layer_id = self.next_layer_id.wrapping_add(1).max(1);
        let mut buf = ImageBuffer::new(self.width, self.height);
        if pixels.len() == buf.data.len() {
            buf.data.copy_from_slice(pixels);
        }
        self.layers.push(Layer {
            id,
            name: if name.is_empty() {
                format!("Layer {}", id)
            } else {
                name.to_string()
            },
            visible,
            opacity: opacity.clamp(0.0, 1.0),
            buf,
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        });
        self.active = self.layers.len() - 1;
        id
    }

    /// Restore a text annotation onto the active (just-pushed) layer WITHOUT
    /// pushing history. Mirrors `restore_shape_annotation` for text. The tile is
    /// rebuilt from config; a fresh id is assigned.
    pub fn restore_text_annotation(
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
        bg_tail: u32,
    ) -> u32 {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id, text, font_size, r, g, b, bold, x, y, rotation_deg,
            background_kind, bg_r, bg_g, bg_b, bg_a,
            bg_padding, bg_corner_radius, bg_tail,
        );
        let active = self.active;
        if let Some(layer) = self.layers.get_mut(active) {
            layer.text_annotations.push(ann);
        }
        id
    }

    /// Finish a layer-restore: clamp the active layer to `active_index`,
    /// guarantee a non-empty stack, and rebuild the composite cache.
    pub fn finish_layer_restore(&mut self, active_index: usize) {
        if self.layers.is_empty() {
            self.layers
                .push(Layer::new(1, "Background".to_string(), self.width, self.height));
            self.next_layer_id = 2;
        }
        self.active = active_index.min(self.layers.len() - 1);
        self.editing_shape_id = None;
        self.recomposite();
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
/// `[x, y, w, h]` as a `Uint32Array`, or `undefined` (`None`) on invalid input
/// so callers can't silently destructure an empty array.
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
) -> Option<Vec<u32>> {
    if ratio_w == 0 || ratio_h == 0 || image_w == 0 || image_h == 0 {
        return None;
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
        return Some(vec![start_x.max(0) as u32, start_y.max(0) as u32, 1, 1]);
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
    Some(vec![x as u32, y as u32, w_u, h_u])
}

/// Compute the largest centred rectangle with the given aspect ratio that
/// fits inside an `image_w` × `image_h` image. Used by the Crop tool's
/// ratio buttons (1:1, 4:3, 16:9, …) so the JS side doesn't reinvent the
/// math. Returns `[x, y, w, h]` as a `Uint32Array`, or `undefined` (`None`)
/// on any non-positive input so callers can't silently destructure empty.
#[wasm_bindgen]
pub fn compute_aspect_crop(
    image_w: u32,
    image_h: u32,
    ratio_w: u32,
    ratio_h: u32,
) -> Option<Vec<u32>> {
    if image_w == 0 || image_h == 0 || ratio_w == 0 || ratio_h == 0 {
        return None;
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
    Some(vec![x, y, cw_u, ch_u])
}
#[cfg(test)]
mod layer_tests {
    use super::*;

    /// A solid WxH RGBA image filled with one colour.
    fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&rgba);
        }
        v
    }

    fn px(tool: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
        let data = tool.get_image_data();
        let i = ((y * tool.width + x) * 4) as usize;
        [data[i], data[i + 1], data[i + 2], data[i + 3]]
    }

    #[test]
    fn starts_with_one_background_layer() {
        let t = ImageHorseTool::new(4, 4);
        assert_eq!(t.layer_count(), 1);
        assert_eq!(t.active, 0);
    }

    #[test]
    fn add_layer_inserts_above_and_activates() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [255, 0, 0, 255]));
        let id = t.add_layer("Layer 2");
        assert_eq!(t.layer_count(), 2);
        assert_eq!(t.active_layer_id(), id);
        assert_eq!(t.active, 1);
        // New layer is transparent → composite still shows the red background.
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn upper_opaque_layer_covers_lower() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        t.add_layer("top");
        // Paint the top (active) layer solid blue.
        let top = t.active;
        t.layers[top].buf.data = solid(2, 2, [0, 0, 255, 255]);
        assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
    }

    #[test]
    fn shape_solid_fill_paints_interior() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [255, 255, 255, 255]));
        // Rect (4,4)-(16,16), solid blue fill (kind 1), thin black stroke.
        t.add_shape_annotation(0, 4.0, 4.0, 16.0, 16.0, "#000000", 1.0, 0, 1, "#0000ff", "#000000", 0, 0);
        let p = px(&t, 10, 10); // interior centre
        assert_eq!([p[0], p[1], p[2]], [0, 0, 255], "interior should be blue fill, got {p:?}");
    }

    #[test]
    fn shape_no_fill_leaves_interior_untouched() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [255, 255, 255, 255]));
        // fill_kind 0 = none → interior stays white.
        t.add_shape_annotation(0, 4.0, 4.0, 16.0, 16.0, "#000000", 1.0, 0, 0, "#000000", "#000000", 0, 0);
        assert_eq!(px(&t, 10, 10), [255, 255, 255, 255]);
    }

    #[test]
    fn shape_gradient_fill_varies_across_axis() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [255, 255, 255, 255]));
        // Horizontal (angle 0) gradient red→green across a wide rect; no stroke
        // bleed in the centre band we sample.
        t.add_shape_annotation(0, 2.0, 2.0, 38.0, 38.0, "#000000", 1.0, 0, 2, "#ff0000", "#00ff00", 0, 0);
        let left = px(&t, 6, 20);
        let right = px(&t, 34, 20);
        assert!(left[0] > left[1], "left end should be redder, got {left:?}");
        assert!(right[1] > right[0], "right end should be greener, got {right:?}");
    }

    #[test]
    fn redact_region_paints_opaque_color() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [255, 255, 255, 255]));
        t.begin_redact_stroke();
        t.redact_region(10.0, 10.0, 5.0, 0, 0, 0);
        assert_eq!(px(&t, 10, 10), [0, 0, 0, 255], "brush centre redacted to black");
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255], "corner outside brush untouched");
    }

    #[test]
    fn pixelate_region_keeps_solid_color() {
        let mut t = ImageHorseTool::new(32, 32);
        t.load_image(&solid(32, 32, [40, 80, 120, 255]));
        t.begin_pixelate_stroke();
        t.pixelate_region(16.0, 16.0, 16.0, 8);
        // Averaging a uniform region leaves the colour unchanged.
        assert_eq!(px(&t, 16, 16), [40, 80, 120, 255]);
    }

    #[test]
    fn shape_pixelate_fill_quantizes_into_blocks() {
        let mut t = ImageHorseTool::new(16, 16);
        // Horizontal grey ramp so neighbouring columns differ before pixelating.
        let mut data = Vec::with_capacity(16 * 16 * 4);
        for _y in 0..16 {
            for x in 0..16u32 {
                let v = (x * 17) as u8;
                data.extend_from_slice(&[v, v, v, 255]);
            }
        }
        t.load_image(&data);
        // Whole-image rect, pixelate fill (kind 3), one 16px block → one cell.
        t.add_shape_annotation(0, 0.0, 0.0, 15.0, 15.0, "#000000", 0.0, 0, 3, "#000000", "#000000", 0, 16);
        let a = px(&t, 2, 8);
        let b = px(&t, 13, 8);
        assert_eq!(a, b, "a single mosaic block must be uniform, {a:?} vs {b:?}");
    }

    #[test]
    fn shape_json_includes_fill_block() {
        let mut t = ImageHorseTool::new(16, 16);
        t.load_image(&solid(16, 16, [0, 0, 0, 255]));
        t.add_shape_annotation(0, 1.0, 1.0, 10.0, 10.0, "#000000", 1.0, 0, 3, "#000000", "#000000", 0, 24);
        let json = t.get_layer_shape_annotations(0);
        assert!(json.contains("\"fill_block\":24"), "got {json}");
    }

    #[test]
    fn visibility_toggle_hides_layer() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [0, 0, 255, 255]);
        assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
        t.set_layer_visible(top, false);
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn opacity_blends_50_percent() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [0, 0, 0, 255]));
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [255, 255, 255, 255]);
        t.set_layer_opacity(top, 0.5);
        let p = px(&t, 0, 0);
        // ~50% white over black ≈ 128 on each channel.
        assert!((p[0] as i32 - 128).abs() <= 2, "got {:?}", p);
        assert_eq!(p[3], 255);
    }

    #[test]
    fn undo_removes_added_layer() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [9, 9, 9, 255]));
        assert_eq!(t.layer_count(), 1);
        t.add_layer("temp");
        assert_eq!(t.layer_count(), 2);
        assert!(t.undo());
        assert_eq!(t.layer_count(), 1);
        assert!(t.redo());
        assert_eq!(t.layer_count(), 2);
    }

    #[test]
    fn cannot_remove_last_layer() {
        let mut t = ImageHorseTool::new(2, 2);
        assert!(!t.remove_layer(t.active_layer_id()));
        assert_eq!(t.layer_count(), 1);
    }

    #[test]
    fn merge_down_combines_layers() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [0, 0, 255, 255]);
        assert!(t.merge_down(top));
        assert_eq!(t.layer_count(), 1);
        assert_eq!(px(&t, 0, 0), [0, 0, 255, 255]);
    }

    #[test]
    fn flatten_all_collapses_stack() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255]));
        t.add_layer("a");
        t.add_layer("b");
        assert_eq!(t.layer_count(), 3);
        t.flatten_all();
        assert_eq!(t.layer_count(), 1);
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn move_layer_reorders() {
        let mut t = ImageHorseTool::new(2, 2);
        t.load_image(&solid(2, 2, [255, 0, 0, 255])); // bottom red
        let top = t.add_layer("top");
        let ti = t.active;
        t.layers[ti].buf.data = solid(2, 2, [0, 255, 0, 255]); // green on top
        assert_eq!(px(&t, 0, 0), [0, 255, 0, 255]);
        // Move green to the bottom → red now on top.
        t.move_layer(top, 0);
        assert_eq!(px(&t, 0, 0), [255, 0, 0, 255]);
    }

    #[test]
    fn paste_region_targets_active_layer() {
        let mut t = ImageHorseTool::new(4, 4);
        t.load_image(&solid(4, 4, [0, 0, 0, 255]));
        t.add_layer("paste-target");
        // Paste a 2x2 white block at (0,0) into the active (transparent) layer.
        t.paste_region(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0);
        assert_eq!(px(&t, 0, 0), [255, 255, 255, 255]);
        // Outside the paste, the black background shows through.
        assert_eq!(px(&t, 3, 3), [0, 0, 0, 255]);
    }
}

#[cfg(test)]
mod layer_persistence_tests {
    use super::*;

    fn solid(w: u32, h: u32, rgba: [u8; 4]) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&rgba);
        }
        v
    }

    fn px(tool: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
        let data = tool.get_image_data();
        let i = ((y * tool.width + x) * 4) as usize;
        [data[i], data[i + 1], data[i + 2], data[i + 3]]
    }

    #[test]
    fn restore_rebuilds_stack_and_active() {
        let mut t = ImageHorseTool::new(2, 2);
        t.begin_layer_restore();
        let id0 = t.push_restored_layer(&solid(2, 2, [10, 20, 30, 255]), 2, 2, "Background", true, 1.0);
        let id1 = t.push_restored_layer(&solid(2, 2, [0, 0, 0, 0]), 2, 2, "Top", true, 0.5);
        t.finish_layer_restore(1);
        assert_eq!(t.layer_count(), 2);
        assert_eq!(t.active, 1);
        assert_ne!(id0, id1);
        // Top layer transparent → bottom colour shows through.
        assert_eq!(px(&t, 0, 0), [10, 20, 30, 255]);
        // Per-layer PNG serialization is non-empty.
        assert!(!t.get_layer_png(0).is_empty());
        assert!(!t.get_layer_png(1).is_empty());
    }

    #[test]
    fn per_layer_annotation_serialization_is_isolated() {
        let mut t = ImageHorseTool::new(16, 16);
        t.load_image(&solid(16, 16, [0, 0, 0, 255]));
        // Shape on the base layer (active = 0).
        t.add_shape_annotation(0, 1.0, 1.0, 5.0, 5.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0);
        // New empty top layer.
        t.add_layer("top");
        let s0 = t.get_layer_shape_annotations(0);
        let s1 = t.get_layer_shape_annotations(1);
        assert!(s0.contains("\"kind\":0"), "base layer should carry the shape: {s0}");
        assert_eq!(s1, "[]", "top layer should have no shapes");
    }

    #[test]
    fn restore_text_annotation_attaches_to_active_layer() {
        let mut t = ImageHorseTool::new(32, 32);
        t.begin_layer_restore();
        t.push_restored_layer(&solid(32, 32, [255, 255, 255, 255]), 32, 32, "bg", true, 1.0);
        t.restore_text_annotation(
            "hi", 16.0, 0, 0, 0, false, 2, 2, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
        );
        t.finish_layer_restore(0);
        let json = t.get_layer_text_annotations(0);
        assert!(json.contains("\"text\":\"hi\""), "got {json}");
        // No history pushed by the restore path.
        assert_eq!(t.undo_count(), 0);
    }
}
