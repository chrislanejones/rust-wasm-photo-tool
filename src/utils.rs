//! Small shared leaf helpers (JSON escaping, point math, label/ink helpers).
//! Pure functions with no `ImageHorseTool` dependency; pulled out of `lib.rs`
//! so the hot paths that use them live next to the engine, not the god object.

/// Escape a string as a JSON string body (without surrounding quotes).
pub(crate) fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out
}
/// Flat [x0,y0,x1,y1,…] → Vec<(x,y)>.
pub(crate) fn flat_to_points(flat: &[f64]) -> Vec<(f64, f64)> {
    flat.chunks_exact(2).map(|c| (c[0], c[1])).collect()
}
/// Axis-aligned bounding box of a point list as (minx,miny,maxx,maxy).
pub(crate) fn points_bbox(pts: &[(f64, f64)]) -> (f64, f64, f64, f64) {
    if pts.is_empty() {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let (mut minx, mut miny) = pts[0];
    let (mut maxx, mut maxy) = pts[0];
    for &(x, y) in pts {
        minx = minx.min(x); maxx = maxx.max(x);
        miny = miny.min(y); maxy = maxy.max(y);
    }
    (minx, miny, maxx, maxy)
}
/// Euclidean distance from point (px,py) to the segment (ax,ay)-(bx,by).
/// Used for hit-testing line/arrow annotations.
pub(crate) fn point_segment_distance(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let dx = bx - ax;
    let dy = by - ay;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-6 {
        return ((px - ax).powi(2) + (py - ay).powi(2)).sqrt();
    }
    let t = (((px - ax) * dx + (py - ay) * dy) / len_sq).clamp(0.0, 1.0);
    let cx = ax + t * dx;
    let cy = ay + t * dy;
    ((px - cx).powi(2) + (py - cy).powi(2)).sqrt()
}
/// A pin's drawn label: `number` as a digit string (kind 0) or as a
/// spreadsheet-style letter sequence (kind 1): 1→A … 26→Z, 27→AA, 28→AB…
pub(crate) fn pin_label(number: u32, label_kind: u8) -> String {
    if label_kind != 1 {
        return number.to_string();
    }
    if number == 0 {
        return "?".to_string();
    }
    let mut n = number;
    let mut chars = Vec::new();
    while n > 0 {
        n -= 1;
        chars.push((b'A' + (n % 26) as u8) as char);
        n /= 26;
    }
    chars.iter().rev().collect()
}
/// Tight ink bounding box (min_x, min_y, max_x, max_y inclusive) of a rendered
/// RGBA tile — the extent of pixels with non-trivial alpha. Used to centre a
/// glyph by its *visual* mass rather than its padded line box, so a single
/// digit or letter lands dead-centre on the pin disc.
pub(crate) fn ink_bounds(pixels: &[u8], w: u32, h: u32) -> Option<(u32, u32, u32, u32)> {
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (w, h, 0u32, 0u32);
    let mut found = false;
    for y in 0..h {
        for x in 0..w {
            let a = pixels[((y * w + x) * 4 + 3) as usize];
            if a > 16 {
                found = true;
                if x < min_x { min_x = x; }
                if y < min_y { min_y = y; }
                if x > max_x { max_x = x; }
                if y > max_y { max_y = y; }
            }
        }
    }
    if found { Some((min_x, min_y, max_x, max_y)) } else { None }
}
