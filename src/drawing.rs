// src/drawing.rs
// Arrow and shape rendering — operates directly on RGBA pixel buffer.
// These run in WASM so they're fast on large images.

use std::f64::consts::PI;

/// Draw a line between two points with given color and width (anti-aliased Bresenham).
fn draw_line_thick(
    data: &mut [u8],
    w: i32,
    h: i32,
    x0: f64, y0: f64,
    x1: f64, y1: f64,
    color: [u8; 4],
    width: f64,
) {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let dist = (dx * dx + dy * dy).sqrt();
    if dist < 0.5 { return; }

    let steps = (dist * 2.0).ceil() as i32;
    let half_w = width / 2.0;

    for i in 0..=steps {
        let t = i as f64 / steps as f64;
        let cx = x0 + dx * t;
        let cy = y0 + dy * t;

        // Fill a circle at each step point
        let min_x = ((cx - half_w).floor() as i32).max(0);
        let max_x = ((cx + half_w).ceil() as i32).min(w - 1);
        let min_y = ((cy - half_w).floor() as i32).max(0);
        let max_y = ((cy + half_w).ceil() as i32).min(h - 1);

        for py in min_y..=max_y {
            for px in min_x..=max_x {
                let ddx = px as f64 - cx;
                let ddy = py as f64 - cy;
                if ddx * ddx + ddy * ddy <= half_w * half_w {
                    let idx = ((py * w + px) * 4) as usize;
                    if idx + 3 < data.len() {
                        blend_pixel(data, idx, color);
                    }
                }
            }
        }
    }
}

/// Alpha-blend a pixel onto the buffer
fn blend_pixel(data: &mut [u8], idx: usize, color: [u8; 4]) {
    let sa = color[3] as f64 / 255.0;
    if sa < 0.001 { return; }
    let da = data[idx + 3] as f64 / 255.0;
    let out_a = sa + da * (1.0 - sa);
    if out_a > 0.001 {
        for c in 0..3 {
            let sv = color[c] as f64 / 255.0;
            let dv = data[idx + c] as f64 / 255.0;
            let ov = (sv * sa + dv * da * (1.0 - sa)) / out_a;
            data[idx + c] = (ov * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }
    data[idx + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
}

/// Fill a triangle (for arrowheads)
fn fill_triangle(
    data: &mut [u8],
    w: i32, h: i32,
    p0: (f64, f64),
    p1: (f64, f64),
    p2: (f64, f64),
    color: [u8; 4],
) {
    // Bounding box
    let min_x = (p0.0.min(p1.0).min(p2.0).floor() as i32).max(0);
    let max_x = (p0.0.max(p1.0).max(p2.0).ceil() as i32).min(w - 1);
    let min_y = (p0.1.min(p1.1).min(p2.1).floor() as i32).max(0);
    let max_y = (p0.1.max(p1.1).max(p2.1).ceil() as i32).min(h - 1);

    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let p = (px as f64 + 0.5, py as f64 + 0.5);
            if point_in_triangle(p, p0, p1, p2) {
                let idx = ((py * w + px) * 4) as usize;
                if idx + 3 < data.len() {
                    blend_pixel(data, idx, color);
                }
            }
        }
    }
}

fn point_in_triangle(p: (f64, f64), v0: (f64, f64), v1: (f64, f64), v2: (f64, f64)) -> bool {
    let d1 = sign(p, v0, v1);
    let d2 = sign(p, v1, v2);
    let d3 = sign(p, v2, v0);
    let has_neg = (d1 < 0.0) || (d2 < 0.0) || (d3 < 0.0);
    let has_pos = (d1 > 0.0) || (d2 > 0.0) || (d3 > 0.0);
    !(has_neg && has_pos)
}

fn sign(p1: (f64, f64), p2: (f64, f64), p3: (f64, f64)) -> f64 {
    (p1.0 - p3.0) * (p2.1 - p3.1) - (p2.0 - p3.0) * (p1.1 - p3.1)
}

/// Parse a CSS hex color like "#ef4444" → [r, g, b, 255]
pub fn parse_hex_color(hex: &str) -> [u8; 4] {
    let hex = hex.trim_start_matches('#');
    if hex.len() < 6 { return [0, 0, 0, 255]; }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    [r, g, b, 255]
}

/// Draw an arrow (single or double-headed) on the pixel buffer.
/// style: 0 = single, 1 = double
pub fn draw_arrow(
    data: &mut [u8],
    w: u32, h: u32,
    from_x: f64, from_y: f64,
    to_x: f64, to_y: f64,
    color: [u8; 4],
    stroke_width: f64,
    style: u32,
) {
    let wi = w as i32;
    let hi = h as i32;
    let head_length = (20.0f64).max(stroke_width * 3.0);
    let head_width = PI / 5.0;
    let angle = (to_y - from_y).atan2(to_x - from_x);

    // Shorten line so it doesn't poke through the arrowhead
    let end_x = to_x - head_length * 0.5 * angle.cos();
    let end_y = to_y - head_length * 0.5 * angle.sin();

    let (start_x, start_y) = if style == 1 {
        (
            from_x + head_length * 0.5 * angle.cos(),
            from_y + head_length * 0.5 * angle.sin(),
        )
    } else {
        (from_x, from_y)
    };

    // Draw shaft
    draw_line_thick(data, wi, hi, start_x, start_y, end_x, end_y, color, stroke_width);

    // Forward arrowhead
    let h1 = (
        to_x - head_length * (angle - head_width).cos(),
        to_y - head_length * (angle - head_width).sin(),
    );
    let h2 = (
        to_x - head_length * (angle + head_width).cos(),
        to_y - head_length * (angle + head_width).sin(),
    );
    fill_triangle(data, wi, hi, (to_x, to_y), h1, h2, color);

    // Backward arrowhead (double style)
    if style == 1 {
        let back_angle = angle + PI;
        let b1 = (
            from_x - head_length * (back_angle - head_width).cos(),
            from_y - head_length * (back_angle - head_width).sin(),
        );
        let b2 = (
            from_x - head_length * (back_angle + head_width).cos(),
            from_y - head_length * (back_angle + head_width).sin(),
        );
        fill_triangle(data, wi, hi, (from_x, from_y), b1, b2, color);
    }
}

/// Draw a shape on the pixel buffer.
/// shape: 0=rect, 1=circle, 2=line
pub fn draw_shape(
    data: &mut [u8],
    w: u32, h: u32,
    from_x: f64, from_y: f64,
    to_x: f64, to_y: f64,
    shape: u32,
    color: [u8; 4],
    stroke_width: f64,
) {
    let wi = w as i32;
    let hi = h as i32;

    match shape {
        0 => {
            // Rectangle — four lines
            let x0 = from_x.min(to_x);
            let y0 = from_y.min(to_y);
            let x1 = from_x.max(to_x);
            let y1 = from_y.max(to_y);
            draw_line_thick(data, wi, hi, x0, y0, x1, y0, color, stroke_width); // top
            draw_line_thick(data, wi, hi, x1, y0, x1, y1, color, stroke_width); // right
            draw_line_thick(data, wi, hi, x1, y1, x0, y1, color, stroke_width); // bottom
            draw_line_thick(data, wi, hi, x0, y1, x0, y0, color, stroke_width); // left
        }
        1 => {
            // Circle
            let cx = (from_x + to_x) / 2.0;
            let cy = (from_y + to_y) / 2.0;
            let rw = (to_x - from_x).abs() / 2.0;
            let rh = (to_y - from_y).abs() / 2.0;
            let r = rw.min(rh);
            let segments = (r * 4.0).max(60.0) as i32;
            for i in 0..segments {
                let a0 = 2.0 * PI * (i as f64) / (segments as f64);
                let a1 = 2.0 * PI * ((i + 1) as f64) / (segments as f64);
                let x0 = cx + r * a0.cos();
                let y0 = cy + r * a0.sin();
                let x1 = cx + r * a1.cos();
                let y1 = cy + r * a1.sin();
                draw_line_thick(data, wi, hi, x0, y0, x1, y1, color, stroke_width);
            }
        }
        2 => {
            // Line
            draw_line_thick(data, wi, hi, from_x, from_y, to_x, to_y, color, stroke_width);
        }
        _ => {}
    }
}