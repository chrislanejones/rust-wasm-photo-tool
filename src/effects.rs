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

    /// Blur the WHOLE image in one call — history snapshot included.
    ///
    /// ADR-024 Stage 2. `useTransforms.applyGlobalBlur` used to build this out
    /// of four crossings:
    ///
    /// ```text
    /// const cx = t.width() / 2;                 // read
    /// const cy = t.height() / 2;                // read
    /// const r  = Math.max(t.width(), t.height());
    /// t.begin_blur_stroke();                    // write
    /// t.blur_region(cx, cy, r, kernelRadius);   // write, using the reads
    /// ```
    ///
    /// That is a read-modify-write: the geometry is measured on the JS side
    /// and handed back. Synchronously nothing can change in between; once the
    /// reads resolve on a later task, a resize landing in the gap blurs the new
    /// image around the old image's centre. Computing the geometry where the
    /// dimensions live removes the gap rather than narrowing it — and is the
    /// project's standing rule anyway: the engine owns pixels.
    ///
    /// `intensity` is the same clamped 1..=30 kernel radius `blur_region`
    /// takes, so the visual result is identical to the sequence above.
    pub fn blur_whole_image(&mut self, intensity: u32) {
        self.snap("Blur");
        let (w, h) = (self.width as f64, self.height as f64);
        // Radius covers the far corner from the centre, matching the previous
        // `max(width, height)` — which already over-covered, and still does.
        // `blur_region` does not snap — the snapshot is `begin_blur_stroke`'s
        // job, done above — so this is exactly the old two-call sequence with
        // the geometry computed on this side of the boundary.
        self.blur_region(w / 2.0, h / 2.0, w.max(h), intensity);
    }

    // ── GPU blur hand-off (ADR-030) ──────────────────────────────────────
    //
    // The GPU path lives in JS (`app/src/lib/webgpu/gpuBlur.ts`) because `wgpu`
    // does not fit in the wasm size band — ADR-030 has the arithmetic. So the
    // pixels have to leave the engine and come back, and these two methods are
    // that door. They are deliberately a PAIR, deliberately named for the one
    // operation they serve, and deliberately not a general pixel setter.
    //
    // ⚠️ WHY NOT `get_image_data()` FOR THE READ. That returns the COMPOSITE —
    // artboard underneath, annotations rendered over. `blur_region` writes the
    // ACTIVE LAYER's raw buffer. Blurring the composite and storing it as the
    // layer would bake the canvas colour and every annotation into the photo,
    // which looks right on screen exactly until you hide a layer.
    //
    // ⚠️ WHY NOT `get_layer_png()`. It is the only existing layer read, and a
    // PNG encode plus decode on a 4 MB buffer costs more than the whole GPU
    // win it would be paying for.

    /// The engine's Gaussian kernel for `radius` — the same values
    /// `blur_region` convolves with.
    ///
    /// ⚠️ A METHOD AS WELL AS THE FREE `gaussian_kernel`, and the duplication is
    /// deliberate rather than sloppy. The free function is what the harnesses
    /// use: they `import("stamp_tool")` directly and already initialise it. The
    /// PRODUCTION caller cannot — under ADR-024's worker the engine lives on
    /// another thread, and the only handle the main thread holds is this tool's
    /// proxy. Reaching the free function from there would mean initialising a
    /// SECOND wasm instance on the main thread, ~800 KB of linear memory, to
    /// compute 61 floats.
    ///
    /// One implementation, two doors. Both delegate to
    /// `filters::build_gaussian_kernel`, so they cannot disagree.
    pub fn gaussian_kernel(&self, radius: u32) -> Vec<f32> {
        crate::filters::build_gaussian_kernel(radius.clamp(1, 30))
    }

    /// The ACTIVE layer's raw RGBA, for a pure-function pass that will hand the
    /// result straight back to [`Self::apply_blurred_layer_rgba`].
    pub fn active_layer_rgba(&self) -> Vec<u8> {
        self.layers[self.active].buf.data.clone()
    }

    /// Write `pixels` back into the ACTIVE layer as the result of a blur, with
    /// the same single history snapshot `blur_whole_image` takes.
    ///
    /// Returns `false` and writes NOTHING if the length does not match the
    /// current layer — a resize landing between the read and the write is the
    /// realistic way that happens, and the caller's answer is to fall back to
    /// the CPU path rather than to paint a mis-sized buffer.
    ///
    /// ⚠️ The snapshot is taken only AFTER the length check passes. Snapping
    /// first would leave a stray "Blur" entry in undo for an operation that
    /// never happened — the one-op-one-snapshot lockstep that #60/#61 broke.
    ///
    /// ⚠️ This does NOT record an op, exactly like `blur_whole_image`. See
    /// ADR-052: whole-image blur has never been in the log, the coverage check
    /// (`undo_count > cursor`) notices, and resume falls to the archive, whose
    /// baked pixels already carry the blur. The GPU changes nothing about that.
    pub fn apply_blurred_layer_rgba(&mut self, pixels: &[u8]) -> bool {
        if pixels.len() != self.layers[self.active].buf.data.len() {
            return false;
        }
        self.snap("Blur");
        self.layers[self.active].buf.data.copy_from_slice(pixels);
        true
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
        stab: &str,
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
        // Op-log recorder: collect the exact dab centres (apply_effect_dab
        // pushes each one, interpolated moves included). Only blur (mode 0)
        // becomes an op at effect_up — pixelate/redact are unrecorded and
        // the undo-time sync check handles them.
        #[cfg(feature = "tiles")]
        {
            self.rec_effect = Some((
                Vec::new(),
                self.effect_radius,
                self.effect_intensity,
                self.effect_mode,
            ));
        }
        self.effect_last = Some((x, y));
        // The first dab lands at the press point either way, matching paint,
        // which dabs at the down point before anchoring its tip.
        self.effect_stab = crate::stabilizer::Stabilizer::for_level(stab);
        if self.effect_stab.is_on() {
            self.effect_stab.begin(x, y);
        }
        self.apply_effect_dab(x, y);
    }

    /// Stamp one effect dab at (x, y) using the current mode + params.
    fn apply_effect_dab(&mut self, x: f64, y: f64) {
        #[cfg(feature = "tiles")]
        if let Some((pts, ..)) = self.rec_effect.as_mut() {
            pts.push((x, y));
        }
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
        let Some((prev_x, prev_y)) = self.effect_last else {
            return false;
        };
        // `effect_last` is ALWAYS the raw cursor, never the stabilized tip.
        // effect_up flushes the leash against it, and a tip stored here would
        // make that flush a no-op — the last leash-length of every stabilized
        // stroke would simply not be drawn.
        self.effect_last = Some((x, y));

        // Stabilized: the leash decides both whether to stamp and from where.
        // A cursor still inside the leash returns false, which the shared
        // stroke coalescer reads as "nothing changed" and skips the flush, so
        // a leashed move costs zero recomposites.
        let ((lx, ly), (tx, ty)) = if self.effect_stab.is_on() {
            match self.effect_stab.advance(x, y) {
                Some(seg) => seg,
                None => return false,
            }
        } else {
            ((prev_x, prev_y), (x, y))
        };
        self.stamp_effect_segment(lx, ly, tx, ty);
        true
    }

    /// Stamp dabs along a segment at ~half-radius steps so a fast drag leaves
    /// no gaps. Starts at step 1: the `from` end was stamped by whatever
    /// produced it (the press, or the previous move).
    fn stamp_effect_segment(&mut self, lx: f64, ly: f64, tx: f64, ty: f64) {
        let dx = tx - lx;
        let dy = ty - ly;
        let dist = (dx * dx + dy * dy).sqrt();
        let step = (self.effect_radius * 0.5).max(1.0);
        let steps = (dist / step).ceil() as u32;
        for i in 1..=steps {
            let t = i as f64 / steps as f64;
            self.apply_effect_dab(lx + dx * t, ly + dy * t);
        }
    }

    /// End the effects stroke (the undo snapshot was taken on effect_down).
    pub fn effect_up(&mut self) {
        // Catch up to where the pointer actually was before closing the op —
        // the recorder reads `rec_effect` below, so the flush has to stamp
        // FIRST or the last leash-length of the stroke is missing from both
        // the canvas and the op log.
        if let Some((raw_x, raw_y)) = self.effect_last {
            if self.effect_stab.is_on() {
                if let Some(((lx, ly), (tx, ty))) = self.effect_stab.flush(raw_x, raw_y) {
                    self.stamp_effect_segment(lx, ly, tx, ty);
                }
            }
        }
        #[cfg(feature = "tiles")]
        if let Some((pts, radius, intensity, mode)) = self.rec_effect.take() {
            if mode == 0 && !pts.is_empty() {
                self.oplog_record(crate::ops::Op::Blur {
                    points: pts,
                    radius,
                    intensity,
                });
            }
        }
        self.effect_last = None;
        self.effect_stab = crate::stabilizer::Stabilizer::default();
    }

    // Note: No end_blur_stroke needed — the snapshot is already saved.
    // Just call blur_region() repeatedly during the stroke, then
    // the next begin_blur_stroke() or other action creates a new snapshot.
}

#[cfg(test)]
mod gpu_handoff_tests {
    use crate::ImageHorseTool;

    fn solid(w: u32, h: u32, v: [u8; 4]) -> Vec<u8> {
        let mut out = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            out.extend_from_slice(&v);
        }
        out
    }

    fn tool() -> ImageHorseTool {
        let mut t = ImageHorseTool::new(8, 8);
        t.load_image(&solid(8, 8, [10, 20, 30, 255]));
        t
    }

    /// The happy path: what comes out is what a GPU pass would chew on, and
    /// what goes back in lands on the ACTIVE LAYER.
    #[test]
    fn round_trip_writes_the_returned_pixels_into_the_active_layer() {
        let mut t = tool();
        let mut px = t.active_layer_rgba();
        assert_eq!(
            px.len(),
            8 * 8 * 4,
            "the read must be the raw layer, not a PNG"
        );
        for chunk in px.chunks_mut(4) {
            chunk[0] = 200;
        }
        assert!(t.apply_blurred_layer_rgba(&px));
        assert_eq!(t.active_layer_rgba()[0], 200);
    }

    /// A resize landing between the read and the write is the realistic way a
    /// length mismatch happens. The engine must refuse rather than paint a
    /// mis-sized buffer, and the caller falls back to the CPU path.
    #[test]
    fn a_length_mismatch_is_refused_and_writes_nothing() {
        let mut t = tool();
        let before = t.active_layer_rgba();
        assert!(
            !t.apply_blurred_layer_rgba(&[0u8; 16]),
            "short buffer must be refused"
        );
        assert!(
            !t.apply_blurred_layer_rgba(&vec![0u8; 8 * 8 * 4 + 4]),
            "long buffer must be refused"
        );
        assert_eq!(t.active_layer_rgba(), before, "a refused write still wrote");
    }

    /// ⚠️ THE SUBTLE ONE. Snapping before the length check would leave a stray
    /// "Blur" entry in undo for an operation that never happened — the
    /// one-op-one-snapshot lockstep that #60/#61 broke, in a new place.
    #[test]
    fn a_refused_write_takes_no_history_snapshot() {
        let mut t = tool();
        let before = t.undo_count();
        assert!(!t.apply_blurred_layer_rgba(&[0u8; 16]));
        assert_eq!(t.undo_count(), before, "a refused write still snapped");
    }

    /// And the accepted one takes exactly one, matching `blur_whole_image`.
    #[test]
    fn an_accepted_write_takes_exactly_one_snapshot() {
        let mut t = tool();
        let px = t.active_layer_rgba();
        let before = t.undo_count();
        assert!(t.apply_blurred_layer_rgba(&px));
        assert_eq!(t.undo_count(), before + 1);
    }
}
