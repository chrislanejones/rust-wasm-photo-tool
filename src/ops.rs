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
//! ## The Canvas is not content (ADR-016)
//! [`Document::pixels`] is the document's ONE **content** layer. The artboard
//! fill — the Canvas — is carried as [`CanvasParams`] metadata instead: ops
//! never touch it, but [`Document::composite_flat`] renders it underneath, so
//! the log's composite still matches what the user sees. That is what puts the
//! DEFAULT (Canvas + Photo) document inside the log's single-layer scope; a
//! genuinely multi-layer document (two or more content layers) remains out of
//! scope, exactly as before.
//!
//! ## Serialization
//! Each op serializes as `[format-version byte] ++ postcard(op)`. A bumped
//! version is rejected cleanly by [`decode_op`], so old logs never silently
//! mis-decode against a newer schema. Version **2** = the Canvas-metadata
//! schema (see [`OP_FORMAT_VERSION`]); version 1 was the parity schema.

use crate::tiles::TileBuffer;
use serde::{Deserialize, Serialize};

/// Leading byte on every encoded op. Bump when the schema changes
/// incompatibly.
///
/// **2** — ADR-016: the base/keyframe blob gained the Canvas metadata
/// (`encode_annotations` now serializes `(texts, shapes, canvas)`), and the
/// persisted pixel plane is now the CONTENT layer alone rather than the whole
/// document. A v1 log decoded under v2 rules would restore a Canvas document
/// with no fill and a pixel plane that means something subtly different — so v1
/// is REJECTED, not migrated. Safe: op-log persistence ships behind
/// `ih_oplog_persist` (OFF), the log is derived state, and a rejected restore
/// falls back to the snapshot/archive path with the image intact.
///
/// **3** — v8.40, text reflow: text annotations gained a `wrap_width`. Unlike
/// the v1→v2 step this is **MIGRATED, NOT REJECTED**, and the whole shape of
/// the change is chosen to make that possible:
///
///   * Every pre-existing [`Op`] variant and every existing struct keeps its
///     exact v2 byte layout. The wrap width rides in an APPENDED variant
///     ([`Op::TextWrap`]) — postcard indexes enum variants positionally, so
///     appending cannot disturb the ones already on disk. `decode_op`
///     therefore accepts v2 and v3 bytes through the same code path, with no
///     frozen mirror of the enum to transcribe (and get subtly wrong).
///   * `encode_annotations` gained a trailing tuple element, so v3 blobs are
///     a strict prefix-extension of v2 ones. `decode_annotations` tries the
///     4-tuple and falls back to the 3-tuple, defaulting the wrap widths.
///
/// ⚠️ That claim is not decoration — `v2_blobs_still_decode_under_v3` and
/// `v2_op_bytes_still_decode_under_v3` pin it. `ih_oplog_persist` now ships
/// **ON** (`USE_OPLOG_PERSISTENCE = true`), so a rejected log would have cost
/// every user their cross-reload undo history; that is why this step migrates
/// instead of rejecting.
///
/// **4** — v8.41, the text box's second axis: text annotations gained a
/// `box_height` to go with the `wrap_width`. Built to the v3 recipe, clause
/// for clause, because the recipe is what makes the step migratable:
///
///   * `box_height` is `#[serde(skip)]` on [`TextParams`], so the struct's
///     wire layout is still byte-identical to v2's.
///   * The height rides in an APPENDED variant ([`Op::TextBoxHeight`]), placed
///     after `TextWrap` so no existing variant is renumbered.
///   * `encode_annotations` gained a FIFTH tuple element, keeping v4 blobs a
///     strict prefix-extension of v3 ones (which are one of v2's).
///     `decode_annotations` tries 5, then 4, then 3 elements.
///
/// So v2, v3 and v4 all decode through one path, and a v2 or v3 document
/// simply comes back with `box_height == 0` — "size the box to the text",
/// which is exactly what it meant. Pinned by `v3_blobs_still_decode_under_v4`
/// and `v2_blobs_still_decode_under_v3` (unchanged, and still passing under
/// v4 — that it did not need editing IS the prefix-extension property).
///
/// v5 (v8.42, the Perspective tool) is the same move a third time: two more
/// APPENDED `Op` variants (`TextPerspective`, `PerspectiveWarp`) and a sixth
/// trailing element on the annotation tuple carrying the per-text corner
/// quads. A v4 document decodes with every quad at the identity — "no
/// perspective", which is exactly what a v4 document meant. Pinned by
/// `v4_blobs_still_decode_under_v5`.
pub const OP_FORMAT_VERSION: u8 = 5;

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
    /// Reflow width in px (0 = don't wrap — size the box to the text). v8.40.
    ///
    /// ⚠️ `#[serde(skip)]` is LOAD-BEARING, not an optimisation. postcard
    /// writes struct fields positionally with no names and no length prefix,
    /// so a real field here would shift every byte after it in the
    /// `Op::TextAdd` / `Op::TextEdit` payloads already persisted in users'
    /// IndexedDB — silently mis-decoding their documents. Skipped, the wire
    /// layout of `TextParams` is byte-identical to v2, and the width travels
    /// beside it instead: as the trailing element of `encode_annotations`, and
    /// as [`Op::TextWrap`] in the log. Deserialises to 0, which is exactly
    /// what every pre-v8.40 annotation meant.
    #[serde(skip)]
    pub wrap_width: u32,
    /// Box height in px (0 = size the box to the text). v8.41.
    ///
    /// ⚠️ `#[serde(skip)]` is load-bearing here for the identical reason it is
    /// on `wrap_width` above — read that comment, it applies word for word.
    /// The height travels beside the struct instead: as the fifth element of
    /// `encode_annotations`, and as [`Op::TextBoxHeight`] in the log.
    #[serde(skip)]
    pub box_height: u32,
    /// Normalised projective corner quad (TL, TR, BR, BL). v8.42.
    ///
    /// ⚠️ `#[serde(skip)]` is load-bearing here for the identical reason it is
    /// on `wrap_width` and `box_height` above — read that comment, it applies
    /// word for word. The quad travels beside the struct instead: as the sixth
    /// element of `encode_annotations`, and as [`Op::TextPerspective`] in the
    /// log. Deserialises to all-zero, which `default_quad_if_unset` promotes to
    /// the identity — exactly what every pre-v8.42 annotation meant.
    #[serde(skip)]
    pub perspective: [(f32, f32); 4],
}

/// An all-zero quad is what `#[serde(skip)]` leaves behind on a v4-or-older
/// blob, and it is NOT a meaningful transform — all four corners at the origin
/// is a collapsed point. Promote it to the identity so old documents mean "no
/// perspective" rather than "warp this to nothing".
///
/// This exists because the skipped-field default and the semantic default are
/// different values; leaving them conflated is how a migration silently eats
/// every text annotation in a v4 document.
pub fn default_quad_if_unset(q: [(f32, f32); 4]) -> [(f32, f32); 4] {
    if q.iter().all(|&(x, y)| x == 0.0 && y == 0.0) {
        crate::perspective::IDENTITY_QUAD
    } else {
        q
    }
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
            wrap_width: a.wrap_width,
            box_height: a.box_height,
            perspective: a.perspective,
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
    /// Set a text annotation's wrap width in px (0 = don't wrap, size the box
    /// to the text). v8.40.
    ///
    /// ⚠️ MUST STAY LAST. postcard encodes an enum as `varint(variant index)
    /// ++ payload`, so this variant's index is what makes v2 op bytes decode
    /// unchanged under v3 — inserting anything above it would renumber the
    /// variants already written to users' disks and silently mis-decode them.
    /// Append new variants; never insert.
    ///
    /// Carried as its own op rather than a field on [`TextParams`] for the
    /// same reason: a new field would move every byte after it in `TextAdd`
    /// and `TextEdit` payloads that are already persisted.
    TextWrap { id: u32, wrap_width: u32 },
    /// v8.41 — the text box's HEIGHT, the second axis of the same box.
    ///
    /// Appended after [`Op::TextWrap`] for exactly the reason stated there:
    /// postcard indexes variants positionally, so appending is invisible to
    /// every op already on a user's disk while inserting would renumber them
    /// all. Same argument for carrying it here instead of as a `TextParams`
    /// field.
    TextBoxHeight { id: u32, box_height: u32 },
    /// v8.42 — a text annotation's projective corner quad, normalised 0..1
    /// across its tile in TL/TR/BR/BL order.
    ///
    /// Appended, for the third time, for the reason spelled out on
    /// [`Op::TextWrap`]: postcard indexes enum variants positionally, so
    /// appending is invisible to every op already on a user's disk and
    /// inserting would renumber all of them.
    ///
    /// Carried as `[(f32, f32); 4]` rather than a `TextParams` field for the
    /// same reason — a new struct field shifts every byte after it in the
    /// `TextAdd`/`TextEdit` payloads already persisted.
    TextPerspective { id: u32, quad: [(f32, f32); 4] },
    /// v8.42 — the DESTRUCTIVE half of the Perspective tool: lift the pixels
    /// in `rect` and resample them into `quad` (absolute canvas coords, not
    /// normalised — a pixel warp has no tile to be a fraction of).
    ///
    /// Appended after [`Op::TextPerspective`]; same rule, same reason.
    PerspectiveWarp { rect: Rect, quad: [(f32, f32); 4] },
}

impl Op {
    /// Human-facing history label — matches the labels the snapshot path
    /// uses for the same actions, so the History panel reads identically
    /// whichever undo engine is live.
    pub fn label(&self) -> &'static str {
        match self {
            Op::Stroke { brush, .. } if brush.erase => "Erase",
            Op::Stroke { .. } => "Paint",
            Op::FillRegion { .. } => "Fill",
            Op::Blur { .. } => "Blur",
            Op::Levels(_) => "Levels",
            Op::Crop { .. } => "Crop",
            Op::TextAdd(_) => "Add Text",
            Op::TextEdit(_) => "Edit Text",
            Op::TextRemove { .. } => "Delete Text",
            Op::ShapeAdd(_) => "Add Shape",
            Op::ShapeEdit(_) => "Edit Shape",
            Op::ShapeRemove { .. } => "Delete Shape",
            Op::LayerMove { .. } => "Move Layer",
            // Same label as an edit: to the user, dragging the box wider IS
            // editing the text, and a separate "Wrap Text" entry would make
            // one gesture read as two history steps.
            Op::TextWrap { .. } => "Edit Text",
            Op::TextBoxHeight { .. } => "Edit Text",
            // Its OWN label, unlike TextWrap/TextBoxHeight which borrow "Edit
            // Text". Those two are one gesture on the text box and reading as
            // a second history entry would be noise; a perspective warp is a
            // different operation the user chose a different tool to perform,
            // and the History panel is where they go to find and re-select it.
            Op::TextPerspective { .. } => "Perspective",
            Op::PerspectiveWarp { .. } => "Perspective",
        }
    }
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
///
/// Accepts **everything from 2 up to [`OP_FORMAT_VERSION`]**: every step since
/// v2 has only APPENDED enum variants, so a byte sequence any of those writers
/// could produce means exactly the same thing here. v1 is still rejected (its
/// structs differ).
///
/// ⚠️ Written as a RANGE on purpose. It used to read
/// `ver != OP_FORMAT_VERSION && ver != 2`, which described "2 and the current
/// version" — correct on the day it was written and quietly wrong the moment
/// v4 landed, because v3 stopped being the current version and every v3 op
/// frame in a user's IndexedDB started coming back `UnsupportedVersion(3)`.
/// (`v3_op_bytes_still_decode_under_v4` is what caught it.) Enumerating the
/// accepted versions one by one is a list somebody has to remember to extend;
/// the range extends itself, and the append-only rule stated on
/// [`OP_FORMAT_VERSION`] is what makes it sound. A future step that is NOT
/// append-only must narrow this deliberately, not inherit it.
pub fn decode_op(bytes: &[u8]) -> Result<Op, OpError> {
    let (&ver, body) = bytes.split_first().ok_or(OpError::Empty)?;
    if !(2..=OP_FORMAT_VERSION).contains(&ver) {
        return Err(OpError::UnsupportedVersion(ver));
    }
    let op: Op = postcard::from_bytes(body).map_err(|_| OpError::Decode)?;
    // ⚠️ NORMALISE THE SKIPPED QUAD, and this is not cosmetic.
    //
    // `TextParams::perspective` is `#[serde(skip)]`, so it decodes as all-zero
    // — a collapsed point, not the identity the field actually means when
    // unset. `wrap_width` and `box_height` get away without this step because
    // their skipped default (0) IS their semantic default; the quad's is not.
    //
    // What breaks without it: `oplog_sync_annotations` diffs the log
    // document's `TextParams` against the live annotation's. The live one
    // holds the identity, the decoded one held all-zero, so they compared
    // unequal on EVERY sync and the recorder appended a fresh
    // `Op::TextPerspective` each time — an op log that grows without the user
    // doing anything. Caught by `postcard_round_trip_every_variant`.
    Ok(match op {
        Op::TextAdd(mut p) => {
            p.perspective = default_quad_if_unset(p.perspective);
            Op::TextAdd(p)
        }
        Op::TextEdit(mut p) => {
            p.perspective = default_quad_if_unset(p.perspective);
            Op::TextEdit(p)
        }
        other => other,
    })
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

/// Serialize the parts of a base/keyframe snapshot that flat pixels can't
/// carry: the annotation lists AND the Canvas metadata (postcard,
/// version-prefixed).
///
/// Keeping pre-log annotations LIVE across a persist→restore round trip is what
/// lets TextEdit/TextRemove ops on them replay exactly. The Canvas rides along
/// for the same reason: the persisted pixel plane is the CONTENT layer only
/// (ADR-016), so without these params a restore would rebuild the document with
/// a transparent artboard instead of the user's fill.
pub fn encode_annotations(
    texts: &[TextParams],
    shapes: &[ShapeParams],
    canvas: Option<CanvasParams>,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(16);
    out.push(OP_FORMAT_VERSION);
    // v3 appends the per-text wrap widths as a trailing tuple element, making
    // a v3 blob a strict prefix-extension of a v2 one — which is exactly what
    // lets `decode_annotations` read both. Parallel to `texts` by index.
    // v4 appends the box heights the same way, one element further out.
    // v5 appends the corner quads one element further out again.
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    let heights: Vec<u32> = texts.iter().map(|t| t.box_height).collect();
    let quads: Vec<[(f32, f32); 4]> = texts.iter().map(|t| t.perspective).collect();
    if let Ok(body) = postcard::to_allocvec(&(texts, shapes, canvas, &wraps, &heights, &quads)) {
        out.extend_from_slice(&body);
    }
    out
}

/// Inverse of [`encode_annotations`].
///
/// A v1 blob (annotations only, no Canvas) is rejected by the version byte, not
/// mis-decoded — the whole point of the prefix. Its log's op frames are v1 too
/// and would be rejected alongside it, so `oplog_restore` cleanly returns false
/// and the caller falls back to the snapshot/archive path. No silent
/// mis-decode, and no data loss: the op log is a derived undo/persistence
/// layer, and the image itself is persisted separately.
#[allow(clippy::type_complexity)]
pub fn decode_annotations(
    bytes: &[u8],
) -> Result<(Vec<TextParams>, Vec<ShapeParams>, Option<CanvasParams>), OpError> {
    let (&ver, body) = bytes.split_first().ok_or(OpError::Empty)?;
    // Same range, same reasoning, as `decode_op` — read the ⚠️ there before
    // changing either. Every version from 2 up is a strict prefix-extension of
    // the one before it, which is what the narrowing ladder below relies on.
    if !(2..=OP_FORMAT_VERSION).contains(&ver) {
        return Err(OpError::UnsupportedVersion(ver));
    }
    // Widest tuple first, narrowing on failure. Each older blob simply runs
    // out of bytes at the element it never wrote, so the fallback fires and
    // the missing values default to 0 — "size the box to the text" on both
    // axes, which is precisely what a v2 or v3 document meant.
    type V5 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
        Vec<u32>,
        Vec<[(f32, f32); 4]>,
    );
    if let Ok((mut texts, shapes, canvas, wraps, heights, quads)) = postcard::from_bytes::<V5>(body)
    {
        for (t, w) in texts.iter_mut().zip(wraps) {
            t.wrap_width = w;
        }
        for (t, h) in texts.iter_mut().zip(heights) {
            t.box_height = h;
        }
        for (t, q) in texts.iter_mut().zip(quads) {
            t.perspective = default_quad_if_unset(q);
        }
        return Ok((texts, shapes, canvas));
    }
    type V4 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
        Vec<u32>,
    );
    if let Ok((mut texts, shapes, canvas, wraps, heights)) = postcard::from_bytes::<V4>(body) {
        for (t, w) in texts.iter_mut().zip(wraps) {
            t.wrap_width = w;
        }
        for (t, h) in texts.iter_mut().zip(heights) {
            t.box_height = h;
        }
        // No quad element at all — every annotation is unwarped.
        for t in texts.iter_mut() {
            t.perspective = crate::perspective::IDENTITY_QUAD;
        }
        return Ok((texts, shapes, canvas));
    }
    type V3 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
    );
    if let Ok((mut texts, shapes, canvas, wraps)) = postcard::from_bytes::<V3>(body) {
        for (t, w) in texts.iter_mut().zip(wraps) {
            t.wrap_width = w;
        }
        for t in texts.iter_mut() {
            t.perspective = crate::perspective::IDENTITY_QUAD;
        }
        return Ok((texts, shapes, canvas));
    }
    type V2 = (Vec<TextParams>, Vec<ShapeParams>, Option<CanvasParams>);
    let (mut texts, shapes, canvas) =
        postcard::from_bytes::<V2>(body).map_err(|_| OpError::Decode)?;
    for t in texts.iter_mut() {
        t.perspective = crate::perspective::IDENTITY_QUAD;
    }
    Ok((texts, shapes, canvas))
}

// ── The replay document ─────────────────────────────────────────────────────

/// The Canvas fill as DOCUMENT METADATA (ADR-016) — everything needed to
/// reproduce the artboard fill's contribution to the composite, and nothing
/// more.
///
/// Deliberately NOT (pad, size, RGBA): the fill spans the whole document, so
/// its size IS the document's size and `pad` is not needed to render it —
/// storing either would be a second source of truth that can silently disagree
/// with the layer geometry. `visible` and `opacity` ARE stored, because the
/// engine composites the Canvas layer through them and the log's composite must
/// match the engine's byte-for-byte or the sync check breaks the log.
///
/// Ops never touch this. It is refreshed from the engine (`canvas_params`) and
/// applied uniformly across the log's base, keyframes and live document —
/// metadata is not versioned by the op stream, so undo does not rewind the
/// canvas colour.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CanvasParams {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    pub visible: bool,
    pub opacity: f64,
}

/// The state ops replay over: the single CONTENT layer's pixels plus its live
/// annotation lists, plus the Canvas metadata needed to reconstruct the full
/// visual. See the module doc ("The document model") and ADR-016.
#[derive(Clone)]
pub struct Document {
    pub pixels: TileBuffer,
    pub texts: Vec<TextParams>,
    pub shapes: Vec<ShapeParams>,
    /// The artboard fill under `pixels`, when the document has one. `None` for
    /// a single-layer (`load_image`) document.
    pub canvas: Option<CanvasParams>,
}

impl Document {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            pixels: TileBuffer::new(width, height),
            texts: Vec::new(),
            shapes: Vec::new(),
            canvas: None,
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

    /// The CONTENT layer as the engine's `render_layer` would produce it:
    /// pixels, then shapes, then text tiles — the same order and the same
    /// rasterisation calls (no mask, opacity 1, nothing being edited).
    fn content_flat(&self) -> Vec<u8> {
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

    /// Render the user-visible canvas — the Canvas fill (when present and
    /// visible) with the content layer composited over it, exactly as the
    /// engine's `composite_layers_into` does it for a Canvas + content stack:
    /// zeroed buffer, `blend_over` the fill scaled by its opacity, `blend_over`
    /// the rendered content.
    ///
    /// This calls the ENGINE's own `blend_over` rather than re-deriving the
    /// arithmetic, so the log's composite is byte-identical to the engine's by
    /// construction — which is what the op-log sync check hashes. Getting this
    /// even one rounding step wrong would break every log on a Canvas document.
    pub fn composite_flat(&self) -> Vec<u8> {
        let content = self.content_flat();
        let Some(c) = self.canvas.filter(|c| c.visible) else {
            // No Canvas: the content IS the composite. (The engine's
            // single-visible-opaque-layer fast path is a straight copy, and
            // `blend_over` onto a transparent buffer is the identity for
            // opacity 1 — the two agree, which is why today's single-layer
            // logs hash equal.)
            return content;
        };
        let n = content.len();
        let mut fill = vec![0u8; n];
        for px in fill.chunks_exact_mut(4) {
            px[0] = c.r;
            px[1] = c.g;
            px[2] = c.b;
            px[3] = c.a;
        }
        let mut out = vec![0u8; n];
        crate::layer::blend_over(&mut out, &fill, c.opacity);
        crate::layer::blend_over(&mut out, &content, 1.0);
        out
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
        t.box_height,
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
        Op::TextWrap { id, wrap_width } => {
            if let Some(t) = doc.texts.iter_mut().find(|t| t.id == *id) {
                t.wrap_width = *wrap_width;
            }
        }
        Op::TextBoxHeight { id, box_height } => {
            if let Some(t) = doc.texts.iter_mut().find(|t| t.id == *id) {
                t.box_height = *box_height;
            }
        }
        Op::TextPerspective { id, quad } => {
            if let Some(t) = doc.texts.iter_mut().find(|t| t.id == *id) {
                t.perspective = *quad;
            }
        }
        Op::PerspectiveWarp { rect, quad } => {
            let (w, h) = (doc.width(), doc.height());
            if w == 0 || h == 0 {
                return;
            }
            // Straight through the SHARED helper the engine calls — see the ⚠️
            // on `perspective::warp_region_in_place`. Replay and engine are the
            // same code path, not two implementations that agree.
            let mut flat = doc.pixels_flat();
            if crate::perspective::warp_region_in_place(
                &mut flat,
                w,
                h,
                (rect.x, rect.y, rect.w, rect.h),
                &crate::perspective::quad_from_pairs(quad),
            ) {
                doc.pixels.blit_from_flat(&flat, w, h);
            }
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

    /// The Canvas metadata currently carried by the log.
    pub fn canvas(&self) -> Option<CanvasParams> {
        self.live.canvas
    }

    /// Update the Canvas metadata (ADR-016) — on the live document, the base,
    /// AND every keyframe.
    ///
    /// Uniform on purpose: the Canvas is metadata, not content, so it is not
    /// versioned by the op stream. Storing it only on `live` would mean a seek
    /// back to a keyframe resurrects an old canvas colour (undo silently
    /// repainting the artboard); storing it only on the base would mean replay
    /// from a keyframe loses it. Writing all three keeps replay from ANY
    /// position byte-identical to the engine, which is what the sync check
    /// demands. Cheap: keyframes hold at most `KEYFRAMES_IN_MEMORY` entries and
    /// this writes one `Option<CanvasParams>` each.
    pub fn set_canvas(&mut self, canvas: Option<CanvasParams>) {
        self.live.canvas = canvas;
        for (_, doc) in self.keyframes.iter_mut() {
            doc.canvas = canvas;
        }
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
            wrap_width: 0,
            box_height: 0,
            perspective: crate::perspective::IDENTITY_QUAD,
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
                wrap_width: 0,
                box_height: 0,
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
                wrap_width: 0,
                box_height: 0,
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

#[cfg(test)]
mod v2_migration_tests {
    //! The v2 → v3 promise, pinned: **old data must still decode**.
    //!
    //! `USE_OPLOG_PERSISTENCE` ships ON, so a rejected log costs every user
    //! their cross-reload undo history. v3 was shaped to make migration
    //! possible (append-only variant, `#[serde(skip)]` on the new field,
    //! trailing tuple element) — these tests are what stop that shape from
    //! being "simplified" back into a breaking change.
    use super::*;

    fn a_text(id: u32) -> TextParams {
        TextParams {
            id,
            wrap_width: 0,
            box_height: 0,
            perspective: crate::perspective::IDENTITY_QUAD,
            text: "hello".into(),
            x: 1,
            y: 2,
            font_size: 16.0,
            r: 1,
            g: 2,
            b: 3,
            bold: true,
            rotation_deg: 0.0,
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

    /// A v2 writer emitted `[2] ++ postcard((texts, shapes, canvas))` — the
    /// 3-tuple, with no wrap widths. Reconstructed here byte-for-byte.
    fn v2_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
        let mut out = vec![2u8];
        let shapes: Vec<ShapeParams> = Vec::new();
        let canvas: Option<CanvasParams> = None;
        out.extend_from_slice(&postcard::to_allocvec(&(texts, &shapes, &canvas)).unwrap());
        out
    }

    #[test]
    fn v2_blobs_still_decode_under_v3() {
        let texts = vec![a_text(7)];
        let (got, shapes, canvas) = decode_annotations(&v2_annotation_blob(&texts))
            .expect("a v2 annotation blob must still decode — users' logs depend on it");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].text, "hello");
        assert_eq!(got[0].id, 7);
        assert_eq!(got[0].wrap_width, 0, "a v2 document meant 'do not wrap'");
        assert!(shapes.is_empty());
        assert!(canvas.is_none());
    }

    #[test]
    fn v3_blobs_round_trip_the_wrap_width() {
        let mut t = a_text(9);
        t.wrap_width = 240;
        let blob = encode_annotations(&[t], &[], None);
        assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
        let (got, _, _) = decode_annotations(&blob).unwrap();
        assert_eq!(got[0].wrap_width, 240, "v3 carries the width");
    }

    #[test]
    fn v2_op_bytes_still_decode_under_v3() {
        // Appending `TextWrap` must not renumber the variants already on disk.
        // A v2 writer produced these exact bytes for each op below.
        for op in [
            Op::TextAdd(a_text(1)),
            Op::TextEdit(a_text(2)),
            Op::TextRemove { id: 3 },
            Op::LayerMove {
                layer: 1,
                dx: 4,
                dy: 5,
            },
            Op::Crop {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 8,
                    h: 8,
                },
            },
        ] {
            let mut v2_bytes = vec![2u8];
            v2_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap());
            let decoded = decode_op(&v2_bytes)
                .unwrap_or_else(|e| panic!("v2 bytes for {:?} rejected: {e:?}", op.label()));
            assert_eq!(decoded, op, "v2 op must mean the same thing under v3");
        }
    }

    #[test]
    fn text_params_wire_layout_is_unchanged_by_the_new_field() {
        // The `#[serde(skip)]` guarantee, measured: two TextParams differing
        // ONLY in wrap_width must serialize to identical bytes. If this fails,
        // every persisted TextAdd/TextEdit payload has shifted.
        let a = a_text(4);
        let mut b = a_text(4);
        b.wrap_width = 512;
        assert_eq!(
            postcard::to_allocvec(&a).unwrap(),
            postcard::to_allocvec(&b).unwrap(),
            "wrap_width must not appear on the wire"
        );
    }

    #[test]
    fn v1_is_still_rejected_not_silently_migrated() {
        let mut v1 = vec![1u8];
        v1.extend_from_slice(&postcard::to_allocvec(&(vec![a_text(1)],)).unwrap());
        assert!(matches!(
            decode_annotations(&v1),
            Err(OpError::UnsupportedVersion(1))
        ));
    }

    #[test]
    fn text_wrap_op_applies_to_the_right_annotation() {
        let mut doc = Document::new(32, 32);
        doc.texts.push(a_text(1));
        doc.texts.push(a_text(2));
        apply(
            &Op::TextWrap {
                id: 2,
                wrap_width: 180,
            },
            &mut doc,
        );
        assert_eq!(doc.texts[0].wrap_width, 0, "untouched");
        assert_eq!(doc.texts[1].wrap_width, 180);
    }

    // ── v4: the box's second axis ──────────────────────────────────────────
    // Same four guarantees v3 had to prove, restated for `box_height`. They are
    // separate tests rather than extra asserts on the v3 ones deliberately: if
    // a later change breaks only the height, the failure should say so.

    /// A v3 writer emitted `[3] ++ postcard((texts, shapes, canvas, wraps))` —
    /// the 4-tuple, with no box heights. Reconstructed here byte-for-byte.
    fn v3_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
        let mut out = vec![3u8];
        let shapes: Vec<ShapeParams> = Vec::new();
        let canvas: Option<CanvasParams> = None;
        let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
        out.extend_from_slice(&postcard::to_allocvec(&(texts, &shapes, &canvas, &wraps)).unwrap());
        out
    }

    #[test]
    fn v3_blobs_still_decode_under_v4() {
        // The load-bearing one. `ih_oplog_persist` ships ON, so every user who
        // has opened the app since v8.40 has v3 blobs in IndexedDB; rejecting
        // them would drop their cross-reload undo history.
        let mut t = a_text(7);
        t.wrap_width = 240;
        let (got, shapes, canvas) = decode_annotations(&v3_annotation_blob(&[t]))
            .expect("a v3 annotation blob must still decode — users' logs depend on it");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].id, 7);
        assert_eq!(got[0].wrap_width, 240, "the v3 width survives the step");
        assert_eq!(
            got[0].box_height, 0,
            "a v3 document meant 'size the box to the text'"
        );
        assert!(shapes.is_empty());
        assert!(canvas.is_none());
    }

    #[test]
    fn v4_blobs_round_trip_both_box_axes() {
        let mut t = a_text(9);
        t.wrap_width = 240;
        t.box_height = 310;
        let blob = encode_annotations(&[t], &[], None);
        assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
        let (got, _, _) = decode_annotations(&blob).unwrap();
        assert_eq!(got[0].wrap_width, 240);
        assert_eq!(got[0].box_height, 310, "v4 carries the height");
    }

    #[test]
    fn v3_op_bytes_still_decode_under_v4() {
        // Appending `TextBoxHeight` must not renumber the variants already on
        // disk — `TextWrap` is the one appended last before it, so it is the
        // one that would break first.
        for op in [
            Op::TextAdd(a_text(1)),
            Op::TextRemove { id: 3 },
            Op::TextWrap {
                id: 5,
                wrap_width: 200,
            },
        ] {
            let mut v3_bytes = vec![3u8];
            v3_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap());
            let decoded = decode_op(&v3_bytes)
                .unwrap_or_else(|e| panic!("v3 bytes for {:?} rejected: {e:?}", op.label()));
            assert_eq!(decoded, op, "v3 op must mean the same thing under v4");
        }
    }

    #[test]
    fn text_params_wire_layout_is_unchanged_by_the_box_height_field() {
        // Same measurement as `..._by_the_new_field` above, for the second
        // skipped field. A regression here shifts every persisted
        // TextAdd/TextEdit payload.
        let a = a_text(4);
        let mut b = a_text(4);
        b.box_height = 512;
        assert_eq!(
            postcard::to_allocvec(&a).unwrap(),
            postcard::to_allocvec(&b).unwrap(),
            "box_height must not appear on the wire"
        );
    }

    #[test]
    fn text_box_height_op_applies_to_the_right_annotation() {
        let mut doc = Document::new(32, 32);
        doc.texts.push(a_text(1));
        doc.texts.push(a_text(2));
        apply(
            &Op::TextBoxHeight {
                id: 2,
                box_height: 310,
            },
            &mut doc,
        );
        assert_eq!(doc.texts[0].box_height, 0, "untouched");
        assert_eq!(doc.texts[1].box_height, 310);
    }

    // ── v5: the corner quad ────────────────────────────────────────────────
    // The same four guarantees a third time, restated for `perspective`. Kept
    // as their own tests for the reason given above the v4 block: a failure
    // should name the axis that broke.

    /// A skewed but valid quad — the top edge pulled in, i.e. the keystone the
    /// tool exists to produce.
    fn a_quad() -> [(f32, f32); 4] {
        [(0.15, 0.0), (0.85, 0.0), (1.0, 1.0), (0.0, 1.0)]
    }

    /// A v4 writer emitted `[4] ++ postcard((texts, shapes, canvas, wraps,
    /// heights))` — the 5-tuple, with no quads. Reconstructed byte-for-byte.
    fn v4_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
        let mut out = vec![4u8];
        let shapes: Vec<ShapeParams> = Vec::new();
        let canvas: Option<CanvasParams> = None;
        let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
        let heights: Vec<u32> = texts.iter().map(|t| t.box_height).collect();
        out.extend_from_slice(
            &postcard::to_allocvec(&(texts, &shapes, &canvas, &wraps, &heights)).unwrap(),
        );
        out
    }

    #[test]
    fn v4_blobs_still_decode_under_v5() {
        // The load-bearing one, for the third time. Anyone who has opened the
        // app since v8.41 has v4 blobs in IndexedDB.
        let mut t = a_text(7);
        t.wrap_width = 240;
        t.box_height = 310;
        let (got, shapes, canvas) = decode_annotations(&v4_annotation_blob(&[t]))
            .expect("a v4 annotation blob must still decode — users' logs depend on it");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].wrap_width, 240, "the v4 width survives the step");
        assert_eq!(got[0].box_height, 310, "the v4 height survives the step");
        assert_eq!(
            got[0].perspective,
            crate::perspective::IDENTITY_QUAD,
            "a v4 document meant 'no perspective' — NOT a collapsed all-zero quad"
        );
        assert!(shapes.is_empty());
        assert!(canvas.is_none());
    }

    #[test]
    fn v5_blobs_round_trip_the_corner_quad() {
        let mut t = a_text(9);
        t.wrap_width = 240;
        t.box_height = 310;
        t.perspective = a_quad();
        let blob = encode_annotations(&[t], &[], None);
        assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
        let (got, _, _) = decode_annotations(&blob).unwrap();
        assert_eq!(got[0].wrap_width, 240);
        assert_eq!(got[0].box_height, 310);
        assert_eq!(got[0].perspective, a_quad(), "v5 carries the quad");
    }

    #[test]
    fn v4_op_bytes_still_decode_under_v5() {
        // Appending `TextPerspective` and `PerspectiveWarp` must not renumber
        // the variants already on disk — `TextBoxHeight` was appended last
        // before them, so it is the one that would break first.
        for op in [
            Op::TextAdd(a_text(1)),
            Op::TextRemove { id: 3 },
            Op::TextWrap {
                id: 5,
                wrap_width: 200,
            },
            Op::TextBoxHeight {
                id: 5,
                box_height: 310,
            },
        ] {
            let mut v4_bytes = vec![4u8];
            v4_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap());
            let decoded = decode_op(&v4_bytes)
                .unwrap_or_else(|e| panic!("v4 bytes for {:?} rejected: {e:?}", op.label()));
            assert_eq!(decoded, op, "v4 op must mean the same thing under v5");
        }
    }

    #[test]
    fn text_params_wire_layout_is_unchanged_by_the_perspective_field() {
        // Third instance of the measurement. A regression here shifts every
        // persisted TextAdd/TextEdit payload in every user's IndexedDB.
        let a = a_text(4);
        let mut b = a_text(4);
        b.perspective = a_quad();
        assert_eq!(
            postcard::to_allocvec(&a).unwrap(),
            postcard::to_allocvec(&b).unwrap(),
            "perspective must not appear on the wire"
        );
    }

    #[test]
    fn text_perspective_op_applies_to_the_right_annotation() {
        let mut doc = Document::new(32, 32);
        doc.texts.push(a_text(1));
        doc.texts.push(a_text(2));
        apply(
            &Op::TextPerspective {
                id: 2,
                quad: a_quad(),
            },
            &mut doc,
        );
        assert_eq!(
            doc.texts[0].perspective,
            crate::perspective::IDENTITY_QUAD,
            "untouched"
        );
        assert_eq!(doc.texts[1].perspective, a_quad());
    }

    #[test]
    fn decoded_text_ops_never_carry_the_all_zero_quad() {
        // The regression this guards is subtle and expensive: an all-zero quad
        // decoded back into a live document compares unequal to the identity
        // the engine holds, so `oplog_sync_annotations` emits a fresh
        // TextPerspective op on every single sync. The log grows forever while
        // the user does nothing.
        let bytes = encode_op(&Op::TextAdd(a_text(1)));
        let Op::TextAdd(p) = decode_op(&bytes).unwrap() else {
            panic!("wrong variant");
        };
        assert_eq!(
            p.perspective,
            crate::perspective::IDENTITY_QUAD,
            "the skipped field must decode to the identity, not to zeros"
        );
    }

    #[test]
    fn perspective_warp_op_moves_pixels_into_the_quad() {
        let mut doc = Document::new(64, 64);
        // Fill a 20×20 block so there is something identifiable to move.
        apply(
            &Op::FillRegion {
                rect: Rect {
                    x: 10,
                    y: 10,
                    w: 20,
                    h: 20,
                },
                color: Rgba {
                    r: 255,
                    g: 0,
                    b: 0,
                    a: 255,
                },
            },
            &mut doc,
        );
        apply(
            &Op::PerspectiveWarp {
                rect: Rect {
                    x: 10,
                    y: 10,
                    w: 20,
                    h: 20,
                },
                // Same footprint, top edge pulled inward — a keystone.
                quad: [(14.0, 10.0), (26.0, 10.0), (30.0, 30.0), (10.0, 30.0)],
            },
            &mut doc,
        );
        let flat = doc.pixels_flat();
        let at = |x: usize, y: usize| -> [u8; 4] {
            let i = (y * 64 + x) * 4;
            [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]
        };
        // The near (bottom) edge still spans the full width...
        assert_eq!(
            at(12, 28)[3],
            255,
            "bottom-left corner should still be covered"
        );
        // ...while the far (top) edge has retreated inward.
        assert_eq!(
            at(11, 11)[3],
            0,
            "top-left corner must be vacated by the keystone"
        );
        // And the source rect was moved, not copied: nothing outside the quad
        // keeps the original fill.
        assert_eq!(at(28, 11)[3], 0, "top-right corner must be vacated too");
    }
}
