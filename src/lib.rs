use wasm_bindgen::prelude::*;

const MAX_HISTORY: usize = 50;

struct Snapshot {
    label: String,
    data: Vec<u8>,
}

#[wasm_bindgen]
pub struct CloneStampTool {
    width: u32,
    height: u32,
    data: Vec<u8>,
    source_x: Option<i32>,
    source_y: Option<i32>,
    offset_x: f64,
    offset_y: f64,
    brush_size: u32,
    hardness: f64,
    opacity: f64,
    spacing: f64,
    zoom: f64,
    undo_stack: Vec<Snapshot>,
    redo_stack: Vec<Snapshot>,
    stroke_active: bool,
    stroke_pre_snapshot: Option<Snapshot>,
    stroke_counter: u32,
    last_stamp_x: Option<f64>,
    last_stamp_y: Option<f64>,
}

#[wasm_bindgen]
impl CloneStampTool {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            data: vec![0u8; (width * height * 4) as usize],
            source_x: None,
            source_y: None,
            offset_x: 0.0,
            offset_y: 0.0,
            brush_size: 20,
            hardness: 0.8,
            opacity: 1.0,
            spacing: 0.25,
            zoom: 1.0,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            stroke_active: false,
            stroke_pre_snapshot: None,
            stroke_counter: 0,
            last_stamp_x: None,
            last_stamp_y: None,
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }
    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn load_image(&mut self, pixels: &[u8]) {
        if pixels.len() == self.data.len() {
            self.data.copy_from_slice(pixels);
            self.undo_stack.clear();
            self.redo_stack.clear();
            self.stroke_counter = 0;
            self.source_x = None;
            self.source_y = None;
        }
    }

    pub fn set_brush_size(&mut self, size: u32) {
        self.brush_size = size.max(1);
    }
    pub fn get_brush_size(&self) -> u32 {
        self.brush_size
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

    pub fn set_source(&mut self, x: i32, y: i32) {
        self.source_x = Some(x);
        self.source_y = Some(y);
    }
    pub fn has_source(&self) -> bool {
        self.source_x.is_some()
    }

    pub fn begin_stroke(&mut self, dest_x: f64, dest_y: f64) -> bool {
        let (sx, sy) = match (self.source_x, self.source_y) {
            (Some(x), Some(y)) => (x as f64, y as f64),
            _ => return false,
        };
        if self.stroke_active {
            return true;
        }
        self.offset_x = dest_x - sx;
        self.offset_y = dest_y - sy;
        self.stroke_active = true;
        self.last_stamp_x = None;
        self.last_stamp_y = None;
        self.stroke_counter += 1;
        self.stroke_pre_snapshot = Some(Snapshot {
            label: format!("Stamp {}", self.stroke_counter),
            data: self.data.clone(),
        });
        self.redo_stack.clear();
        self.stamp_at(dest_x, dest_y);
        true
    }

    pub fn continue_stroke(&mut self, dest_x: f64, dest_y: f64) {
        if !self.stroke_active {
            return;
        }
        self.stroke_to(dest_x, dest_y);
    }

    pub fn end_stroke(&mut self) {
        if !self.stroke_active {
            return;
        }
        self.stroke_active = false;
        if let Some(snap) = self.stroke_pre_snapshot.take() {
            self.undo_stack.push(snap);
            if self.undo_stack.len() > MAX_HISTORY {
                self.undo_stack.remove(0);
            }
        }
        self.last_stamp_x = None;
        self.last_stamp_y = None;
    }

    pub fn undo(&mut self) -> bool {
        if let Some(snap) = self.undo_stack.pop() {
            self.redo_stack.push(Snapshot {
                label: snap.label.clone(),
                data: self.data.clone(),
            });
            self.data = snap.data;
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(snap) = self.redo_stack.pop() {
            self.undo_stack.push(Snapshot {
                label: snap.label.clone(),
                data: self.data.clone(),
            });
            self.data = snap.data;
            true
        } else {
            false
        }
    }

    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }
    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    pub fn history_labels(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        for s in &self.undo_stack {
            parts.push(format!("undo:{}", s.label));
        }
        parts.push("current:Current State".to_string());
        for s in self.redo_stack.iter().rev() {
            parts.push(format!("redo:{}", s.label));
        }
        parts.join("|")
    }

    pub fn jump_to_history(&mut self, target_index: usize) -> bool {
        let current = self.undo_stack.len();
        if target_index == current {
            return false;
        }
        if target_index < current {
            for _ in 0..(current - target_index) {
                if !self.undo() {
                    break;
                }
            }
        } else {
            for _ in 0..(target_index - current) {
                if !self.redo() {
                    break;
                }
            }
        }
        true
    }

    pub fn delete_history_entry(&mut self, index: usize) -> bool {
        if index >= self.undo_stack.len() {
            return false;
        }
        self.data = self.undo_stack[index].data.clone();
        self.undo_stack.truncate(index);
        self.redo_stack.clear();
        true
    }

    pub fn clear_history(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    pub fn get_image_data(&self) -> Vec<u8> {
        self.data.clone()
    }
    pub fn data_ptr(&self) -> *const u8 {
        self.data.as_ptr()
    }
    pub fn data_len(&self) -> usize {
        self.data.len()
    }

    pub fn export_png(&self) -> Vec<u8> {
        let mut output = Vec::new();
        let mut encoder = png::Encoder::new(&mut output, self.width, self.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        if let Ok(mut writer) = encoder.write_header() {
            let _ = writer.write_image_data(&self.data);
        }
        output
    }
}

impl CloneStampTool {
    fn stroke_to(&mut self, dest_x: f64, dest_y: f64) {
        let step = (self.brush_size as f64 * self.spacing).max(1.0);
        let (start_x, start_y) = match (self.last_stamp_x, self.last_stamp_y) {
            (Some(lx), Some(ly)) => (lx, ly),
            _ => {
                self.stamp_at(dest_x, dest_y);
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
            self.stamp_at(start_x + dx * t, start_y + dy * t);
        }
        self.last_stamp_x = Some(dest_x);
        self.last_stamp_y = Some(dest_y);
    }

    fn stamp_at(&mut self, dest_x: f64, dest_y: f64) {
        let src_x = dest_x - self.offset_x;
        let src_y = dest_y - self.offset_y;
        self.apply_dab(dest_x, dest_y, src_x, src_y);
        self.last_stamp_x = Some(dest_x);
        self.last_stamp_y = Some(dest_y);
    }

    fn apply_dab(&mut self, cx: f64, cy: f64, src_cx: f64, src_cy: f64) {
        let r = self.brush_size as f64;
        let w = self.width as i32;
        let h = self.height as i32;
        let min_x = ((cx - r).floor() as i32).max(0);
        let max_x = ((cx + r).ceil() as i32).min(w - 1);
        let min_y = ((cy - r).floor() as i32).max(0);
        let max_y = ((cy + r).ceil() as i32).min(h - 1);
        let src_min_x = (src_cx - r).floor() as i32;
        let src_max_x = (src_cx + r).ceil() as i32;
        let src_min_y = (src_cy - r).floor() as i32;
        let src_max_y = (src_cy + r).ceil() as i32;
        if src_max_x < 0 || src_min_x >= w || src_max_y < 0 || src_min_y >= h {
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
                let alpha = if norm <= self.hardness {
                    1.0
                } else {
                    let t = (norm - self.hardness) / (1.0 - self.hardness + 1e-9);
                    (1.0 - t * t).max(0.0)
                } * self.opacity;
                let sx = (src_cx + (px as f64 - cx)).round() as i32;
                let sy = (src_cy + (py as f64 - cy)).round() as i32;
                if sx < 0 || sx >= w || sy < 0 || sy >= h {
                    continue;
                }
                let si = ((sy * w + sx) * 4) as usize;
                let di = ((py * w + px) * 4) as usize;
                let sr = self.data[si] as f64;
                let sg = self.data[si + 1] as f64;
                let sb = self.data[si + 2] as f64;
                let dr = self.data[di] as f64;
                let dg = self.data[di + 1] as f64;
                let db = self.data[di + 2] as f64;
                self.data[di] = (dr + (sr - dr) * alpha).round() as u8;
                self.data[di + 1] = (dg + (sg - dg) * alpha).round() as u8;
                self.data[di + 2] = (db + (sb - db) * alpha).round() as u8;
            }
        }
    }
}