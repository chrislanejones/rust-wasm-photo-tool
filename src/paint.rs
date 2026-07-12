//! Paint / brush engine: the paint, eraser, mask-paint and stabiliser-stab
//! state machine. Split out of `lib.rs`; behaviour is unchanged.

use crate::parse_hex;
use crate::ImageHorseTool;
use wasm_bindgen::prelude::*;

// ── Pure stroke kernels ─────────────────────────────────────────────────────
// The dab-coverage accumulator and the coverage→pixels compositor, extracted
// from the `ImageHorseTool` methods below so they are callable without the
// tool's stroke state. The live brush delegates to these; op-log replay
// (`ops::apply`, `tiles` feature) calls the SAME functions — one
// implementation, so replay parity can never drift from what the brush
// actually painted. Bodies are verbatim from the former methods.

/// Stamp one dab's soft-edged profile into `cov` (max-combine, never additive
/// — this is what kills per-dab alpha build-up). `cov` is a `w*h` coverage
/// plane. Returns the touched bbox, or None if the dab fell outside the
/// canvas or the radius is degenerate.
pub(crate) fn dab_coverage(
    cov: &mut [u8],
    w: i32,
    h: i32,
    cx: f64,
    cy: f64,
    radius: f64,
    hardness: f32,
) -> Option<(i32, i32, i32, i32)> {
    let r_f32 = radius as f32;
    if r_f32 <= 0.0 {
        return None;
    }
    let r_sq = r_f32 * r_f32;
    let min_x = ((cx - radius).floor() as i32).max(0);
    let max_x = ((cx + radius).ceil() as i32).min(w - 1);
    let min_y = ((cy - radius).floor() as i32).max(0);
    let max_y = ((cy + radius).ceil() as i32).min(h - 1);
    if min_x > max_x || min_y > max_y {
        return None;
    }

    // Hoisted invariants: the hardened-zone radius² (full coverage, no
    // sqrt/falloff inside) and the falloff-band width. `hard_frac` is the
    // brush hardness: 1.0 → crisp edge (hard zone == whole radius), lower →
    // a wider smoothstep skirt.
    let hard_frac = hardness.clamp(0.0, 1.0);
    let inv_radius = 1.0_f32 / r_f32;
    let hard_r = r_f32 * hard_frac;
    let hard_r_sq = hard_r * hard_r;
    let band = (1.0 - hard_frac).max(1e-4); // normalized falloff width
    let cx_f32 = cx as f32;
    let cy_f32 = cy as f32;

    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let dx = px as f32 - cx_f32;
            let dy = py as f32 - cy_f32;
            let dist_sq = dx * dx + dy * dy;
            if dist_sq > r_sq {
                continue;
            }
            let edge = if r_f32 > 1.0 {
                if dist_sq <= hard_r_sq {
                    1.0
                } else {
                    let norm = dist_sq.sqrt() * inv_radius;
                    let t = ((norm - hard_frac) / band).clamp(0.0, 1.0);
                    (1.0 - t * t).max(0.0)
                }
            } else {
                1.0
            };
            let c = (edge * 255.0).round() as u8;
            let i = (py * w + px) as usize;
            if c > cov[i] {
                cov[i] = c; // max-combine: overlap can't exceed full coverage
            }
        }
    }
    Some((min_x, min_y, max_x, max_y))
}

/// Recomposite `base` + a stroke (brush colour at coverage×opacity) over
/// `bbox` into `data`. Porter-Duff source-over; idempotent for a given
/// coverage, so re-running over overlapping regions is safe. `erase` scrubs
/// alpha toward transparent instead of laying colour.
#[allow(clippy::too_many_arguments)]
pub(crate) fn composite_stroke_bbox(
    data: &mut [u8],
    base: &[u8],
    cov: &[u8],
    w: i32,
    min_x: i32,
    min_y: i32,
    max_x: i32,
    max_y: i32,
    color: (u8, u8, u8),
    opacity: f32,
    erase: bool,
) {
    let (cr, cg, cb) = color;
    let op = opacity.clamp(0.0, 1.0);
    let sr = cr as f32 / 255.0;
    let sg = cg as f32 / 255.0;
    let sb = cb as f32 / 255.0;
    if base.len() != data.len() {
        return;
    }

    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let i = (py * w + px) as usize;
            let idx = i * 4;
            if idx + 3 >= data.len() {
                continue;
            }
            // Stroke strength at this pixel: dab coverage × the stroke opacity.
            let sa = (cov[i] as f32 / 255.0) * op;
            let ba = base[idx + 3] as f32 / 255.0;

            if erase {
                // Eraser: scrub the base alpha down by the stroke strength
                // (sa = 1 fully clears it). RGB is carried over untouched so a
                // partial erase just fades to transparent — no colour fringe.
                // Recomputed from `base` each move, so it's idempotent over
                // overlapping coverage exactly like the paint path.
                let out_a = ba * (1.0 - sa);
                data[idx] = base[idx];
                data[idx + 1] = base[idx + 1];
                data[idx + 2] = base[idx + 2];
                data[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
                continue;
            }

            let out_a = sa + ba * (1.0 - sa);
            data[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
            if out_a > 1e-6 {
                let src = [sr, sg, sb];
                for c in 0..3usize {
                    let bv = base[idx + c] as f32 / 255.0;
                    let ov = (src[c] * sa + bv * ba * (1.0 - sa)) / out_a;
                    data[idx + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                }
            } else {
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
            }
        }
    }
}

/// Interpolated dab centres for one stroke segment, exactly as
/// `paint_stroke_to` lays them: step = max(radius/4, 1px), dabs at
/// t = 0..=steps inclusive. Shared with op-log replay so the dab placement
/// formula exists once.
pub(crate) fn segment_dab_centers(
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
    radius: f64,
) -> impl Iterator<Item = (f64, f64)> {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let dist = (dx * dx + dy * dy).sqrt();
    let step = (radius * 0.25).max(1.0);
    let steps = (dist / step).ceil() as u32;
    (0..=steps).map(move |i| {
        let t = if steps == 0 {
            1.0
        } else {
            i as f64 / steps as f64
        };
        (x0 + dx * t, y0 + dy * t)
    })
}

#[wasm_bindgen]
impl ImageHorseTool {
    // ── Paint / Brush Tool ──────────────────────────────────────

    pub fn paint_begin(&mut self, label: &str) {
        self.snap(label);
        let n = (self.width * self.height) as usize;
        self.paint_cov = vec![0u8; n];
        self.paint_base = self.layers[self.active].buf.data.clone();
        self.paint_color = (0, 0, 0);
        self.paint_opacity = 1.0;
        self.paint_erase = false;
    }

    /// Stamp one dab's soft-edged profile into the coverage buffer. Thin
    /// wrapper over the pure [`dab_coverage`] kernel (shared with op-log
    /// replay); returns None additionally when the stroke isn't primed
    /// (paint_begin not run).
    fn accumulate_dab(&mut self, cx: f64, cy: f64, radius: f64) -> Option<(i32, i32, i32, i32)> {
        let w = self.width as i32;
        let h = self.height as i32;
        let n = (self.width * self.height) as usize;
        if self.paint_cov.len() != n {
            return None;
        }
        dab_coverage(
            &mut self.paint_cov,
            w,
            h,
            cx,
            cy,
            radius,
            self.paint_hardness,
        )
    }

    /// Recomposite `paint_base` + the stroke (brush colour at coverage*opacity)
    /// over `bbox` into the active layer. Porter-Duff source-over; idempotent for
    /// a given coverage, so re-running over overlapping regions is safe.
    fn recomposite_stroke_bbox(&mut self, min_x: i32, min_y: i32, max_x: i32, max_y: i32) {
        let w = self.width as i32;
        let active = self.active;

        // Mask stroke: scrub the dab's coverage×opacity toward `paint_mask_value`
        // over the mask snapshot, writing the active layer's grayscale mask. The
        // compositor (render_layer) turns that into a live reveal/hide. Handled
        // first + returns, so the colour/erase path below stays untouched.
        if self.paint_mask {
            let op = self.paint_opacity.clamp(0.0, 1.0);
            let value = self.paint_mask_value as f32;
            let cov = &self.paint_cov;
            let base = &self.paint_mask_base;
            let Some(mask) = self.layers[active].mask.as_mut() else {
                return;
            };
            if base.len() != mask.len() {
                return;
            }
            for py in min_y..=max_y {
                for px in min_x..=max_x {
                    let i = (py * w + px) as usize;
                    if i >= mask.len() || i >= cov.len() {
                        continue;
                    }
                    let sa = (cov[i] as f32 / 255.0) * op;
                    let out = base[i] as f32 * (1.0 - sa) + value * sa;
                    mask[i] = out.round().clamp(0.0, 255.0) as u8;
                }
            }
            return;
        }

        // Colour / erase path: delegate to the pure kernel (shared with
        // op-log replay — see the module doc on `composite_stroke_bbox`).
        composite_stroke_bbox(
            &mut self.layers[active].buf.data,
            &self.paint_base,
            &self.paint_cov,
            w,
            min_x,
            min_y,
            max_x,
            max_y,
            self.paint_color,
            self.paint_opacity,
            self.paint_erase,
        );
    }

    /// Single dab (the stroke's first touch). Accumulates coverage + recomposites.
    pub fn paint_dab(&mut self, cx: f64, cy: f64, radius: f64, r: u8, g: u8, b: u8, opacity: f64) {
        self.paint_color = (r, g, b);
        self.paint_opacity = opacity.clamp(0.0, 1.0) as f32;
        if let Some((min_x, min_y, max_x, max_y)) = self.accumulate_dab(cx, cy, radius) {
            self.recomposite_stroke_bbox(min_x, min_y, max_x, max_y);
        }
    }

    pub fn paint_stroke_to(
        &mut self,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        radius: f64,
        r: u8,
        g: u8,
        b: u8,
        opacity: f64,
    ) {
        self.paint_color = (r, g, b);
        self.paint_opacity = opacity.clamp(0.0, 1.0) as f32;
        // Op-log recorder: every painted segment endpoint extends the
        // polyline (stabilized strokes arrive here as their painted
        // tip-to-tip segments, so the recording is post-stabilizer).
        #[cfg(feature = "tiles")]
        if let Some((pts, _)) = self.rec_stroke.as_mut() {
            pts.push((x1, y1));
        }
        // Accumulate every dab's coverage first, then recomposite the union bbox
        // once — correct per-stroke opacity, and far fewer recomposites per move.
        // Dab placement comes from the shared `segment_dab_centers` iterator so
        // replay lays dabs at the exact same centres.
        let mut bbox: Option<(i32, i32, i32, i32)> = None;
        for (cx, cy) in segment_dab_centers(x0, y0, x1, y1, radius) {
            if let Some(bb) = self.accumulate_dab(cx, cy, radius) {
                bbox = Some(match bbox {
                    None => bb,
                    Some(a) => (a.0.min(bb.0), a.1.min(bb.1), a.2.max(bb.2), a.3.max(bb.3)),
                });
            }
        }
        if let Some((min_x, min_y, max_x, max_y)) = bbox {
            self.recomposite_stroke_bbox(min_x, min_y, max_x, max_y);
        }
    }

    // ── High-level brush driver — the whole stroke lives in Rust ───────────
    // JS just forwards pointer coords. `paint_down` parses the hex colour, maps
    // the stabilizer level → leash, snapshots the layer, and lays the first dab;
    // `paint_move` continues the stroke (stabilized or raw); `paint_up` flushes
    // the stabilizer catch-up and frees the stroke buffers. Each returns whether
    // it painted, so the caller knows when to re-flush the canvas.

    /// Map a stabilizer level name → trailing-tip leash in px (0 = off). Shared
    /// by the paint brush and the eraser. (Private — not part of the WASM API.)
    fn leash_for(stab: &str) -> f64 {
        match stab {
            "low" => 12.0,
            "med" => 22.0,
            "high" => 36.0,
            _ => 0.0,
        }
    }

    pub fn paint_down(
        &mut self,
        x: f64,
        y: f64,
        size: f64,
        color: &str,
        opacity: f64,
        hardness: f64,
        stab: &str,
    ) {
        let [r, g, b, _] = parse_hex(color.trim_start_matches('#')).unwrap_or([0, 0, 0, 255]);
        self.paint_begin("Paint");
        self.paint_erase = false;
        self.paint_hardness = hardness.clamp(0.0, 1.0) as f32;
        let radius = (size * 0.5).max(0.0);
        self.paint_radius = radius;
        self.paint_leash = Self::leash_for(stab);
        self.paint_last = Some((x, y));
        self.paint_raw = (x, y);
        // Op-log recorder: the down point starts the painted polyline; the
        // exact params the kernels get are the op's brush.
        #[cfg(feature = "tiles")]
        {
            self.rec_stroke = Some((
                vec![(x, y)],
                crate::ops::Brush {
                    r,
                    g,
                    b,
                    radius,
                    hardness: self.paint_hardness,
                    opacity: opacity.clamp(0.0, 1.0) as f32,
                    erase: false,
                },
            ));
        }
        self.paint_dab(x, y, radius, r, g, b, opacity);
        if self.paint_leash > 0.0 {
            self.paint_stab_begin(x, y);
        }
    }

    /// Eraser driver — the mirror of `paint_down`, sharing the dab / coverage /
    /// stabilizer machinery. The stroke clears the active layer's alpha instead
    /// of laying down colour (see `recomposite_stroke_bbox`'s erase branch), so
    /// it reveals whatever is below the active layer (or transparency). There's
    /// no colour: coverage × opacity drives how hard each pixel is scrubbed.
    /// `erase_move` / `erase_up` just delegate to the paint stroke continuation
    /// (the erase semantics live entirely in the recomposite step).
    pub fn erase_down(
        &mut self,
        x: f64,
        y: f64,
        size: f64,
        opacity: f64,
        hardness: f64,
        stab: &str,
    ) {
        self.paint_begin("Erase");
        self.paint_erase = true;
        self.paint_hardness = hardness.clamp(0.0, 1.0) as f32;
        let radius = (size * 0.5).max(0.0);
        self.paint_radius = radius;
        self.paint_leash = Self::leash_for(stab);
        self.paint_last = Some((x, y));
        self.paint_raw = (x, y);
        #[cfg(feature = "tiles")]
        {
            self.rec_stroke = Some((
                vec![(x, y)],
                crate::ops::Brush {
                    r: 0,
                    g: 0,
                    b: 0,
                    radius,
                    hardness: self.paint_hardness,
                    opacity: opacity.clamp(0.0, 1.0) as f32,
                    erase: true,
                },
            ));
        }
        self.paint_dab(x, y, radius, 0, 0, 0, opacity);
        if self.paint_leash > 0.0 {
            self.paint_stab_begin(x, y);
        }
    }

    /// Continue the active eraser stroke. Returns true if it scrubbed pixels.
    pub fn erase_move(&mut self, x: f64, y: f64) -> bool {
        self.paint_move(x, y)
    }

    /// End the active eraser stroke and free its buffers. True if it scrubbed.
    pub fn erase_up(&mut self) -> bool {
        self.paint_up()
    }

    /// Mask brush driver — paints the active layer's grayscale MASK with the very
    /// same dab / coverage / stabilizer engine as the colour brush, but the
    /// recomposite writes into the mask instead of the pixels (see the
    /// `paint_mask` branch of `recomposite_stroke_bbox`). `value` is the grey
    /// laid down: 0 hides the layer there, 255 reveals it, in-between is partial.
    /// `opacity` and `hardness` are 0..1. If the active layer has no mask yet a
    /// fully-revealed one is created first (so the first stroke "just works").
    /// `mask_paint_move` / `mask_paint_up` continue / end the stroke.
    pub fn mask_paint_down(
        &mut self,
        x: f64,
        y: f64,
        size: f64,
        value: u8,
        opacity: f64,
        hardness: f64,
        stab: &str,
    ) {
        let n = (self.width * self.height) as usize;
        if n == 0 {
            return;
        }
        self.snap("Mask");
        // Ensure the active layer has a correctly-sized mask to paint into.
        if self.layers[self.active]
            .mask
            .as_ref()
            .is_none_or(|m| m.len() != n)
        {
            self.layers[self.active].mask = Some(vec![255u8; n]);
        }
        self.paint_mask_base = self.layers[self.active]
            .mask
            .clone()
            .unwrap_or_else(|| vec![255u8; n]);
        self.paint_cov = vec![0u8; n];
        self.paint_base = Vec::new();
        self.paint_mask = true;
        // Mask strokes are outside the op-log model — make sure no stale
        // stroke recording survives into this stroke.
        #[cfg(feature = "tiles")]
        {
            self.rec_stroke = None;
        }
        self.paint_erase = false;
        self.paint_mask_value = value;
        self.paint_hardness = hardness.clamp(0.0, 1.0) as f32;
        let radius = (size * 0.5).max(0.0);
        self.paint_radius = radius;
        self.paint_leash = Self::leash_for(stab);
        self.paint_last = Some((x, y));
        self.paint_raw = (x, y);
        // Colour is irrelevant when masking; paint_dab sets paint_opacity and
        // recomposites through the paint_mask branch.
        self.paint_dab(x, y, radius, 0, 0, 0, opacity);
        if self.paint_leash > 0.0 {
            self.paint_stab_begin(x, y);
        }
    }

    /// Continue the active mask stroke. True if it changed the mask.
    pub fn mask_paint_move(&mut self, x: f64, y: f64) -> bool {
        self.paint_move(x, y)
    }

    /// End the active mask stroke and free its buffers. True if it changed the mask.
    pub fn mask_paint_up(&mut self) -> bool {
        self.paint_up()
    }

    /// Continue the active stroke toward (x, y). Returns true if it painted.
    pub fn paint_move(&mut self, x: f64, y: f64) -> bool {
        self.paint_raw = (x, y);
        let (r, g, b) = self.paint_color;
        let radius = self.paint_radius;
        let leash = self.paint_leash;
        let op = self.paint_opacity as f64;
        if leash > 0.0 {
            return self.paint_stab_to(x, y, leash, radius, r, g, b, op);
        }
        if let Some((lx, ly)) = self.paint_last {
            self.paint_stroke_to(lx, ly, x, y, radius, r, g, b, op);
            self.paint_last = Some((x, y));
            return true;
        }
        false
    }

    /// End the active stroke (stabilizer catch-up to the true cursor) and free
    /// the stroke buffers. Returns true if it painted.
    pub fn paint_up(&mut self) -> bool {
        let mut painted = false;
        if self.paint_leash > 0.0 {
            let (rx, ry) = self.paint_raw;
            let (r, g, b) = self.paint_color;
            painted = self.paint_stab_flush(
                rx,
                ry,
                self.paint_radius,
                r,
                g,
                b,
                self.paint_opacity as f64,
            );
        }
        // Op-log recorder: the stroke is complete (stabilizer catch-up
        // included) — commit it as one op. Mask strokes never record.
        #[cfg(feature = "tiles")]
        if let Some((pts, brush)) = self.rec_stroke.take() {
            if !self.paint_mask && !pts.is_empty() {
                self.oplog_record(crate::ops::Op::Stroke { points: pts, brush });
            }
        }
        self.paint_last = None;
        self.paint_leash = 0.0;
        self.paint_cov = Vec::new();
        self.paint_base = Vec::new();
        self.paint_erase = false;
        self.paint_mask = false;
        self.paint_mask_base = Vec::new();
        painted
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
        raw_x: f64,
        raw_y: f64,
        leash: f64,
        radius: f64,
        r: u8,
        g: u8,
        b: u8,
        opacity: f64,
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
        raw_x: f64,
        raw_y: f64,
        radius: f64,
        r: u8,
        g: u8,
        b: u8,
        opacity: f64,
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
}
