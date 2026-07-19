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

/// The canvas-clamped bbox a dab of this radius touches, or None if it falls
/// off-canvas / the radius is degenerate.
///
/// Split out of [`dab_coverage`] (whose signature is unchanged — op-log replay
/// calls it) because the Smart Brush needs the bbox *before* the dab is
/// stamped, to snapshot the coverage it is about to overwrite. One formula, so
/// the snapshot and the stamp can never disagree about which pixels were
/// touched.
#[inline]
pub(crate) fn dab_bbox(
    w: i32,
    h: i32,
    cx: f64,
    cy: f64,
    radius: f64,
) -> Option<(i32, i32, i32, i32)> {
    if radius as f32 <= 0.0 {
        return None;
    }
    let min_x = ((cx - radius).floor() as i32).max(0);
    let max_x = ((cx + radius).ceil() as i32).min(w - 1);
    let min_y = ((cy - radius).floor() as i32).max(0);
    let max_y = ((cy + radius).ceil() as i32).min(h - 1);
    if min_x > max_x || min_y > max_y {
        return None;
    }
    Some((min_x, min_y, max_x, max_y))
}

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
    let r_sq = r_f32 * r_f32;
    let (min_x, min_y, max_x, max_y) = dab_bbox(w, h, cx, cy, radius)?;

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

// ── Smart Brush containment ─────────────────────────────────────────────────
// The SECOND consumer of the shared edge cost map (the magnetic lasso is the
// first). The lasso path-finds ALONG the cheap edges; the brush treats those
// same edges as walls it cannot paint across. One cost map, two readings of it
// — which is exactly why the two features can never disagree about where an
// object stops.
//
// Region-grow from the dab centre, bounded to the dab's own bbox: coverage the
// grow can't reach is rolled back to what it was before this dab. Bounding it
// to the footprint is what keeps the brush O(dab area) instead of O(image) per
// dab — a full-image flood on every dab of a 60/s stroke would be unusable.
//
// A region-grow rather than a straight-line visibility test, because the grow
// respects concave shapes: paint inside a "C" and the stroke will not jump the
// gap to the other arm, which a line test would happily do.

/// Roll back the coverage this dab just laid wherever the paint could not
/// *reach* from the dab centre without crossing a strong edge.
///
/// `prev` is the bbox-local snapshot of `cov` from immediately before the dab
/// (see [`dab_bbox`]); `reach` and `stack` are caller-owned scratch, reused
/// across dabs so a stroke allocates nothing per dab. `reach` must be `w*h`;
/// only the bbox region is touched (and cleared) here.
///
/// If the dab centre is itself a wall — the user painted right on an outline —
/// the dab is left unconstrained. Same rule the edge-aware wand uses for a seed
/// on an edge: doing *something* beats mysteriously doing nothing.
#[allow(clippy::too_many_arguments)]
pub(crate) fn constrain_dab_to_region(
    cov: &mut [u8],
    prev: &[u8],
    cost: &[u16],
    w: usize,
    bbox: (i32, i32, i32, i32),
    centre: (i32, i32),
    strength: u8,
    reach: &mut [bool],
    stack: &mut Vec<usize>,
) {
    let (min_x, min_y, max_x, max_y) = bbox;
    let (x0, y0) = (min_x as usize, min_y as usize);
    let (x1, y1) = (max_x as usize, max_y as usize);
    let (cx, cy) = (centre.0 as usize, centre.1 as usize);
    if cost.len() != reach.len() || cost.len() != cov.len() {
        return; // mismatched planes: paint normally rather than corrupt the stroke
    }
    // Centre outside its own bbox (dab clipped by the canvas edge) or standing
    // on a wall: leave the dab alone.
    if cx < x0 || cx > x1 || cy < y0 || cy > y1 {
        return;
    }
    let is_open = |i: usize| !crate::edges::is_wall(cost[i], strength);
    if !is_open(cy * w + cx) {
        return;
    }

    // Clear only the window we're about to flood — zeroing a full-image plane
    // per dab would cost more than the flood itself.
    for y in y0..=y1 {
        reach[y * w + x0..=y * w + x1].fill(false);
    }
    crate::selection::flood_barrier_into(
        reach,
        w,
        &[cy * w + cx],
        (x0, y0, x1, y1),
        stack,
        is_open,
    );

    // Anything the paint couldn't reach goes back to its pre-dab coverage.
    let bw = x1 - x0 + 1;
    for y in y0..=y1 {
        for x in x0..=x1 {
            let i = y * w + x;
            if !reach[i] {
                cov[i] = prev[(y - y0) * bw + (x - x0)];
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

        // Smart Brush: build the edge cost map ONCE per stroke (a Sobel pass
        // per dab would be unusable), and size the scratch planes now so the
        // stroke itself allocates nothing per dab. Untouched — and unallocated
        // — when the Smart Brush is off, which is the default.
        if self.smart_brush {
            let (w, h) = (self.width as usize, self.height as usize);
            let mag = crate::edges::sobel_magnitude(&self.composite_cache, w, h);
            self.smart_cost = crate::edges::edge_cost_map(&mag);
            self.smart_reach.clear();
            self.smart_reach.resize(n, false);
        }
    }

    /// Turn the Smart Brush on/off and set how hard an edge has to be before it
    /// walls the stroke in (`strength`, 0..=255 — higher = only the hardest
    /// edges contain the paint). Takes effect from the next `paint_begin`.
    ///
    /// Off by default. With it off, `accumulate_dab` below is byte-for-byte the
    /// brush that shipped.
    pub fn set_smart_brush(&mut self, enabled: bool, strength: u32) {
        self.smart_brush = enabled;
        self.smart_strength = strength.min(255) as u8;
        if !enabled {
            // Don't sit on a multi-MB cost map after the user switches it off.
            self.smart_cost = Vec::new();
            self.smart_reach = Vec::new();
        }
    }

    /// Stamp one dab's soft-edged profile into the coverage buffer. Thin
    /// wrapper over the pure [`dab_coverage`] kernel (shared with op-log
    /// replay); returns None additionally when the stroke isn't primed
    /// (paint_begin not run).
    ///
    /// With the Smart Brush on, the dab is additionally contained by the shared
    /// edge cost map: coverage the paint can't reach from the dab centre without
    /// crossing a strong edge is rolled back (see [`constrain_dab_to_region`]).
    fn accumulate_dab(&mut self, cx: f64, cy: f64, radius: f64) -> Option<(i32, i32, i32, i32)> {
        let w = self.width as i32;
        let h = self.height as i32;
        let n = (self.width * self.height) as usize;
        if self.paint_cov.len() != n {
            return None;
        }

        // Smart path: snapshot the coverage this dab is about to overwrite
        // (bbox-local, so the snapshot is dab-sized, not image-sized), stamp,
        // then roll back whatever the paint couldn't reach.
        if self.smart_brush && self.smart_cost.len() == n && self.smart_reach.len() == n {
            let bbox = dab_bbox(w, h, cx, cy, radius)?;
            let (min_x, min_y, max_x, max_y) = bbox;
            let (bw, bh) = ((max_x - min_x + 1) as usize, (max_y - min_y + 1) as usize);
            let wu = w as usize;

            // Reused across dabs: `resize` only reallocates when the brush grows.
            self.smart_prev.clear();
            self.smart_prev.reserve(bw * bh);
            for y in min_y as usize..=max_y as usize {
                let row = y * wu + min_x as usize;
                self.smart_prev
                    .extend_from_slice(&self.paint_cov[row..row + bw]);
            }

            let bbox = dab_coverage(
                &mut self.paint_cov,
                w,
                h,
                cx,
                cy,
                radius,
                self.paint_hardness,
            )?;
            constrain_dab_to_region(
                &mut self.paint_cov,
                &self.smart_prev,
                &self.smart_cost,
                wu,
                bbox,
                (cx.round() as i32, cy.round() as i32),
                self.smart_strength,
                &mut self.smart_reach,
                &mut self.smart_stack,
            );
            return Some(bbox);
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

        // Magic Eraser stroke: mark `selection` bits, touch no pixels or layer
        // mask at all. Hard edge + monotonic — any nonzero coverage in this
        // dab marks the pixel, and a pixel already marked earlier in the
        // stroke never gets unmarked by a later dab. Handled first + returns,
        // same shape as the `paint_mask` branch below. Gated on the same
        // feature as the field itself — a default build never has either.
        #[cfg(feature = "patchmatch")]
        if self.paint_selection_mask {
            let cov = &self.paint_cov;
            let Some(sel) = self.selection.as_mut() else {
                return;
            };
            if sel.len() != cov.len() {
                return;
            }
            for py in min_y..=max_y {
                for px in min_x..=max_x {
                    let i = (py * w + px) as usize;
                    if i >= sel.len() || i >= cov.len() {
                        continue;
                    }
                    if cov[i] > 0 {
                        sel[i] = true;
                    }
                }
            }
            return;
        }

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

    /// Magic Eraser brush (feature `patchmatch`): paints into `selection` —
    /// the SAME `Vec<bool>` mask wand / lasso / color-range build and
    /// `remove_object` consumes — using this same dab/coverage/stabilizer
    /// engine, instead of painting pixels or a layer's grayscale mask. Day-1
    /// scope is hard-edge only (see `recomposite_stroke_bbox`'s
    /// `paint_selection_mask` branch); soft/anti-aliased masks are later
    /// polish (arc day-4).
    ///
    /// Starts a FRESH selection each stroke (replaces, doesn't extend, any
    /// prior selection) — one continuous paint gesture is one removal
    /// region, matching "paint, release, it fills." Touches no layer pixels
    /// or mask, and does not snap history or record an op-log entry: this
    /// stroke marks WHAT to remove, it is not itself an edit.
    /// `remove_object` (unchanged) is what actually mutates pixels, snaps,
    /// and consumes this selection, once the caller confirms.
    #[cfg(feature = "patchmatch")]
    pub fn magic_eraser_brush_down(
        &mut self,
        x: f64,
        y: f64,
        size: f64,
        hardness: f64,
        stab: &str,
    ) {
        let n = (self.width * self.height) as usize;
        if n == 0 {
            return;
        }
        self.selection = Some(vec![false; n]);
        self.paint_cov = vec![0u8; n];
        self.paint_base = Vec::new();
        self.paint_mask = false;
        self.paint_selection_mask = true;
        self.paint_erase = false;
        #[cfg(feature = "tiles")]
        {
            self.rec_stroke = None;
        }
        self.paint_hardness = hardness.clamp(0.0, 1.0) as f32;
        let radius = (size * 0.5).max(0.0);
        self.paint_radius = radius;
        self.paint_leash = Self::leash_for(stab);
        self.paint_last = Some((x, y));
        self.paint_raw = (x, y);
        // Colour/opacity are irrelevant when marking a selection; paint_dab
        // still routes through recomposite_stroke_bbox, which the
        // paint_selection_mask branch intercepts before any pixel math runs.
        self.paint_dab(x, y, radius, 0, 0, 0, 1.0);
        if self.paint_leash > 0.0 {
            self.paint_stab_begin(x, y);
        }
    }

    /// Continue the active Magic Eraser stroke. True if it marked more of the mask.
    #[cfg(feature = "patchmatch")]
    pub fn magic_eraser_brush_move(&mut self, x: f64, y: f64) -> bool {
        self.paint_move(x, y)
    }

    /// End the active Magic Eraser stroke. Returns whether anything ended up
    /// selected — the caller (JS) checks this before invoking `remove_object`,
    /// the same non-empty guard `remove_object` applies internally.
    #[cfg(feature = "patchmatch")]
    pub fn magic_eraser_brush_up(&mut self) -> bool {
        self.paint_up();
        self.selection
            .as_ref()
            .is_some_and(|m| m.iter().any(|&b| b))
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
        // included) — commit it as one op. Mask strokes and Magic Eraser
        // selection strokes never record (neither touches a pixel).
        #[cfg(feature = "tiles")]
        if let Some((pts, brush)) = self.rec_stroke.take() {
            // A default (non-`patchmatch`) build never has a selection-mask
            // stroke to exclude, so this reads as a plain `false` there —
            // same technique used below for the field reset.
            #[cfg(feature = "patchmatch")]
            let is_selection_stroke = self.paint_selection_mask;
            #[cfg(not(feature = "patchmatch"))]
            let is_selection_stroke = false;
            if !self.paint_mask && !is_selection_stroke && !pts.is_empty() {
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
        #[cfg(feature = "patchmatch")]
        {
            self.paint_selection_mask = false;
        }
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

#[cfg(test)]
mod smart_brush_tests {
    use super::*;
    use crate::edges::{edge_cost_map, sobel_magnitude};

    const W: usize = 64;
    const H: usize = 32;
    /// The seam: x < 32 is the dark region, x >= 32 is the light one.
    const SEAM: usize = 32;

    /// Two regions, one clean hard edge down the middle — the fixture the whole
    /// feature is judged on.
    fn two_regions() -> Vec<u8> {
        let mut v = vec![0u8; W * H * 4];
        for y in 0..H {
            for x in 0..W {
                let c: [u8; 4] = if x < SEAM {
                    [25, 25, 25, 255]
                } else {
                    [235, 235, 235, 255]
                };
                v[(y * W + x) * 4..(y * W + x) * 4 + 4].copy_from_slice(&c);
            }
        }
        v
    }

    fn cost() -> Vec<u16> {
        edge_cost_map(&sobel_magnitude(&two_regions(), W, H))
    }

    /// Lay one dab and contain it, exactly as `accumulate_dab` does — the pure
    /// kernels, so the assertion is about the algorithm and not about wasm.
    fn smart_dab(cx: f64, cy: f64, radius: f64, strength: u8) -> Vec<u8> {
        let cost = cost();
        let mut cov = vec![0u8; W * H];
        let bbox = dab_bbox(W as i32, H as i32, cx, cy, radius).expect("dab is on canvas");
        let (min_x, min_y, max_x, max_y) = bbox;
        let bw = (max_x - min_x + 1) as usize;

        // Bbox-local snapshot of the pre-dab coverage, as the brush takes.
        let mut prev = Vec::new();
        for y in min_y as usize..=max_y as usize {
            let row = y * W + min_x as usize;
            prev.extend_from_slice(&cov[row..row + bw]);
        }

        dab_coverage(&mut cov, W as i32, H as i32, cx, cy, radius, 1.0).expect("dab lands");
        let mut reach = vec![false; W * H];
        let mut stack = Vec::new();
        constrain_dab_to_region(
            &mut cov,
            &prev,
            &cost,
            W,
            bbox,
            (cx.round() as i32, cy.round() as i32),
            strength,
            &mut reach,
            &mut stack,
        );
        cov
    }

    /// Total coverage laid on the light side of the seam.
    fn coverage_across_the_seam(cov: &[u8]) -> u32 {
        let mut sum = 0u32;
        for y in 0..H {
            for x in SEAM..W {
                sum += cov[y * W + x] as u32;
            }
        }
        sum
    }

    #[test]
    fn a_stroke_in_one_region_does_not_bleed_into_the_other() {
        // A fat dab centred in the DARK region, close enough to the seam that a
        // normal brush would spill well across it.
        let (cx, cy, r) = (24.0, 16.0, 14.0);

        // The control: the shipped brush, unconstrained. It bleeds — that is the
        // bug the Smart Brush exists to fix, so the test asserts the bug is real
        // before asserting it's fixed. Without this, a containment that did
        // nothing would still pass.
        let mut plain = vec![0u8; W * H];
        dab_coverage(&mut plain, W as i32, H as i32, cx, cy, r, 1.0).unwrap();
        assert!(
            coverage_across_the_seam(&plain) > 0,
            "fixture is wrong: the plain brush must spill across the seam"
        );

        // The Smart Brush, same dab: nothing crosses.
        let smart = smart_dab(cx, cy, r, 128);
        assert_eq!(
            coverage_across_the_seam(&smart),
            0,
            "the stroke must not bleed across a clean edge"
        );
        // ...and it still painted its own side (containment, not suppression).
        assert!(
            smart[16 * W + 24] > 0,
            "the dab must still paint the region it was centred in"
        );
    }

    #[test]
    fn containment_is_deterministic() {
        let a = smart_dab(24.0, 16.0, 14.0, 128);
        let b = smart_dab(24.0, 16.0, 14.0, 128);
        assert_eq!(a, b, "same dab + same cost map -> byte-identical coverage");
    }

    #[test]
    fn a_dab_far_from_any_edge_is_untouched_by_containment() {
        // Deep in the dark region: containment must be a no-op, not a nibble at
        // the brush's own footprint.
        let (cx, cy, r) = (10.0, 16.0, 6.0);
        let smart = smart_dab(cx, cy, r, 128);
        let mut plain = vec![0u8; W * H];
        dab_coverage(&mut plain, W as i32, H as i32, cx, cy, r, 1.0).unwrap();
        assert_eq!(
            smart, plain,
            "away from edges the Smart Brush must lay exactly the normal dab"
        );
    }

    #[test]
    fn painting_on_the_edge_still_paints() {
        // Centre the dab ON the seam. The centre is a wall, so containment backs
        // off entirely rather than mysteriously painting nothing — the same rule
        // the edge-aware wand uses for a seed that lands on an outline.
        let smart = smart_dab(SEAM as f64, 16.0, 8.0, 128);
        assert!(
            smart.iter().any(|&c| c > 0),
            "a dab centred on an edge must still paint something"
        );
    }

    #[test]
    fn strength_tunes_how_much_it_takes_to_wall_a_stroke_in() {
        // At a strength above what this seam's edge can muster, the wall stops
        // being a wall and the brush behaves normally. (Normalized magnitude at
        // a hard black/white seam is 255, so only a strength above that frees
        // it — 255 is the max the UI can send, hence: still contained.)
        assert_eq!(
            coverage_across_the_seam(&smart_dab(24.0, 16.0, 14.0, 255)),
            0
        );
        // And at a low strength it is certainly contained.
        assert_eq!(
            coverage_across_the_seam(&smart_dab(24.0, 16.0, 14.0, 40)),
            0
        );
    }

    #[test]
    fn degenerate_inputs_do_not_panic() {
        let mut cov = vec![0u8; W * H];
        let mut reach = vec![false; W * H];
        let mut stack = Vec::new();
        // Mismatched planes: bail out, paint normally, don't corrupt or panic.
        constrain_dab_to_region(
            &mut cov,
            &[],
            &[],
            W,
            (0, 0, 3, 3),
            (1, 1),
            128,
            &mut reach,
            &mut stack,
        );
        assert!(cov.iter().all(|&c| c == 0));
        // Zero / negative radius has no bbox at all.
        assert!(dab_bbox(W as i32, H as i32, 5.0, 5.0, 0.0).is_none());
        assert!(dab_bbox(W as i32, H as i32, -50.0, -50.0, 2.0).is_none());
    }
}

/// Session-level coverage for the Magic Eraser brush
/// (`magic_eraser_brush_down/move/up`) — drives the real wasm-bindgen
/// methods on a full `ImageHorseTool`, same style as
/// `selection::lasso_session_tests`, since the thing under test is the
/// session bookkeeping (does painting actually land in `selection`, does it
/// touch pixels, does it reset between strokes) not the pure dab kernel
/// (already covered by `smart_brush_tests` and `patchmatch`'s own tests).
#[cfg(all(test, feature = "patchmatch"))]
mod magic_eraser_brush_tests {
    use crate::ImageHorseTool;

    fn solid(w: u32, h: u32, c: [u8; 4]) -> Vec<u8> {
        let mut v = vec![0u8; (w * h * 4) as usize];
        for px in v.chunks_exact_mut(4) {
            px.copy_from_slice(&c);
        }
        v
    }

    #[test]
    fn a_stroke_marks_selection_and_touches_no_pixels() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [200, 100, 50, 255]));
        let before = t.export_png();

        t.magic_eraser_brush_down(20.0, 20.0, 10.0, 1.0, "off");
        t.magic_eraser_brush_move(22.0, 20.0);
        let had_selection = t.magic_eraser_brush_up();

        assert!(
            had_selection,
            "a brush stroke over the canvas should mark something"
        );
        assert_eq!(
            t.export_png(),
            before,
            "the brush marks a mask — it must not touch a single pixel"
        );
    }

    #[test]
    fn the_marked_mask_is_the_same_shape_remove_object_consumes() {
        // Not exercising remove_object itself (that's selection.rs's own
        // tests) — just pinning that the brush leaves behind a selection
        // (Some(Vec<bool>) sized w*h) in the exact shape `remove_object`'s
        // `self.selection.take()` expects, same as wand/lasso already do.
        let mut t = ImageHorseTool::new(30, 20);
        t.load_image(&solid(30, 20, [10, 10, 10, 255]));
        t.magic_eraser_brush_down(15.0, 10.0, 6.0, 1.0, "off");
        t.magic_eraser_brush_up();
        assert!(t.selection.as_ref().is_some_and(|m| m.len() == 30 * 20));
    }

    #[test]
    fn a_new_stroke_replaces_rather_than_extends_the_previous_one() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [0, 0, 0, 255]));

        t.magic_eraser_brush_down(5.0, 5.0, 3.0, 1.0, "off");
        t.magic_eraser_brush_up();
        let first_count = t.selection.as_ref().unwrap().iter().filter(|&&b| b).count();
        assert!(first_count > 0);

        // A second, disjoint stroke well away from the first.
        t.magic_eraser_brush_down(35.0, 35.0, 3.0, 1.0, "off");
        t.magic_eraser_brush_up();
        let sel = t.selection.as_ref().unwrap();
        // The first stroke's region must be gone — a fresh stroke replaces,
        // it does not accumulate ACROSS separate press/release gestures.
        assert!(
            !sel[5 * 40 + 5],
            "the previous stroke's mark should not survive a new stroke"
        );
        assert!(
            sel.iter().any(|&b| b),
            "the new stroke should have marked something"
        );
    }

    #[test]
    fn releasing_with_nothing_painted_reports_no_selection() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [0, 0, 0, 255]));
        // down/up with a zero-radius dab that lands nothing (mirrors
        // dab_bbox's own "no bbox at all" degenerate case above).
        t.magic_eraser_brush_down(10.0, 10.0, 0.0, 1.0, "off");
        let had_selection = t.magic_eraser_brush_up();
        assert!(!had_selection);
    }

    #[test]
    #[cfg(feature = "tiles")]
    fn a_selection_mask_stroke_does_not_record_into_the_op_log() {
        // Mirrors the mask-brush precedent this feature copies: neither kind
        // of non-pixel stroke should ever show up as a replayable Op::Stroke.
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [5, 5, 5, 255]));
        let before = t.oplog_op_count();
        t.magic_eraser_brush_down(20.0, 20.0, 8.0, 1.0, "off");
        t.magic_eraser_brush_move(22.0, 20.0);
        t.magic_eraser_brush_up();
        assert_eq!(
            t.oplog_op_count(),
            before,
            "a selection-mask stroke touches no pixels, so it must not record an op"
        );
    }
}
