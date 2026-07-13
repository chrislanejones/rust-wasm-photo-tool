//! Layer stack: the `Layer` type, the composite/render pipeline, and the layer
//! CRUD / mask / merge impl block. Split out of `lib.rs`; behaviour is unchanged.

use crate::annotations::{
    annotations_to_json, build_text_annotation, render_shape_into, shapes_to_json, ShapeAnnotation,
    TextAnnotation,
};
use crate::core::ImageBuffer;
use crate::utils::json_escape;
use crate::ImageHorseTool;
use crate::PastePreview;
use crate::{codec, transform};
use wasm_bindgen::prelude::*;

/// What a layer *is* to the document — the answer to "is this the Canvas?".
///
/// This is an explicit flag, set at creation and carried with the layer,
/// because the alternative (matching `name == "Background"`) is a bug waiting
/// to happen: the name is user-editable, and the engine has historically used
/// "Background" for BOTH the artboard fill (`load_image_artboard`) and the
/// photo itself (`load_image`). One rename — or one artboard-off document with
/// a pasted layer — and a name match reads the wrong layer. See ADR-016's
/// pre-mortem.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LayerKind {
    /// The artboard fill at the bottom of the stack (ADR-016). A layer to the
    /// user — visible in the Layers panel, toggleable, movable — but DOCUMENT
    /// METADATA to the op log, which counts only `Content` layers. This is what
    /// lets a default (Canvas + Photo) document read as ONE pixel layer and
    /// stay in op-log scope.
    Canvas,
    /// Real pixel content: the photo, pastes, added layers. The default.
    Content,
}

/// A single Photoshop-style layer: an independent RGBA pixel buffer plus its
/// own live (non-destructive) text and shape annotations. Layers share the
/// canvas dimensions held on `ImageHorseTool`. The display canvas is the
/// composite of every visible layer, bottom → top, each blended source-over
/// scaled by `opacity`.
///
/// `Clone` is derived so each history snapshot can carry an independent copy of
/// the whole stack (undo/redo restores layer structure, pixels and overlays) —
/// `kind` rides along, so undo can't launder a Canvas into content.
#[derive(Clone)]
pub struct Layer {
    pub id: u32,
    pub name: String,
    /// Canvas or Content — see [`LayerKind`]. Never inferred from `name`.
    pub kind: LayerKind,
    pub visible: bool,
    pub opacity: f64, // 0.0..=1.0
    pub buf: ImageBuffer,
    /// Optional non-destructive layer mask — one grayscale byte per pixel
    /// (255 = fully revealed, 0 = fully hidden), same w×h as the canvas. It
    /// scales the layer's alpha at composite time (see `render_layer`) without
    /// touching `buf`, so masking is fully reversible until "Apply Mask" bakes
    /// it in. `None` when the layer has no mask.
    pub mask: Option<Vec<u8>>,
    pub text_annotations: Vec<TextAnnotation>,
    pub shape_annotations: Vec<ShapeAnnotation>,
}

impl Layer {
    /// A new `Content` layer — the default for everything the user creates.
    /// The Canvas fill is built with [`Layer::new_canvas`].
    pub(crate) fn new(id: u32, name: String, width: u32, height: u32) -> Self {
        Layer {
            id,
            name,
            kind: LayerKind::Content,
            visible: true,
            opacity: 1.0,
            buf: ImageBuffer::new(width, height),
            mask: None,
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        }
    }

    /// The artboard fill (ADR-016) — `LayerKind::Canvas`, named "Canvas".
    /// Only `load_image_artboard` / `set_artboard_border` build one.
    pub(crate) fn new_canvas(id: u32, width: u32, height: u32) -> Self {
        Layer {
            kind: LayerKind::Canvas,
            ..Layer::new(id, CANVAS_LAYER_NAME.to_string(), width, height)
        }
    }

    /// Is this the artboard fill?
    pub(crate) fn is_canvas(&self) -> bool {
        self.kind == LayerKind::Canvas
    }

    /// True when every pixel is byte-identical — what an artboard fill is by
    /// construction (`load_image_artboard` / `set_artboard_border` write one
    /// RGBA value across the whole buffer, or leave it zeroed when `bg_a == 0`)
    /// and what a photo essentially never is. Used ONLY at the legacy-restore
    /// boundary, where documents predate `kind` and the name alone can't be
    /// trusted (ADR-016 step 6).
    pub(crate) fn is_uniform_fill(&self) -> bool {
        let data = &self.buf.data;
        let Some(first) = data.get(0..4) else {
            return false;
        };
        data.chunks_exact(4).all(|px| px == first)
    }
}

/// The artboard fill's layer name. "Canvas" means exactly one thing (ADR-016);
/// "Background" now always means CONTENT (the photo of a `load_image` document,
/// a flattened stack, a restored snapshot).
pub(crate) const CANVAS_LAYER_NAME: &str = "Canvas";
/// Render one layer (its pixels with shapes + text overlays composited on top)
/// into a fresh RGBA buffer of `w×h`. The shape being edited (if any) is
/// skipped so the JS overlay preview is the only thing drawn for it.
pub(crate) fn render_layer(
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
    // Layer mask LAST: scale the whole layer's alpha (pixels + overlays) by the
    // grayscale mask, so a mask hides the layer's entire contribution. Applied
    // here means every composite/export/thumbnail/flatten path honours it for
    // free. Only the alpha byte is touched; RGB is left intact.
    if let Some(mask) = &layer.mask {
        if mask.len() == (w as usize) * (h as usize) {
            for (i, &m) in mask.iter().enumerate() {
                let a = i * 4 + 3;
                if a < out.len() {
                    out[a] = ((out[a] as u16 * m as u16 + 127) / 255) as u8;
                }
            }
        }
    }
    out
}

/// Blend `src` (RGBA, same `w×h` as `dst`) over `dst` source-over, with the
/// source alpha pre-scaled by `opacity` (0.0..=1.0).
pub(crate) fn blend_over(dst: &mut [u8], src: &[u8], opacity: f64) {
    let op = opacity.clamp(0.0, 1.0);
    if op <= 0.0 {
        return;
    }
    // Layer opacity as a 0..=255 integer multiplier, applied once up front so the
    // per-pixel inner loop is pure integer source-over (same trick as
    // drawing::blend_pixel — no f32 / ÷255.0 per channel per pixel).
    let op255 = (op * 255.0).round() as u32;
    let n = dst.len().min(src.len());
    let mut i = 0;
    while i + 3 < n {
        let sa = ((src[i + 3] as u32 * op255 + 127) / 255).min(255);
        if sa > 0 {
            let da = dst[i + 3] as u32;
            let dst_w = da * (255 - sa);
            let out_a_hi = sa * 255 + dst_w; // out_a ×255 — no intermediate rounding
            if out_a_hi > 0 {
                let half = out_a_hi / 2;
                for c in 0..3 {
                    let num = src[i + c] as u32 * sa * 255 + dst[i + c] as u32 * dst_w;
                    dst[i + c] = ((num + half) / out_a_hi) as u8;
                }
            }
            dst[i + 3] = ((out_a_hi + 127) / 255) as u8;
        }
        i += 4;
    }
}

/// True if `layer` has no live overlays (so its composite is just its pixels).
pub(crate) fn layer_has_no_overlays(layer: &Layer) -> bool {
    layer.text_annotations.is_empty() && layer.shape_annotations.is_empty()
}

/// Composite an entire layer stack into `out` (reused across frames to avoid a
/// per-flush allocation), bottom → top. Hidden layers are skipped; each visible
/// layer is blended source-over scaled by its opacity. Includes a fast path for
/// the common single-visible-opaque-layer-with-no-overlays case (a straight
/// copy — what the old zero-copy blit did).
pub(crate) fn composite_layers_into(
    out: &mut Vec<u8>,
    layers: &[Layer],
    w: u32,
    h: u32,
    editing_shape_id: Option<u32>,
    editing_text_id: Option<u32>,
    // Live Move-tool preview: (active_index, dx, dy). When set, that layer's
    // rendered pixels are shifted by (dx, dy) before blending — non-destructive,
    // operating on the temporary render only.
    move_preview: Option<(usize, i32, i32)>,
    // Layer-resize preview: the layer at this index is skipped entirely — its
    // own (still-unmodified) pixels would otherwise double up with the scaled
    // copy `recomposite` overlays on top via `paste_preview`. `None` outside a
    // "Resize Layer" drag.
    hide_layer: Option<usize>,
) {
    let n = (w as usize) * (h as usize) * 4;
    if out.len() != n {
        out.clear();
        out.resize(n, 0);
    }

    // Fast path: exactly one visible, fully-opaque layer with no overlays →
    // copy its pixels straight in. Avoids the zero-fill + per-pixel blend that
    // would otherwise run on every paint/stamp dab. Skipped during a move
    // preview (so the shift actually applies) or a layer-resize preview (so
    // the hidden layer doesn't show through).
    if move_preview.is_none() && hide_layer.is_none() {
        let mut visible = layers.iter().filter(|l| l.visible);
        if let (Some(only), None) = (visible.next(), visible.next()) {
            // A masked layer isn't a straight copy — it must go through
            // render_layer so the mask scales its alpha; so opt it out here.
            if only.opacity >= 0.999
                && only.mask.is_none()
                && layer_has_no_overlays(only)
                && only.buf.data.len() == n
            {
                out.copy_from_slice(&only.buf.data);
                return;
            }
        }
    }

    out.iter_mut().for_each(|b| *b = 0);
    for (idx, layer) in layers.iter().enumerate() {
        if !layer.visible || hide_layer == Some(idx) {
            continue;
        }
        let mut rendered = render_layer(layer, w, h, editing_shape_id, editing_text_id);
        if let Some((active_idx, dx, dy)) = move_preview {
            if idx == active_idx && (dx != 0 || dy != 0) {
                rendered = crate::transform::translate(&rendered, w as i32, h as i32, dx, dy);
            }
        }
        blend_over(out, &rendered, layer.opacity);
    }
}

/// Allocating variant — composite a stack into a fresh buffer. Used by export /
/// thumbnail / snapshot-PNG paths that aren't on the per-frame hot path.
pub(crate) fn composite_layers(
    layers: &[Layer],
    w: u32,
    h: u32,
    editing_shape_id: Option<u32>,
    editing_text_id: Option<u32>,
) -> Vec<u8> {
    let mut out = Vec::new();
    composite_layers_into(
        &mut out,
        layers,
        w,
        h,
        editing_shape_id,
        editing_text_id,
        None,
        None,
    );
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
/// Paint a soft drop shadow into `tile` from the given silhouette(s): an
/// optional box coverage mask and/or an optional text-alpha source. The union is
/// offset by (dx,dy), blurred twice (≈ Gaussian), and composited as the shadow
/// colour — call it BEFORE drawing the box/text so it sits behind them.
#[allow(clippy::too_many_arguments)]
pub(crate) fn composite_drop_shadow(
    tile: &mut [u8],
    tile_w: u32,
    tile_h: u32,
    box_cov: Option<&[f32]>,
    text_src: Option<(&[u8], u32, u32, i32, i32)>, // pixels, w, h, paste_x, paste_y
    dx: i32,
    dy: i32,
    blur: u32,
    sr: u8,
    sg: u8,
    sb: u8,
    sa: u8,
) {
    if sa == 0 {
        return;
    }
    let n = (tile_w * tile_h) as usize;
    let mut mask = vec![0f32; n];
    if let Some(cov) = box_cov {
        for (m, c) in mask.iter_mut().zip(cov.iter()) {
            *m = m.max(*c);
        }
    }
    if let Some((px, sw, sh, ox, oy)) = text_src {
        for yy in 0..sh as i32 {
            for xx in 0..sw as i32 {
                let a = px[((yy * sw as i32 + xx) * 4 + 3) as usize];
                if a == 0 {
                    continue;
                }
                let tx = ox + xx;
                let ty = oy + yy;
                if tx >= 0 && ty >= 0 && (tx as u32) < tile_w && (ty as u32) < tile_h {
                    let i = (ty as u32 * tile_w + tx as u32) as usize;
                    mask[i] = mask[i].max(a as f32 / 255.0);
                }
            }
        }
    }
    // Offset by (dx,dy): sample the source at the inverse offset.
    let mut shifted = vec![0f32; n];
    for ty in 0..tile_h as i32 {
        for tx in 0..tile_w as i32 {
            let sx = tx - dx;
            let sy = ty - dy;
            if sx >= 0 && sy >= 0 && (sx as u32) < tile_w && (sy as u32) < tile_h {
                shifted[(ty as u32 * tile_w + tx as u32) as usize] =
                    mask[(sy as u32 * tile_w + sx as u32) as usize];
            }
        }
    }
    if blur > 0 {
        crate::drawing::box_blur_f32(&mut shifted, tile_w, tile_h, blur);
        crate::drawing::box_blur_f32(&mut shifted, tile_w, tile_h, blur);
    }
    crate::drawing::blend_coverage(tile, &shifted, sr, sg, sb, sa);
}

/// Speech-bubble tail geometry (`background_kind == 2`). SSOT for these
/// numbers: the tile builder below, `tail_margin`, and (via the
/// `text_ink_offset_bg` export) the JS overlay's anchor mapping all flow
/// from here — never hardcode them JS-side.
const TAIL_LEN: f64 = 46.0; // how far the apex sticks out past the rect edge
const TAIL_HALF: f64 = 16.0; // half-width of the tail base

/// Uniform margin reserved on EVERY side of a bubble tile so the tail fits
/// at any angle — the apex lands inside the margin no matter the direction.
/// 0 for plain text and plain rects.
pub(crate) fn tail_margin(background_kind: u8) -> u32 {
    if background_kind == 2 {
        (TAIL_LEN.ceil() as u32) + (TAIL_HALF.ceil() as u32)
    } else {
        0
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn build_annotation_tile(
    text: &str,
    font_size: f32,
    r: u8,
    g: u8,
    b: u8,
    bold: bool,
    rotation_deg: f64,
    background_kind: u8,
    bg_r: u8,
    bg_g: u8,
    bg_b: u8,
    bg_a: u8,
    bg_padding: u32,
    bg_corner_radius: u32,
    bg_tail: u32,
    shadow_box: bool,
    shadow_text: bool,
    shadow_r: u8,
    shadow_g: u8,
    shadow_b: u8,
    shadow_a: u8,
    shadow_dx: i32,
    shadow_dy: i32,
    shadow_blur: u32,
) -> (Vec<u8>, u32, u32, i32, i32) {
    let rendered = crate::text::render_text(text, font_size, r, g, b, bold);
    let raw_w = rendered.width;
    let raw_h = rendered.height;

    // Reserve a uniform margin so the offset+blurred shadow isn't clipped — and
    // so the tile bbox (used by the Align tool) grows to include the shadow.
    let any_shadow = (shadow_box || shadow_text) && shadow_a > 0;
    let sh_margin: u32 = if any_shadow {
        shadow_blur + shadow_dx.unsigned_abs().max(shadow_dy.unsigned_abs())
    } else {
        0
    };

    // No background.
    if background_kind == 0 {
        // Fast path: nothing to compose (no shadow, no rotation).
        if !any_shadow && rotation_deg.abs() < 0.5 {
            return (rendered.pixels, raw_w, raw_h, 0, 0);
        }
        let tile_w = raw_w + sh_margin * 2;
        let tile_h = raw_h + sh_margin * 2;
        let tx = sh_margin as i32;
        let ty = sh_margin as i32;
        let mut tile = vec![0u8; (tile_w * tile_h * 4) as usize];
        // Only the text can cast a shadow when there's no background box.
        if any_shadow && shadow_text {
            composite_drop_shadow(
                &mut tile,
                tile_w,
                tile_h,
                None,
                Some((&rendered.pixels, raw_w, raw_h, tx, ty)),
                shadow_dx,
                shadow_dy,
                shadow_blur,
                shadow_r,
                shadow_g,
                shadow_b,
                shadow_a,
            );
        }
        crate::transform::paste_region(
            &mut tile,
            tile_w as i32,
            tile_h as i32,
            &rendered.pixels,
            raw_w,
            raw_h,
            tx,
            ty,
        );
        if rotation_deg.abs() < 0.5 {
            return (tile, tile_w, tile_h, 0, 0);
        }
        // `rotate_pixels(+θ)` is clockwise — matches the CSS preview.
        let rotated = crate::text::rotate_pixels(&tile, tile_w, tile_h, rotation_deg as f32);
        let cx = tile_w as i32 / 2;
        let cy = tile_h as i32 / 2;
        let off_x = cx - rotated.width as i32 / 2;
        let off_y = cy - rotated.height as i32 / 2;
        return (rotated.pixels, rotated.width, rotated.height, off_x, off_y);
    }

    // Background path: expand the tile by `bg_padding` on all sides, plus a
    // uniform tail margin for bubbles (`bg_tail` is an angle in degrees, so
    // the margin is reserved on every side — see `tail_margin`).
    let tail_margin: u32 = tail_margin(background_kind);
    let pad = bg_padding;
    let tile_w = raw_w + pad * 2 + tail_margin * 2 + sh_margin * 2;
    let tile_h = raw_h + pad * 2 + tail_margin * 2 + sh_margin * 2;
    let mut tile = vec![0u8; (tile_w * tile_h * 4) as usize];

    // Origin offset = tail margin + shadow margin; the background rect occupies
    // the padded text area, inset by both.
    let origin = (tail_margin + sh_margin) as i32;
    let rect_x0 = origin;
    let rect_y0 = origin;
    let rect_x1 = origin + (raw_w + pad * 2) as i32;
    let rect_y1 = origin + (raw_h + pad * 2) as i32;

    // Build the bubble as a single coverage mask (rect ∪ tail), then composite
    // the colour ONCE. This keeps the tail flush with the body — no AA seam at
    // the join, and translucent fills don't double up where the two overlap.
    let mut cov = vec![0f32; (tile_w * tile_h) as usize];
    crate::drawing::rounded_rect_coverage(
        &mut cov,
        tile_w,
        tile_h,
        rect_x0,
        rect_y0,
        rect_x1,
        rect_y1,
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

        let tx = if dx.abs() > 1e-6 {
            hw / dx.abs()
        } else {
            f64::INFINITY
        };
        let ty = if dy.abs() > 1e-6 {
            hh / dy.abs()
        } else {
            f64::INFINITY
        };
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
            let inward = if dx >= 0.0 {
                -TAIL_OVERLAP
            } else {
                TAIL_OVERLAP
            };
            let bx = ex + inward;
            b1 = (bx, yc - TAIL_HALF);
            b2 = (bx, yc + TAIL_HALF);
            apex = (ex + dx * TAIL_LEN, yc + dy * TAIL_LEN);
        } else {
            // Top/bottom edge — horizontal base running along the edge.
            let lo = rect_x0 as f64 + rad_eff + TAIL_HALF;
            let hi = rect_x1 as f64 - rad_eff - TAIL_HALF;
            let xc = if lo <= hi { ex.clamp(lo, hi) } else { cx };
            let inward = if dy >= 0.0 {
                -TAIL_OVERLAP
            } else {
                TAIL_OVERLAP
            };
            let by = ey + inward;
            b1 = (xc - TAIL_HALF, by);
            b2 = (xc + TAIL_HALF, by);
            apex = (xc + dx * TAIL_LEN, ey + dy * TAIL_LEN);
        }

        crate::drawing::triangle_coverage(&mut cov, tile_w as i32, tile_h as i32, b1, b2, apex);
    }

    // Text sits inside the rect with `pad` margin (origin already folds in the
    // tail + shadow margins).
    let text_dx = origin + pad as i32;
    let text_dy = origin + pad as i32;

    // Soft drop shadow behind everything — cast from the box coverage and/or the
    // text silhouette, per the toggles.
    if any_shadow {
        composite_drop_shadow(
            &mut tile,
            tile_w,
            tile_h,
            if shadow_box {
                Some(cov.as_slice())
            } else {
                None
            },
            if shadow_text {
                Some((&rendered.pixels, raw_w, raw_h, text_dx, text_dy))
            } else {
                None
            },
            shadow_dx,
            shadow_dy,
            shadow_blur,
            shadow_r,
            shadow_g,
            shadow_b,
            shadow_a,
        );
    }

    crate::drawing::blend_coverage(&mut tile, &cov, bg_r, bg_g, bg_b, bg_a);

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

/// Where the FIRST line's glyph ink begins inside the tile that
/// `build_annotation_tile` would produce for these parameters, as offsets
/// from the tile origin — i.e. from the annotation's stored (x, y) when
/// unrotated. Mirrors the no-shadow tile geometry above: `render_text`'s
/// own ink inset (0.25·font_size pad + bearing/ascent inset, true embedded-
/// font metrics) for plain text, plus `tail_margin + bg_padding` for
/// background kinds (rect/bubble) whose text sits at `origin + bg_padding`.
///
/// This is the shared anchor→ink convention for the typing overlay: commit
/// stores `(x, y) = overlay ink − this`, re-edit applies the exact inverse.
/// Lives next to `build_annotation_tile` so the two can't drift; proven
/// against the real tile builder in the tests below.
pub(crate) fn annotation_ink_offset(
    text: &str,
    font_size: f32,
    bold: bool,
    background_kind: u8,
    bg_padding: u32,
) -> (i32, i32) {
    let pad = (font_size * 0.25).ceil() as i32;
    let first = text.lines().next().unwrap_or("");
    let (ink_x, ink_y) = if first.trim().is_empty() {
        (pad, pad)
    } else {
        let rendered = crate::text::render_text(first, font_size, 255, 255, 255, bold);
        crate::utils::ink_bounds(&rendered.pixels, rendered.width, rendered.height)
            .map(|(min_x, min_y, _, _)| (min_x as i32, min_y as i32))
            .unwrap_or((pad, pad))
    };
    let margin = if background_kind == 0 {
        0
    } else {
        (tail_margin(background_kind) + bg_padding) as i32
    };
    (ink_x + margin, ink_y + margin)
}

/// Minimum paste-placement size (px), matching the crop overlay's own floor —
/// keeps a resize from collapsing the box to nothing.
const PASTE_MIN_SIZE: u32 = 10;

#[wasm_bindgen]
impl ImageHorseTool {
    // ── Layers ───────────────────────────────────────────────────────────

    /// Every layer in the stack, Canvas included — what the Layers panel shows.
    pub fn layer_count(&self) -> usize {
        self.layers.len()
    }

    /// How many real PIXEL layers the document has — the Canvas doesn't count
    /// (ADR-016). A default document (Canvas + Photo) answers **1**.
    ///
    /// This, not `layer_count()`, is the number that decides whether the op log
    /// can describe the document: JS's `isLogTrustworthy` reads it. Asking
    /// `layer_count() > 1` was what kept op-log undo and persistence dark on
    /// every default document.
    pub fn content_layer_count(&self) -> usize {
        self.layers.iter().filter(|l| !l.is_canvas()).count()
    }

    /// JSON array of the layer stack, bottom → top:
    /// `[{id,name,kind,visible,opacity,active,hasMask}]`.
    /// `kind` is `"canvas"` for the artboard fill, `"content"` otherwise — the
    /// UI labels and gates on this rather than matching the name.
    pub fn get_layers(&self) -> String {
        let mut out = String::from("[");
        for (i, l) in self.layers.iter().enumerate() {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                "{{\"id\":{},\"name\":\"{}\",\"kind\":\"{}\",\"visible\":{},\"opacity\":{},\"active\":{},\"hasMask\":{}}}",
                l.id,
                json_escape(&l.name),
                if l.is_canvas() { "canvas" } else { "content" },
                l.visible,
                l.opacity,
                i == self.active,
                l.mask.is_some(),
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
    ///
    /// Deleting the Canvas fill (the solid/transparent fill
    /// `load_image_artboard` / `set_artboard_border` grow) also shrinks the
    /// document to the remaining content's tight bounding box — otherwise the
    /// padded canvas those calls added lingers after its fill is gone, and
    /// keeps showing up (as excess transparent/bordered space) in every
    /// subsequent export.
    ///
    /// Identified by `kind`, not name: on an artboard-off document the PHOTO is
    /// the one named "Background" (ADR-016), and shrink-to-content after
    /// deleting a photo is not what the old name match meant to do.
    pub fn remove_layer(&mut self, id: u32) -> bool {
        if self.layers.len() <= 1 {
            return false;
        }
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        self.snap("Delete Layer");
        let was_backing = self.layers[idx].is_canvas();
        self.layers.remove(idx);
        if self.active >= self.layers.len() {
            self.active = self.layers.len() - 1;
        } else if self.active > idx {
            self.active -= 1;
        }
        if was_backing {
            self.shrink_to_content();
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
    ///
    /// The Canvas fill is pinned to the bottom (ADR-016): it can't be moved,
    /// and nothing can be moved beneath it. A Canvas above content would hide
    /// the photo behind an opaque fill, and the export/op-log paths take it as
    /// an invariant that the Canvas — when present — is index 0.
    pub fn move_layer(&mut self, id: u32, new_index: usize) -> bool {
        let Some(from) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if self.layers[from].is_canvas() {
            return false;
        }
        let last = self.layers.len() - 1;
        let floor = match self.canvas_idx() {
            Some(c) => (c + 1).min(last),
            None => 0,
        };
        // `min` before `max`, never `clamp`: clamp panics when floor > last,
        // and a panic here would cross the WASM boundary.
        let to = new_index.min(last).max(floor);
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

    /// Move tool — set the live, non-destructive drag offset for the ACTIVE
    /// layer. The next `recomposite` renders that layer shifted by (dx, dy)
    /// without altering stored pixels. `(0, 0)` clears the preview. No history.
    pub fn set_move_preview(&mut self, dx: i32, dy: i32) {
        self.move_preview = if dx == 0 && dy == 0 {
            None
        } else {
            Some((dx, dy))
        };
    }

    /// Move tool — discard any in-progress move preview without committing
    /// (drag abort / Escape). No history.
    pub fn cancel_move_preview(&mut self) {
        self.move_preview = None;
    }

    /// Move tool — commit a move of the ACTIVE layer's content by (dx, dy):
    /// shifts its pixel buffer AND its text/shape annotations so everything on
    /// the layer travels together. Pushes one "Move Layer" snapshot. Clears any
    /// live preview first. A zero delta clears the preview and does nothing else
    /// (no empty history entry).
    pub fn translate_active_layer(&mut self, dx: i32, dy: i32) {
        self.move_preview = None;
        if (dx == 0 && dy == 0) || self.active >= self.layers.len() {
            return;
        }
        self.snap("Move Layer");
        let (w, h) = (self.width as i32, self.height as i32);
        let layer = &mut self.layers[self.active];
        layer.buf.data = crate::transform::translate(&layer.buf.data, w, h, dx, dy);
        for a in &mut layer.text_annotations {
            a.x += dx;
            a.y += dy;
        }
        for s in &mut layer.shape_annotations {
            s.x0 += dx as f64;
            s.y0 += dy as f64;
            s.x1 += dx as f64;
            s.y1 += dy as f64;
            for p in &mut s.points {
                p.0 += dx as f64;
                p.1 += dy as f64;
            }
        }
        #[cfg(feature = "tiles")]
        {
            let active = self.active as u32;
            self.oplog_record(crate::ops::Op::LayerMove {
                layer: active,
                dx,
                dy,
            });
        }
    }

    // ── Paste placement (movable/resizable bounding-box preview) ──────────
    // Same transient-preview split as the Move tool above: nothing here
    // touches a layer's stored pixel buffer until `commit_paste_preview`, so
    // the pasted image stays adjustable (not yet in undo history) until the
    // user finalizes its placement.

    /// Begin a placement preview for `pixels` (src_w × src_h RGBA), initially
    /// shown at (dest_x, dest_y, dest_w, dest_h). Transient — not part of undo
    /// history until `commit_paste_preview`. Replaces any prior preview.
    pub fn begin_paste_preview(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
        dest_w: u32,
        dest_h: u32,
    ) {
        if pixels.len() != (src_w * src_h * 4) as usize || src_w == 0 || src_h == 0 {
            return;
        }
        self.paste_preview = Some(PastePreview {
            pixels: pixels.to_vec(),
            src_w,
            src_h,
            dest_x,
            dest_y,
            dest_w: dest_w.max(PASTE_MIN_SIZE),
            dest_h: dest_h.max(PASTE_MIN_SIZE),
            init_x: dest_x,
            init_y: dest_y,
            init_w: dest_w.max(PASTE_MIN_SIZE),
            init_h: dest_h.max(PASTE_MIN_SIZE),
            is_layer_source: false,
        });
    }

    /// "Resize Layer" — begin a placement preview seeded from the ACTIVE
    /// layer's own current pixels, initially shown at full canvas size.
    /// Reuses the exact `set_paste_preview_rect`/`cancel_paste_preview`/
    /// `commit_paste_preview` flow built for paste placement: drag the same
    /// bounding-box handles to scale/move the layer's content, Escape cancels
    /// with the layer untouched, committing resamples+replaces the layer's
    /// buffer and pushes one history snapshot. No-op if there's no active
    /// layer.
    pub fn begin_layer_resize_preview(&mut self) {
        if self.active >= self.layers.len() {
            return;
        }
        let (w, h) = (self.width, self.height);
        let pixels = self.layers[self.active].buf.data.clone();
        self.paste_preview = Some(PastePreview {
            pixels,
            src_w: w,
            src_h: h,
            dest_x: 0,
            dest_y: 0,
            dest_w: w,
            dest_h: h,
            init_x: 0,
            init_y: 0,
            init_w: w,
            init_h: h,
            is_layer_source: true,
        });
    }

    /// Update the live placement rect (called every move/resize drag frame).
    /// No-op if there's no active preview (e.g. `begin_paste_preview` wasn't
    /// called, or it already ended via commit/cancel).
    pub fn set_paste_preview_rect(&mut self, dest_x: i32, dest_y: i32, dest_w: u32, dest_h: u32) {
        if let Some(p) = &mut self.paste_preview {
            p.dest_x = dest_x;
            p.dest_y = dest_y;
            p.dest_w = dest_w.max(PASTE_MIN_SIZE);
            p.dest_h = dest_h.max(PASTE_MIN_SIZE);
        }
    }

    /// Discard the in-progress preview without committing (Escape / cancel).
    /// No history.
    pub fn cancel_paste_preview(&mut self) {
        self.paste_preview = None;
    }

    /// True while a placement preview is active — lets JS gate Enter/Escape/
    /// click-away handlers without duplicating state on the JS side.
    pub fn has_paste_preview(&self) -> bool {
        self.paste_preview.is_some()
    }

    /// Bake the current preview into the ACTIVE layer's pixel buffer: resamples
    /// the ORIGINAL source pixels to (dest_w, dest_h) with `filter` (same
    /// 0=nearest/1=bilinear/2=catmull-rom/3=lanczos3 convention as
    /// `resize_with_filter`), then alpha-composites at (dest_x, dest_y) — or,
    /// for a "Resize Layer" preview (`is_layer_source`), REPLACES the buffer
    /// outright, since the source there is that same layer's own pre-drag
    /// content and blending onto it would double it up. Clears the preview.
    /// No-op if there is no active preview.
    ///
    /// History: a "Resize Layer" preview pushes ONE snapshot. A paste pushes
    /// "Paste" — and, when the box was moved/resized away from its initial
    /// fit rect, a SECOND "Resize Layer"/"Move Layer" snapshot, so the sizing
    /// shows in the History panel and undoes independently of the paste
    /// itself. Both bakes resample from the ORIGINAL source pixels (never a
    /// resample of a resample).
    pub fn commit_paste_preview(&mut self, filter: u8) {
        let Some(p) = self.paste_preview.take() else {
            return;
        };
        if self.active >= self.layers.len() {
            return;
        }
        let resized = p.dest_w != p.init_w || p.dest_h != p.init_h;
        let moved = p.dest_x != p.init_x || p.dest_y != p.init_y;

        if p.is_layer_source {
            self.snap("Resize Layer");
            let scaled = Self::scale_paste_source(&p, p.dest_w, p.dest_h, filter);
            let buf = &mut self.layers[self.active].buf.data;
            buf.iter_mut().for_each(|b| *b = 0);
            crate::transform::paste_region(
                buf,
                self.width as i32,
                self.height as i32,
                &scaled,
                p.dest_w,
                p.dest_h,
                p.dest_x,
                p.dest_y,
            );
            return;
        }

        self.snap("Paste");
        if resized || moved {
            // Intermediate bake at the initial fit rect, snapshotted, then
            // wiped — leaves history reading "Paste" → "Resize/Move Layer"
            // with the final bake done fresh over the pre-paste pixels.
            let before = self.layers[self.active].buf.data.clone();
            let init_scaled = Self::scale_paste_source(&p, p.init_w, p.init_h, filter);
            crate::transform::paste_region(
                &mut self.layers[self.active].buf.data,
                self.width as i32,
                self.height as i32,
                &init_scaled,
                p.init_w,
                p.init_h,
                p.init_x,
                p.init_y,
            );
            self.snap(if resized {
                "Resize Layer"
            } else {
                "Move Layer"
            });
            self.layers[self.active].buf.data = before;
        }
        let scaled = Self::scale_paste_source(&p, p.dest_w, p.dest_h, filter);
        crate::transform::paste_region(
            &mut self.layers[self.active].buf.data,
            self.width as i32,
            self.height as i32,
            &scaled,
            p.dest_w,
            p.dest_h,
            p.dest_x,
            p.dest_y,
        );
    }

    /// Resample a preview's ORIGINAL source pixels to (w, h) with `filter`
    /// (0=nearest/1=bilinear/2=catmull-rom/3=lanczos3). Identity dimensions
    /// skip the resample.
    fn scale_paste_source(p: &PastePreview, w: u32, h: u32, filter: u8) -> Vec<u8> {
        if w == p.src_w && h == p.src_h {
            return p.pixels.clone();
        }
        match filter {
            0 => crate::transform::resize_nearest(&p.pixels, p.src_w, p.src_h, w, h),
            2 => crate::transform::resize_catmull_rom(&p.pixels, p.src_w, p.src_h, w, h),
            3 => crate::transform::resize_lanczos3(&p.pixels, p.src_w, p.src_h, w, h),
            _ => crate::transform::resize_bilinear(&p.pixels, p.src_w, p.src_h, w, h),
        }
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
            // Bake the lower layer's own mask into its alpha and drop it, so the
            // merged pixels (including the upper layer we're about to blend in)
            // aren't re-masked by it. The upper layer's mask is already baked in
            // by `render_layer` above.
            if let Some(mask) = lower.mask.take() {
                for (i, &m) in mask.iter().enumerate() {
                    let a = i * 4 + 3;
                    if a < lower.buf.data.len() {
                        lower.buf.data[a] =
                            ((lower.buf.data[a] as u16 * m as u16 + 127) / 255) as u8;
                    }
                }
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

    // ── Layer masks ───────────────────────────────────────────────────────
    // A mask is a grayscale buffer (255 = revealed, 0 = hidden) scaling the
    // layer's alpha at composite time (`render_layer`) — non-destructive until
    // applied. Paint it with `mask_paint_*`. All four mutators snap history.

    /// Add a fully-revealed (white) mask to layer `id`. Returns false if the
    /// layer isn't found or already has a valid mask. (No recomposite — a white
    /// mask is visually identical until you paint on it.)
    pub fn add_layer_mask(&mut self, id: u32) -> bool {
        let n = (self.width * self.height) as usize;
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if self.layers[idx].mask.as_ref().is_some_and(|m| m.len() == n) {
            return false;
        }
        self.snap("Add Mask");
        self.layers[idx].mask = Some(vec![255u8; n]);
        true
    }

    /// Discard layer `id`'s mask (reveal everything again). False if it had none.
    pub fn remove_layer_mask(&mut self, id: u32) -> bool {
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if self.layers[idx].mask.is_none() {
            return false;
        }
        self.snap("Remove Mask");
        self.layers[idx].mask = None;
        self.recomposite();
        true
    }

    /// Bake layer `id`'s mask into its alpha permanently, then drop the mask
    /// (the masked-out pixels become genuinely transparent). False if no mask.
    pub fn apply_layer_mask(&mut self, id: u32) -> bool {
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if self.layers[idx].mask.is_none() {
            return false;
        }
        self.snap("Apply Mask");
        if let Some(mask) = self.layers[idx].mask.take() {
            let data = &mut self.layers[idx].buf.data;
            for (i, &m) in mask.iter().enumerate() {
                let a = i * 4 + 3;
                if a < data.len() {
                    data[a] = ((data[a] as u16 * m as u16 + 127) / 255) as u8;
                }
            }
        }
        self.recomposite();
        true
    }

    /// Invert layer `id`'s mask (reveal↔hide). False if it has none.
    pub fn invert_layer_mask(&mut self, id: u32) -> bool {
        let Some(idx) = self.layers.iter().position(|l| l.id == id) else {
            return false;
        };
        if self.layers[idx].mask.is_none() {
            return false;
        }
        self.snap("Invert Mask");
        if let Some(mask) = self.layers[idx].mask.as_mut() {
            crate::simd::color::invert_u8(mask); // SIMD 255−x (scalar fallback)
        }
        self.recomposite();
        true
    }

    /// Whether layer `id` currently has a mask.
    pub fn has_layer_mask(&self, id: u32) -> bool {
        self.layers.iter().any(|l| l.id == id && l.mask.is_some())
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
            // Content by default; `finish_layer_restore` promotes the bottom
            // layer to Canvas when the persisted document was an artboard (see
            // its legacy-read doc). A restored layer is never assumed to be a
            // Canvas here — at push time the stack is still incomplete, so
            // "is this the bottom of a multi-layer document?" has no answer yet.
            kind: LayerKind::Content,
            visible,
            opacity: opacity.clamp(0.0, 1.0),
            buf,
            mask: None,
            text_annotations: Vec::new(),
            shape_annotations: Vec::new(),
        });
        self.active = self.layers.len() - 1;
        id
    }

    /// Restore a text annotation onto the active (just-pushed) layer WITHOUT
    /// pushing history. Mirrors `restore_shape_annotation` for text. The tile is
    /// rebuilt from config; a fresh id is assigned.
    #[allow(clippy::too_many_arguments)]
    pub fn restore_text_annotation(
        &mut self,
        text: &str,
        font_size: f32,
        r: u8,
        g: u8,
        b: u8,
        bold: bool,
        x: i32,
        y: i32,
        rotation_deg: f64,
        background_kind: u8,
        bg_r: u8,
        bg_g: u8,
        bg_b: u8,
        bg_a: u8,
        bg_padding: u32,
        bg_corner_radius: u32,
        bg_tail: u32,
        shadow_box: bool,
        shadow_text: bool,
        shadow_r: u8,
        shadow_g: u8,
        shadow_b: u8,
        shadow_a: u8,
        shadow_dx: i32,
        shadow_dy: i32,
        shadow_blur: u32,
    ) -> u32 {
        let id = self.next_text_id;
        self.next_text_id = self.next_text_id.wrapping_add(1).max(1);
        let ann = build_text_annotation(
            id,
            text,
            font_size,
            r,
            g,
            b,
            bold,
            x,
            y,
            rotation_deg,
            background_kind,
            bg_r,
            bg_g,
            bg_b,
            bg_a,
            bg_padding,
            bg_corner_radius,
            bg_tail,
            shadow_box,
            shadow_text,
            shadow_r,
            shadow_g,
            shadow_b,
            shadow_a,
            shadow_dx,
            shadow_dy,
            shadow_blur,
        );
        let active = self.active;
        if let Some(layer) = self.layers.get_mut(active) {
            layer.text_annotations.push(ann);
        }
        id
    }

    /// Finish a layer-restore: recover the Canvas flag for documents persisted
    /// before it existed, clamp the active layer to `active_index`, guarantee a
    /// non-empty stack, and rebuild the composite cache.
    ///
    /// ## The legacy read (ADR-016 step 6)
    /// Persisted documents predate `kind` — they carry only a layer NAME, and
    /// the archive that wrote them called the artboard fill "Background". These
    /// are real user documents with no backup, so they must still open with the
    /// fill understood as the Canvas.
    ///
    /// Inferring from the name ALONE is what the ADR's pre-mortem warns
    /// against, and it is not paranoia: an artboard-OFF document whose bottom
    /// layer is the PHOTO is also named "Background" (`load_image`), and one
    /// pasted layer makes it a >1-layer document — indistinguishable by name.
    /// Calling that photo a Canvas would hand the op log the wrong content
    /// plane and drop the photo from exports.
    ///
    /// So the name is necessary but not sufficient: the layer must ALSO be a
    /// uniform fill, which every `load_image_artboard` / `set_artboard_border`
    /// canvas is by construction and a photograph is not. The only documents
    /// this can misread are ones whose bottom layer is a perfectly solid
    /// colour — and there the misreading is harmless, because the Canvas
    /// metadata reproduces that exact plane at composite time.
    pub fn finish_layer_restore(&mut self, active_index: usize) {
        if self.layers.is_empty() {
            self.layers.push(Layer::new(
                1,
                "Background".to_string(),
                self.width,
                self.height,
            ));
            self.next_layer_id = 2;
        }
        if self.layers.len() > 1 {
            let bottom = &mut self.layers[0];
            let named_like_a_canvas =
                bottom.name == CANVAS_LAYER_NAME || bottom.name == "Background";
            if named_like_a_canvas && bottom.is_uniform_fill() {
                bottom.kind = LayerKind::Canvas;
                bottom.name = CANVAS_LAYER_NAME.to_string();
            }
        }
        self.active = active_index.min(self.layers.len() - 1);
        self.editing_shape_id = None;
        self.recomposite();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `annotation_ink_offset` must agree with the REAL tile builder: build
    /// the tile with a fully transparent background (isolates the glyph ink
    /// inside the true bg-kind geometry — margins still apply) and no
    /// shadow/rotation, then assert the tile's ink bounds start exactly at
    /// the predicted offset. Covers plain / rect / bubble across paddings
    /// and font sizes so the overlay's anchor mapping can't silently drift
    /// from `build_annotation_tile`.
    #[test]
    fn ink_offset_matches_tile_geometry() {
        for &kind in &[0u8, 1, 2] {
            for &pad in &[0u32, 8, 24] {
                for &fs in &[16.0f32, 24.0, 54.0] {
                    for &bold in &[false, true] {
                        let (tile, w, h, off_x, off_y) = build_annotation_tile(
                            "Hg", fs, 255, 255, 255, bold, 0.0, kind, 0, 0, 0,
                            0, // bg_a = 0: transparent bg, geometry unchanged
                            pad, 6, 135, false, false, 0, 0, 0, 0, 0, 0, 0,
                        );
                        assert_eq!((off_x, off_y), (0, 0), "unrotated tile offset");
                        let ink =
                            crate::utils::ink_bounds(&tile, w, h).expect("tile has visible ink");
                        let want = annotation_ink_offset("Hg", fs, bold, kind, pad);
                        assert_eq!(
                            (ink.0 as i32, ink.1 as i32),
                            want,
                            "kind={kind} pad={pad} fs={fs} bold={bold}"
                        );
                    }
                }
            }
        }
    }

    /// Bubble margin = ceil(TAIL_LEN) + ceil(TAIL_HALF); other kinds 0.
    #[test]
    fn tail_margin_values() {
        assert_eq!(tail_margin(0), 0);
        assert_eq!(tail_margin(1), 0);
        assert_eq!(
            tail_margin(2),
            (TAIL_LEN.ceil() as u32) + (TAIL_HALF.ceil() as u32)
        );
    }
}
