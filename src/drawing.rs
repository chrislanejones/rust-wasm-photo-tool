use std::f64::consts::PI;

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

fn fill_triangle(
    data: &mut [u8],
    w: i32, h: i32,
    p0: (f64, f64),
    p1: (f64, f64),
    p2: (f64, f64),
    color: [u8; 4],
) {
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

pub fn parse_hex_color(hex: &str) -> [u8; 4] {
    let hex = hex.trim_start_matches('#');
    if hex.len() < 6 { return [0, 0, 0, 255]; }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    [r, g, b, 255]
}

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
    draw_line_thick(data, wi, hi, start_x, start_y, end_x, end_y, color, stroke_width);
    let h1 = (
        to_x - head_length * (angle - head_width).cos(),
        to_y - head_length * (angle - head_width).sin(),
    );
    let h2 = (
        to_x - head_length * (angle + head_width).cos(),
        to_y - head_length * (angle + head_width).sin(),
    );
    fill_triangle(data, wi, hi, (to_x, to_y), h1, h2, color);
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
        // 0 = Rectangle
        0 => {
            let x0 = from_x.min(to_x);
            let y0 = from_y.min(to_y);
            let x1 = from_x.max(to_x);
            let y1 = from_y.max(to_y);
            draw_line_thick(data, wi, hi, x0, y0, x1, y0, color, stroke_width);
            draw_line_thick(data, wi, hi, x1, y0, x1, y1, color, stroke_width);
            draw_line_thick(data, wi, hi, x1, y1, x0, y1, color, stroke_width);
            draw_line_thick(data, wi, hi, x0, y1, x0, y0, color, stroke_width);
        }
        // 1 = Circle (clean)
        1 => {
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
        // 2 = Line
        2 => {
            draw_line_thick(data, wi, hi, from_x, from_y, to_x, to_y, color, stroke_width);
        }
        // 3 = Hand-drawn circle
        //
        // Ported from drawShape.ts handCircle case.
        // Uses sinusoidal noise for wobble, a slight random tilt,
        // a lead-in tail, and a main arc that's slightly less than
        // a full rotation — giving it a natural, sketched look.
        //
        // Since WASM has no Math.random(), we derive a seed from
        // the bounding box coordinates so each position produces
        // a unique but deterministic shape.
        3 => {
            draw_hand_circle(data, wi, hi, from_x, from_y, to_x, to_y, color, stroke_width);
        }
        _ => {}
    }
}

/* ------------------------------------------------------------------ */
/* Hand-drawn circle — shape 3                                         */
/* ------------------------------------------------------------------ */

/// Simple pseudo-random f64 in [0, 1) from a seed.
/// Uses a basic hash to get variety without pulling in a crate.
fn pseudo_rand(seed: f64) -> f64 {
    let bits = (seed * 1000.0 + 0.5).to_bits();
    let mixed = bits.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    (mixed >> 33) as f64 / (1u64 << 31) as f64
}

fn draw_hand_circle(
    data: &mut [u8],
    w: i32, h: i32,
    from_x: f64, from_y: f64,
    to_x: f64, to_y: f64,
    color: [u8; 4],
    stroke_width: f64,
) {
    let x = from_x.min(to_x);
    let y = from_y.min(to_y);
    let bw = (to_x - from_x).abs();
    let bh = (to_y - from_y).abs();
    if bw < 4.0 || bh < 4.0 { return; }

    let cx = x + bw / 2.0;
    let cy = y + bh / 2.0;
    let rx = bw / 2.0;
    let ry = bh / 2.0;

    // Deterministic seed from position
    let seed = from_x * 31.17 + from_y * 47.53 + to_x * 13.91 + to_y * 67.37;

    // Randomized parameters (deterministic from seed)
    let start_offset = pseudo_rand(seed) * PI * 2.0;
    let main_arc = PI * 2.0 - PI * (0.1 + pseudo_rand(seed + 1.0) * 0.15);
    let tilt = (pseudo_rand(seed + 2.0) - 0.5) * 0.15;
    let tail_length = PI * (0.2 + pseudo_rand(seed + 3.0) * 0.25);

    let num_points = 60usize;

    // Noise function — smooth sinusoidal wobble
    let noise = |angle: f64| -> f64 {
        (angle * 2.3 + seed).sin() * 3.0
            + (angle * 1.1 + seed * 0.7).sin() * 2.0
            + (angle * 3.7 + seed * 1.3).cos() * 1.5
    };

    // --- Generate tail points (lead-in before the circle starts) ---
    let tail_steps = 10usize;
    let mut tail_points: Vec<(f64, f64)> = Vec::with_capacity(tail_steps + 1);

    for i in 0..=tail_steps {
        let t = i as f64 / tail_steps as f64;
        let angle = start_offset - tail_length * (1.0 - t);
        let n = noise(angle) * t; // fade noise toward tip
        let squeeze = 1.0 + (angle * 2.0 + seed).sin() * 0.03;

        // Tail curves inward slightly
        let inward = (1.0 - t) * (rx * 0.15);
        let px = cx + (rx * squeeze - inward + n) * (angle + tilt).cos();
        let py = cy + (ry / squeeze - inward + n) * (angle + tilt).sin();
        tail_points.push((px, py));
    }

    // --- Generate main circle points ---
    let mut path_points: Vec<(f64, f64)> = Vec::with_capacity(num_points + 1);

    for i in 0..=num_points {
        let t = i as f64 / num_points as f64;
        let angle = start_offset + t * main_arc;

        let n = noise(angle);
        let squeeze = 1.0 + (angle * 2.0 + seed).sin() * 0.03;

        let px = cx + (rx * squeeze + n) * (angle + tilt).cos();
        let py = cy + (ry / squeeze + n) * (angle + tilt).sin();
        path_points.push((px, py));
    }

    // --- Draw tail segments ---
    for i in 1..tail_points.len() {
        let (x0, y0) = tail_points[i - 1];
        let (x1, y1) = tail_points[i];
        draw_line_thick(data, w, h, x0, y0, x1, y1, color, stroke_width);
    }

    // Connect tail end to circle start
    if let (Some(&tail_last), Some(&circle_first)) = (tail_points.last(), path_points.first()) {
        draw_line_thick(data, w, h, tail_last.0, tail_last.1, circle_first.0, circle_first.1, color, stroke_width);
    }

    // --- Draw main circle with smooth interpolation ---
    // Use midpoint averaging (like quadratic curves) for smoothness
    if path_points.len() >= 3 {
        for i in 0..path_points.len() - 2 {
            let (px, py) = path_points[i];
            let (nx, ny) = path_points[i + 1];
            // Midpoint between current and next
            let mx = (px + nx) / 2.0;
            let my = (py + ny) / 2.0;

            if i == 0 {
                draw_line_thick(data, w, h, px, py, mx, my, color, stroke_width);
            } else {
                // From previous midpoint to this midpoint through the control point
                let (ppx, ppy) = path_points[i - 1];
                let prev_mx = (ppx + px) / 2.0;
                let prev_my = (ppy + py) / 2.0;

                // Subdivide the quadratic curve segment for smoothness
                let sub_steps = 4;
                for s in 0..sub_steps {
                    let t0 = s as f64 / sub_steps as f64;
                    let t1 = (s + 1) as f64 / sub_steps as f64;

                    // Quadratic bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
                    let bx0 = (1.0 - t0) * (1.0 - t0) * prev_mx
                        + 2.0 * (1.0 - t0) * t0 * px
                        + t0 * t0 * mx;
                    let by0 = (1.0 - t0) * (1.0 - t0) * prev_my
                        + 2.0 * (1.0 - t0) * t0 * py
                        + t0 * t0 * my;
                    let bx1 = (1.0 - t1) * (1.0 - t1) * prev_mx
                        + 2.0 * (1.0 - t1) * t1 * px
                        + t1 * t1 * mx;
                    let by1 = (1.0 - t1) * (1.0 - t1) * prev_my
                        + 2.0 * (1.0 - t1) * t1 * py
                        + t1 * t1 * my;

                    draw_line_thick(data, w, h, bx0, by0, bx1, by1, color, stroke_width);
                }
            }
        }

        // Final segment to last point
        let len = path_points.len();
        let (sx, sy) = path_points[len - 2];
        let (ex, ey) = path_points[len - 1];
        let smx = (sx + ex) / 2.0;
        let smy = (sy + ey) / 2.0;
        draw_line_thick(data, w, h, smx, smy, ex, ey, color, stroke_width);
    }
}