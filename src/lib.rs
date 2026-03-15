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
    #[wasm_bindgen(constructor)]
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

    pub fn set_hardness(&mut self, h: f64) {
        self.hardness = h.clamp(0.0, 1.0);
    }

    pub fn set_opacity(&mut self, o: f64) {
        self.opacity = o.clamp(0.0, 1.0);
    }

    pub fn set_spacing(&mut self, s: f64) {
        self.spacing = s.clamp(0.05, 2.0);
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

    /// Call once on mousedown. Locks in the offset and stamps the first dab.
    pub fn begin_stroke(&mut self, dest_x: f64, dest_y: f64) {
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
            data: self.data.clone(),
        });
        self.redo_stack.clear();
        self.stamp_at(dest_x, dest_y);
    }

    /// Call on mousemove while drawing.
    pub fn continue_stroke(&mut self, dest_x: f64, dest_y: f64) {
        if !self.stroke_active {
            return;
        }
        self.stroke_to(dest_x, dest_y);
    }

    /// Call on mouseup.
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

    pub fn export_png(&self) -> Vec<u8> {
        let mut output = Vec::new();
        let mut encoder =
            png::Encoder::new(&mut output, self.width, self.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        if let Ok(mut writer) = encoder.write_header() {
            let _ = writer.write_image_data(&self.data);
        }
        output
    }
}

impl CloneStampTool {
    fn push_snapshot(&mut self, label: &str) {
        self.undo_stack.push(Snapshot {
            label: label.to_string(),
            data: self.data.clone(),
        });
        if self.undo_stack.len() > MAX_HISTORY {
            self.undo_stack.remove(0);
        }
        self.redo_stack.clear();
    }

    fn sample_bilinear(&self, fx: f64, fy: f64) -> [u8; 4] {
        let w = self.width as i32;
        let h = self.height as i32;
        let x0 = fx.floor() as i32;
        let y0 = fy.floor() as i32;
        let tx = fx - fx.floor();
        let ty = fy - fy.floor();

        let pixel = |xi: i32, yi: i32| -> [f64; 4] {
            let xi = xi.clamp(0, w - 1) as usize;
            let yi = yi.clamp(0, h - 1) as usize;
            let idx = (yi * self.width as usize + xi) * 4;
            [
                self.data[idx] as f64,
                self.data[idx + 1] as f64,
                self.data[idx + 2] as f64,
                self.data[idx + 3] as f64,
            ]
        };

        let [r00, g00, b00, a00] = pixel(x0, y0);
        let [r10, g10, b10, a10] = pixel(x0 + 1, y0);
        let [r01, g01, b01, a01] = pixel(x0, y0 + 1);
        let [r11, g11, b11, a11] = pixel(x0 + 1, y0 + 1);

        let lerp = |a: f64, b: f64, t: f64| a + (b - a) * t;
        let bi = |v00: f64, v10: f64, v01: f64, v11: f64| {
            lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty)
        };
        [
            bi(r00, r10, r01, r11).round().clamp(0.0, 255.0) as u8,
            bi(g00, g10, g01, g11).round().clamp(0.0, 255.0) as u8,
            bi(b00, b10, b01, b11).round().clamp(0.0, 255.0) as u8,
            bi(a00, a10, a01, a11).round().clamp(0.0, 255.0) as u8,
        ]
    }

    fn thumb_dims(w: u32, h: u32, max_px: u32) -> (u32, u32) {
        if w == 0 || h == 0 || max_px == 0 {
            return (1, 1);
        }
        let longest = w.max(h);
        if longest <= max_px {
            return (w, h);
        }
        let scale = max_px as f64 / longest as f64;
        let tw = ((w as f64 * scale).round() as u32).max(1);
        let th = ((h as f64 * scale).round() as u32).max(1);
        (tw, th)
    }

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
        if src_max_x < 0
            || src_min_x >= w
            || src_max_y < 0
            || src_min_y >= h
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
                let alpha = if norm <= self.hardness {
                    1.0
                } else {
                    let t =
                        (norm - self.hardness) / (1.0 - self.hardness + 1e-9);
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

#[wasm_bindgen]
impl CloneStampTool {
    pub fn thumbnail_width(&self, max_px: u32) -> u32 {
        Self::thumb_dims(self.width, self.height, max_px).0
    }

    pub fn thumbnail_height(&self, max_px: u32) -> u32 {
        Self::thumb_dims(self.width, self.height, max_px).1
    }

    pub fn thumbnail_data(&self, max_px: u32) -> Vec<u8> {
        let (tw, th) = Self::thumb_dims(self.width, self.height, max_px);
        let mut out = vec![0u8; (tw * th * 4) as usize];
        let sx = self.width as f64 / tw as f64;
        let sy = self.height as f64 / th as f64;
        for ty in 0..th {
            for tx in 0..tw {
                let fx = (tx as f64 + 0.5) * sx - 0.5;
                let fy = (ty as f64 + 0.5) * sy - 0.5;
                let [r, g, b, a] = self.sample_bilinear(fx, fy);
                let di = ((ty * tw + tx) * 4) as usize;
                out[di]     = r;
                out[di + 1] = g;
                out[di + 2] = b;
                out[di + 3] = a;
            }
        }
        out
    }

    pub fn copy_region(&self, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
        let mut out = vec![0u8; (w * h * 4) as usize];
        let sw = self.width as i32;
        let sh = self.height as i32;
        for ry in 0..h as i32 {
            for rx in 0..w as i32 {
                let sx = x + rx;
                let sy = y + ry;
                let di = ((ry * w as i32 + rx) * 4) as usize;
                if sx >= 0 && sx < sw && sy >= 0 && sy < sh {
                    let si = ((sy * sw + sx) * 4) as usize;
                    out[di..di + 4].copy_from_slice(&self.data[si..si + 4]);
                }
            }
        }
        out
    }

    pub fn paste_region(
        &mut self,
        pixels: &[u8],
        src_w: u32,
        src_h: u32,
        dest_x: i32,
        dest_y: i32,
    ) {
        if pixels.len() != (src_w * src_h * 4) as usize {
            return;
        }
        self.push_snapshot("Paste");
        let dw = self.width as i32;
        let dh = self.height as i32;
        for sy in 0..src_h as i32 {
            for sx in 0..src_w as i32 {
                let dx = dest_x + sx;
                let dy = dest_y + sy;
                if dx < 0 || dx >= dw || dy < 0 || dy >= dh {
                    continue;
                }
                let si = ((sy * src_w as i32 + sx) * 4) as usize;
                let di = ((dy * dw + dx) * 4) as usize;
                let sa = pixels[si + 3] as f64 / 255.0;
                let da = self.data[di + 3] as f64 / 255.0;
                let out_a = sa + da * (1.0 - sa);
                if out_a > 1e-6 {
                    for c in 0..3 {
                        let sv = pixels[si + c] as f64 / 255.0;
                        let dv = self.data[di + c] as f64 / 255.0;
                        let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
                        self.data[di + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
                    }
                }
                self.data[di + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
            }
        }
    }

    pub fn flip_horizontal(&mut self) {
        self.push_snapshot("Flip H");
        let w = self.width as usize;
        let h = self.height as usize;
        for y in 0..h {
            for x in 0..w / 2 {
                let a = (y * w + x) * 4;
                let b = (y * w + (w - 1 - x)) * 4;
                for c in 0..4 {
                    self.data.swap(a + c, b + c);
                }
            }
        }
        if let Some(sx) = self.source_x {
            self.source_x = Some(self.width as i32 - 1 - sx);
        }
    }

    pub fn flip_vertical(&mut self) {
        self.push_snapshot("Flip V");
        let w = self.width as usize;
        let h = self.height as usize;
        for y in 0..h / 2 {
            for x in 0..w {
                let a = (y * w + x) * 4;
                let b = ((h - 1 - y) * w + x) * 4;
                for c in 0..4 {
                    self.data.swap(a + c, b + c);
                }
            }
        }
        if let Some(sy) = self.source_y {
            self.source_y = Some(self.height as i32 - 1 - sy);
        }
    }

    pub fn rotate_90_cw(&mut self) {
        self.push_snapshot("Rotate 90°");
        let old_w = self.width as usize;
        let old_h = self.height as usize;
        let new_w = old_h;
        let new_h = old_w;
        let mut out = vec![0u8; new_w * new_h * 4];
        for oy in 0..old_h {
            for ox in 0..old_w {
                let si = (oy * old_w + ox) * 4;
                let nx = old_h - 1 - oy;
                let ny = ox;
                let di = (ny * new_w + nx) * 4;
                out[di..di + 4].copy_from_slice(&self.data[si..si + 4]);
            }
        }
        self.data   = out;
        self.width  = new_w as u32;
        self.height = new_h as u32;
        self.source_x = None;
        self.source_y = None;
    }

    pub fn adjust_brightness(&mut self, delta: f64) {
        self.push_snapshot("Brightness");
        let d = (delta.clamp(-1.0, 1.0) * 255.0).round() as i32;
        for i in (0..self.data.len()).step_by(4) {
            self.data[i]     = (self.data[i] as i32 + d).clamp(0, 255) as u8;
            self.data[i + 1] = (self.data[i + 1] as i32 + d).clamp(0, 255) as u8;
            self.data[i + 2] = (self.data[i + 2] as i32 + d).clamp(0, 255) as u8;
        }
    }

    pub fn adjust_contrast(&mut self, factor: f64) {
        self.push_snapshot("Contrast");
        let f = factor.clamp(0.0, 4.0);
        for i in (0..self.data.len()).step_by(4) {
            for c in 0..3 {
                let v = self.data[i + c] as f64 / 255.0;
                let adj = ((v - 0.5) * f + 0.5).clamp(0.0, 1.0);
                self.data[i + c] = (adj * 255.0).round() as u8;
            }
        }
    }
}