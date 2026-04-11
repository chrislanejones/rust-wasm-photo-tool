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
        self.stroke_pre_snapshot = Some(Snapshot {
            label: format!("Stamp {}", self.stroke_counter),
            data: data.to_vec(),
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
        let src_x = dest_x - self.offset_x;
        let src_y = dest_y - self.offset_y;
        apply_dab(data, w, h, self.brush_size, self.hardness, self.opacity, dest_x, dest_y, src_x, src_y);
        self.last_stamp_x = Some(dest_x);
        self.last_stamp_y = Some(dest_y);
    }
}

/// Pure function — blends source pixels onto destination in a circular brush footprint.
fn apply_dab(
    data: &mut [u8],
    w: i32, h: i32,
    brush_size: u32, hardness: f64, opacity: f64,
    cx: f64, cy: f64, src_cx: f64, src_cy: f64,
) {
    let r = brush_size as f64;
    let min_x = ((cx - r).floor() as i32).max(0);
    let max_x = ((cx + r).ceil() as i32).min(w - 1);
    let min_y = ((cy - r).floor() as i32).max(0);
    let max_y = ((cy + r).ceil() as i32).min(h - 1);
    if (src_cx + r).ceil() as i32 <= 0
        || (src_cx - r).floor() as i32 >= w
        || (src_cy + r).ceil() as i32 <= 0
        || (src_cy - r).floor() as i32 >= h
    {
        return;
    }
    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let dx = px as f64 - cx;
            let dy = py as f64 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist > r {
                continue;
            }
            let norm = dist / r;
            let alpha = if norm <= hardness {
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
            for c in 0..3 {
                let sv = data[si + c] as f64;
                let dv = data[di + c] as f64;
                data[di + c] = (dv + (sv - dv) * alpha).round() as u8;
            }
        }
    }
}
