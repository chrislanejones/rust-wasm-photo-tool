//! Operation log — a serializable, replayable history of edits over a
//! single-layer document.
//!
//! Feature-gated behind `tiles`, which the shipped wasm is built with
//! (`scripts/build-wasm.sh`; ADR-017). The log
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
//!   exact dab centers in stamp order (blur dabs are order-dependent).
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
///
/// **6** — v8.76, the Perspective tool reaching SHAPES: the same move a fourth
/// time, for squares, circles and everything else `ShapeAnnotation` draws.
///
///   * `perspective` is `#[serde(skip)]` on [`ShapeParams`], so that struct's
///     wire layout is still byte-identical to v2's — which matters more here
///     than it did for text, because `ShapeAdd`/`ShapeEdit` payloads have been
///     persisted since v2 and a shifted byte would mis-decode every one of
///     them.
///   * The quad rides in an APPENDED variant ([`Op::ShapePerspective`]), after
///     `PerspectiveWarp`, so no existing variant is renumbered.
///   * `encode_annotations` gained a SEVENTH tuple element carrying the
///     per-shape quads, keeping v6 blobs a strict prefix-extension of v5 ones.
///
/// A v5 document decodes with every shape quad at the identity — "no
/// perspective", which is exactly what a v5 document meant. Pinned by
/// `v5_blobs_still_decode_under_v6` and `v5_op_bytes_still_decode_under_v6`.
///
/// **7** — v8.8x, shape stroke sloppiness: the same move a fifth time, so a
/// firm-rendered shape can be re-rendered sketchy and survive replay.
///
///   * `sloppiness` is `#[serde(skip)]` on [`ShapeParams`] — the wire layout
///     stays byte-identical to v6's, and the shape-add/edit payloads persisted
///     since v2 still decode. Its semantic default (0 = firm) equals the
///     skipped default, so no normalisation step is needed.
///   * The value rides in an APPENDED variant ([`Op::ShapeSloppiness`]), after
///     `ShapePerspective`, so no existing variant is renumbered.
///   * `encode_annotations` gained an EIGHTH tuple element carrying the
///     per-shape sloppiness, keeping v7 blobs a strict prefix-extension of v6.
///
/// A v6 document decodes with every shape firm — exactly what a v6 document
/// meant.
///
/// **8** — v8.8x, the font selector: text annotations gained a `font_id`
/// naming the typeface the engine rasterises them with. The recipe a SIXTH
/// time, clause for clause:
///
///   * `font_id` is `#[serde(skip)]` on [`TextParams`], so the struct's wire
///     layout is STILL byte-identical to v2's.
///   * The face rides in an APPENDED variant ([`Op::TextFont`]), after
///     `ShapeSloppiness`, so no existing variant is renumbered.
///   * `encode_annotations` gained a NINTH trailing element, keeping v8 blobs
///     a strict prefix-extension of v7 ones.
///
/// ⚠️ This step was WRITTEN as v6, on a branch that then sat unmerged while
/// v6 and v7 shipped for shapes. `TextFont` was moved to the END of the enum
/// on merge rather than left where the branch put it: the two shape variants
/// are on users' disks and `TextFont` never was, so the only renumbering that
/// costs anything is the one that did not happen.
///
/// A v7 document decodes with every `font_id` empty — the embedded Liberation
/// Sans, which is the only face that existed when it was written and therefore
/// exactly what it meant. Pinned by `v7_blobs_still_decode_under_v8`.
///
/// ⚠️ The skipped-field default and the semantic default AGREE here, unlike
/// the quad (see `default_quad_if_unset`). `String::default()` is `""`, and
/// `""` is defined by `fonts::DEFAULT_FONT_ID`'s contract to mean the embedded
/// face. That is why this step needs no promoting function — but it is a
/// property to check, not to assume, the next time a field is added.
///
/// ## v8.81 fixed a text-settings loss and DELIBERATELY DID NOT BUMP THIS
///
/// ADR-060. `Op::TextEdit` / `Op::ShapeEdit` used to REPLACE the annotation
/// they name, which reset the four `#[serde(skip)]` axes to their decode
/// defaults — so the typeface and the box a user set were erased by the next
/// edit, and only on reload, because only replay runs `apply`. Applying those
/// two ops now MERGES (see `TextParams::carry_skipped_from`).
///
/// **No version number was taken, and that is the decision, not an oversight.**
/// A bump is for a change in what the BYTES are; this is a change in what the
/// engine does with bytes it was already reading, and the wire layout is
/// untouched — a v8 writer and this reader still agree frame for frame. Taking
/// a number here would have cost every existing log (`decode_op` accepts
/// `2..=OP_FORMAT_VERSION`, so v9 bytes are unreadable by every shipped build,
/// and PR #187 needs v9 for a change that genuinely IS new bytes).
///
/// The honest cost is that v8 bytes now replay differently than they did under
/// v8.80. That is intended and it is the repair: the old replay lost data the
/// log demonstrably contained, so every existing log comes back MORE like what
/// its user saw, never less. Pinned on real captured production bytes by
/// `tests/oplog_v8_text_settings_replay.rs` and `tests/oplog_v7_v8_fixture_resume.rs`.
pub const OP_FORMAT_VERSION: u8 = 8;

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

/// Straight (non-premultiplied) RGBA color.
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
    /// Eraser stroke: scrubs alpha instead of laying color — the same
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
    /// ⚠️ `#[serde(skip)]` is LOAD-BEARING, not an optimization. postcard
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
    /// Normalized projective corner quad (TL, TR, BR, BL). v8.42.
    ///
    /// ⚠️ `#[serde(skip)]` is load-bearing here for the identical reason it is
    /// on `wrap_width` and `box_height` above — read that comment, it applies
    /// word for word. The quad travels beside the struct instead: as the sixth
    /// element of `encode_annotations`, and as [`Op::TextPerspective`] in the
    /// log. Deserialises to all-zero, which `default_quad_if_unset` promotes to
    /// the identity — exactly what every pre-v8.42 annotation meant.
    #[serde(skip)]
    pub perspective: [(f32, f32); 4],
    /// Typeface id; `""` = the embedded Liberation Sans. v8.76.
    ///
    /// ⚠️ `#[serde(skip)]` is load-bearing here for the identical reason it is
    /// on `wrap_width`, `box_height` and `perspective` above — read that
    /// comment, it applies word for word. The face travels beside the struct
    /// instead: as the seventh element of `encode_annotations`, and as
    /// [`Op::TextFont`] in the log. Deserialises to `""`, which is exactly
    /// what every pre-v8.76 annotation meant.
    #[serde(skip)]
    pub font_id: String,
}

/// An all-zero quad is what `#[serde(skip)]` leaves behind on a v4-or-older
/// blob, and it is NOT a meaningful transform — all four corners at the origin
/// is a collapsed point. Promote it to the identity so old documents mean "no
/// perspective" rather than "warp this to nothing".
///
/// This exists because the skipped-field default and the semantic default are
/// different values; leaving them conflated is how a migration silently eats
/// every text annotation in a v4 document.
pub(crate) fn default_quad_if_unset(q: [(f32, f32); 4]) -> [(f32, f32); 4] {
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
    /// Stroke sloppiness (0–100): how hand-drawn the outline is.
    ///
    /// ⚠️ `#[serde(skip)]` is load-bearing for the identical reason it is on
    /// [`TextParams::perspective`] / our own `perspective` field — read that
    /// comment. `ShapeAdd`/`ShapeEdit` payloads have been persisted since v2
    /// and postcard encodes struct fields positionally, so a new field here
    /// would mis-decode every one already on disk. The value rides instead as
    /// [`Op::ShapeSloppiness`], appended after [`Op::ShapePerspective`] so no
    /// existing variant is renumbered. Deserialises to 0 — the "clean / firm"
    /// default, which is exactly what every pre-sloppiness shape meant.
    #[serde(skip)]
    pub sloppiness: u8,
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
    /// Normalized projective corner quad (TL, TR, BR, BL) over the shape's own
    /// bbox. v8.76 — the vector Perspective tool reaching squares and circles.
    ///
    /// ⚠️ `#[serde(skip)]` is load-bearing here for the identical reason it is
    /// on [`TextParams::perspective`] — read that comment, it applies word for
    /// word. The quad travels beside the struct instead, as
    /// [`Op::ShapePerspective`] in the log. Deserialises to all-zero, which
    /// `default_quad_if_unset` promotes to the identity — exactly what every
    /// pre-v8.76 shape meant.
    #[serde(skip)]
    pub perspective: [(f32, f32); 4],
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
            font_id: a.font_id.clone(),
        }
    }

    /// Carry the four `#[serde(skip)]` fields over from the annotation this
    /// payload is about to replace — ADR-060.
    ///
    /// ⚠️ THIS IS WHAT MAKES `Op::TextEdit` NON-DESTRUCTIVE, and it is not a
    /// nicety. `wrap_width`, `box_height`, `perspective` and `font_id` are
    /// `#[serde(skip)]` (see the fields' comments — they have to be, or every
    /// `TextAdd`/`TextEdit` payload already on a user's disk mis-decodes), so
    /// an encoded `TextEdit` **physically cannot carry them**. What comes back
    /// out of `postcard` is therefore not "the user chose the default" — it is
    /// *no information at all*, and a replace that honored it silently reset
    /// the typeface and the box on every text edit.
    ///
    /// Measured on a captured production log (`tests/fixtures/oplog/`): a
    /// `TextFont` then a `TextWrap` established `liberation-serif` / 299 px,
    /// and the next `TextEdit` put them back to `""` / 0. That is the reload
    /// bug this method fixes, and the same bytes replay correctly with it.
    ///
    /// Resetting a setting to its default is still representable — that is the
    /// property that makes the absent value safe to ignore here.
    /// `annotation_sync_ops` emits `TextFont { font_id: "" }` /
    /// `TextWrap { wrap_width: 0 }` whenever the live value differs from the
    /// log's, *including* when the new value is the default. So every genuine
    /// reset rides its own op and nothing depends on `TextEdit` clearing
    /// anything.
    /// `prev` is `&mut` and `font_id` is MOVED out of it rather than cloned:
    /// the only caller overwrites `prev` with `self` on the next line, so the
    /// emptied string is never observable, and replaying a long log stops
    /// allocating one `String` per `TextEdit`.
    fn carry_skipped_from(&mut self, prev: &mut TextParams) {
        self.wrap_width = prev.wrap_width;
        self.box_height = prev.box_height;
        self.perspective = prev.perspective;
        self.font_id = std::mem::take(&mut prev.font_id);
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
            sloppiness: s.sloppiness,
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
            perspective: s.perspective.0,
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
            sloppiness: self.sloppiness,
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
            perspective: crate::perspective::NormQuad(self.perspective),
        }
    }

    /// The shape twin of [`TextParams::carry_skipped_from`] — ADR-060. Read
    /// that doc comment; it applies word for word, with `sloppiness` and
    /// `perspective` as the two `#[serde(skip)]` fields an encoded
    /// `Op::ShapeEdit` physically cannot carry.
    ///
    /// It is fixed here at the same time as the text one deliberately. The
    /// comment on `annotation_sync_ops` says the four skipped axes are
    /// "handled identically below; keep them that way, because one of them
    /// being forgotten is the failure this comment exists to prevent" — and a
    /// merge rule that held for text and not for shapes would be exactly that
    /// failure, waiting for the first log that edits a sketchy shape after
    /// drawing it. No such log has shipped yet only because `ShapeSloppiness`
    /// is new; the defect is the same age as `ShapeEdit`.
    fn carry_skipped_from(&mut self, prev: &ShapeParams) {
        self.sloppiness = prev.sloppiness;
        self.perspective = prev.perspective;
    }
}

/// Diff live annotation lists against the log's document and return the ops
/// that close the gap — nothing here touches engine state, which is why it
/// lives beside the `Op` definitions rather than in the engine.
///
/// ⚠️ THE SKIPPED FIELDS ARE THE WHOLE DIFFICULTY. `TextParams::wrap_width`,
/// `box_height` and `perspective`, and `ShapeParams::perspective`, are all
/// `#[serde(skip)]` (they have to be — see the fields' comments), so
/// `TextAdd`/`TextEdit`/`ShapeAdd`/`ShapeEdit` physically CANNOT carry them.
/// Every such change therefore needs its own `TextWrap` / `TextBoxHeight` /
/// `TextPerspective` / `ShapePerspective` op, or replay rebuilds the item
/// unboxed and unwarped, the composite hash diverges, and the log marks itself
/// broken — silently falling the user back to snapshot undo. All four are
/// handled identically below; keep them that way, because one of them being
/// forgotten is the failure this comment exists to prevent.
///
/// Returns an empty vec when both sides are empty, which is the fast path that
/// makes a pure-paint session free.
pub(crate) fn annotation_sync_ops(
    texts: &[crate::annotations::TextAnnotation],
    shapes: &[crate::annotations::ShapeAnnotation],
    log_doc: &Document,
) -> Vec<Op> {
    let mut pending: Vec<Op> = Vec::new();
    if texts.is_empty()
        && shapes.is_empty()
        && log_doc.texts.is_empty()
        && log_doc.shapes.is_empty()
    {
        return pending;
    }
    for lt in &log_doc.texts {
        if !texts.iter().any(|a| a.id == lt.id) {
            pending.push(Op::TextRemove { id: lt.id });
        }
    }
    for a in texts {
        let params = TextParams::from_annotation(a);
        // ⚠️ `TextParams::wrap_width`, `box_height`, `perspective` AND
        // `font_id` are all `#[serde(skip)]` (they have to be — see the
        // fields' comments), so `TextAdd`/`TextEdit` physically CANNOT
        // carry any of them. Every such change therefore needs its own
        // `TextWrap` / `TextBoxHeight` / `TextPerspective` / `TextFont`
        // op, or replay rebuilds the text unboxed, unwarped and in the
        // wrong typeface, the composite hash diverges, and the log marks
        // itself broken — silently falling the user back to snapshot
        // undo. The four are handled identically; keep them that way,
        // because one of them being forgotten is the failure this comment
        // exists to prevent, and it has already happened twice (v8.42
        // added the third, v8.8x the fourth).
        match log_doc.texts.iter().find(|t| t.id == a.id) {
            None => {
                let wrap = params.wrap_width;
                let box_h = params.box_height;
                let quad = params.perspective;
                let font = params.font_id.clone();
                pending.push(Op::TextAdd(params));
                if wrap != 0 {
                    pending.push(Op::TextWrap {
                        id: a.id,
                        wrap_width: wrap,
                    });
                }
                if box_h != 0 {
                    pending.push(Op::TextBoxHeight {
                        id: a.id,
                        box_height: box_h,
                    });
                }
                // The "unset" sentinel for the quad is the IDENTITY,
                // not zero — the other two axes get to use 0 because 0
                // means "auto" for them, whereas an all-zero quad is a
                // collapsed point. Emitting nothing here leaves replay
                // at the identity, which is the same thing.
                if !crate::perspective::is_identity(&quad) {
                    pending.push(Op::TextPerspective { id: a.id, quad });
                }
                // "" is the embedded face — same "unset means the
                // default" shape as `wrap == 0`.
                if !font.is_empty() {
                    pending.push(Op::TextFont {
                        id: a.id,
                        font_id: font,
                    });
                }
            }
            Some(t) => {
                if t.wrap_width != params.wrap_width {
                    pending.push(Op::TextWrap {
                        id: a.id,
                        wrap_width: params.wrap_width,
                    });
                }
                if t.box_height != params.box_height {
                    pending.push(Op::TextBoxHeight {
                        id: a.id,
                        box_height: params.box_height,
                    });
                }
                if t.perspective != params.perspective {
                    pending.push(Op::TextPerspective {
                        id: a.id,
                        quad: params.perspective,
                    });
                }
                if t.font_id != params.font_id {
                    pending.push(Op::TextFont {
                        id: a.id,
                        font_id: params.font_id.clone(),
                    });
                }
                // Compare everything EXCEPT the four skipped fields,
                // which the branches above already accounted for —
                // otherwise a box-only drag would also emit a redundant
                // TextEdit (and `TextParams` derives PartialEq over the
                // real fields, `#[serde(skip)]` or not, so they DO
                // count here).
                let mut without_box = t.clone();
                without_box.wrap_width = params.wrap_width;
                without_box.box_height = params.box_height;
                without_box.perspective = params.perspective;
                without_box.font_id = params.font_id.clone();
                if without_box != params {
                    pending.push(Op::TextEdit(params));
                }
            }
        }
    }
    for ls in &log_doc.shapes {
        if !shapes.iter().any(|s| s.id == ls.id) {
            pending.push(Op::ShapeRemove { id: ls.id });
        }
    }
    for s in shapes {
        let params = ShapeParams::from_annotation(s);
        // ⚠️ `ShapeParams::perspective` is `#[serde(skip)]` (it has to
        // be — see the field's comment), so `ShapeAdd`/`ShapeEdit`
        // physically CANNOT carry it. It needs its own
        // `ShapePerspective` op, exactly as the text quad needs
        // `TextPerspective` above; without it replay rebuilds the shape
        // unwarped, the composite hash diverges, and the log marks
        // itself broken — silently falling the user back to snapshot
        // undo. This is the fourth axis in that family; keep all four
        // handled the same way.
        match log_doc.shapes.iter().find(|p| p.id == s.id) {
            None => {
                let quad = params.perspective;
                let sloppiness = params.sloppiness;
                pending.push(Op::ShapeAdd(params));
                // The "unset" sentinel is the IDENTITY, not zero —
                // emitting nothing leaves replay at the identity, which
                // is the same thing.
                if !crate::perspective::is_identity(&quad) {
                    pending.push(Op::ShapePerspective { id: s.id, quad });
                }
                // Sloppiness is `#[serde(skip)]`; emit its own appended op the
                // same way the quad does. 0 (firm) needs no op — a shape
                // decoded from a v6 keyframe is already firm.
                if sloppiness != 0 {
                    pending.push(Op::ShapeSloppiness {
                        id: s.id,
                        sloppiness,
                    });
                }
            }
            Some(p) => {
                if p.perspective != params.perspective {
                    pending.push(Op::ShapePerspective {
                        id: s.id,
                        quad: params.perspective,
                    });
                }
                if p.sloppiness != params.sloppiness {
                    pending.push(Op::ShapeSloppiness {
                        id: s.id,
                        sloppiness: params.sloppiness,
                    });
                }
                // Compare everything EXCEPT the skipped quad, which the
                // branch above already accounted for — otherwise a
                // perspective-only drag would also emit a redundant
                // ShapeEdit (`ShapeParams` derives PartialEq over the
                // real fields, `#[serde(skip)]` or not, so it DOES
                // count here).
                let mut without_quad = p.clone();
                without_quad.perspective = params.perspective;
                if without_quad != params {
                    pending.push(Op::ShapeEdit(params));
                }
            }
        }
    }
    pending
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
    /// Fill a rectangle with a flat color.
    FillRegion { rect: Rect, color: Rgba },
    /// Gaussian-blur brush stroke: `points` are the EXACT dab centers in
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
    /// ⚠️ INDEX IS PERSISTED — never insert above this. postcard encodes an
    /// enum as `varint(variant index) ++ payload`, so this variant's index is
    /// what makes v2 op bytes decode unchanged under v3 — inserting anything
    /// above it would renumber the variants already written to users' disks
    /// and silently mis-decode them. Append new variants; never insert.
    ///
    /// (#69) This used to say "MUST STAY LAST", which was true when written
    /// and then quietly stopped being true: `TextBoxHeight`, `TextPerspective`
    /// and `PerspectiveWarp` were each APPENDED after it — correctly — and the
    /// comment was not updated. The rule was never "last"; it is "append
    /// only", and it applies to every variant in this enum equally, because
    /// each one's index is on disk the moment a log containing it is saved.
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
    /// v8.42 — a text annotation's projective corner quad, normalized 0..1
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
    /// normalized — a pixel warp has no tile to be a fraction of).
    ///
    /// Appended after [`Op::TextPerspective`]; same rule, same reason.
    PerspectiveWarp { rect: Rect, quad: [(f32, f32); 4] },
    /// v8.76 — a SHAPE's projective corner quad, normalized 0..1 across its
    /// own bbox in TL/TR/BR/BL order. The square/circle twin of
    /// [`Op::TextPerspective`], and what makes Distort / Perspective / Skew
    /// non-destructive on everything the app draws rather than on text alone.
    ///
    /// Appended, for the fourth time, for the reason spelled out on
    /// [`Op::TextWrap`]: postcard indexes enum variants positionally, so
    /// appending is invisible to every op already on a user's disk and
    /// inserting would renumber all of them.
    ShapePerspective { id: u32, quad: [(f32, f32); 4] },
    /// v8.8x — a shape's stroke sloppiness (0–100): how hand-drawn its
    /// outline is. The fifth of the appended family: `#[serde(skip)]` on
    /// [`ShapeParams::sloppiness`] means `ShapeAdd`/`ShapeEdit` CANNOT carry
    /// it, and without this op replay rebuilds the shape firm regardless of
    /// what the user drew — a composite-hash divergence the log then marks
    /// itself broken over. Reuse the rationale on [`Op::TextWrap`]: appended,
    /// never inserted, so the variants already on disk keep their indices.
    ShapeSloppiness { id: u32, sloppiness: u8 },
    /// v8.8x — a text annotation's TYPEFACE. `""` is the embedded Liberation
    /// Sans; anything else names a face registered via `register_font`.
    ///
    /// Appended after [`Op::ShapeSloppiness`], for the sixth time, for the
    /// reason spelled out on [`Op::TextWrap`]: postcard indexes enum variants
    /// positionally, so appending is invisible to every op already on a user's
    /// disk and inserting would renumber all of them. It sits LAST rather than
    /// beside `PerspectiveWarp` where its branch first put it — see the ⚠️ on
    /// [`OP_FORMAT_VERSION`]'s **8**.
    ///
    /// A `String`, not an index — replaying a log on a machine with a
    /// different set of faces registered must mean "this face is missing", not
    /// "this is a different face". `fonts::with_face` turns a missing one into
    /// a visible fallback rather than a failed replay.
    TextFont { id: u32, font_id: String },
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
            Op::ShapePerspective { .. } => "Perspective",
            // Same reasoning as ShapePerspective: a sloppiness change is a
            // style decision the user made in the panel, worth its own entry.
            Op::ShapeSloppiness { .. } => "Edit Shape",
            // Its OWN label, like TextPerspective and unlike TextWrap: picking
            // a typeface is a deliberate styling choice the user will want to
            // find in the History panel, not a by-product of dragging a box.
            Op::TextFont { .. } => "Text Font",
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
        // Shapes carry the same skipped quad since v8.76, so they need the
        // same promotion — and for the same reason, not merely by analogy:
        // `oplog_sync_annotations` diffs `ShapeParams` the way it diffs
        // `TextParams`, so an all-zero decode would differ from the live
        // identity on every sync and append a `ShapePerspective` op forever.
        Op::ShapeAdd(mut p) => {
            p.perspective = default_quad_if_unset(p.perspective);
            Op::ShapeAdd(p)
        }
        Op::ShapeEdit(mut p) => {
            p.perspective = default_quad_if_unset(p.perspective);
            Op::ShapeEdit(p)
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
    // v6 appends the SHAPE quads, parallel to `shapes` by index — the seventh
    // element, and the same prefix-extension trick for the fourth time.
    // v7 appends the per-shape SLOOPINESS (0–100), parallel to `shapes` by
    // index — the eighth element, same trick. `ShapeParams::sloppiness` is
    // `#[serde(skip)]`, so this tuple is the ONLY place a keyframe carries it:
    // the op log still mirrors it with `Op::ShapeSloppiness` appended frames.
    // v8 appends the per-TEXT typeface ids — the ninth element, parallel to
    // `texts` by index, same trick again.
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    let heights: Vec<u32> = texts.iter().map(|t| t.box_height).collect();
    let quads: Vec<[(f32, f32); 4]> = texts.iter().map(|t| t.perspective).collect();
    let shape_quads: Vec<[(f32, f32); 4]> = shapes.iter().map(|s| s.perspective).collect();
    let shape_sloppiness: Vec<u8> = shapes.iter().map(|s| s.sloppiness).collect();
    let fonts: Vec<&str> = texts.iter().map(|t| t.font_id.as_str()).collect();
    if let Ok(body) = postcard::to_allocvec(&(
        texts,
        shapes,
        canvas,
        &wraps,
        &heights,
        &quads,
        &shape_quads,
        &shape_sloppiness,
        &fonts,
    )) {
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
    type V8 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
        Vec<u32>,
        Vec<[(f32, f32); 4]>,
        Vec<[(f32, f32); 4]>,
        Vec<u8>,
        Vec<String>,
    );
    if let Ok((
        mut texts,
        mut shapes,
        canvas,
        wraps,
        heights,
        quads,
        shape_quads,
        shape_sloppiness,
        fonts,
    )) = postcard::from_bytes::<V8>(body)
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
        for (sp, q) in shapes.iter_mut().zip(shape_quads) {
            sp.perspective = default_quad_if_unset(q);
        }
        for (sp, sl) in shapes.iter_mut().zip(shape_sloppiness) {
            sp.sloppiness = sl;
        }
        for (t, f) in texts.iter_mut().zip(fonts) {
            t.font_id = f;
        }
        return Ok((texts, shapes, canvas));
    }
    type V7 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
        Vec<u32>,
        Vec<[(f32, f32); 4]>,
        Vec<[(f32, f32); 4]>,
        Vec<u8>,
    );
    if let Ok((
        mut texts,
        mut shapes,
        canvas,
        wraps,
        heights,
        quads,
        shape_quads,
        shape_sloppiness,
    )) = postcard::from_bytes::<V7>(body)
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
        for (sp, q) in shapes.iter_mut().zip(shape_quads) {
            sp.perspective = default_quad_if_unset(q);
        }
        for (sp, sl) in shapes.iter_mut().zip(shape_sloppiness) {
            sp.sloppiness = sl;
        }
        return Ok((texts, shapes, canvas));
    }
    type V6 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
        Vec<u32>,
        Vec<[(f32, f32); 4]>,
        Vec<[(f32, f32); 4]>,
    );
    if let Ok((mut texts, mut shapes, canvas, wraps, heights, quads, shape_quads)) =
        postcard::from_bytes::<V6>(body)
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
        for (sp, q) in shapes.iter_mut().zip(shape_quads) {
            sp.perspective = default_quad_if_unset(q);
        }
        return Ok((texts, shapes, canvas));
    }
    type V5 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
        Vec<u32>,
        Vec<[(f32, f32); 4]>,
    );
    if let Ok((mut texts, mut shapes, canvas, wraps, heights, quads)) =
        postcard::from_bytes::<V5>(body)
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
        // No shape-quad element at all — every shape is unwarped.
        for sp in shapes.iter_mut() {
            sp.perspective = crate::perspective::IDENTITY_QUAD;
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
    if let Ok((mut texts, mut shapes, canvas, wraps, heights)) = postcard::from_bytes::<V4>(body) {
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
        for sp in shapes.iter_mut() {
            sp.perspective = crate::perspective::IDENTITY_QUAD;
        }
        return Ok((texts, shapes, canvas));
    }
    type V3 = (
        Vec<TextParams>,
        Vec<ShapeParams>,
        Option<CanvasParams>,
        Vec<u32>,
    );
    if let Ok((mut texts, mut shapes, canvas, wraps)) = postcard::from_bytes::<V3>(body) {
        for (t, w) in texts.iter_mut().zip(wraps) {
            t.wrap_width = w;
        }
        for t in texts.iter_mut() {
            t.perspective = crate::perspective::IDENTITY_QUAD;
        }
        for sp in shapes.iter_mut() {
            sp.perspective = crate::perspective::IDENTITY_QUAD;
        }
        return Ok((texts, shapes, canvas));
    }
    type V2 = (Vec<TextParams>, Vec<ShapeParams>, Option<CanvasParams>);
    let (mut texts, mut shapes, canvas) =
        postcard::from_bytes::<V2>(body).map_err(|_| OpError::Decode)?;
    for t in texts.iter_mut() {
        t.perspective = crate::perspective::IDENTITY_QUAD;
    }
    for sp in shapes.iter_mut() {
        sp.perspective = crate::perspective::IDENTITY_QUAD;
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
/// canvas color.
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
        &t.font_id,
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
                // MERGE, not replace — ADR-060. The payload cannot carry the
                // four `#[serde(skip)]` axes, so the annotation keeps its own;
                // `TextParams::carry_skipped_from` is where the whole argument
                // lives.
                let mut next = p.clone();
                next.carry_skipped_from(t);
                *t = next;
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
        Op::ShapePerspective { id, quad } => {
            if let Some(sp) = doc.shapes.iter_mut().find(|s| s.id == *id) {
                sp.perspective = *quad;
            }
        }
        Op::ShapeSloppiness { id, sloppiness } => {
            if let Some(sp) = doc.shapes.iter_mut().find(|s| s.id == *id) {
                sp.sloppiness = *sloppiness;
            }
        }
        Op::TextFont { id, font_id } => {
            if let Some(t) = doc.texts.iter_mut().find(|t| t.id == *id) {
                t.font_id = font_id.clone();
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
                // MERGE, not replace — ADR-060, same rule as `TextEdit` above
                // and for the same reason. See `ShapeParams::carry_skipped_from`.
                let mut next = p.clone();
                next.carry_skipped_from(s);
                *s = next;
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

/// Precompute the 256-entry levels remap for a channel value. Delegates to the
/// live Levels tool, so replay and the live apply are one function and cannot
/// drift (`levels.rs`). The math moved there unchanged.
fn build_levels_lut(p: &LevelsParams) -> [u8; 256] {
    crate::levels::levels_lut(p.black, p.white, p.gamma)
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
    /// back to a keyframe resurrects an old canvas color (undo silently
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
mod tests;

#[cfg(test)]
mod v2_migration_tests;
