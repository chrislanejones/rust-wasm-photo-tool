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

use crate::core::ImageBuffer;
use crate::history::History;
use crate::stamp::StampState;

const MAX_HISTORY: usize = 50;

#[wasm_bindgen]
pub struct CloneStampTool {
    buf: ImageBuffer,
    hist: History,
    stamp: StampState,
    zoom: f64,
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
            .end_stroke(&mut self.hist.undo_stack, MAX_HISTORY);
    }

    // ── History ─────────────────────────────────────────────────────────

    pub fn undo(&mut self) -> bool {
        if let Some(restored) = self.hist.undo(&self.buf.data) {
            self.buf.data = restored;
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(restored) = self.hist.redo(&self.buf.data) {
            self.buf.data = restored;
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
        self.hist.jump_to(target_index, &mut self.buf.data)
    }

    pub fn delete_history_entry(&mut self, index: usize) -> bool {
        if let Some(restored) = self.hist.delete_entry(index) {
            self.buf.data = restored;
            true
        } else {
            false
        }
    }

    pub fn clear_history(&mut self) {
        self.hist.clear();
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
        self.hist.push_snapshot("Flip H", &self.buf.data);
        let w = self.buf.width as usize;
        let h = self.buf.height as usize;
        transform::flip_horizontal(&mut self.buf.data, w, h);
        if let Some(sx) = self.stamp.source_x {
            self.stamp.source_x = Some(self.buf.width as i32 - 1 - sx);
        }
    }

    pub fn flip_vertical(&mut self) {
        self.hist.push_snapshot("Flip V", &self.buf.data);
        let w = self.buf.width as usize;
        let h = self.buf.height as usize;
        transform::flip_vertical(&mut self.buf.data, w, h);
        if let Some(sy) = self.stamp.source_y {
            self.stamp.source_y = Some(self.buf.height as i32 - 1 - sy);
        }
    }

    pub fn rotate_90_cw(&mut self) {
        self.hist.push_snapshot("Rotate 90° CW", &self.buf.data);
        let (new_data, new_w, new_h) =
            transform::rotate_90_cw(&self.buf.data, self.buf.width as usize, self.buf.height as usize);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn rotate_90_ccw(&mut self) {
        self.hist.push_snapshot("Rotate 90° CCW", &self.buf.data);
        let (new_data, new_w, new_h) =
            transform::rotate_90_ccw(&self.buf.data, self.buf.width as usize, self.buf.height as usize);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
    }

    pub fn crop(&mut self, x: u32, y: u32, w: u32, h: u32) {
        self.hist.push_snapshot("Crop", &self.buf.data);
        let (new_data, new_w, new_h) =
            transform::crop(&self.buf.data, self.buf.width, self.buf.height, x, y, w, h);
        self.buf.data = new_data;
        self.buf.width = new_w;
        self.buf.height = new_h;
        self.stamp.source_x = None;
        self.stamp.source_y = None;
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
        self.hist.push_snapshot("Paste", &self.buf.data);
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
        self.hist.push_snapshot("Resize", &self.buf.data);
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
        self.hist.push_snapshot("Brightness", &self.buf.data);
        filters::adjust_brightness(&mut self.buf.data, delta);
    }

    pub fn adjust_contrast(&mut self, factor: f64) {
        self.hist.push_snapshot("Contrast", &self.buf.data);
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
        );
    }
 
    /// Begin a blur stroke — saves undo snapshot once
    pub fn begin_blur_stroke(&mut self) {
        self.hist.push_snapshot("Blur", &self.buf.data);
    }
 
    // Note: No end_blur_stroke needed — the snapshot is already saved.
    // Just call blur_region() repeatedly during the stroke, then
    // the next begin_blur_stroke() or other action creates a new snapshot.
     // ── Drawing: Arrows ─────────────────────────────────────────
    /// Save undo snapshot before drawing an arrow/shape.
    /// Call once on mousedown, then draw_arrow/draw_shape on mouseup.
    pub fn begin_draw_stroke(&mut self, label: &str) {
        self.hist.push_snapshot(label, &self.buf.data);
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
        self.hist.push_snapshot("Emoji", &self.buf.data);
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
     // ── Paint / Brush Tool ──────────────────────────────────────
    // Freehand painting with configurable color, size, opacity.
    // Uses the same dab-based approach as clone stamp but fills
    // with a solid color instead of sampling from a source.
 
    /// Begin a paint stroke — saves undo snapshot
    pub fn paint_begin(&mut self) {
        self.hist.push_snapshot("Paint", &self.buf.data);
    }
 
    /// Paint a single dab at (cx, cy) with given color, size, opacity.
    /// color is [r, g, b, a] packed as u32: 0xRRGGBBAA
    pub fn paint_dab(
        &mut self,
        cx: f64,
        cy: f64,
        radius: f64,
        r: u8, g: u8, b: u8,
        opacity: f64,
    ) {
        let w = self.buf.width as i32;
        let h = self.buf.height as i32;
        let data = &mut self.buf.data;
        let alpha = opacity.clamp(0.0, 1.0);
 
        let min_x = ((cx - radius).floor() as i32).max(0);
        let max_x = ((cx + radius).ceil() as i32).min(w - 1);
        let min_y = ((cy - radius).floor() as i32).max(0);
        let max_y = ((cy + radius).ceil() as i32).min(h - 1);
 
        for py in min_y..=max_y {
            for px in min_x..=max_x {
                let dx = px as f64 - cx;
                let dy = py as f64 - cy;
                let dist = (dx * dx + dy * dy).sqrt();
                if dist > radius { continue; }
 
                // Soft edge falloff
                let edge = if radius > 1.0 {
                    let norm = dist / radius;
                    if norm < 0.7 { 1.0 } else {
                        let t = (norm - 0.7) / 0.3;
                        (1.0 - t * t).max(0.0)
                    }
                } else {
                    1.0
                };
 
                let a = alpha * edge;
                let idx = ((py * w + px) * 4) as usize;
                if idx + 3 >= data.len() { continue; }
 
                // Alpha blend
                for c in 0..3usize {
                    let src = [r, g, b][c] as f64;
                    let dst = data[idx + c] as f64;
                    data[idx + c] = (dst + (src - dst) * a).round().clamp(0.0, 255.0) as u8;
                }
                // Keep dest alpha at max
                let da = data[idx + 3] as f64 / 255.0;
                let out_a = a + da * (1.0 - a);
                data[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
            }
        }
    }
 
    /// Paint a line of dabs from (x0,y0) to (x1,y1) with spacing.
    /// Call this on mousemove for smooth strokes.
    pub fn paint_stroke_to(
        &mut self,
        x0: f64, y0: f64,
        x1: f64, y1: f64,
        radius: f64,
        r: u8, g: u8, b: u8,
        opacity: f64,
    ) {
        let dx = x1 - x0;
        let dy = y1 - y0;
        let dist = (dx * dx + dy * dy).sqrt();
        let step = (radius * 0.25).max(1.0);
        let steps = (dist / step).ceil() as u32;
 
        for i in 0..=steps {
            let t = if steps == 0 { 1.0 } else { i as f64 / steps as f64 };
            let cx = x0 + dx * t;
            let cy = y0 + dy * t;
            self.paint_dab(cx, cy, radius, r, g, b, opacity);
        }
    }
 
 
}