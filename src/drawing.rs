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

/// Anti-aliased filled disc (Porter-Duff source-over). Used for numbered
/// callout pins.
pub fn fill_circle(
    data: &mut [u8],
    w: u32, h: u32,
    cx: f64, cy: f64,
    radius: f64,
    color: [u8; 4],
) {
    let wi = w as i32;
    let hi = h as i32;
    let r = radius.max(0.0);
    let min_x = ((cx - r - 1.0).floor() as i32).max(0);
    let max_x = ((cx + r + 1.0).ceil() as i32).min(wi - 1);
    let min_y = ((cy - r - 1.0).floor() as i32).max(0);
    let max_y = ((cy + r + 1.0).ceil() as i32).min(hi - 1);
    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let dx = px as f64 + 0.5 - cx;
            let dy = py as f64 + 0.5 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let cov = if dist <= r - 0.5 { 1.0 }
                      else if dist >= r + 0.5 { 0.0 }
                      else { (r + 0.5 - dist).clamp(0.0, 1.0) };
            if cov <= 0.0 { continue; }
            let idx = ((py * wi + px) * 4) as usize;
            if idx + 3 >= data.len() { continue; }
            let mut c = color;
            c[3] = (color[3] as f64 * cov).round().clamp(0.0, 255.0) as u8;
            blend_pixel(data, idx, c);
        }
    }
}

/// Scanline even-odd fill of an arbitrary (possibly concave) closed polygon
/// given as a point list — used to fill the interior of a flattened Bézier pen
/// path. Source-over blended; the boundary is left to the stroke on top.
pub fn fill_polygon(data: &mut [u8], w: u32, h: u32, points: &[(f64, f64)], color: [u8; 4]) {
    if points.len() < 3 || color[3] == 0 {
        return;
    }
    let wi = w as i32;
    let hi = h as i32;
    let mut min_y = f64::MAX;
    let mut max_y = f64::MIN;
    for &(_, y) in points {
        min_y = min_y.min(y);
        max_y = max_y.max(y);
    }
    let y0 = (min_y.floor() as i32).max(0);
    let y1 = (max_y.ceil() as i32).min(hi - 1);
    let n = points.len();
    let mut xs: Vec<f64> = Vec::new();
    for y in y0..=y1 {
        let yc = y as f64 + 0.5;
        xs.clear();
        for i in 0..n {
            let (xi, yi) = points[i];
            let (xj, yj) = points[(i + 1) % n];
            if (yi <= yc && yj > yc) || (yj <= yc && yi > yc) {
                let t = (yc - yi) / (yj - yi);
                xs.push(xi + t * (xj - xi));
            }
        }
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let mut k = 0;
        while k + 1 < xs.len() {
            let xa = (xs[k].ceil() as i32).max(0);
            let xb = (xs[k + 1].floor() as i32).min(wi - 1);
            for x in xa..=xb {
                let idx = ((y * wi + x) * 4) as usize;
                if idx + 3 < data.len() {
                    blend_pixel(data, idx, color);
                }
            }
            k += 2;
        }
    }
}

/// Freehand/polyline pen: thick round-capped segments between consecutive
/// vertices. A single point renders as a dot.
pub fn draw_polyline(
    data: &mut [u8],
    w: u32, h: u32,
    points: &[(f64, f64)],
    color: [u8; 4],
    width: f64,
) {
    if points.is_empty() { return; }
    if points.len() == 1 {
        fill_circle(data, w, h, points[0].0, points[0].1, (width / 2.0).max(0.5), color);
        return;
    }
    let wi = w as i32;
    let hi = h as i32;
    for p in points.windows(2) {
        draw_line_thick(data, wi, hi, p[0].0, p[0].1, p[1].0, p[1].1, color, width);
    }
}

/// Flatten a cubic Bézier path given as a flat control sequence
/// `[a0, c0_out, c1_in, a1, c1_out, c2_in, a2, …]` into a polyline ready for
/// `draw_polyline`. Each `(anchor, out, in, anchor)` quad is one cubic segment;
/// corner anchors simply have their handles coincide with the anchor point.
/// Step count adapts to the control-polygon length so long curves stay smooth.
pub fn flatten_cubic_path(ctrl: &[(f64, f64)]) -> Vec<(f64, f64)> {
    if ctrl.len() < 4 {
        return ctrl.to_vec();
    }
    let mut out = Vec::with_capacity(ctrl.len() * 12);
    out.push(ctrl[0]);
    let mut i = 0;
    while i + 3 < ctrl.len() {
        let (p0, p1, p2, p3) = (ctrl[i], ctrl[i + 1], ctrl[i + 2], ctrl[i + 3]);
        let approx = pt_dist(p0, p1) + pt_dist(p1, p2) + pt_dist(p2, p3);
        let steps = ((approx / 3.0) as usize).clamp(8, 256);
        for s in 1..=steps {
            let t = s as f64 / steps as f64;
            out.push(cubic_point(p0, p1, p2, p3, t));
        }
        i += 3;
    }
    out
}

fn pt_dist(a: (f64, f64), b: (f64, f64)) -> f64 {
    let dx = a.0 - b.0;
    let dy = a.1 - b.1;
    (dx * dx + dy * dy).sqrt()
}

/// Cubic Bézier point at parameter `t` (de Casteljau weights).
fn cubic_point(
    p0: (f64, f64),
    p1: (f64, f64),
    p2: (f64, f64),
    p3: (f64, f64),
    t: f64,
) -> (f64, f64) {
    let u = 1.0 - t;
    let (w0, w1, w2, w3) = (u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t);
    (
        w0 * p0.0 + w1 * p1.0 + w2 * p2.0 + w3 * p3.0,
        w0 * p0.1 + w1 * p1.1 + w2 * p2.1 + w3 * p3.1,
    )
}

/// Public filled rounded-rect helper. Renders into an RGBA buffer of size
/// (w*h*4) with Porter-Duff source-over blending. Approximates rounded
/// corners by composing a centre rectangle, two edge strips, plus four
/// filled quarter-disks at the corners. The corners use a per-pixel
/// distance test so they are anti-aliased to about ±0.5 px.
///
/// Coordinates are inclusive of `x0,y0` and exclusive of `x1,y1`
/// (i.e. rect width = x1-x0, height = y1-y0).
#[allow(dead_code)]
pub fn fill_rounded_rect(
    out: &mut [u8],
    w: u32, h: u32,
    x0: i32, y0: i32,
    x1: i32, y1: i32,
    radius: u32,
    r: u8, g: u8, b: u8, a: u8,
) {
    let wi = w as i32;
    let hi = h as i32;
    let x0c = x0.max(0);
    let y0c = y0.max(0);
    let x1c = x1.min(wi);
    let y1c = y1.min(hi);
    if x0c >= x1c || y0c >= y1c { return; }

    let rw = (x1 - x0).max(0) as u32;
    let rh = (y1 - y0).max(0) as u32;
    let max_r = (rw.min(rh) / 2).max(0);
    let rad = radius.min(max_r);
    let radf = rad as f64;

    let color = [r, g, b, a];
    for py in y0c..y1c {
        for px in x0c..x1c {
            // Distance from the nearest "rounded" corner anchor.
            let lx = (x0 + rad as i32) as f64;
            let rx = (x1 - rad as i32 - 1) as f64;
            let ty = (y0 + rad as i32) as f64;
            let by = (y1 - rad as i32 - 1) as f64;
            let dx = if (px as f64) < lx { (px as f64) - lx }
                     else if (px as f64) > rx { (px as f64) - rx }
                     else { 0.0 };
            let dy = if (py as f64) < ty { (py as f64) - ty }
                     else if (py as f64) > by { (py as f64) - by }
                     else { 0.0 };
            let dist = (dx * dx + dy * dy).sqrt();
            let cov = if rad == 0 {
                1.0
            } else if dist <= radf - 0.5 {
                1.0
            } else if dist >= radf + 0.5 {
                0.0
            } else {
                (radf + 0.5 - dist).clamp(0.0, 1.0)
            };
            if cov <= 0.0 { continue; }
            let idx = ((py * wi + px) * 4) as usize;
            if idx + 3 >= out.len() { continue; }
            let mut c = color;
            c[3] = (a as f64 * cov).round().clamp(0.0, 255.0) as u8;
            blend_pixel(out, idx, c);
        }
    }
}

/// Accumulate anti-aliased rounded-rect coverage into a single-channel mask
/// (`cov[i]` in 0..=1), taking the max with any existing coverage. Used to
/// build the union of the bubble body + tail so the fill is composited ONCE —
/// no seam where the shapes meet, and translucent fills don't double up in the
/// overlap. Mirrors the AA math in `fill_rounded_rect`.
pub fn rounded_rect_coverage(
    cov: &mut [f32],
    w: u32, h: u32,
    x0: i32, y0: i32,
    x1: i32, y1: i32,
    radius: u32,
) {
    let wi = w as i32;
    let hi = h as i32;
    let x0c = x0.max(0);
    let y0c = y0.max(0);
    let x1c = x1.min(wi);
    let y1c = y1.min(hi);
    if x0c >= x1c || y0c >= y1c { return; }

    let rw = (x1 - x0).max(0) as u32;
    let rh = (y1 - y0).max(0) as u32;
    let max_r = rw.min(rh) / 2;
    let rad = radius.min(max_r);
    let radf = rad as f64;

    let lx = (x0 + rad as i32) as f64;
    let rx = (x1 - rad as i32 - 1) as f64;
    let ty = (y0 + rad as i32) as f64;
    let by = (y1 - rad as i32 - 1) as f64;

    for py in y0c..y1c {
        for px in x0c..x1c {
            let dx = if (px as f64) < lx { (px as f64) - lx }
                     else if (px as f64) > rx { (px as f64) - rx }
                     else { 0.0 };
            let dy = if (py as f64) < ty { (py as f64) - ty }
                     else if (py as f64) > by { (py as f64) - by }
                     else { 0.0 };
            let dist = (dx * dx + dy * dy).sqrt();
            let c = if rad == 0 {
                1.0
            } else if dist <= radf - 0.5 {
                1.0
            } else if dist >= radf + 0.5 {
                0.0
            } else {
                (radf + 0.5 - dist).clamp(0.0, 1.0)
            };
            if c <= 0.0 { continue; }
            let cf = c as f32;
            let i = (py * wi + px) as usize;
            if i < cov.len() && cf > cov[i] { cov[i] = cf; }
        }
    }
}

/// Accumulate a (hard-edged) filled triangle into a coverage mask. Used for the
/// speech-bubble tail so it unions with the body before a single composite.
pub fn triangle_coverage(
    cov: &mut [f32],
    w: i32, h: i32,
    p0: (f64, f64),
    p1: (f64, f64),
    p2: (f64, f64),
) {
    let min_x = (p0.0.min(p1.0).min(p2.0).floor() as i32).max(0);
    let max_x = (p0.0.max(p1.0).max(p2.0).ceil() as i32).min(w - 1);
    let min_y = (p0.1.min(p1.1).min(p2.1).floor() as i32).max(0);
    let max_y = (p0.1.max(p1.1).max(p2.1).ceil() as i32).min(h - 1);
    for py in min_y..=max_y {
        for px in min_x..=max_x {
            let p = (px as f64 + 0.5, py as f64 + 0.5);
            if point_in_triangle(p, p0, p1, p2) {
                let i = (py * w + px) as usize;
                if i < cov.len() { cov[i] = 1.0; }
            }
        }
    }
}

/// Composite a flat color into `out` using a coverage mask, once per pixel.
pub fn blend_coverage(
    out: &mut [u8],
    cov: &[f32],
    r: u8, g: u8, b: u8, a: u8,
) {
    for (i, &c) in cov.iter().enumerate() {
        let c = c.clamp(0.0, 1.0);
        if c <= 0.0 { continue; }
        let idx = i * 4;
        if idx + 3 >= out.len() { continue; }
        let col = [r, g, b, (a as f32 * c).round().clamp(0.0, 255.0) as u8];
        blend_pixel(out, idx, col);
    }
}

/// Public filled triangle helper (Porter-Duff source-over blend) for the
/// speech-bubble tail.
#[allow(dead_code)]
pub fn fill_triangle_public(
    out: &mut [u8],
    w: u32, h: u32,
    p1: (f64, f64),
    p2: (f64, f64),
    p3: (f64, f64),
    r: u8, g: u8, b: u8, a: u8,
) {
    fill_triangle(out, w as i32, h as i32, p1, p2, p3, [r, g, b, a]);
}

fn blend_pixel(data: &mut [u8], idx: usize, color: [u8; 4]) {
    // Straight-alpha source-over in pure integer math — no f32 / ÷255.0 round
    // trip (this runs per pixel across every draw + fill loop). Kept in an ×255
    // domain so there's no intermediate rounding (matches the old f32 result
    // within ±1). With sa,da in 0..=255:
    //   dst_w     = da·(255−sa)          (dest's surviving weight, ×255)
    //   out_a×255 = sa·255 + dst_w
    //   out_c     = (src·sa·255 + dst·dst_w) / (out_a×255)
    let sa = color[3] as u32;
    if sa == 0 {
        return;
    }
    let da = data[idx + 3] as u32;
    let dst_w = da * (255 - sa);
    let out_a_hi = sa * 255 + dst_w;
    if out_a_hi > 0 {
        let half = out_a_hi / 2;
        for c in 0..3 {
            let num = color[c] as u32 * sa * 255 + data[idx + c] as u32 * dst_w;
            data[idx + c] = ((num + half) / out_a_hi) as u8;
        }
    }
    data[idx + 3] = ((out_a_hi + 127) / 255) as u8;
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

/// Per-channel linear interpolation of two straight-alpha RGBA colours.
fn lerp_rgba(a: [u8; 4], b: [u8; 4], t: f64) -> [u8; 4] {
    let l = |x: u8, y: u8| (x as f64 + (y as f64 - x as f64) * t).round().clamp(0.0, 255.0) as u8;
    [l(a[0], b[0]), l(a[1], b[1]), l(a[2], b[2]), l(a[3], b[3])]
}

/// Fill the interior of a rectangle (`shape == 0`) or circle (`shape == 1`)
/// defined by the bbox (x0,y0)-(x1,y1). `fill_kind`: 1 = solid `c0`, 2 = linear
/// gradient `c0`→`c1` along `angle_deg` (0 = left→right, 90 = top→bottom),
/// 3 = pixelate/mosaic the underlying pixels in `block`×`block` cells.
/// Composited source-over (1/2) or overwritten (3); the caller draws the stroke
/// on top afterwards.
pub fn fill_shape(
    data: &mut [u8],
    w: u32, h: u32,
    shape: u8,
    x0: f64, y0: f64, x1: f64, y1: f64,
    fill_kind: u8,
    c0: [u8; 4], c1: [u8; 4],
    angle_deg: u16,
    fill_block: u32,
) {
    let wi = w as i32;
    let hi = h as i32;
    let minx = x0.min(x1);
    let maxx = x0.max(x1);
    let miny = y0.min(y1);
    let maxy = y0.max(y1);
    let cx = (minx + maxx) * 0.5;
    let cy = (miny + maxy) * 0.5;
    // Circle radius matches draw_shape's clean circle: min of the half-extents.
    let radius = ((maxx - minx) * 0.5).min((maxy - miny) * 0.5);

    let px0 = (minx.floor() as i32).max(0);
    let py0 = (miny.floor() as i32).max(0);
    let px1 = (maxx.ceil() as i32).min(wi - 1);
    let py1 = (maxy.ceil() as i32).min(hi - 1);
    if px0 > px1 || py0 > py1 { return; }

    // Pixelate/mosaic fill: average grid-aligned cells of the pixels already in
    // `data` (this layer + earlier-rendered shapes) and overwrite them, clipped
    // to the shape. Block size falls back to 16 and is clamped to 2..=128.
    if fill_kind == 3 {
        let block = (if fill_block == 0 { 16 } else { fill_block.clamp(2, 128) }) as i32;
        let mut by = (py0 / block) * block;
        while by <= py1 {
            let mut bx = (px0 / block) * block;
            while bx <= px1 {
                let cx0 = bx.max(0);
                let cy0 = by.max(0);
                let cx1 = (bx + block - 1).min(wi - 1);
                let cy1 = (by + block - 1).min(hi - 1);
                let (mut sr, mut sg, mut sb, mut sa, mut n) = (0u64, 0u64, 0u64, 0u64, 0u64);
                for yy in cy0..=cy1 {
                    for xx in cx0..=cx1 {
                        let i = ((yy * wi + xx) * 4) as usize;
                        sr += data[i] as u64;
                        sg += data[i + 1] as u64;
                        sb += data[i + 2] as u64;
                        sa += data[i + 3] as u64;
                        n += 1;
                    }
                }
                if n > 0 {
                    let avg = [(sr / n) as u8, (sg / n) as u8, (sb / n) as u8, (sa / n) as u8];
                    for yy in cy0..=cy1 {
                        for xx in cx0..=cx1 {
                            if xx < px0 || xx > px1 || yy < py0 || yy > py1 { continue; }
                            if shape == 1 {
                                let dx = xx as f64 + 0.5 - cx;
                                let dy = yy as f64 + 0.5 - cy;
                                if (dx * dx + dy * dy).sqrt() > radius { continue; }
                            }
                            let i = ((yy * wi + xx) * 4) as usize;
                            data[i..i + 4].copy_from_slice(&avg);
                        }
                    }
                }
                bx += block;
            }
            by += block;
        }
        return;
    }

    // Gradient axis: project pixel centres onto the unit direction and
    // normalise against the bbox's projected span so t spans 0..1 edge-to-edge.
    let ang = (angle_deg as f64) * PI / 180.0;
    let (ax, ay) = (ang.cos(), ang.sin());
    let proj = |x: f64, y: f64| x * ax + y * ay;
    let corners = [(minx, miny), (maxx, miny), (minx, maxy), (maxx, maxy)];
    let mut pmin = f64::INFINITY;
    let mut pmax = f64::NEG_INFINITY;
    for &(x, y) in &corners {
        let p = proj(x, y);
        pmin = pmin.min(p);
        pmax = pmax.max(p);
    }
    let span = (pmax - pmin).max(1e-6);

    for py in py0..=py1 {
        for px in px0..=px1 {
            let fx = px as f64 + 0.5;
            let fy = py as f64 + 0.5;
            if shape == 1 {
                let dx = fx - cx;
                let dy = fy - cy;
                if (dx * dx + dy * dy).sqrt() > radius { continue; }
            }
            let col = if fill_kind == 2 {
                let t = ((proj(fx, fy) - pmin) / span).clamp(0.0, 1.0);
                lerp_rgba(c0, c1, t)
            } else {
                c0
            };
            let idx = ((py * wi + px) * 4) as usize;
            blend_pixel(data, idx, col);
        }
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