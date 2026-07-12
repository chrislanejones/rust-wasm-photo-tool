//! Live (non-destructive) text and shape/arrow annotations: the data types,
//! JSON (de)serialisation, rasterisation helpers, and the annotation CRUD impl
//! blocks. Split out of `lib.rs`; behaviour is unchanged.

use crate::layer::build_annotation_tile;
use crate::utils::{
    flat_to_points, ink_bounds, json_escape, pin_label, point_segment_distance, points_bbox,
};
use crate::ImageHorseTool;
use crate::{drawing, transform};
use wasm_bindgen::prelude::*;

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
    pub x: i32, // unrotated top-left in canvas coords
    pub y: i32,
    pub font_size: f32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub bold: bool,
    pub rotation_deg: f64,
    // cached pre-rendered tile (rotated): updated whenever the annotation changes.
    // Arc so history snapshots can clone the annotation list cheaply (the tile
    // bytes are shared, not deep-copied per snapshot).
    pub tile_pixels: std::sync::Arc<Vec<u8>>,
    pub tile_w: u32,
    pub tile_h: u32,
    pub tile_offset_x: i32, // offset of tile origin from (x,y) due to rotation expanding bounds
    pub tile_offset_y: i32,
    // Text background (optional fill behind the text)
    pub background_kind: u8, // 0 = None, 1 = Rect, 2 = SpeechBubble
    pub bg_r: u8,
    pub bg_g: u8,
    pub bg_b: u8,
    pub bg_a: u8,
    pub bg_padding: u32,
    pub bg_corner_radius: u32,
    pub bg_tail: u32, // speech-bubble tail angle in degrees (0-359, CW from +x / east); only used when background_kind == 2
    // Soft drop shadow — shared color/offset/blur with independent box/text
    // toggles. Cast from the selected silhouette(s), offset, blurred, and painted
    // behind everything when the tile is built. All-zero / both-false = no shadow.
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
    pub x0: f64,
    pub y0: f64, // start point / bbox corner (canvas coords)
    pub x1: f64,
    pub y1: f64, // end point / opposite bbox corner
    pub r: u8,
    pub g: u8,
    pub b: u8,
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
    pub fill_r: u8,
    pub fill_g: u8,
    pub fill_b: u8,
    pub fill_a: u8,
    /// Gradient stop 1 (RGBA). Used only when `fill_kind == 2`.
    pub fill2_r: u8,
    pub fill2_g: u8,
    pub fill2_b: u8,
    pub fill2_a: u8,
    /// Linear-gradient direction in degrees (0 = →, 90 = ↓, …). `fill_kind == 2`.
    pub fill_angle: u16,
    /// Mosaic block size in px for `fill_kind == 3` (pixelate). 0 → default 16.
    pub fill_block: u32,
}
/// Build a complete TextAnnotation (config + pre-rendered tile) ready to
/// either push onto the live overlay list or onto a history snapshot's
/// annotation vector. Centralizes the tile-rebuild logic so add/update
/// and snapshot-restore all share the same path.
#[allow(clippy::too_many_arguments)]
pub(crate) fn build_text_annotation(
    id: u32,
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
) -> TextAnnotation {
    let (tile_pixels, tile_w, tile_h, tile_offset_x, tile_offset_y) = build_annotation_tile(
        text,
        font_size,
        r,
        g,
        b,
        bold,
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
    TextAnnotation {
        id,
        text: text.to_string(),
        x,
        y,
        font_size,
        r,
        g,
        b,
        bold,
        rotation_deg,
        tile_pixels: std::sync::Arc::new(tile_pixels),
        tile_w,
        tile_h,
        tile_offset_x,
        tile_offset_y,
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
    }
}

/// Serialize a list of annotations to the JSON format consumed by JS.
/// Tile dimensions are included so the JS overlay can lay out chevrons
/// and selection rectangles without a Rust round-trip per frame.
pub(crate) fn annotations_to_json(anns: &[TextAnnotation]) -> String {
    let mut out = String::from("[");
    for (i, a) in anns.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!(
            "{{\"id\":{},\"text\":\"{}\",\"x\":{},\"y\":{},\"font_size\":{},\"r\":{},\"g\":{},\"b\":{},\"bold\":{},\"rotation_deg\":{},\"tile_w\":{},\"tile_h\":{},\"tile_offset_x\":{},\"tile_offset_y\":{},\"background_kind\":{},\"bg_r\":{},\"bg_g\":{},\"bg_b\":{},\"bg_a\":{},\"bg_padding\":{},\"bg_corner_radius\":{},\"bg_tail\":{},\"shadow_box\":{},\"shadow_text\":{},\"shadow_r\":{},\"shadow_g\":{},\"shadow_b\":{},\"shadow_a\":{},\"shadow_dx\":{},\"shadow_dy\":{},\"shadow_blur\":{}}}",
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
            a.shadow_box, a.shadow_text,
            a.shadow_r, a.shadow_g, a.shadow_b, a.shadow_a,
            a.shadow_dx, a.shadow_dy, a.shadow_blur,
        ));
    }
    out.push(']');
    out
}

/// Serialize a list of shape annotations to JSON for the JS overlay /
/// Reselect list. Geometry is the raw endpoint pair; the JS side derives
/// bounding boxes the same way Rust's `draw_shape` does.
pub(crate) fn shapes_to_json(shapes: &[ShapeAnnotation]) -> String {
    let mut out = String::from("[");
    for (i, s) in shapes.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        let mut pts = String::from("[");
        for (j, (x, y)) in s.points.iter().enumerate() {
            if j > 0 {
                pts.push(',');
            }
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
/// Composite one shape annotation directly into `data` (RGBA, w×h) using the
/// same drawing primitives as the instant-commit path, so the live overlay and
/// the flattened pixels are identical.
pub(crate) fn render_shape_into(data: &mut [u8], w: u32, h: u32, s: &ShapeAnnotation) {
    let color = [s.r, s.g, s.b, 255];
    // Interior fill (rect=0, circle=1 only), painted BEFORE the stroke so the
    // outline sits on top. fill_kind: 1 = solid, 2 = linear gradient.
    if (s.kind == 0 || s.kind == 1) && s.fill_kind != 0 {
        crate::drawing::fill_shape(
            data,
            w,
            h,
            s.kind,
            s.x0,
            s.y0,
            s.x1,
            s.y1,
            s.fill_kind,
            [s.fill_r, s.fill_g, s.fill_b, s.fill_a],
            [s.fill2_r, s.fill2_g, s.fill2_b, s.fill2_a],
            s.fill_angle,
            s.fill_block,
        );
    }
    match s.kind {
        4 => crate::drawing::draw_arrow(
            data,
            w,
            h,
            s.x0,
            s.y0,
            s.x1,
            s.y1,
            color,
            s.stroke_width,
            s.arrow_style as u32,
        ),
        5 => render_pin(data, w, h, s),
        6 => crate::drawing::draw_polyline(data, w, h, &s.points, color, s.stroke_width),
        7 => {
            let pts = crate::drawing::flatten_cubic_path(&s.points);
            if s.fill_kind != 0 {
                crate::drawing::fill_polygon(
                    data,
                    w,
                    h,
                    &pts,
                    [s.fill_r, s.fill_g, s.fill_b, s.fill_a],
                );
            }
            crate::drawing::draw_polyline(data, w, h, &pts, color, s.stroke_width);
        }
        _ => crate::drawing::draw_shape(
            data,
            w,
            h,
            s.x0,
            s.y0,
            s.x1,
            s.y1,
            s.kind as u32,
            color,
            s.stroke_width,
        ),
    }
}
/// Render a callout pin: a filled disc (from the bbox) with its label —
/// a number (1, 2, 3…) or a letter (A, B, C…) — centred on it in a
/// contrasting colour.
pub(crate) fn render_pin(data: &mut [u8], w: u32, h: u32, s: &ShapeAnnotation) {
    let cx = (s.x0 + s.x1) * 0.5;
    let cy = (s.y0 + s.y1) * 0.5;
    let radius = (s.x1 - s.x0).abs().min((s.y1 - s.y0).abs()) * 0.5;
    if radius < 1.0 {
        return;
    }
    crate::drawing::fill_circle(data, w, h, cx, cy, radius, [s.r, s.g, s.b, 255]);

    // Black or white label depending on fill luminance.
    let lum = 0.299 * s.r as f64 + 0.587 * s.g as f64 + 0.114 * s.b as f64;
    let (nr, ng, nb) = if lum > 140.0 {
        (20u8, 20u8, 20u8)
    } else {
        (255u8, 255u8, 255u8)
    };
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
        data,
        w as i32,
        h as i32,
        &rendered.pixels,
        rendered.width,
        rendered.height,
        dx,
        dy,
    );
}
#[wasm_bindgen]
impl ImageHorseTool {
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
        from_x: f64,
        from_y: f64,
        to_x: f64,
        to_y: f64,
        color_hex: &str,
        stroke_width: f64,
        style: u32,
    ) {
        let color = drawing::parse_hex_color(color_hex);
        drawing::draw_arrow(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            from_x,
            from_y,
            to_x,
            to_y,
            color,
            stroke_width,
            style,
        );
    }

    // ── Drawing: Shapes ─────────────────────────────────────────
    /// Draw a shape onto the image buffer.
    /// shape: 0=rect, 1=circle, 2=line
    /// color_hex: CSS hex like "#ef4444"
    pub fn draw_shape(
        &mut self,
        from_x: f64,
        from_y: f64,
        to_x: f64,
        to_y: f64,
        shape: u32,
        color_hex: &str,
        stroke_width: f64,
    ) {
        let color = drawing::parse_hex_color(color_hex);
        drawing::draw_shape(
            &mut self.layers[self.active].buf.data,
            self.width,
            self.height,
            from_x,
            from_y,
            to_x,
            to_y,
            shape,
            color,
            stroke_width,
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
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
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
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind,
                x0,
                y0,
                x1,
                y1,
                r: c[0],
                g: c[1],
                b: c[2],
                stroke_width,
                arrow_style,
                number: 0,
                label_kind: 0,
                points: Vec::new(),
                fill_kind,
                fill_r: f[0],
                fill_g: f[1],
                fill_b: f[2],
                fill_a: f[3],
                fill2_r: f2[0],
                fill2_g: f2[1],
                fill2_b: f2[2],
                fill2_a: f2[3],
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
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        r: u8,
        g: u8,
        b: u8,
        stroke_width: f64,
        arrow_style: u8,
        fill_kind: u8,
        fill_r: u8,
        fill_g: u8,
        fill_b: u8,
        fill_a: u8,
        fill2_r: u8,
        fill2_g: u8,
        fill2_b: u8,
        fill2_a: u8,
        fill_angle: u16,
        fill_block: u32,
    ) -> u32 {
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind,
                x0,
                y0,
                x1,
                y1,
                r,
                g,
                b,
                stroke_width,
                arrow_style,
                number: 0,
                label_kind: 0,
                points: Vec::new(),
                fill_kind,
                fill_r,
                fill_g,
                fill_b,
                fill_a,
                fill2_r,
                fill2_g,
                fill2_b,
                fill2_a,
                fill_angle,
                fill_block,
            });
        id
    }

    /// Add a numbered callout pin (kind 5): a filled circle + centred number,
    /// stored as a circle-style bbox plus its label. Pushes "Add Pin".
    pub fn add_pin_annotation(
        &mut self,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        number: u32,
        color_hex: &str,
        label_kind: u8,
    ) -> u32 {
        self.snap("Add Pin");
        let c = drawing::parse_hex_color(color_hex);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind: 5,
                x0,
                y0,
                x1,
                y1,
                r: c[0],
                g: c[1],
                b: c[2],
                stroke_width: 0.0,
                arrow_style: 0,
                number,
                label_kind,
                points: Vec::new(),
                ..Default::default()
            });
        id
    }

    /// Restore a persisted pin WITHOUT pushing history. Colour is raw r,g,b.
    pub fn restore_pin_annotation(
        &mut self,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        number: u32,
        r: u8,
        g: u8,
        b: u8,
        label_kind: u8,
    ) -> u32 {
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind: 5,
                x0,
                y0,
                x1,
                y1,
                r,
                g,
                b,
                stroke_width: 0.0,
                arrow_style: 0,
                number,
                label_kind,
                points: Vec::new(),
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
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind: 6,
                x0,
                y0,
                x1,
                y1,
                r: c[0],
                g: c[1],
                b: c[2],
                stroke_width,
                arrow_style: 0,
                number: 0,
                points: pts,
                ..Default::default()
            });
        id
    }

    /// Restore a persisted polyline WITHOUT pushing history. Colour is raw r,g,b.
    pub fn restore_polyline_annotation(
        &mut self,
        points: &[f64],
        r: u8,
        g: u8,
        b: u8,
        stroke_width: f64,
    ) -> u32 {
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind: 6,
                x0,
                y0,
                x1,
                y1,
                r,
                g,
                b,
                stroke_width,
                arrow_style: 0,
                number: 0,
                points: pts,
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
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind: 7,
                x0,
                y0,
                x1,
                y1,
                r: c[0],
                g: c[1],
                b: c[2],
                stroke_width,
                arrow_style: 0,
                number: 0,
                points: pts,
                fill_kind,
                fill_r: fc[0],
                fill_g: fc[1],
                fill_b: fc[2],
                fill_a: fc[3],
                ..Default::default()
            });
        id
    }

    /// Restore a persisted Bézier path WITHOUT pushing history. Raw r,g,b.
    pub fn restore_bezier_annotation(
        &mut self,
        points: &[f64],
        r: u8,
        g: u8,
        b: u8,
        stroke_width: f64,
        fill_kind: u8,
        fill_r: u8,
        fill_g: u8,
        fill_b: u8,
        fill_a: u8,
    ) -> u32 {
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let id = self.next_shape_id;
        self.next_shape_id = self.next_shape_id.wrapping_add(1).max(1);
        self.layers[self.active]
            .shape_annotations
            .push(ShapeAnnotation {
                id,
                kind: 7,
                x0,
                y0,
                x1,
                y1,
                r,
                g,
                b,
                stroke_width,
                arrow_style: 0,
                number: 0,
                points: pts,
                fill_kind,
                fill_r,
                fill_g,
                fill_b,
                fill_a,
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
            s.x0 = x0;
            s.y0 = y0;
            s.x1 = x1;
            s.y1 = y1;
        }
    }

    /// Commit a reshape of an existing Bézier path: pushes one "Edit Pen Path"
    /// snapshot (so undo restores the prior shape), then replaces its control
    /// points. Style (colour / width / fill) is left untouched.
    /// Update a Bézier pen path's geometry AND style (stroke colour/width +
    /// solid Background fill), so reselecting a committed path and changing the
    /// Paint→Pen panel re-styles it — including filling a path that was drawn
    /// without a Background. `fill_kind`: 0 = no fill, 1 = solid `fill_color_hex`.
    /// Mirrors `update_shape_annotation` for shapes. Pushes "Edit Pen Path".
    pub fn update_bezier_annotation(
        &mut self,
        id: u32,
        points: &[f64],
        color_hex: &str,
        stroke_width: f64,
        fill_kind: u8,
        fill_color_hex: &str,
    ) {
        self.snap("Edit Pen Path");
        let pts = flat_to_points(points);
        let (x0, y0, x1, y1) = points_bbox(&pts);
        let c = drawing::parse_hex_color(color_hex);
        let fc = drawing::parse_hex_color(fill_color_hex);
        if let Some(s) = self.layers[self.active]
            .shape_annotations
            .iter_mut()
            .find(|s| s.id == id)
        {
            s.points = pts;
            s.x0 = x0;
            s.y0 = y0;
            s.x1 = x1;
            s.y1 = y1;
            s.r = c[0];
            s.g = c[1];
            s.b = c[2];
            s.stroke_width = stroke_width;
            s.fill_kind = fill_kind;
            s.fill_r = fc[0];
            s.fill_g = fc[1];
            s.fill_b = fc[2];
            s.fill_a = fc[3];
        }
    }

    /// Update an existing shape annotation in full (geometry + style). Pushes
    /// an "Edit Shape" snapshot so undo restores the prior values. Used when a
    /// drag/resize or panel restyle of a selected shape is committed.
    pub fn update_shape_annotation(
        &mut self,
        id: u32,
        kind: u8,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        color_hex: &str,
        stroke_width: f64,
        arrow_style: u8,
        fill_kind: u8,
        fill_hex: &str,
        fill2_hex: &str,
        fill_angle: u16,
        fill_block: u32,
    ) -> bool {
        if !self.layers[self.active]
            .shape_annotations
            .iter()
            .any(|s| s.id == id)
        {
            return false;
        }
        self.snap("Edit Shape");
        let c = drawing::parse_hex_color(color_hex);
        let f = drawing::parse_hex_color(fill_hex);
        let f2 = drawing::parse_hex_color(fill2_hex);
        if let Some(s) = self.layers[self.active]
            .shape_annotations
            .iter_mut()
            .find(|s| s.id == id)
        {
            s.kind = kind;
            s.x0 = x0;
            s.y0 = y0;
            s.x1 = x1;
            s.y1 = y1;
            s.r = c[0];
            s.g = c[1];
            s.b = c[2];
            s.stroke_width = stroke_width;
            s.arrow_style = arrow_style;
            s.fill_kind = fill_kind;
            s.fill_r = f[0];
            s.fill_g = f[1];
            s.fill_b = f[2];
            s.fill_a = f[3];
            s.fill2_r = f2[0];
            s.fill2_g = f2[1];
            s.fill2_b = f2[2];
            s.fill2_a = f2[3];
            s.fill_angle = fill_angle;
            s.fill_block = fill_block;
        }
        true
    }

    /// Align a committed annotation's bounding box to an edge / center of the
    /// canvas. `mode` ∈ {left, centerH, right, top, middleV, bottom}. `is_text`
    /// picks the text vs shape list (active layer). Snaps history once; the
    /// caller flushes to re-render. Returns true if the annotation was moved.
    pub fn align_annotation(
        &mut self,
        id: u32,
        is_text: bool,
        mode: &str,
        canvas_w: f64,
        canvas_h: f64,
    ) -> bool {
        // Current bbox (minx, miny, maxx, maxy) — computed without holding a
        // mutable borrow across snap().
        let bbox: Option<(f64, f64, f64, f64)> = if is_text {
            self.layers[self.active]
                .text_annotations
                .iter()
                .find(|t| t.id == id)
                .map(|t| {
                    let minx = (t.x + t.tile_offset_x) as f64;
                    let miny = (t.y + t.tile_offset_y) as f64;
                    (minx, miny, minx + t.tile_w as f64, miny + t.tile_h as f64)
                })
        } else {
            self.layers[self.active]
                .shape_annotations
                .iter()
                .find(|s| s.id == id)
                .map(|s| {
                    (
                        s.x0.min(s.x1),
                        s.y0.min(s.y1),
                        s.x0.max(s.x1),
                        s.y0.max(s.y1),
                    )
                })
        };
        let Some((minx, miny, maxx, maxy)) = bbox else {
            return false;
        };
        let (bw, bh) = (maxx - minx, maxy - miny);
        // Cell centers of a 3×3 grid over the canvas: columns at w/6, w/2, 5w/6
        // and rows at h/6, h/2, 5h/6. A "nine-grid" mode centers the bbox in the
        // chosen cell; the legacy single-axis modes flush it to an edge/center.
        let cx = |col: f64| col * canvas_w / 6.0 - minx - bw / 2.0;
        let cy = |row: f64| row * canvas_h / 6.0 - miny - bh / 2.0;
        let (dx, dy) = match mode {
            // Legacy single-axis edge aligns (kept for compatibility).
            "left" => (-minx, 0.0),
            "centerH" => ((canvas_w - bw) / 2.0 - minx, 0.0),
            "right" => (canvas_w - maxx, 0.0),
            "top" => (0.0, -miny),
            "middleV" => (0.0, (canvas_h - bh) / 2.0 - miny),
            "bottom" => (0.0, canvas_h - maxy),
            // Nine-grid cell placement: center the object in cell (col, row).
            "top-left" => (cx(1.0), cy(1.0)),
            "top-center" => (cx(3.0), cy(1.0)),
            "top-right" => (cx(5.0), cy(1.0)),
            "middle-left" => (cx(1.0), cy(3.0)),
            "center" => (cx(3.0), cy(3.0)),
            "middle-right" => (cx(5.0), cy(3.0)),
            "bottom-left" => (cx(1.0), cy(5.0)),
            "bottom-center" => (cx(3.0), cy(5.0)),
            "bottom-right" => (cx(5.0), cy(5.0)),
            _ => return false,
        };
        if dx.abs() < 0.5 && dy.abs() < 0.5 {
            return true; // already placed — no history churn
        }
        self.snap("Place");
        if is_text {
            if let Some(t) = self.layers[self.active]
                .text_annotations
                .iter_mut()
                .find(|t| t.id == id)
            {
                t.x += dx.round() as i32;
                t.y += dy.round() as i32;
            }
        } else if let Some(s) = self.layers[self.active]
            .shape_annotations
            .iter_mut()
            .find(|s| s.id == id)
        {
            s.x0 += dx;
            s.y0 += dy;
            s.x1 += dx;
            s.y1 += dy;
            for p in s.points.iter_mut() {
                p.0 += dx;
                p.1 += dy;
            }
        }
        true
    }

    /// Remove a shape annotation. Pushes a "Delete Shape" snapshot so undo
    /// restores it. Returns true if found.
    pub fn remove_shape_annotation(&mut self, id: u32) -> bool {
        if !self.layers[self.active]
            .shape_annotations
            .iter()
            .any(|s| s.id == id)
        {
            return false;
        }
        self.snap("Delete Shape");
        self.layers[self.active]
            .shape_annotations
            .retain(|s| s.id != id);
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
}
#[wasm_bindgen]
impl ImageHorseTool {
    // ── Live text annotations (non-destructive overlay) ─────────────────
    // Annotations live as Rust state, get composited onto the buffer for
    // display via `render_with_annotations`, and are burnt into pixels
    // (one history snapshot) by `flatten_text_annotations` before export.

    /// Number of live (uncommitted) text annotations. Cheap getter so JS
    /// can decide whether to do the overlay-aware flush.
    pub fn text_annotation_count(&self) -> usize {
        self.layers[self.active].text_annotations.len()
    }

    /// Where the visible ink of `text`'s FIRST line begins inside the
    /// annotation tile, as `[dx, dy]` from the tile origin — i.e. from the
    /// annotation's stored (x, y) when `background_kind == 0` (whose tile is
    /// exactly the `render_text` output at offset 0,0).
    ///
    /// The typing overlay uses this to map between "where the user sees the
    /// glyphs" and the engine anchor, so a committed annotation lands
    /// pixel-where-typed instead of `0.25·font_size + ascent-inset` below-
    /// right (the mismatch grows with font size). First line only: it owns
    /// the visual anchor the overlay shows.
    pub fn text_ink_offset(&self, text: &str, font_size: f32, bold: bool) -> Vec<i32> {
        let pad = (font_size * 0.25).ceil() as i32;
        let first = text.lines().next().unwrap_or("");
        if first.trim().is_empty() {
            return vec![pad, pad];
        }
        let rendered = crate::text::render_text(first, font_size, 255, 255, 255, bold);
        match crate::utils::ink_bounds(&rendered.pixels, rendered.width, rendered.height) {
            Some((min_x, min_y, _, _)) => vec![min_x as i32, min_y as i32],
            None => vec![pad, pad],
        }
    }

    /// Add a new text annotation. Pre-renders the rotated tile, stores it,
    /// returns the new annotation's id. Pushes an "Add Text" history snapshot
    /// so undo restores the state with this annotation absent.
    pub fn add_text_annotation(
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
    ) -> u32 {
        self.snap("Add Text");
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
            false,
            false,
            0,
            0,
            0,
            0,
            0,
            0,
            0, // shadow off; set via set_text_shadow
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
    ) -> bool {
        let Some(idx) = self.layers[self.active]
            .text_annotations
            .iter()
            .position(|a| a.id == id)
        else {
            return false;
        };
        self.snap("Edit Text");
        // Preserve the existing drop shadow across a text/background edit.
        let sh = {
            let a = &self.layers[self.active].text_annotations[idx];
            (
                a.shadow_box,
                a.shadow_text,
                a.shadow_r,
                a.shadow_g,
                a.shadow_b,
                a.shadow_a,
                a.shadow_dx,
                a.shadow_dy,
                a.shadow_blur,
            )
        };
        let (tile_pixels, tile_w, tile_h, tile_offset_x, tile_offset_y) = build_annotation_tile(
            text,
            font_size,
            r,
            g,
            b,
            bold,
            rotation_deg,
            background_kind,
            bg_r,
            bg_g,
            bg_b,
            bg_a,
            bg_padding,
            bg_corner_radius,
            bg_tail,
            sh.0,
            sh.1,
            sh.2,
            sh.3,
            sh.4,
            sh.5,
            sh.6,
            sh.7,
            sh.8,
        );
        let a = &mut self.layers[self.active].text_annotations[idx];
        a.text = text.to_string();
        a.font_size = font_size;
        a.r = r;
        a.g = g;
        a.b = b;
        a.bold = bold;
        a.x = x;
        a.y = y;
        a.rotation_deg = rotation_deg;
        a.tile_pixels = std::sync::Arc::new(tile_pixels);
        a.tile_w = tile_w;
        a.tile_h = tile_h;
        a.tile_offset_x = tile_offset_x;
        a.tile_offset_y = tile_offset_y;
        a.background_kind = background_kind;
        a.bg_r = bg_r;
        a.bg_g = bg_g;
        a.bg_b = bg_b;
        a.bg_a = bg_a;
        a.bg_padding = bg_padding;
        a.bg_corner_radius = bg_corner_radius;
        a.bg_tail = bg_tail;
        true
    }

    /// Set (or clear) the soft drop shadow on a text annotation and rebuild its
    /// tile. `on_box` / `on_text` choose which silhouette casts the shadow;
    /// colour / offset / blur are shared. Both toggles false (or `alpha` 0)
    /// clears it. Pushes a "Text Shadow" snapshot. Returns true if found.
    #[allow(clippy::too_many_arguments)]
    pub fn set_text_shadow(
        &mut self,
        id: u32,
        on_box: bool,
        on_text: bool,
        color_hex: &str,
        alpha: u8,
        dx: i32,
        dy: i32,
        blur: u32,
    ) -> bool {
        let Some(idx) = self.layers[self.active]
            .text_annotations
            .iter()
            .position(|a| a.id == id)
        else {
            return false;
        };
        let c = drawing::parse_hex_color(color_hex);
        // No-op (and no history snapshot) when unchanged — lets commitText call
        // this on every text commit cheaply.
        {
            let a = &self.layers[self.active].text_annotations[idx];
            if a.shadow_box == on_box
                && a.shadow_text == on_text
                && a.shadow_r == c[0]
                && a.shadow_g == c[1]
                && a.shadow_b == c[2]
                && a.shadow_a == alpha
                && a.shadow_dx == dx
                && a.shadow_dy == dy
                && a.shadow_blur == blur
            {
                return true;
            }
        }
        self.snap("Text Shadow");
        // Rebuild the tile with the new shadow, reusing the annotation's current
        // text / background config.
        let (text, fs, r, g, b, bold, rot, bk, br, bgc, bb, ba, bpad, brad, btail) = {
            let a = &self.layers[self.active].text_annotations[idx];
            (
                a.text.clone(),
                a.font_size,
                a.r,
                a.g,
                a.b,
                a.bold,
                a.rotation_deg,
                a.background_kind,
                a.bg_r,
                a.bg_g,
                a.bg_b,
                a.bg_a,
                a.bg_padding,
                a.bg_corner_radius,
                a.bg_tail,
            )
        };
        let (tile_pixels, tile_w, tile_h, tile_offset_x, tile_offset_y) = build_annotation_tile(
            &text, fs, r, g, b, bold, rot, bk, br, bgc, bb, ba, bpad, brad, btail, on_box, on_text,
            c[0], c[1], c[2], alpha, dx, dy, blur,
        );
        let a = &mut self.layers[self.active].text_annotations[idx];
        a.shadow_box = on_box;
        a.shadow_text = on_text;
        a.shadow_r = c[0];
        a.shadow_g = c[1];
        a.shadow_b = c[2];
        a.shadow_a = alpha;
        a.shadow_dx = dx;
        a.shadow_dy = dy;
        a.shadow_blur = blur;
        a.tile_pixels = std::sync::Arc::new(tile_pixels);
        a.tile_w = tile_w;
        a.tile_h = tile_h;
        a.tile_offset_x = tile_offset_x;
        a.tile_offset_y = tile_offset_y;
        true
    }

    /// Remove an annotation. Returns true if found. Pushes a "Delete Text"
    /// history snapshot so undo restores the removed annotation.
    pub fn remove_text_annotation(&mut self, id: u32) -> bool {
        if !self.layers[self.active]
            .text_annotations
            .iter()
            .any(|a| a.id == id)
        {
            return false;
        }
        self.snap("Delete Text");
        self.layers[self.active]
            .text_annotations
            .retain(|a| a.id != id);
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
            if x >= tx && y >= ty && x < tx + a.tile_w as i32 && y < ty + a.tile_h as i32 {
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
}
