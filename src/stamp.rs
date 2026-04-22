/// Clone stamp brush engine.
///
/// Source point, offset tracking, stroke lifecycle (begin / continue / end),
/// spacing-based interpolation, and the per-pixel dab blending kernel.

use crate::history::Snapshot;

pub struct StampState {
    pub source_x: Option<i32>,
    pub source_y: Option<i32>,
    offset_x: f64,
    offset_y: f64,
    pub brush_size: u32,
    pub hardness: f64,
    pub opacity: f64,
    pub spacing: f64,
    pub stroke_active: bool,
    pub stroke_pre_snapshot: Option<Snapshot>,
    pub stroke_counter: u32,
    last_stamp_x: Option<f64>,
    last_stamp_y: Option<f64>,
    /// Frozen copy of the buffer taken at begin_stroke; used as the read-only
    /// source for all dabs in the stroke so we never sample modified pixels.
    stroke_src_data: Vec<u8>,
}

impl StampState {
    pub fn new() -> Self {
        Self {
            source_x: None,
            source_y: None,
            offset_x: 0.0,
            offset_y: 0.0,
            brush_size: 20,
            hardness: 0.8,
            opacity: 1.0,
            spacing: 0.25,
            stroke_active: false,
            stroke_pre_snapshot: None,
            stroke_counter: 0,
            last_stamp_x: None,
            last_stamp_y: None,
            stroke_src_data: Vec::new(),
        }
    }

    pub fn set_source(&mut self, x: i32, y: i32) {
        self.source_x = Some(x);
        self.source_y = Some(y);
    }

    pub fn has_source(&self) -> bool {
        self.source_x.is_some()
    }

    pub fn set_brush_size(&mut self, size: u32) {
        self.brush_size = size.max(1);
    }
    pub fn set_hardness(&mut self, h: f64) {
        self.hardness = h.clamp(0.0, 1.0);
    }
    pub fn set_opacity(&mut self, o: f64) {
        self.opacity = o.clamp(0.0, 1.0);
    }
    pub fn set_spacing(&mut self, s: f64) {
        self.spacing = s.clamp(0.05, 2.0);
    }

    // ── Stroke lifecycle ────────────────────────────────────────────────────

    pub fn begin_stroke(
        &mut self,
        data: &mut [u8],
        w: i32,
        h: i32,
        redo_stack: &mut Vec<Snapshot>,
        dest_x: f64,
        dest_y: f64,
    ) {
        let (sx, sy) = match (self.source_x, self.source_y) {
            (Some(x), Some(y)) => (x as f64, y as f64),
            _ => return,
        };
        if self.stroke_active {
            return;
        }
        self.offset_x = dest_x - sx;
        self.offset_y = dest_y - sy;
        self.stroke_active = true;
        self.last_stamp_x = None;
        self.last_stamp_y = None;
        self.stroke_counter += 1;
        self.stroke_src_data = data.to_vec();
        self.stroke_pre_snapshot = Some(Snapshot {
            label: format!("Stamp {}", self.stroke_counter),
            data: self.stroke_src_data.clone(),
            width: w as u32,
            height: h as u32,
        });
        redo_stack.clear();
        self.stamp_at(data, w, h, dest_x, dest_y);
    }

    pub fn continue_stroke(
        &mut self,
        data: &mut [u8],
        w: i32,
        h: i32,
        dest_x: f64,
        dest_y: f64,
    ) {
        if !self.stroke_active {
            return;
        }
        self.stroke_to(data, w, h, dest_x, dest_y);
    }

    pub fn end_stroke(&mut self, undo_stack: &mut Vec<Snapshot>, max_history: usize) {
        if !self.stroke_active {
            return;
        }
        self.stroke_active = false;
        if let Some(snap) = self.stroke_pre_snapshot.take() {
            undo_stack.push(snap);
            if undo_stack.len() > max_history {
                undo_stack.remove(0);
            }
        }
        self.stroke_src_data.clear();
        self.last_stamp_x = None;
        self.last_stamp_y = None;
    }

    // ── Internal ────────────────────────────────────────────────────────────

    fn stroke_to(&mut self, data: &mut [u8], w: i32, h: i32, dest_x: f64, dest_y: f64) {
        let step = (self.brush_size as f64 * self.spacing).max(1.0);
        let (start_x, start_y) = match (self.last_stamp_x, self.last_stamp_y) {
            (Some(lx), Some(ly)) => (lx, ly),
            _ => {
                self.stamp_at(data, w, h, dest_x, dest_y);
                return;
            }
        };
        let dx = dest_x - start_x;
        let dy = dest_y - start_y;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist < 0.5 {
            return;
        }
        let steps = (dist / step).ceil() as u32;
        for i in 1..=steps {
            let t = i as f64 / steps as f64;
            self.stamp_at(data, w, h, start_x + dx * t, start_y + dy * t);
        }
        self.last_stamp_x = Some(dest_x);
        self.last_stamp_y = Some(dest_y);
    }

    fn stamp_at(&mut self, data: &mut [u8], w: i32, h: i32, dest_x: f64, dest_y: f64) {
        let src_cx = dest_x - self.offset_x;
        let src_cy = dest_y - self.offset_y;
        let brush_size = self.brush_size;
        let hardness = self.hardness;
        let opacity = self.opacity;
        apply_dab(&self.stroke_src_data, data, w, h, brush_size, hardness, opacity,
                  dest_x, dest_y, src_cx, src_cy);
        self.last_stamp_x = Some(dest_x);
        self.last_stamp_y = Some(dest_y);
    }
}

/// Blends source pixels onto destination in a circular brush footprint.
/// `src` is a frozen snapshot of the canvas taken before the stroke began;
/// `dst` is the live canvas being modified. Keeping them separate prevents
/// reading already-painted pixels as source material during a single stroke.
/// Uses Porter-Duff source-over compositing so transparency is handled correctly.
fn apply_dab(
    src: &[u8],
    dst: &mut [u8],
    w: i32, h: i32,
    brush_size: u32, hardness: f64, opacity: f64,
    cx: f64, cy: f64, src_cx: f64, src_cy: f64,
) {
    let r = brush_size as f64;
    let r_sq = r * r;
    let min_x = ((cx - r).floor() as i32).max(0);
    let max_x = ((cx + r).ceil() as i32).min(w - 1);
    let min_y = ((cy - r).floor() as i32).max(0);
    let max_y = ((cy + r).ceil() as i32).min(h - 1);
    if (src_cx + r).ceil() as i32 <= 0
        || (src_cx - r).floor() as i32 >= w
        || (src_cy + r).ceil() as i32 <= 0
        || (src_cy - r).floor() as i32 >= h
        || src.is_empty()
    {
        return;
    }
    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let dx = px as f64 - cx;
            let dy = py as f64 - cy;
            let dist_sq = dx * dx + dy * dy;
            if dist_sq > r_sq {
                continue;
            }
            let norm = dist_sq.sqrt() / r;
            let brush_alpha = if norm <= hardness {
                1.0
            } else {
                let t = (norm - hardness) / (1.0 - hardness + 1e-9);
                (1.0 - t * t).max(0.0)
            } * opacity;
            let sx = (src_cx + dx).round() as i32;
            let sy = (src_cy + dy).round() as i32;
            if sx < 0 || sx >= w || sy < 0 || sy >= h {
                continue;
            }
            let si = ((sy * w + sx) * 4) as usize;
            let di = ((py * w + px) * 4) as usize;
            if si + 3 >= src.len() || di + 3 >= dst.len() {
                continue;
            }
            // Porter-Duff source-over: src_a scaled by brush_alpha
            let sa = src[si + 3] as f64 / 255.0 * brush_alpha;
            let da = dst[di + 3] as f64 / 255.0;
            let out_a = sa + da * (1.0 - sa);
            dst[di + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
            if out_a > 1e-6 {
                for c in 0..3 {
                    let sv = src[si + c] as f64 / 255.0;
                    let dv = dst[di + c] as f64 / 255.0;
                    let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
                    dst[di + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                }
            }
        }
    }
}
