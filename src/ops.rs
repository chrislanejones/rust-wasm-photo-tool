//! Operation log — a serializable, replayable history of edits over a
//! single-layer document.
//!
//! Feature-gated behind `tiles`; not part of the default wasm build. The log
//! is the source of truth for undo/redo and content-addressed persistence:
//! every edit is an [`Op`], appended in order, with periodic keyframe
//! snapshots so replay does not have to start from scratch.
//!
//! ## The document model
//! The log replays over a [`Document`]: the layer's PIXEL buffer (as a
//! [`TileBuffer`]) plus the live text/shape annotation lists — the same
//! split the engine itself keeps (`Layer.buf` + `Layer.text_annotations` /
//! `shape_annotations`). Pixel ops (stroke, blur, fill, crop, levels, move)
//! mutate the pixels; annotation ops mutate the lists. This is what makes
//! `TextEdit` / `TextRemove` replayable — a bake-on-add model could never
//! undo a remove. The user-visible canvas is [`Document::composite`], which
//! renders annotations over pixels through the SAME `render_shape_into` /
//! `build_annotation_tile` / `paste_region` code the live compositor uses.
//!
//! ## Apply fidelity
//! Every implemented op calls the engine's own kernel, not a re-derivation:
//! - `Stroke` → `paint::dab_coverage` + `paint::segment_dab_centers` +
//!   `paint::composite_stroke_bbox` (the live brush delegates to the same
//!   three functions).
//! - `Blur` → `filters::gaussian_blur_region` with the same
//!   `build_gaussian_kernel` the live blur-brush uses; `points` are the
//!   exact dab centres in stamp order (blur dabs are order-dependent).
//! - `Crop` → `transform::crop` + the same annotation-offset shift as
//!   `crop_in_place`.
//! - `LayerMove` → `transform::translate` + the same annotation shift as
//!   `translate_active_layer`.
//! - Text/shape ops are list mutations of the same parameter sets the
//!   engine stores.
//!
//! ## Serialization
//! Each op serializes as `[format-version byte] ++ postcard(op)`. A bumped
//! version is rejected cleanly by [`decode_op`], so old logs never silently
//! mis-decode against a newer schema. The schema was reshaped for replay
//! parity (f64 stroke geometry, dab-centre blur, full-fidelity text/shape
//! params) BEFORE any log was ever persisted, so the format version stays 1
//! — version 1 now means "the parity schema".

use crate::tiles::TileBuffer;
use serde::{Deserialize, Serialize};

/// Leading byte on every encoded op. Bump when the schema changes
/// incompatibly.
pub const OP_FORMAT_VERSION: u8 = 1;

/// Number of ops between keyframe snapshots. Replay restores the nearest
/// keyframe at or before the target, then applies the remainder.
pub const KEYFRAME_INTERVAL: usize = 50;

/// Axis-aligned rectangle in canvas pixel coords.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

/// Straight (non-premultiplied) RGBA colour.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

/// Brush parameters for a freehand stroke — the exact inputs
/// `paint_down`/`paint_stroke_to` feed the shared stroke kernels. `radius`
/// is stored (not the UI's diameter) and geometry stays f64 because that is
/// the engine's own math domain; quantizing would break byte parity.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Brush {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    /// Dab radius in px (the UI slider's size × 0.5, as `paint_down` computes).
    pub radius: f64,
    /// 0.0 (soft) .. 1.0 (hard).
    pub hardness: f32,
    /// 0.0 .. 1.0.
    pub opacity: f32,
    /// Eraser stroke: scrubs alpha instead of laying colour — the same
    /// coverage machinery with `recomposite`'s erase branch.
    pub erase: bool,
}

/// Levels remap: `black`/`white` input points and output `gamma`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LevelsParams {
    pub black: u8,
    pub white: u8,
    pub gamma: f32,
}

/// Full-fidelity serializable mirror of the engine's `TextAnnotation`
/// (minus the derived tile cache, which [`Document::composite`] rebuilds
/// through the same `build_annotation_tile`). Every field that affects
/// rendering is here — background and shadow included — so replay parity
/// is by construction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextParams {
    pub id: u32,
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub font_size: f32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub bold: bool,
    pub rotation_deg: f64,
    /// 0 = none, 1 = filled rounded rect, 2 = speech bubble.
    pub background_kind: u8,
    pub bg_r: u8,
    pub bg_g: u8,
    pub bg_b: u8,
    pub bg_a: u8,
    pub bg_padding: u32,
    pub bg_corner_radius: u32,
    pub bg_tail: u32,
    pub shadow_box: bool,
    pub shadow_text: bool,
    pub shadow_r: u8,
    pub shadow_g: u8,
    pub shadow_b: u8,
    pub shadow_a: u8,
    pub shadow_dx: i32,
    pub shadow_dy: i32,
    pub shadow_blur: u32,
}

/// Full-fidelity serializable mirror of the engine's `ShapeAnnotation` —
/// same reasoning as [`TextParams`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShapeParams {
    pub id: u32,
    /// 0=rect, 1=circle, 2=line, 3=handCircle, 4=arrow, 5=pin, 6=polyline,
    /// 7=bezier.
    pub kind: u8,
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub stroke_width: f64,
    pub arrow_style: u8,
    pub number: u32,
    pub label_kind: u8,
    pub points: Vec<(f64, f64)>,
    pub fill_kind: u8,
    pub fill_r: u8,
    pub fill_g: u8,
    pub fill_b: u8,
    pub fill_a: u8,
    pub fill2_r: u8,
    pub fill2_g: u8,
    pub fill2_b: u8,
    pub fill2_a: u8,
    pub fill_angle: u16,
    pub fill_block: u32,
}

impl TextParams {
    /// Capture the full render-relevant state of a live engine annotation —
    /// what the Stage-4 recorder stores for TextAdd/TextEdit.
    pub(crate) fn from_annotation(a: &crate::annotations::TextAnnotation) -> Self {
        TextParams {
            id: a.id,
            text: a.text.clone(),
            x: a.x,
            y: a.y,
            font_size: a.font_size,
            r: a.r,
            g: a.g,
            b: a.b,
            bold: a.bold,
            rotation_deg: a.rotation_deg,
            background_kind: a.background_kind,
            bg_r: a.bg_r,
            bg_g: a.bg_g,
            bg_b: a.bg_b,
            bg_a: a.bg_a,
            bg_padding: a.bg_padding,
            bg_corner_radius: a.bg_corner_radius,
            bg_tail: a.bg_tail,
            shadow_box: a.shadow_box,
            shadow_text: a.shadow_text,
            shadow_r: a.shadow_r,
            shadow_g: a.shadow_g,
            shadow_b: a.shadow_b,
            shadow_a: a.shadow_a,
            shadow_dx: a.shadow_dx,
            shadow_dy: a.shadow_dy,
            shadow_blur: a.shadow_blur,
        }
    }
}

impl ShapeParams {
    /// Capture a live engine shape annotation (recorder side).
    pub(crate) fn from_annotation(s: &crate::annotations::ShapeAnnotation) -> Self {
        ShapeParams {
            id: s.id,
            kind: s.kind,
            x0: s.x0,
            y0: s.y0,
            x1: s.x1,
            y1: s.y1,
            r: s.r,
            g: s.g,
            b: s.b,
            stroke_width: s.stroke_width,
            arrow_style: s.arrow_style,
            number: s.number,
            label_kind: s.label_kind,
            points: s.points.clone(),
            fill_kind: s.fill_kind,
            fill_r: s.fill_r,
            fill_g: s.fill_g,
            fill_b: s.fill_b,
            fill_a: s.fill_a,
            fill2_r: s.fill2_r,
            fill2_g: s.fill2_g,
            fill2_b: s.fill2_b,
            fill2_a: s.fill2_a,
            fill_angle: s.fill_angle,
            fill_block: s.fill_block,
        }
    }

    /// Rebuild the engine's annotation struct for rendering. (Kept here so
    /// the field-for-field mapping lives next to the params it mirrors.)
    pub(crate) fn to_annotation(&self) -> crate::annotations::ShapeAnnotation {
        crate::annotations::ShapeAnnotation {
            id: self.id,
            kind: self.kind,
            x0: self.x0,
            y0: self.y0,
            x1: self.x1,
            y1: self.y1,
            r: self.r,
            g: self.g,
            b: self.b,
            stroke_width: self.stroke_width,
            arrow_style: self.arrow_style,
            number: self.number,
            label_kind: self.label_kind,
            points: self.points.clone(),
            fill_kind: self.fill_kind,
            fill_r: self.fill_r,
            fill_g: self.fill_g,
            fill_b: self.fill_b,
            fill_a: self.fill_a,
            fill2_r: self.fill2_r,
            fill2_g: self.fill2_g,
            fill2_b: self.fill2_b,
            fill2_a: self.fill2_a,
            fill_angle: self.fill_angle,
            fill_block: self.fill_block,
        }
    }
}

/// A single recorded edit. Every variant is applied for real (no no-ops).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Op {
    /// Freehand brush stroke (paint or erase — see [`Brush::erase`]).
    /// `points` is the post-stabilizer painted polyline: the down point,
    /// then each painted segment endpoint. Dab placement along segments is
    /// re-derived through the SAME `segment_dab_centers` the live brush
    /// uses.
    Stroke {
        points: Vec<(f64, f64)>,
        brush: Brush,
    },
    /// Fill a rectangle with a flat colour.
    FillRegion { rect: Rect, color: Rgba },
    /// Gaussian-blur brush stroke: `points` are the EXACT dab centres in
    /// stamp order (blur dabs read already-blurred pixels, so order
    /// matters), `radius` the brush radius, `intensity` the kernel radius.
    Blur {
        points: Vec<(f64, f64)>,
        radius: f64,
        intensity: u32,
    },
    /// Black/white/gamma remap over the whole canvas.
    Levels(LevelsParams),
    /// Crop to a rectangle, changing logical bounds. Annotations shift with
    /// the crop origin exactly as `crop_in_place` shifts them.
    Crop { rect: Rect },
    /// Add a text annotation.
    TextAdd(TextParams),
    /// Replace an existing text annotation's full state (the recorder
    /// captures post-edit state, shadow preservation included).
    TextEdit(TextParams),
    /// Remove a text annotation by id.
    TextRemove { id: u32 },
    /// Add a shape annotation.
    ShapeAdd(ShapeParams),
    /// Remove a shape annotation by id.
    ShapeRemove { id: u32 },
    /// Content translation of the (single) layer — pixels and annotations
    /// move together, exactly as `translate_active_layer` commits a Move.
    LayerMove { layer: u32, dx: i32, dy: i32 },
    /// Replace an existing shape annotation's full state (re-selected and
    /// edited live shapes/arrows/pen paths).
    ShapeEdit(ShapeParams),
}

/// Errors from decoding an encoded op.
#[derive(Debug, PartialEq, Eq)]
pub enum OpError {
    /// Byte stream was empty (no version byte).
    Empty,
    /// Version byte did not match [`OP_FORMAT_VERSION`].
    UnsupportedVersion(u8),
    /// Payload failed to deserialize.
    Decode,
}

impl std::fmt::Display for OpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpError::Empty => write!(f, "empty op byte stream"),
            OpError::UnsupportedVersion(v) => {
                write!(
                    f,
                    "unsupported op format version {v} (expected {OP_FORMAT_VERSION})"
                )
            }
            OpError::Decode => write!(f, "op payload failed to decode"),
        }
    }
}

impl std::error::Error for OpError {}

/// Encode an op as `[version byte] ++ postcard(op)`.
pub fn encode_op(op: &Op) -> Vec<u8> {
    let mut out = Vec::with_capacity(32);
    out.push(OP_FORMAT_VERSION);
    // postcard serialization of a plain data enum is infallible in practice;
    // if it ever fails we surface an empty-payload stream rather than panic.
    if let Ok(body) = postcard::to_allocvec(op) {
        out.extend_from_slice(&body);
    }
    out
}

/// Decode an op, validating the leading version byte first.
pub fn decode_op(bytes: &[u8]) -> Result<Op, OpError> {
    let (&ver, body) = bytes.split_first().ok_or(OpError::Empty)?;
    if ver != OP_FORMAT_VERSION {
        return Err(OpError::UnsupportedVersion(ver));
    }
    postcard::from_bytes(body).map_err(|_| OpError::Decode)
}

/// Frame a slice of ops for persistence: `[u32 LE frame-length][frame]*`,
/// where each frame is [`encode_op`]'s output. The framing lets a chunk hold
/// any number of ops while staying self-describing.
pub fn encode_op_frames(ops: &[Op]) -> Vec<u8> {
    let mut out = Vec::new();
    for op in ops {
        let frame = encode_op(op);
        out.extend_from_slice(&(frame.len() as u32).to_le_bytes());
        out.extend_from_slice(&frame);
    }
    out
}

/// Decode a persisted frame stream back into ops. Rejects truncated frames
/// and any frame whose version byte doesn't match — a torn tail can't decode
/// into silently-wrong history.
pub fn decode_op_frames(bytes: &[u8]) -> Result<Vec<Op>, OpError> {
    let mut ops = Vec::new();
    let mut at = 0usize;
    while at < bytes.len() {
        if at + 4 > bytes.len() {
            return Err(OpError::Decode);
        }
        let len =
            u32::from_le_bytes([bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]]) as usize;
        at += 4;
        if at + len > bytes.len() {
            return Err(OpError::Decode);
        }
        ops.push(decode_op(&bytes[at..at + len])?);
        at += len;
    }
    Ok(ops)
}

/// Serialize a document's annotation lists (postcard, version-prefixed) —
/// the piece of a base/keyframe snapshot that flat pixels can't carry.
/// Keeping pre-log annotations LIVE across a persist→restore round trip is
/// what lets TextEdit/TextRemove ops on them replay exactly.
pub fn encode_annotations(texts: &[TextParams], shapes: &[ShapeParams]) -> Vec<u8> {
    let mut out = Vec::with_capacity(16);
    out.push(OP_FORMAT_VERSION);
    if let Ok(body) = postcard::to_allocvec(&(texts, shapes)) {
        out.extend_from_slice(&body);
    }
    out
}

/// Inverse of [`encode_annotations`].
#[allow(clippy::type_complexity)]
pub fn decode_annotations(bytes: &[u8]) -> Result<(Vec<TextParams>, Vec<ShapeParams>), OpError> {
    let (&ver, body) = bytes.split_first().ok_or(OpError::Empty)?;
    if ver != OP_FORMAT_VERSION {
        return Err(OpError::UnsupportedVersion(ver));
    }
    postcard::from_bytes(body).map_err(|_| OpError::Decode)
}

// ── The replay document ─────────────────────────────────────────────────────

/// The state ops replay over: the single layer's pixels plus its live
/// annotation lists. See the module doc ("The document model").
#[derive(Clone)]
pub struct Document {
    pub pixels: TileBuffer,
    pub texts: Vec<TextParams>,
    pub shapes: Vec<ShapeParams>,
}

impl Document {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            pixels: TileBuffer::new(width, height),
            texts: Vec::new(),
            shapes: Vec::new(),
        }
    }

    pub fn width(&self) -> u32 {
        self.pixels.width()
    }

    pub fn height(&self) -> u32 {
        self.pixels.height()
    }

    /// The layer pixels as a flat RGBA buffer (row-major).
    fn pixels_flat(&self) -> Vec<u8> {
        let mut flat = vec![0u8; (self.width() as usize) * (self.height() as usize) * 4];
        self.pixels.blit_to_flat(&mut flat);
        flat
    }

    /// Render the user-visible canvas: pixels, then shapes, then text tiles —
    /// the same order and the same rasterisation calls as the engine's
    /// `render_layer` (single layer, no mask, opacity 1, nothing being
    /// edited).
    pub fn composite_flat(&self) -> Vec<u8> {
        let w = self.width();
        let h = self.height();
        let mut flat = self.pixels_flat();
        for s in &self.shapes {
            crate::annotations::render_shape_into(&mut flat, w, h, &s.to_annotation());
        }
        for t in &self.texts {
            let (tile, tile_w, tile_h, off_x, off_y) = build_text_tile(t);
            crate::transform::paste_region(
                &mut flat,
                w as i32,
                h as i32,
                &tile,
                tile_w,
                tile_h,
                t.x + off_x,
                t.y + off_y,
            );
        }
        flat
    }

    /// Content hash of the user-visible canvas (composite, not just pixels)
    /// — annotation ops change this even though they leave `pixels` alone.
    pub fn composite_hash(&self) -> u64 {
        let mut buf = TileBuffer::new(self.width(), self.height());
        buf.blit_from_flat(&self.composite_flat(), self.width(), self.height());
        buf.content_hash()
    }
}

/// Build a text annotation's pre-rendered (possibly rotated) tile through
/// the engine's own `build_annotation_tile`. Returns
/// (pixels, w, h, off_x, off_y).
fn build_text_tile(t: &TextParams) -> (Vec<u8>, u32, u32, i32, i32) {
    crate::layer::build_annotation_tile(
        &t.text,
        t.font_size,
        t.r,
        t.g,
        t.b,
        t.bold,
        t.rotation_deg,
        t.background_kind,
        t.bg_r,
        t.bg_g,
        t.bg_b,
        t.bg_a,
        t.bg_padding,
        t.bg_corner_radius,
        t.bg_tail,
        t.shadow_box,
        t.shadow_text,
        t.shadow_r,
        t.shadow_g,
        t.shadow_b,
        t.shadow_a,
        t.shadow_dx,
        t.shadow_dy,
        t.shadow_blur,
    )
}

// ── Applying ops ─────────────────────────────────────────────────────────────

/// Apply a single op to a document. Pixel ops route through the engine's own
/// kernels (see the module doc, "Apply fidelity").
pub fn apply(op: &Op, doc: &mut Document) {
    match op {
        Op::FillRegion { rect, color } => {
            let c = [color.r, color.g, color.b, color.a];
            let x0 = rect.x.max(0);
            let y0 = rect.y.max(0);
            let x1 = (rect.x + rect.w as i32)
                .min(doc.pixels.width() as i32)
                .max(x0);
            let y1 = (rect.y + rect.h as i32)
                .min(doc.pixels.height() as i32)
                .max(y0);
            for y in y0..y1 {
                for x in x0..x1 {
                    doc.pixels.set_pixel(x, y, c);
                }
            }
        }
        Op::Crop { rect } => {
            let (ow, oh) = (doc.width(), doc.height());
            if ow == 0 || oh == 0 {
                return;
            }
            // Pixels through the engine's own crop...
            let cx = (rect.x.max(0) as u32).min(ow - 1);
            let cy = (rect.y.max(0) as u32).min(oh - 1);
            let flat = doc.pixels_flat();
            let (out, nw, nh) = crate::transform::crop(&flat, ow, oh, cx, cy, rect.w, rect.h);
            doc.pixels.blit_from_flat(&out, nw, nh);
            // ...and annotations shifted by the crop origin, exactly as
            // `crop_in_place` shifts them.
            let dx = -(cx as i32);
            let dy = -(cy as i32);
            shift_annotations(doc, dx, dy);
        }
        Op::Levels(p) => {
            let lut = build_levels_lut(p);
            doc.pixels.map_pixels_mut(|px| {
                // Leave fully-transparent pixels untouched so transparent space
                // (incl. edge-tile padding) stays pristine and hashes stably.
                if px[3] == 0 {
                    px
                } else {
                    [
                        lut[px[0] as usize],
                        lut[px[1] as usize],
                        lut[px[2] as usize],
                        px[3],
                    ]
                }
            });
        }
        Op::Stroke { points, brush } => {
            let w = doc.width();
            let h = doc.height();
            if w == 0 || h == 0 || points.is_empty() {
                return;
            }
            let wi = w as i32;
            let hi = h as i32;
            // Whole-stroke coverage, then ONE composite over the union bbox —
            // provably identical to the live brush's incremental
            // recomposites: coverage max-combines (order/duplicate
            // insensitive) and the composite is a pure function of
            // (base, final coverage) at every pixel.
            let mut cov = vec![0u8; (w as usize) * (h as usize)];
            let mut bbox: Option<(i32, i32, i32, i32)> = None;
            let merge = |bb: (i32, i32, i32, i32), bbox: &mut Option<(i32, i32, i32, i32)>| {
                *bbox = Some(match *bbox {
                    None => bb,
                    Some(a) => (a.0.min(bb.0), a.1.min(bb.1), a.2.max(bb.2), a.3.max(bb.3)),
                });
            };
            // The down-point dab, then each painted segment — the same call
            // sequence as paint_down + paint_move (stabilizer already
            // resolved: `points` is the painted polyline).
            if let Some(bb) = crate::paint::dab_coverage(
                &mut cov,
                wi,
                hi,
                points[0].0,
                points[0].1,
                brush.radius,
                brush.hardness,
            ) {
                merge(bb, &mut bbox);
            }
            for k in 1..points.len() {
                let (x0, y0) = points[k - 1];
                let (x1, y1) = points[k];
                for (cx, cy) in crate::paint::segment_dab_centers(x0, y0, x1, y1, brush.radius) {
                    if let Some(bb) = crate::paint::dab_coverage(
                        &mut cov,
                        wi,
                        hi,
                        cx,
                        cy,
                        brush.radius,
                        brush.hardness,
                    ) {
                        merge(bb, &mut bbox);
                    }
                }
            }
            if let Some((min_x, min_y, max_x, max_y)) = bbox {
                let mut flat = doc.pixels_flat();
                let base = flat.clone();
                crate::paint::composite_stroke_bbox(
                    &mut flat,
                    &base,
                    &cov,
                    wi,
                    min_x,
                    min_y,
                    max_x,
                    max_y,
                    (brush.r, brush.g, brush.b),
                    brush.opacity,
                    brush.erase,
                );
                doc.pixels.blit_from_flat(&flat, w, h);
            }
        }
        Op::Blur {
            points,
            radius,
            intensity,
        } => {
            let w = doc.width();
            let h = doc.height();
            if w == 0 || h == 0 || points.is_empty() {
                return;
            }
            // Same kernel construction as the live blur brush's per-intensity
            // cache; dabs are stamped in recorded order because each one
            // reads the previous dabs' output.
            let kernel = crate::filters::build_gaussian_kernel((*intensity).clamp(1, 30));
            let mut flat = doc.pixels_flat();
            let mut scratch_a = Vec::new();
            let mut scratch_b = Vec::new();
            for &(cx, cy) in points {
                crate::filters::gaussian_blur_region(
                    &mut flat,
                    w,
                    h,
                    cx,
                    cy,
                    *radius,
                    *intensity,
                    &mut scratch_a,
                    &mut scratch_b,
                    &kernel,
                );
            }
            doc.pixels.blit_from_flat(&flat, w, h);
        }
        Op::TextAdd(p) => {
            doc.texts.push(p.clone());
        }
        Op::TextEdit(p) => {
            if let Some(t) = doc.texts.iter_mut().find(|t| t.id == p.id) {
                *t = p.clone();
            }
        }
        Op::TextRemove { id } => {
            doc.texts.retain(|t| t.id != *id);
        }
        Op::ShapeAdd(p) => {
            doc.shapes.push(p.clone());
        }
        Op::ShapeEdit(p) => {
            if let Some(s) = doc.shapes.iter_mut().find(|s| s.id == p.id) {
                *s = p.clone();
            }
        }
        Op::ShapeRemove { id } => {
            doc.shapes.retain(|s| s.id != *id);
        }
        Op::LayerMove { layer: _, dx, dy } => {
            if *dx == 0 && *dy == 0 {
                return;
            }
            let w = doc.width();
            let h = doc.height();
            if w == 0 || h == 0 {
                return;
            }
            // Exactly `translate_active_layer`: pixels through
            // `transform::translate`, annotations shifted by the same delta.
            let flat = doc.pixels_flat();
            let moved = crate::transform::translate(&flat, w as i32, h as i32, *dx, *dy);
            doc.pixels.blit_from_flat(&moved, w, h);
            shift_annotations(doc, *dx, *dy);
        }
    }
}

/// Shift every annotation by (dx, dy) — the shared tail of Crop and
/// LayerMove, mirroring `crop_in_place` / `translate_active_layer`.
fn shift_annotations(doc: &mut Document, dx: i32, dy: i32) {
    for a in &mut doc.texts {
        a.x += dx;
        a.y += dy;
    }
    for s in &mut doc.shapes {
        s.x0 += dx as f64;
        s.y0 += dy as f64;
        s.x1 += dx as f64;
        s.y1 += dy as f64;
        for p in &mut s.points {
            p.0 += dx as f64;
            p.1 += dy as f64;
        }
    }
}

/// Precompute the 256-entry levels remap for a channel value.
fn build_levels_lut(p: &LevelsParams) -> [u8; 256] {
    let lo = p.black as f32;
    let hi = p.white as f32;
    let denom = (hi - lo).max(1.0);
    let inv_gamma = 1.0 / p.gamma.max(0.01);
    let mut lut = [0u8; 256];
    for (v, out) in lut.iter_mut().enumerate() {
        let t = ((v as f32 - lo) / denom).clamp(0.0, 1.0);
        let t = t.powf(inv_gamma);
        *out = (t * 255.0).round().clamp(0.0, 255.0) as u8;
    }
    lut
}

// ── The log ──────────────────────────────────────────────────────────────────

/// How many trailing keyframes stay resident in memory (besides the
/// index-0 base). Older ones are pruned — a seek behind the pruned range
/// replays from the base keyframe: slower, still exact. Persistence
/// (the night project's Task B) will keep evicted keyframes on disk.
pub const KEYFRAMES_IN_MEMORY: usize = 3;

/// An append-only, keyframed, replayable operation log over a [`Document`].
///
/// The log owns a `live` document kept in sync with the ops, plus keyframe
/// snapshots taken every [`KEYFRAME_INTERVAL`] ops (and one at index 0).
///
/// Undo/redo move the [`cursor`](Self::cursor) with [`seek`](Self::seek)
/// WITHOUT dropping ops (redo stays possible); an [`append`](Self::append)
/// while the cursor is rewound drops the tail first (truncate-on-branch —
/// linear history for now). [`truncate`](Self::truncate) is the hard drop.
pub struct OpLog {
    ops: Vec<Op>,
    /// `(op_count_at_snapshot, document_state_after_that_many_ops)`.
    keyframes: Vec<(usize, Document)>,
    live: Document,
    /// The op count `live` reflects. == `ops.len()` unless rewound by
    /// [`seek`](Self::seek).
    cursor: usize,
    /// Bumped every time an append DROPS a redo tail (history branched).
    /// Persistence compares this against its manifest: unchanged ⇒ the
    /// already-persisted prefix is still valid and only the delta needs
    /// appending; changed ⇒ rewrite.
    generation: u64,
}

impl OpLog {
    /// A new log over an empty `width`×`height` canvas. Index-0 keyframe is the
    /// initial empty state.
    pub fn new(width: u32, height: u32) -> Self {
        Self::with_base(Document::new(width, height))
    }

    /// A new log whose index-0 state is `base` — how the live recorder
    /// starts a log for an already-loaded image (the base corresponds to
    /// the content-addressed original + any pre-log edits; ops describe
    /// everything after).
    pub fn with_base(base: Document) -> Self {
        Self {
            ops: Vec::new(),
            keyframes: vec![(0, base.clone())],
            live: base,
            cursor: 0,
            generation: 0,
        }
    }

    /// Number of ops currently in the log.
    pub fn len(&self) -> usize {
        self.ops.len()
    }

    /// Whether the log has no ops.
    pub fn is_empty(&self) -> bool {
        self.ops.is_empty()
    }

    /// Read-only view of the recorded ops.
    pub fn ops(&self) -> &[Op] {
        &self.ops
    }

    /// The live document's pixel buffer (state after all ops).
    pub fn buffer(&self) -> &TileBuffer {
        &self.live.pixels
    }

    /// The live document (pixels + annotations) after all ops.
    pub fn document(&self) -> &Document {
        &self.live
    }

    /// Number of keyframes currently held (incl. the index-0 snapshot).
    pub fn keyframe_count(&self) -> usize {
        self.keyframes.len()
    }

    /// The op count the live document currently reflects (== [`len`](Self::len)
    /// unless rewound by [`seek`](Self::seek)).
    pub fn cursor(&self) -> usize {
        self.cursor
    }

    /// The live document as the log last computed it.
    pub fn live_document(&self) -> &Document {
        &self.live
    }

    /// Append and apply an op at the cursor. If the cursor was rewound
    /// (undo), the tail past it is dropped first — truncate-on-branch.
    /// Takes a keyframe snapshot when the op count hits a multiple of
    /// [`KEYFRAME_INTERVAL`], and prunes old keyframes past
    /// [`KEYFRAMES_IN_MEMORY`].
    pub fn append(&mut self, op: Op) {
        if self.cursor < self.ops.len() {
            self.ops.truncate(self.cursor);
            let c = self.cursor;
            self.keyframes.retain(|(idx, _)| *idx <= c);
            self.generation += 1;
        }
        apply(&op, &mut self.live);
        self.ops.push(op);
        self.cursor = self.ops.len();
        if self.ops.len().is_multiple_of(KEYFRAME_INTERVAL) {
            self.keyframes.push((self.ops.len(), self.live.clone()));
            self.prune_keyframes();
        }
    }

    /// Persistence generation — see the field doc.
    pub fn generation(&self) -> u64 {
        self.generation
    }

    /// The op-counts of the keyframes currently resident in memory
    /// (ascending; always starts with 0, the base).
    pub fn keyframe_ops(&self) -> Vec<usize> {
        self.keyframes.iter().map(|(idx, _)| *idx).collect()
    }

    /// The resident keyframe document at exactly `at` applied ops, if held.
    pub fn keyframe_document(&self, at: usize) -> Option<&Document> {
        self.keyframes
            .iter()
            .find(|(idx, _)| *idx == at)
            .map(|(_, doc)| doc)
    }

    /// Move the cursor to exactly `n` applied ops WITHOUT dropping any op —
    /// undo (`n = cursor - 1`) and redo (`n = cursor + 1`) both land here.
    /// Rebuilds the live document from the nearest surviving keyframe at or
    /// before `n`. Returns false if `n` is out of range.
    pub fn seek(&mut self, n: usize) -> bool {
        if n > self.ops.len() {
            return false;
        }
        self.live = self.rebuilt_to(n);
        self.cursor = n;
        true
    }

    /// Undo to exactly `n` ops (hard truncate-on-branch). Drops ops and
    /// keyframes past `n` and rebuilds the live document to the state at `n`.
    pub fn truncate(&mut self, n: usize) {
        if n >= self.ops.len() {
            return;
        }
        self.ops.truncate(n);
        self.keyframes.retain(|(idx, _)| *idx <= n);
        // Rebuild live from the nearest surviving keyframe.
        self.live = self.rebuilt_to(n);
        self.cursor = n;
    }

    /// Keep the index-0 base plus the last [`KEYFRAMES_IN_MEMORY`] keyframes;
    /// drop the middle. Seeks behind the kept range replay from the base —
    /// exact, just slower — so memory stays bounded on long sessions (the
    /// whole point of op-log undo vs snapshot stacks).
    fn prune_keyframes(&mut self) {
        while self.keyframes.len() > 1 + KEYFRAMES_IN_MEMORY {
            self.keyframes.remove(1);
        }
    }

    /// Replay the log's PIXELS into `out` up to the CURSOR, starting from
    /// the nearest keyframe (the fast path). Annotation state is on
    /// [`replay_document`](Self::replay_document).
    pub fn replay(&self, out: &mut TileBuffer) {
        *out = self.rebuilt_to(self.cursor).pixels;
    }

    /// Replay the log up to the cursor and return the full document state.
    pub fn replay_document(&self) -> Document {
        self.rebuilt_to(self.cursor)
    }

    /// Replay into `out` from the index-0 keyframe up to the cursor,
    /// ignoring later keyframes (the reference/slow path — used to prove
    /// keyframe replay matches full replay).
    pub fn replay_full(&self, out: &mut TileBuffer) {
        let (_, base) = &self.keyframes[0];
        let mut doc = base.clone();
        for op in &self.ops[..self.cursor] {
            apply(op, &mut doc);
        }
        *out = doc.pixels;
    }

    /// Build the document state after the first `n` ops using the nearest
    /// keyframe at or before `n`.
    fn rebuilt_to(&self, n: usize) -> Document {
        let (kf_idx, base) = self
            .keyframes
            .iter()
            .filter(|(idx, _)| *idx <= n)
            .max_by_key(|(idx, _)| *idx)
            .expect("index-0 keyframe always exists");
        let mut doc = base.clone();
        for op in &self.ops[*kf_idx..n] {
            apply(op, &mut doc);
        }
        doc
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_brush() -> Brush {
        Brush {
            r: 10,
            g: 20,
            b: 30,
            radius: 6.0,
            hardness: 0.8,
            opacity: 0.5,
            erase: false,
        }
    }

    fn test_text(id: u32) -> TextParams {
        TextParams {
            id,
            text: "hi".into(),
            x: 3,
            y: 4,
            font_size: 18.0,
            r: 0,
            g: 0,
            b: 0,
            bold: true,
            rotation_deg: 12.5,
            background_kind: 0,
            bg_r: 0,
            bg_g: 0,
            bg_b: 0,
            bg_a: 0,
            bg_padding: 0,
            bg_corner_radius: 0,
            bg_tail: 0,
            shadow_box: false,
            shadow_text: false,
            shadow_r: 0,
            shadow_g: 0,
            shadow_b: 0,
            shadow_a: 0,
            shadow_dx: 0,
            shadow_dy: 0,
            shadow_blur: 0,
        }
    }

    fn test_shape(id: u32) -> ShapeParams {
        ShapeParams {
            id,
            kind: 1,
            x0: 10.0,
            y0: 10.0,
            x1: 40.0,
            y1: 40.0,
            r: 255,
            g: 0,
            b: 0,
            stroke_width: 2.0,
            arrow_style: 0,
            number: 0,
            label_kind: 0,
            points: Vec::new(),
            fill_kind: 1,
            fill_r: 0,
            fill_g: 128,
            fill_b: 255,
            fill_a: 200,
            fill2_r: 0,
            fill2_g: 0,
            fill2_b: 0,
            fill2_a: 0,
            fill_angle: 0,
            fill_block: 0,
        }
    }

    fn sample_ops() -> Vec<Op> {
        vec![
            Op::Stroke {
                points: vec![(1.0, 2.0), (3.5, 4.5)],
                brush: test_brush(),
            },
            Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 10,
                    h: 10,
                },
                color: Rgba {
                    r: 1,
                    g: 2,
                    b: 3,
                    a: 255,
                },
            },
            Op::Blur {
                points: vec![(15.0, 15.0), (18.0, 16.5)],
                radius: 10.0,
                intensity: 7,
            },
            Op::Levels(LevelsParams {
                black: 16,
                white: 235,
                gamma: 1.2,
            }),
            Op::Crop {
                rect: Rect {
                    x: 2,
                    y: 2,
                    w: 100,
                    h: 100,
                },
            },
            Op::TextAdd(test_text(1)),
            Op::TextEdit(TextParams {
                text: "bye".into(),
                bold: false,
                rotation_deg: 0.0,
                ..test_text(1)
            }),
            Op::TextRemove { id: 1 },
            Op::ShapeAdd(test_shape(2)),
            Op::ShapeRemove { id: 2 },
            Op::LayerMove {
                layer: 0,
                dx: -5,
                dy: 7,
            },
        ]
    }

    #[test]
    fn postcard_round_trip_every_variant() {
        for op in sample_ops() {
            let bytes = encode_op(&op);
            assert_eq!(bytes[0], OP_FORMAT_VERSION, "version byte prefix");
            let back = decode_op(&bytes).expect("decode");
            assert_eq!(op, back, "round-trip mismatch for {op:?}");
        }
    }

    #[test]
    fn version_byte_rejects_bumped_version() {
        let op = Op::TextRemove { id: 9 };
        let mut bytes = encode_op(&op);
        bytes[0] = OP_FORMAT_VERSION + 1;
        assert_eq!(
            decode_op(&bytes),
            Err(OpError::UnsupportedVersion(OP_FORMAT_VERSION + 1))
        );
        assert_eq!(decode_op(&[]), Err(OpError::Empty));
    }

    #[test]
    fn fill_region_applies_and_clamps_to_bounds() {
        let mut doc = Document::new(300, 300);
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 290,
                    y: 290,
                    w: 50,
                    h: 50,
                },
                color: Rgba {
                    r: 9,
                    g: 8,
                    b: 7,
                    a: 255,
                },
            },
            &mut doc,
        );
        assert_eq!(doc.pixels.get_pixel(299, 299), [9, 8, 7, 255]);
        // Out of bounds was clamped away — nothing materialised past the edge.
        assert_eq!(doc.pixels.get_pixel(300, 300), [0, 0, 0, 0]);
    }

    #[test]
    fn crop_changes_bounds_content_and_shifts_annotations() {
        let mut doc = Document::new(300, 300);
        doc.pixels.set_pixel(60, 60, [1, 2, 3, 255]);
        doc.texts.push(test_text(1));
        doc.texts[0].x = 60;
        doc.texts[0].y = 60;
        apply(
            &Op::Crop {
                rect: Rect {
                    x: 50,
                    y: 50,
                    w: 100,
                    h: 100,
                },
            },
            &mut doc,
        );
        assert_eq!(doc.width(), 100);
        assert_eq!(doc.height(), 100);
        // (60,60) is now (10,10) after the crop origin shift — pixels AND
        // annotations, exactly like crop_in_place.
        assert_eq!(doc.pixels.get_pixel(10, 10), [1, 2, 3, 255]);
        assert_eq!((doc.texts[0].x, doc.texts[0].y), (10, 10));
    }

    #[test]
    fn levels_is_pure_and_leaves_transparent_pixels() {
        let mut doc = Document::new(4, 4);
        doc.pixels.set_pixel(0, 0, [100, 100, 100, 255]);
        doc.pixels.set_pixel(1, 0, [100, 100, 100, 0]); // transparent — must not change
        apply(
            &Op::Levels(LevelsParams {
                black: 0,
                white: 255,
                gamma: 1.0,
            }),
            &mut doc,
        );
        // Identity levels (0..255, gamma 1) leaves opaque pixels unchanged.
        assert_eq!(doc.pixels.get_pixel(0, 0), [100, 100, 100, 255]);
        assert_eq!(doc.pixels.get_pixel(1, 0), [100, 100, 100, 0]);

        // A real remap changes opaque RGB but not the transparent pixel's RGB.
        apply(
            &Op::Levels(LevelsParams {
                black: 64,
                white: 192,
                gamma: 1.0,
            }),
            &mut doc,
        );
        assert_ne!(doc.pixels.get_pixel(0, 0)[0], 100);
        assert_eq!(doc.pixels.get_pixel(1, 0), [100, 100, 100, 0]);
    }

    #[test]
    fn stroke_paints_center_and_leaves_far_pixels() {
        let mut doc = Document::new(64, 64);
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 64,
                    h: 64,
                },
                color: Rgba {
                    r: 200,
                    g: 200,
                    b: 200,
                    a: 255,
                },
            },
            &mut doc,
        );
        apply(
            &Op::Stroke {
                points: vec![(10.0, 32.0), (50.0, 32.0)],
                brush: Brush {
                    r: 20,
                    g: 200,
                    b: 60,
                    radius: 4.0,
                    hardness: 1.0,
                    opacity: 1.0,
                    erase: false,
                },
            },
            &mut doc,
        );
        // A hard, opaque brush lays pure colour on the stroke line...
        assert_eq!(doc.pixels.get_pixel(30, 32), [20, 200, 60, 255]);
        // ...and leaves pixels beyond the radius untouched.
        assert_eq!(doc.pixels.get_pixel(30, 45), [200, 200, 200, 255]);
    }

    #[test]
    fn erase_stroke_scrubs_alpha() {
        let mut doc = Document::new(32, 32);
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 32,
                    h: 32,
                },
                color: Rgba {
                    r: 50,
                    g: 60,
                    b: 70,
                    a: 255,
                },
            },
            &mut doc,
        );
        apply(
            &Op::Stroke {
                points: vec![(16.0, 16.0)],
                brush: Brush {
                    r: 0,
                    g: 0,
                    b: 0,
                    radius: 5.0,
                    hardness: 1.0,
                    opacity: 1.0,
                    erase: true,
                },
            },
            &mut doc,
        );
        assert_eq!(doc.pixels.get_pixel(16, 16)[3], 0, "centre fully erased");
        assert_eq!(
            doc.pixels.get_pixel(2, 2),
            [50, 60, 70, 255],
            "far corner untouched"
        );
    }

    #[test]
    fn blur_softens_an_edge_deterministically() {
        let mut doc = Document::new(64, 64);
        // Sharp vertical edge: left black, right white.
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 32,
                    h: 64,
                },
                color: Rgba {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 255,
                },
            },
            &mut doc,
        );
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 32,
                    y: 0,
                    w: 32,
                    h: 64,
                },
                color: Rgba {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 255,
                },
            },
            &mut doc,
        );
        let op = Op::Blur {
            points: vec![(32.0, 32.0)],
            radius: 12.0,
            intensity: 6,
        };
        let mut a = doc.clone();
        let mut b = doc.clone();
        apply(&op, &mut a);
        apply(&op, &mut b);
        assert_eq!(
            a.pixels.content_hash(),
            b.pixels.content_hash(),
            "same op, same input → identical output"
        );
        let px = a.pixels.get_pixel(32, 32);
        assert!(px[0] > 10 && px[0] < 245, "edge pixel blended, got {px:?}");
    }

    #[test]
    fn text_add_then_remove_restores_baseline_composite() {
        let mut doc = Document::new(64, 64);
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 64,
                    h: 64,
                },
                color: Rgba {
                    r: 240,
                    g: 240,
                    b: 240,
                    a: 255,
                },
            },
            &mut doc,
        );
        let baseline = doc.composite_hash();
        apply(&Op::TextAdd(test_text(1)), &mut doc);
        let with_text = doc.composite_hash();
        assert_ne!(baseline, with_text, "text visibly changed the composite");
        apply(
            &Op::TextEdit(TextParams {
                text: "edited".into(),
                ..test_text(1)
            }),
            &mut doc,
        );
        let edited = doc.composite_hash();
        assert_ne!(with_text, edited, "edit visibly changed the composite");
        apply(&Op::TextRemove { id: 1 }, &mut doc);
        assert_eq!(
            baseline,
            doc.composite_hash(),
            "text is non-destructive: remove restores the baseline exactly"
        );
    }

    #[test]
    fn shape_add_then_remove_restores_baseline_composite() {
        let mut doc = Document::new(64, 64);
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 64,
                    h: 64,
                },
                color: Rgba {
                    r: 10,
                    g: 20,
                    b: 30,
                    a: 255,
                },
            },
            &mut doc,
        );
        let baseline = doc.composite_hash();
        apply(&Op::ShapeAdd(test_shape(7)), &mut doc);
        assert_ne!(baseline, doc.composite_hash(), "shape visible");
        apply(&Op::ShapeRemove { id: 7 }, &mut doc);
        assert_eq!(baseline, doc.composite_hash(), "remove restores baseline");
    }

    #[test]
    fn layer_move_translates_pixels_and_annotations() {
        let mut doc = Document::new(32, 32);
        doc.pixels.set_pixel(5, 5, [9, 9, 9, 255]);
        doc.texts.push(test_text(1));
        doc.texts[0].x = 5;
        doc.texts[0].y = 5;
        apply(
            &Op::LayerMove {
                layer: 0,
                dx: 3,
                dy: -2,
            },
            &mut doc,
        );
        assert_eq!(doc.pixels.get_pixel(8, 3), [9, 9, 9, 255]);
        assert_eq!((doc.texts[0].x, doc.texts[0].y), (8, 3));
    }

    /// Build a log with `n` mixed ops (deterministic).
    fn mixed_log(n: usize) -> OpLog {
        let mut log = OpLog::new(512, 512);
        for i in 0..n {
            let op = match i % 3 {
                0 => Op::FillRegion {
                    rect: Rect {
                        x: (i % 400) as i32,
                        y: (i % 400) as i32,
                        w: 20,
                        h: 20,
                    },
                    color: Rgba {
                        r: (i as u8),
                        g: 100,
                        b: 50,
                        a: 255,
                    },
                },
                1 => Op::Levels(LevelsParams {
                    black: 8,
                    white: 240,
                    gamma: 1.05,
                }),
                _ => Op::Stroke {
                    points: vec![(i as f64, i as f64), (i as f64 + 9.0, i as f64 + 4.0)],
                    brush: Brush {
                        r: 0,
                        g: 0,
                        b: 0,
                        radius: 2.0,
                        hardness: 1.0,
                        opacity: 1.0,
                        erase: false,
                    },
                },
            };
            log.append(op);
        }
        log
    }

    #[test]
    fn replay_is_deterministic() {
        let log = mixed_log(120);
        let mut a = TileBuffer::new(0, 0);
        let mut b = TileBuffer::new(0, 0);
        log.replay(&mut a);
        log.replay(&mut b);
        assert_eq!(a.content_hash(), b.content_hash());
        // And matches the live buffer the log maintained while appending.
        assert_eq!(a.content_hash(), log.buffer().content_hash());
    }

    #[test]
    fn keyframe_replay_equals_full_replay() {
        // 120 ops => keyframes at 0, 50, 100.
        let log = mixed_log(120);
        assert!(log.keyframe_count() >= 3, "expected multiple keyframes");
        let mut fast = TileBuffer::new(0, 0);
        let mut full = TileBuffer::new(0, 0);
        log.replay(&mut fast); // nearest keyframe (100) + 20 ops
        log.replay_full(&mut full); // from index 0
        assert_eq!(fast.content_hash(), full.content_hash());
    }

    #[test]
    fn undo_truncate_correctness() {
        let mut log = mixed_log(70);
        let hash_full = log.buffer().content_hash();

        // Snapshot the state at 60 ops via an independent rebuild.
        let log60 = mixed_log(60);
        let hash60 = log60.buffer().content_hash();

        // Truncate the 70-op log back to 60 — must match the freshly-built 60.
        log.truncate(60);
        assert_eq!(log.len(), 60);
        assert_eq!(log.buffer().content_hash(), hash60);
        assert_ne!(log.buffer().content_hash(), hash_full);

        // Branch: append a new op after the undo. Tail is gone; history linear.
        log.append(Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 5,
                h: 5,
            },
            color: Rgba {
                r: 200,
                g: 0,
                b: 0,
                a: 255,
            },
        });
        assert_eq!(log.len(), 61);
        let mut replayed = TileBuffer::new(0, 0);
        log.replay(&mut replayed);
        assert_eq!(replayed.content_hash(), log.buffer().content_hash());
    }

    #[test]
    fn seek_undo_redo_round_trip_and_branch() {
        let mut log = mixed_log(10);
        let h10 = log.buffer().content_hash();
        let h5 = mixed_log(5).buffer().content_hash();

        // Undo to 5 without losing ops — redo must still be possible.
        assert!(log.seek(5));
        assert_eq!(log.cursor(), 5);
        assert_eq!(log.len(), 10, "ops retained across seek");
        assert_eq!(log.buffer().content_hash(), h5);

        // Redo back to 10 — exact state.
        assert!(log.seek(10));
        assert_eq!(log.buffer().content_hash(), h10);

        // Undo again, then BRANCH: append drops the tail.
        assert!(log.seek(5));
        log.append(Op::FillRegion {
            rect: Rect {
                x: 1,
                y: 1,
                w: 3,
                h: 3,
            },
            color: Rgba {
                r: 9,
                g: 9,
                b: 9,
                a: 255,
            },
        });
        assert_eq!(log.len(), 6, "tail dropped on branch");
        assert_eq!(log.cursor(), 6);
        assert!(!log.seek(10), "past-end seek rejected");
    }

    #[test]
    fn keyframe_pruning_keeps_seeks_exact() {
        // 250 ops → keyframes at 0,50,...,250; pruning keeps 0 + last 3.
        let log = mixed_log(250);
        assert_eq!(
            log.keyframe_count(),
            1 + KEYFRAMES_IN_MEMORY,
            "old keyframes pruned"
        );
        // A seek far behind the kept keyframes replays from the base — must
        // still be byte-exact.
        let mut rewound = mixed_log(250);
        assert!(rewound.seek(20));
        assert_eq!(
            rewound.buffer().content_hash(),
            mixed_log(20).buffer().content_hash(),
            "seek behind pruned keyframes is exact via base replay"
        );
    }

    #[test]
    fn annotation_state_survives_keyframe_replay() {
        // Text added before a keyframe boundary must still exist (and
        // composite identically) after a keyframed rebuild.
        let mut log = OpLog::new(128, 128);
        log.append(Op::TextAdd(test_text(1)));
        for i in 0..60 {
            log.append(Op::FillRegion {
                rect: Rect {
                    x: i,
                    y: i,
                    w: 10,
                    h: 10,
                },
                color: Rgba {
                    r: 100,
                    g: 0,
                    b: 0,
                    a: 255,
                },
            });
        }
        let rebuilt = log.replay_document();
        assert_eq!(rebuilt.texts.len(), 1, "annotation survived the keyframe");
        assert_eq!(
            rebuilt.composite_hash(),
            log.document().composite_hash(),
            "keyframed rebuild composites identically to the live document"
        );
    }
}
