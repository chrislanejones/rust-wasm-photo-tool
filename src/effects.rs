//! Effects brush: Gaussian blur, pixelate, and redaction strokes. Split out of
//! `lib.rs`; behaviour is unchanged.

use crate::ImageHorseTool;
use crate::{filters, parse_hex};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl ImageHorseTool {
    // ── Gaussian Blur (WASM) ──────────────────────────────────────
    // Call from JS:  tool.blur_region(cx, cy, brush_radius, intensity)
    // brush_radius = half the brush-size slider value
    // intensity    = the blur-intensity slider value (1..20)
    pub fn blur_region(&mut self, cx: f64, cy: f64, brush_radius: f64, intensity: u32) {
        let clamped = intensity.clamp(1, 30);
        // Cache the Gaussian kernel keyed on intensity — a single blur stroke
        // hits this many times per second with the same intensity.
        let needs_rebuild = match &self.blur_kernel_cache {
            Some((cached_i, _)) => *cached_i != clamped,
            None => true,
        };
        if needs_rebuild {
            self.blur_kernel_cache = Some((clamped, filters::build_gaussian_kernel(clamped)));
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

    // ── High-level effects-brush driver (blur / pixelate / redaction) ──────
    // Mirrors the paint driver: JS forwards pointer coords; the mode branch, the
    // hex parse (redaction), and per-stroke interpolation all live here.
    // `effect_move` steps dabs along the segment so a fast drag no longer leaves
    // gaps (the old per-mouse-event JS driver only stamped at sampled points).

    pub fn effect_down(
        &mut self,
        x: f64,
        y: f64,
        size: f64,
        mode: &str,
        intensity: u32,
        pixel_size: u32,
        color: &str,
    ) {
        self.effect_mode = match mode {
            "pixelate" => 1,
            "solid" => 2,
            _ => 0,
        };
        self.effect_radius = (size * 0.5).max(0.0);
        self.effect_intensity = intensity;
        self.effect_pixel = pixel_size;
        let [r, g, b, _] = parse_hex(color.trim_start_matches('#')).unwrap_or([0, 0, 0, 255]);
        self.effect_color = (r, g, b);
        match self.effect_mode {
            1 => self.begin_pixelate_stroke(),
            2 => self.begin_redact_stroke(),
            _ => self.begin_blur_stroke(),
        }
        self.effect_last = Some((x, y));
        self.apply_effect_dab(x, y);
    }

    /// Stamp one effect dab at (x, y) using the current mode + params.
    fn apply_effect_dab(&mut self, x: f64, y: f64) {
        let r = self.effect_radius;
        match self.effect_mode {
            1 => self.pixelate_region(x, y, r, self.effect_pixel),
            2 => {
                let (cr, cg, cb) = self.effect_color;
                self.redact_region(x, y, r, cr, cg, cb);
            }
            _ => self.blur_region(x, y, r, self.effect_intensity),
        }
    }

    /// Continue the effects stroke to (x, y), interpolating dabs along the
    /// segment (~half-radius steps) so fast drags don't leave gaps. Returns true
    /// if it painted (so the caller knows to re-flush).
    pub fn effect_move(&mut self, x: f64, y: f64) -> bool {
        let (lx, ly) = match self.effect_last {
            Some(p) => p,
            None => return false,
        };
        let dx = x - lx;
        let dy = y - ly;
        let dist = (dx * dx + dy * dy).sqrt();
        let step = (self.effect_radius * 0.5).max(1.0);
        let steps = (dist / step).ceil() as u32;
        // Start at 1 — (lx, ly) was already stamped on the previous call.
        for i in 1..=steps {
            let t = i as f64 / steps as f64;
            self.apply_effect_dab(lx + dx * t, ly + dy * t);
        }
        self.effect_last = Some((x, y));
        true
    }

    /// End the effects stroke (the undo snapshot was taken on effect_down).
    pub fn effect_up(&mut self) {
        self.effect_last = None;
    }

    // Note: No end_blur_stroke needed — the snapshot is already saved.
    // Just call blur_region() repeatedly during the stroke, then
    // the next begin_blur_stroke() or other action creates a new snapshot.
}
