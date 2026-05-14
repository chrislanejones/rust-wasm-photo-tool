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
//! The JS side imports `CloneStampTool` — the API surface is unchanged.

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

#[wasm_bindgen]
pub struct CloneStampTool {
    buf: ImageBuffer,
    hist: History,
    stamp: StampState,
    zoom: f64,
    // Scratch buffers reused across blur_region calls to avoid per-stroke allocation.
    blur_scratch_a: Vec<u8>,
    blur_scratch_b: Vec<u8>,
}

#[wasm_bindgen]
impl CloneStampTool {
    // ── Constructor & dimensions ─────────────────────────────────────────

    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            buf: ImageBuffer::new(width, height),
            hist: History::new(),
            stamp: StampState::new(),
            zoom: 1.0,
            blur_scratch_a: Vec::new(),
            blur_scratch_b: Vec::new(),
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
        self.stamp.begin_stroke(
            &mut self.buf.data,
            w,
            h,
            &mut self.hist.redo_stack,
            dest_x,
            dest_y,
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
        if let Some((data, w, h)) = self.hist.undo(&self.buf.data, self.buf.width, self.buf.height) {
            self.buf.data = data;
            self.buf.width = w;
            self.buf.height = h;
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some((data, w, h)) = self.hist.redo(&self.buf.data, self.buf.width, self.buf.height) {
            self.buf.data = data;
            self.buf.width = w;
            self.buf.height = h;
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
        self.hist.jump_to(target_index, &mut self.buf.data, &mut self.buf.width, &mut self.buf.height)
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

    /// Append a raw-RGBA snapshot to the undo stack (used when restoring a session).
    pub fn inject_undo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        self.hist.undo_stack.push(Snapshot {
            label: label.to_string(),
            data: data.to_vec(),
            width: w,
            height: h,
        });
    }

    /// Append a raw-RGBA snapshot to the redo stack (used when restoring a session).
    pub fn inject_redo_snapshot(&mut self, data: &[u8], w: u32, h: u32, label: &str) {
        self.hist.redo_stack.push(Snapshot {
            label: label.to_string(),
            data: data.to_vec(),
            width: w,
            height: h,
        });
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

    pub fn extract_region_png(&self, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
        // Reuse the existing copy_region which handles out-of-bounds
        // sampling by filling with transparent pixels (0,0,0,0).
        let pixels = transform::copy_region(
            &self.buf.data,
            self.buf.width as i32,
            self.buf.height as i32,
            x, y, w, h,
        );
        // Build a throwaway ImageBuffer at the region's dimensions and
        // pipe it through the existing PNG encoder. Does NOT push a
        // history snapshot or modify self.buf — this is a pure read.
        let tmp = crate::core::ImageBuffer {
            width: w,
            height: h,
            data: pixels,
        };
        codec::export_png(&tmp)
    }

    // ── Transforms ──────────────────────────────────────────────────────

    pub fn flip_horizontal(&mut self) {
        self.hist.push_snapshot("Flip H", &self.buf.data, self.buf.width, self.buf.height);
        let w = self.buf.width as usize;
        let h = self.buf.height as usize;
        transform::flip_horizontal(&mut self.buf.data, w, h);
        if let Some(sx) = self.stamp.source_x {
            self.stamp.source_x = Some(self.buf.width as i32 - 1 - sx);
        }
    }

    pub fn flip_vertical(&mut self) {
        self.hist.push_snapshot("Flip V", &self.buf.data, self.buf.width, self.buf.height);
        let w = self.buf.width as usize;
        let h = self.buf.height as usize;
        transform::flip_vertical(&mut self.buf.data, w, h);
        if let Some(sy) = self.stamp.source_y {
            self.stamp.source_y = Some(self.buf.height as i32 - 1 - sy);
        }
    }

    pub fn rotate_90_cw(&mut self) {
        self.hist.push_snapshot("Rotate 90° CW", &self.buf.data, self.buf.width, self.buf.height);
        let (new_data, new_w, new_h) =
            transform::rotate_90_cw(&self.buf.data, self.buf.width as usize, self.buf.height as usize);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn rotate_90_ccw(&mut self) {
        self.hist.push_snapshot("Rotate 90° CCW", &self.buf.data, self.buf.width, self.buf.height);
        let (new_data, new_w, new_h) =
            transform::rotate_90_ccw(&self.buf.data, self.buf.width as usize, self.buf.height as usize);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.hist.push_snapshot("Crop", &self.buf.data, self.buf.width, self.buf.height);
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
        self.hist.push_snapshot("Crop Preview", &self.buf.data, self.buf.width, self.buf.height);
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
        if let Some((data, bw, bh)) = self.hist.undo(&self.buf.data, self.buf.width, self.buf.height) {
            self.buf.data = data;
            self.buf.width = bw;
            self.buf.height = bh;
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
        self.hist.push_snapshot("Paste", &self.buf.data, self.buf.width, self.buf.height);
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
        if new_w == 0 || new_h == 0 {
            return;
        }
        self.hist.push_snapshot("Resize", &self.buf.data, self.buf.width, self.buf.height);
        let resized = transform::resize_bilinear(
            &self.buf.data,
            self.buf.width,
            self.buf.height,
            new_w,
            new_h,
        );
        self.buf.data = resized;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    // ── Filters ─────────────────────────────────────────────────────────

    pub fn adjust_brightness(&mut self, delta: f64) {
        self.hist.push_snapshot("Brightness", &self.buf.data, self.buf.width, self.buf.height);
        filters::adjust_brightness(&mut self.buf.data, delta);
    }

    pub fn adjust_contrast(&mut self, factor: f64) {
        self.hist.push_snapshot("Contrast", &self.buf.data, self.buf.width, self.buf.height);
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
        );
    }
 
    /// Begin a blur stroke — saves undo snapshot once
    pub fn begin_blur_stroke(&mut self) {
        self.hist.push_snapshot("Blur", &self.buf.data, self.buf.width, self.buf.height);
    }
 
    // Note: No end_blur_stroke needed — the snapshot is already saved.
    // Just call blur_region() repeatedly during the stroke, then
    // the next begin_blur_stroke() or other action creates a new snapshot.
     // ── Drawing: Arrows ─────────────────────────────────────────
    /// Save undo snapshot before drawing an arrow/shape.
    /// Call once on mousedown, then draw_arrow/draw_shape on mouseup.
    pub fn begin_draw_stroke(&mut self, label: &str) {
        self.hist.push_snapshot(label, &self.buf.data, self.buf.width, self.buf.height);
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
        self.hist.push_snapshot("Emoji", &self.buf.data, self.buf.width, self.buf.height);
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
        self.hist.push_snapshot("Red Stamp", &self.buf.data, self.buf.width, self.buf.height);
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
        self.hist.push_snapshot("Text", &self.buf.data, self.buf.width, self.buf.height);

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
        self.hist.push_snapshot("Red Stamp", &self.buf.data, self.buf.width, self.buf.height);
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
        self.hist.push_snapshot("Paint", &self.buf.data, self.buf.width, self.buf.height);
    }

    pub fn paint_dab(
        &mut self,
        cx: f64, cy: f64, radius: f64,
        r: u8, g: u8, b: u8, opacity: f64,
    ) {
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        let data = &mut self.buf.data;
        let brush_alpha = opacity.clamp(0.0, 1.0);
        let r_sq = radius * radius;
        let min_x = ((cx - radius).floor() as i32).max(0);
        let max_x = ((cx + radius).ceil() as i32).min(w - 1);
        let min_y = ((cy - radius).floor() as i32).max(0);
        let max_y = ((cy + radius).ceil() as i32).min(h - 1);

        for py in min_y..=max_y {
            for px in min_x..=max_x {
                let dx = px as f64 - cx;
                let dy = py as f64 - cy;
                let dist_sq = dx * dx + dy * dy;
                if dist_sq > r_sq { continue; }
                let edge = if radius > 1.0 {
                    let norm = dist_sq.sqrt() / radius;
                    if norm < 0.7 { 1.0 } else {
                        let t = (norm - 0.7) / 0.3;
                        (1.0 - t * t).max(0.0)
                    }
                } else { 1.0 };
                let sa = brush_alpha * edge;
                let idx = ((py * w + px) * 4) as usize;
                if idx + 3 >= data.len() { continue; }
                // Porter-Duff source-over
                let da = data[idx + 3] as f64 / 255.0;
                let out_a = sa + da * (1.0 - sa);
                data[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
                if out_a > 1e-6 {
                    for c in 0..3usize {
                        let sv = [r, g, b][c] as f64 / 255.0;
                        let dv = data[idx + c] as f64 / 255.0;
                        let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
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
}