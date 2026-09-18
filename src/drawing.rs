use std::f64::consts::PI;

fn draw_line_thick(
    data: &mut [u8],
    w: i32,
    h: i32,
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
    color: [u8; 4],
    width: f64,
) {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let dist = (dx * dx + dy * dy).sqrt();
    if dist < 0.5 {
        return;
    }
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
pub fn fill_circle(data: &mut [u8], w: u32, h: u32, cx: f64, cy: f64, radius: f64, color: [u8; 4]) {
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
            let cov = if dist <= r - 0.5 {
                1.0
            } else if dist >= r + 0.5 {
                0.0
            } else {
                (r + 0.5 - dist).clamp(0.0, 1.0)
            };
            if cov <= 0.0 {
                continue;
            }
            let idx = ((py * wi + px) * 4) as usize;
            if idx + 3 >= data.len() {
                continue;
            }
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
    w: u32,
    h: u32,
    points: &[(f64, f64)],
    color: [u8; 4],
    width: f64,
) {
    if points.is_empty() {
        return;
    }
    if points.len() == 1 {
        fill_circle(
            data,
            w,
            h,
            points[0].0,
            points[0].1,
            (width / 2.0).max(0.5),
            color,
        );
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

/// Accumulate anti-aliased rounded-rect coverage into a single-channel mask
/// (`cov[i]` in 0..=1), taking the max with any existing coverage. Used to
/// build the union of the bubble body + tail so the fill is composited ONCE —
/// no seam where the shapes meet, and translucent fills don't double up in the
/// overlap.
pub fn rounded_rect_coverage(
    cov: &mut [f32],
    w: u32,
    h: u32,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    radius: u32,
) {
    let wi = w as i32;
    let hi = h as i32;
    let x0c = x0.max(0);
    let y0c = y0.max(0);
    let x1c = x1.min(wi);
    let y1c = y1.min(hi);
    if x0c >= x1c || y0c >= y1c {
        return;
    }

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
            let dx = if (px as f64) < lx {
                (px as f64) - lx
            } else if (px as f64) > rx {
                (px as f64) - rx
            } else {
                0.0
            };
            let dy = if (py as f64) < ty {
                (py as f64) - ty
            } else if (py as f64) > by {
                (py as f64) - by
            } else {
                0.0
            };
            let dist = (dx * dx + dy * dy).sqrt();
            let c = if rad == 0 || dist <= radf - 0.5 {
                1.0
            } else if dist >= radf + 0.5 {
                0.0
            } else {
                (radf + 0.5 - dist).clamp(0.0, 1.0)
            };
            if c <= 0.0 {
                continue;
            }
            let cf = c as f32;
            let i = (py * wi + px) as usize;
            if i < cov.len() && cf > cov[i] {
                cov[i] = cf;
            }
        }
    }
}

/// Accumulate a (hard-edged) filled triangle into a coverage mask. Used for the
/// speech-bubble tail so it unions with the body before a single composite.
pub fn triangle_coverage(
    cov: &mut [f32],
    w: i32,
    h: i32,
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
                if i < cov.len() {
                    cov[i] = 1.0;
                }
            }
        }
    }
}

/// Composite a flat color into `out` using a coverage mask, once per pixel.
pub fn blend_coverage(out: &mut [u8], cov: &[f32], r: u8, g: u8, b: u8, a: u8) {
    for (i, &c) in cov.iter().enumerate() {
        let c = c.clamp(0.0, 1.0);
        if c <= 0.0 {
            continue;
        }
        let idx = i * 4;
        if idx + 3 >= out.len() {
            continue;
        }
        let col = [r, g, b, (a as f32 * c).round().clamp(0.0, 255.0) as u8];
        blend_pixel(out, idx, col);
    }
}

/// In-place separable box blur on a single-channel f32 coverage buffer. Run
/// twice it approximates a Gaussian — used for soft drop shadows on text tiles.
pub fn box_blur_f32(buf: &mut [f32], w: u32, h: u32, radius: u32) {
    if radius == 0 || w == 0 || h == 0 {
        return;
    }
    let (w, h, r) = (w as usize, h as usize, radius as usize);
    let mut tmp = vec![0f32; buf.len()];
    // Horizontal pass.
    for y in 0..h {
        let row = y * w;
        for x in 0..w {
            let x0 = x.saturating_sub(r);
            let x1 = (x + r).min(w - 1);
            let mut sum = 0f32;
            for v in &buf[row + x0..=row + x1] {
                sum += v;
            }
            tmp[row + x] = sum / (x1 - x0 + 1) as f32;
        }
    }
    // Vertical pass.
    for x in 0..w {
        for y in 0..h {
            let y0 = y.saturating_sub(r);
            let y1 = (y + r).min(h - 1);
            let mut sum = 0f32;
            for yy in y0..=y1 {
                sum += tmp[yy * w + x];
            }
            buf[y * w + x] = sum / (y1 - y0 + 1) as f32;
        }
    }
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
    w: i32,
    h: i32,
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
    if hex.len() < 6 {
        return [0, 0, 0, 255];
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    [r, g, b, 255]
}

pub fn draw_arrow(
    data: &mut [u8],
    w: u32,
    h: u32,
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
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
    draw_line_thick(
        data,
        wi,
        hi,
        start_x,
        start_y,
        end_x,
        end_y,
        color,
        stroke_width,
    );
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

/// Per-channel linear interpolation of two straight-alpha RGBA colors.
fn lerp_rgba(a: [u8; 4], b: [u8; 4], t: f64) -> [u8; 4] {
    let l = |x: u8, y: u8| {
        (x as f64 + (y as f64 - x as f64) * t)
            .round()
            .clamp(0.0, 255.0) as u8
    };
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
    w: u32,
    h: u32,
    shape: u8,
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
    fill_kind: u8,
    c0: [u8; 4],
    c1: [u8; 4],
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
    if px0 > px1 || py0 > py1 {
        return;
    }

    // Pixelate/mosaic fill: average grid-aligned cells of the pixels already in
    // `data` (this layer + earlier-rendered shapes) and overwrite them, clipped
    // to the shape. Block size falls back to 16 and is clamped to 2..=128.
    if fill_kind == 3 {
        let block = (if fill_block == 0 {
            16
        } else {
            fill_block.clamp(2, 128)
        }) as i32;
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
                // checked_div folds the `n != 0` guard into the division so an
                // empty cell is skipped (clippy::manual_checked_ops).
                if let (Some(r), Some(g), Some(b), Some(a)) = (
                    sr.checked_div(n),
                    sg.checked_div(n),
                    sb.checked_div(n),
                    sa.checked_div(n),
                ) {
                    let avg = [r as u8, g as u8, b as u8, a as u8];
                    for yy in cy0..=cy1 {
                        for xx in cx0..=cx1 {
                            if xx < px0 || xx > px1 || yy < py0 || yy > py1 {
                                continue;
                            }
                            if shape == 1 {
                                let dx = xx as f64 + 0.5 - cx;
                                let dy = yy as f64 + 0.5 - cy;
                                if (dx * dx + dy * dy).sqrt() > radius {
                                    continue;
                                }
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

    // Gradient axis: project pixel centers onto the unit direction and
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
                if (dx * dx + dy * dy).sqrt() > radius {
                    continue;
                }
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

/// A rotation about a pivot, exactly as SVG's `rotate(θ cx cy)` applies it on
/// a y-down canvas: positive θ turns CLOCKWISE on screen.
///
/// ```text
/// x' = cx + (x-cx)·cosθ − (y-cy)·sinθ
/// y' = cy + (x-cx)·sinθ + (y-cy)·cosθ
/// ```
///
/// Built once per shape per composite (one `sin`/`cos` pair), then applied to
/// every outline point — no allocation of its own.
#[derive(Clone, Copy, Debug)]
pub struct Rotation {
    cos: f64,
    sin: f64,
    cx: f64,
    cy: f64,
}

impl Rotation {
    /// `deg` about the center of the bbox `(x0,y0)-(x1,y1)`. `None` for 0° and
    /// for a non-finite angle — "no rotation" is the absence of a transform,
    /// which is what keeps every unrotated shape on its pre-rotation code path
    /// byte for byte.
    ///
    /// Radians are `deg * PI / 180`, written in that order on purpose: it is
    /// the JS spelling (`deg * Math.PI / 180`), and `f64::to_radians` rounds
    /// differently (`deg * (PI / 180)`).
    pub fn about_bbox_center(deg: f64, x0: f64, y0: f64, x1: f64, y1: f64) -> Option<Self> {
        if deg == 0.0 || !deg.is_finite() {
            return None;
        }
        let t = deg * PI / 180.0;
        Some(Rotation {
            cos: t.cos(),
            sin: t.sin(),
            cx: (x0 + x1) / 2.0,
            cy: (y0 + y1) / 2.0,
        })
    }

    /// Rotate one point about the pivot.
    #[inline]
    pub fn apply(&self, (x, y): (f64, f64)) -> (f64, f64) {
        let dx = x - self.cx;
        let dy = y - self.cy;
        (
            self.cx + dx * self.cos - dy * self.sin,
            self.cy + dx * self.sin + dy * self.cos,
        )
    }
}

/// Rasterize one of the bbox-defined shapes.
///
/// `star_points` is the EFFECTIVE count for a star (kind 9) — the caller maps
/// the stored "0 = classic" to 5; other kinds ignore it. `rot` rotates the
/// OUTLINE of the rect (0), line (2), diamond (8), star (9) and triangle (10):
/// the outline is built exactly as it would be unrotated — the sketch wobble
/// included, seeded from the UNROTATED endpoints — and only then are its points
/// turned about the bbox center. That is also how the frontend previews it (the
/// unrotated path inside an SVG `rotate()`), so the wobble matches. Circle (1)
/// and hand-circle (3) ignore `rot`; the fills are the caller's business.
pub fn draw_shape(
    data: &mut [u8],
    w: u32,
    h: u32,
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
    shape: u32,
    color: [u8; 4],
    stroke_width: f64,
    sloppiness: f64,
    star_points: u32,
    rot: Option<Rotation>,
) {
    let wi = w as i32;
    let hi = h as i32;
    let seed = shape_wobble_seed(from_x, from_y, to_x, to_y);
    match shape {
        // 0 = Rectangle
        0 => {
            let x0 = from_x.min(to_x);
            let y0 = from_y.min(to_y);
            let x1 = from_x.max(to_x);
            let y1 = from_y.max(to_y);
            draw_outline(
                data,
                w,
                h,
                &[(x0, y0), (x1, y0), (x1, y1), (x0, y1)],
                true,
                seed,
                color,
                stroke_width,
                sloppiness,
                rot,
            );
        }
        // 1 = Circle (clean) or sketchy (sloppiness > 0)
        1 => {
            let cx = (from_x + to_x) / 2.0;
            let cy = (from_y + to_y) / 2.0;
            let rw = (to_x - from_x).abs() / 2.0;
            let rh = (to_y - from_y).abs() / 2.0;
            let r = rw.min(rh);
            // `r >= 2.0` matches the old "bbox at least 4 px" guard, but it now
            // FALLS THROUGH to the clean arc instead of drawing nothing — a
            // sub-4-px circle used to vanish the moment sloppiness left 0.
            if sloppiness > 0.0 && r >= 2.0 {
                draw_sloppy_circle(
                    data,
                    wi,
                    hi,
                    from_x,
                    from_y,
                    to_x,
                    to_y,
                    color,
                    stroke_width,
                    sloppiness,
                );
            } else {
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
        }
        // 2 = Line
        2 => {
            draw_outline(
                data,
                w,
                h,
                &[(from_x, from_y), (to_x, to_y)],
                false,
                seed,
                color,
                stroke_width,
                sloppiness,
                rot,
            );
        }
        // 3 = Hand-drawn circle (legacy — superseded by sloppiness on a plain
        // circle, kept so old documents with kind 3 still render identically)
        3 => {
            draw_hand_circle(
                data,
                wi,
                hi,
                from_x,
                from_y,
                to_x,
                to_y,
                color,
                stroke_width,
            );
        }
        // 8 = Diamond, 9 = Star, 10 = Triangle — closed polygons, stroked
        // alike (no fill: fills stay rect/circle only).
        8..=10 => {
            let verts = match shape {
                8 => diamond_vertices(from_x, from_y, to_x, to_y),
                9 => star_vertices_n(from_x, from_y, to_x, to_y, star_points),
                _ => triangle_vertices(from_x, from_y, to_x, to_y),
            };
            draw_outline(
                data,
                w,
                h,
                &verts,
                true,
                seed,
                color,
                stroke_width,
                sloppiness,
                rot,
            );
        }
        _ => {}
    }
}

/// Stroke an outline given as its clean vertices: straight thick segments, or
/// the sketchy polyline when `sloppiness` > 0. `closed` adds the last→first
/// edge. With `rot`, the finished points — wobble and all — are turned about
/// the pivot just before they are drawn.
///
/// With `rot == None` this issues exactly the calls the pre-rotation rect,
/// line, diamond and star branches issued, in the same order, so an unrotated
/// shape's pixels are unchanged (pinned by `tests/shape_rotation.rs`). The
/// rotated clean path rotates each segment's endpoints on the fly rather than
/// collecting them, and the sketchy path rotates the polyline it already owns
/// in place — neither allocates anything the unrotated path does not.
fn draw_outline(
    data: &mut [u8],
    w: u32,
    h: u32,
    verts: &[(f64, f64)],
    closed: bool,
    seed: f64,
    color: [u8; 4],
    stroke_width: f64,
    sloppiness: f64,
    rot: Option<Rotation>,
) {
    if sloppiness > 0.0 {
        let mut pts = sloppy_polyline_points(verts, seed, sloppiness, stroke_width, closed);
        if let Some(r) = rot {
            for p in pts.iter_mut() {
                *p = r.apply(*p);
            }
        }
        draw_polyline(data, w, h, &pts, color, stroke_width);
    } else {
        let n = verts.len();
        let edges = if closed { n } else { n.saturating_sub(1) };
        for i in 0..edges {
            let (mut a, mut b) = (verts[i], verts[(i + 1) % n]);
            if let Some(r) = rot {
                a = r.apply(a);
                b = r.apply(b);
            }
            draw_line_thick(
                data,
                w as i32,
                h as i32,
                a.0,
                a.1,
                b.0,
                b.1,
                color,
                stroke_width,
            );
        }
    }
}

/// Diamond vertices filling the drag bbox — (cx, top), (right, cy),
/// (cx, bottom), (left, cy). Mirrored by hand in drawShapePreview /
/// sloppyShapePath (CanvasArea).
pub fn diamond_vertices(x0: f64, y0: f64, x1: f64, y1: f64) -> Vec<(f64, f64)> {
    let minx = x0.min(x1);
    let maxx = x0.max(x1);
    let miny = y0.min(y1);
    let maxy = y0.max(y1);
    let cx = (minx + maxx) * 0.5;
    let cy = (miny + maxy) * 0.5;
    vec![(cx, miny), (maxx, cy), (cx, maxy), (minx, cy)]
}

/// n-pointed star vertices filling the drag bbox (it replaced the five-point
/// `star_vertices`, which is now `n = 5` — bit for bit, pinned by
/// `five_points_is_the_old_star_bit_for_bit` against the old body verbatim):
/// `2n` of them, n outer tips
/// at even indices and n inner valleys at odd indices, `180/n`° apart,
/// starting at 12 o'clock — `a = -PI/2 + i*PI/n`. Outer radii are the bbox
/// half-extents (an elliptical star on a non-square drag); inner is 0.5×.
///
/// The angle is spelled `i * PI / n` (multiply, THEN divide) because that is
/// how the five-point original spelled `i * PI / 5`; reassociating it would
/// move the classic star's vertices by an ulp and its pixels with them.
///
/// `n` is the EFFECTIVE count (callers map the stored 0 to 5 and clamp to
/// 3..=12); it is floored at 1 here only so a stray 0 cannot divide by zero.
/// Mirrored by hand in `starVerticesN` (shapeSloppiness.ts).
pub fn star_vertices_n(x0: f64, y0: f64, x1: f64, y1: f64, n: u32) -> Vec<(f64, f64)> {
    let n = n.max(1);
    let minx = x0.min(x1);
    let maxx = x0.max(x1);
    let miny = y0.min(y1);
    let maxy = y0.max(y1);
    let cx = (minx + maxx) * 0.5;
    let cy = (miny + maxy) * 0.5;
    let orx = (maxx - minx) * 0.5;
    let ory = (maxy - miny) * 0.5;
    let irx = orx * 0.5;
    let iry = ory * 0.5;
    let nf = n as f64;
    let mut verts = Vec::with_capacity(2 * n as usize);
    for i in 0..2 * n {
        let (rx, ry) = if i % 2 == 0 { (orx, ory) } else { (irx, iry) };
        let a = -PI / 2.0 + i as f64 * PI / nf;
        verts.push((cx + rx * a.cos(), cy + ry * a.sin()));
    }
    verts
}

/// Isosceles triangle filling the drag bbox, apex up: `(cx, top)`,
/// `(right, bottom)`, `(left, bottom)`. Mirrored by hand in
/// `triangleVertices` (shapeSloppiness.ts).
pub fn triangle_vertices(x0: f64, y0: f64, x1: f64, y1: f64) -> Vec<(f64, f64)> {
    let minx = x0.min(x1);
    let maxx = x0.max(x1);
    let miny = y0.min(y1);
    let maxy = y0.max(y1);
    let cx = (minx + maxx) * 0.5;
    vec![(cx, miny), (maxx, maxy), (minx, maxy)]
}

/* ------------------------------------------------------------------ */
/* Sloppiness — the hand-drawn stroke engine                           */
/* ------------------------------------------------------------------ */

/// Deterministic seed for a shape's sketch wobble — derived from the drag
/// endpoints so the same shape always redraws identically (WASM has no
/// Math.random, and the preview/overlay/raster layers must agree pixel-for-
/// pixel). Mirrored by hand in `shapeWobbleSeed` (useDrawingTools).
fn shape_wobble_seed(x0: f64, y0: f64, x1: f64, y1: f64) -> f64 {
    x0 * 31.17 + y0 * 47.53 + x1 * 13.91 + y1 * 67.37
}

/// Smooth pseudo-random "hair" noise in ≈[-1, 1] — a sum of sines with
/// incommensurate frequencies, so consecutive points along a stroke get fresh
/// but continuous values. Mirrored by hand in `hairNoise` (useDrawingTools).
fn hair_noise(p: f64, seed: f64) -> f64 {
    (p * 2.3 + seed).sin() * 0.5
        + (p * 1.1 + seed * 0.7).sin() * 0.3
        + (p * 3.7 + seed * 1.3).cos() * 0.2
}

/* --- the sloppiness curve ------------------------------------------------ */
/* Every constant below is reachable across the 0..=100 slider, and every
 * feature scales from EXACTLY zero, so sloppiness 1 renders the firm shape and
 * the `if sloppiness > 0.0` branches in `draw_shape` are an optimization
 * rather than a change of behavior. The previous curve had constant floors
 * (a 0.05π circle gap, a lead-in tail, a tilt, a squeeze) that switched on
 * whole at the first non-zero value, so a shape was either computer-drawn or
 * hand-drawn with nothing in between. */

/// Full-strength wobble as a fraction of the shape's bounding-box diagonal.
const WOBBLE_FRAC: f64 = 0.020;
/// Floor on the wobble, in stroke widths — a wobble narrower than the pen
/// cannot be seen. Binds on small shapes and fat pens (the width slider is
/// 1..=10 IMAGE px, so this reaches up to a ~550 px diagonal).
const WOBBLE_MIN_STROKES: f64 = 1.10;
/// Ceiling on the wobble, as a fraction of the diagonal, so a fat pen on a
/// small shape stays a shape. Binds below a ~147 px diagonal at width 10.
const WOBBLE_MAX_FRAC: f64 = 0.075;
/// Per-edge bow at full strength, as a fraction of the edge's length.
const BOW_FRAC: f64 = 0.050;
/// How far past its corner an edge may run, in wobble-amplitudes. Signed by
/// the noise, so some corners overshoot and some fall short.
const CORNER_RUN: f64 = 3.0;
/// …but never more than this fraction of the edge, which keeps a star's short
/// inner edges from running into each other.
const CORNER_RUN_MAX: f64 = 0.12;
/// Share of the wobble that survives at a vertex. Below 1 the middle of an
/// edge roams furthest, which is how a hand actually draws a straight line.
const CORNER_HOLD: f64 = 0.35;

/// The 0..=100 slider as a 0..=1 sketch strength, eased so the middle of the
/// travel is a visibly intermediate amount of hand-drawn-ness rather than
/// "on, but small": 25 → 0.35, 50 → 0.59, 100 → 1.
///
/// The ease is `s^0.75`, written as `sqrt(s) * sqrt(sqrt(s))` on purpose.
/// IEEE-754 requires `sqrt` to be correctly rounded, so Rust and JS agree
/// bit-for-bit; `powf`/`Math.pow` carry no such guarantee and would let the
/// preview drift from the committed pixels. `.max(0.0)` also launders NaN
/// (`f64::max` returns the non-NaN operand), so a junk value draws firm
/// instead of NaN coordinates.
///
/// Mirrored by hand in `sketchStrength` (shapeSloppiness.ts).
fn sketch_strength(sloppiness: f64) -> f64 {
    // NOT `clamp`: clippy's own note says "clamp returns NaN if the input is
    // NaN", and NaN here becomes NaN coordinates across the WASM boundary.
    // `f64::max` returns the non-NaN operand, so junk lands on 0.0 = firm.
    #[allow(clippy::manual_clamp)]
    let s = (sloppiness / 100.0).max(0.0).min(1.0);
    let r = s.sqrt();
    r * r.sqrt()
}

/// How far, in image pixels, a full-strength wobble moves the pen.
///
/// The wobble is RELATIVE to the shape, not an absolute pixel count. Image
/// Horse draws in IMAGE pixels while the user sees the image scaled to fit,
/// so a fixed pixel count renders differently on every photo: the old 5.5 px
/// cap was ~2 screen px on a 1385 px-wide image shown at 461 px, and would be
/// a wild scribble on a 300 px thumbnail. A fraction of the shape is what the
/// eye actually reads, and it is what the hand does — tremor is a share of
/// what you are drawing, not a count of pixels.
///
/// Mirrored by hand in `wobbleAmp` (shapeSloppiness.ts).
fn wobble_amp(diag: f64, stroke_width: f64, strength: f64) -> f64 {
    // .max() then .min() (never `clamp`) — `f64::clamp` PANICS when the
    // computed floor exceeds the computed ceiling, and this crosses the WASM
    // boundary.
    let base = (diag * WOBBLE_FRAC).max(stroke_width * WOBBLE_MIN_STROKES);
    base.min(diag * WOBBLE_MAX_FRAC) * strength
}

/// Bounding-box diagonal of a point list — the shape's own scale, which is
/// what the wobble is measured against. Mirrored in `pointsDiag`.
fn points_diag(pts: &[(f64, f64)]) -> f64 {
    let mut minx = f64::INFINITY;
    let mut maxx = f64::NEG_INFINITY;
    let mut miny = f64::INFINITY;
    let mut maxy = f64::NEG_INFINITY;
    for &(x, y) in pts {
        minx = minx.min(x);
        maxx = maxx.max(x);
        miny = miny.min(y);
        maxy = maxy.max(y);
    }
    let dx = maxx - minx;
    let dy = maxy - miny;
    (dx * dx + dy * dy).sqrt().max(1e-6)
}

/// Turn the clean vertices of a shape's outline into a sketchy polyline.
/// Works per-edge: each edge is subdivided and its points are pushed sideways
/// (perpendicular to the edge) by `hair_noise` scaled by the wobble amplitude,
/// plus a gentle per-edge "bow", plus a signed overrun so the pen slides past
/// some corners and stops short of others. `closed` wraps the last edge back
/// to the first vertex.
///
/// Every one of those terms is multiplied by the sketch strength, so as
/// sloppiness approaches 0 the output converges on the clean vertices (with
/// collinear subdivision points, which rasterize identically) and clean shapes
/// pay nothing.
///
/// Mirrored by hand — `sloppyPolylinePoints` (shapeSloppiness.ts) — so the
/// canvas preview and the committed pixels are the same path.
fn sloppy_polyline_points(
    pts: &[(f64, f64)],
    seed: f64,
    sloppiness: f64,
    stroke_width: f64,
    closed: bool,
) -> Vec<(f64, f64)> {
    let strength = sketch_strength(sloppiness);
    if strength <= 0.0 || pts.len() < 2 {
        return pts.to_vec();
    }
    let amp = wobble_amp(points_diag(pts), stroke_width, strength);
    let bow = BOW_FRAC * strength;
    let n = if closed { pts.len() } else { pts.len() - 1 };
    let mut out: Vec<(f64, f64)> = Vec::with_capacity(n * 12);
    let mut phase = seed * 0.31;
    for e in 0..n {
        let (ax, ay) = pts[e];
        let (bx, by) = pts[(e + 1) % pts.len()];
        let dx = bx - ax;
        let dy = by - ay;
        let len = (dx * dx + dy * dy).sqrt().max(1e-6);
        let steps = ((len / 6.0).ceil() as usize).clamp(6, 24);
        let ux = dx / len;
        let uy = dy / len;
        let px = -uy;
        let py = ux;
        let bow_amt = bow * len * hair_noise(phase, seed);
        // Signed corner overrun, as a share of the edge. Proportional to `amp`,
        // so it vanishes with everything else at sloppiness 0.
        let run = amp * CORNER_RUN / len;
        let t0 = -(run * hair_noise(phase + 0.7, seed)).clamp(-CORNER_RUN_MAX, CORNER_RUN_MAX);
        let t1 = 1.0 + (run * hair_noise(phase + 2.9, seed)).clamp(-CORNER_RUN_MAX, CORNER_RUN_MAX);
        for i in 0..=steps {
            let t = t0 + (t1 - t0) * (i as f64 / steps as f64);
            // Clamped at 0 so the overrun tails past a vertex keep the corner
            // offset instead of flipping sign.
            let fade = (t * (1.0 - t) * 4.0).max(0.0);
            let nv = hair_noise(phase * 1.7 + t * 3.1, seed);
            let off = nv * amp * (CORNER_HOLD + (1.0 - CORNER_HOLD) * fade) + bow_amt * fade;
            out.push((ax + dx * t + px * off, ay + dy * t + py * off));
        }
        phase += 1.3;
    }
    if out.is_empty() {
        out.push(pts[0]);
    }
    out
}

/// Widest the ends may miss each other by, at full strength.
const CIRCLE_GAP: f64 = 0.30;
/// Lead-in tail at full strength: a fixed part plus a seeded part, in turns.
const CIRCLE_TAIL: f64 = 0.18;
const CIRCLE_TAIL_RAND: f64 = 0.24;
/// How far the whole circle may lean at full strength, in radians.
const CIRCLE_TILT: f64 = 0.22;
/// How far out of round the circle may go at full strength.
const CIRCLE_SQUEEZE: f64 = 0.05;

/// Sketchy circle — the "fin documents" look: a wobbly ring whose ends do NOT
/// quite meet, plus a short lead-in tail. At the top of the range it matches
/// the character of the retired `draw_hand_circle` (kind 3); at the bottom it
/// converges on the clean arc `draw_shape` draws at sloppiness 0.
///
/// Two things here used to be wrong, and both of them were the step Chris saw:
///
///  * It drew the bbox ELLIPSE (`rx = bw/2`, `ry = bh/2`) while the clean
///    branch — and the interior fill, and the SVG preview — all use a CIRCLE of
///    `min(bw, bh) / 2`. On any non-square drag the outline changed shape and
///    size the instant the slider left 0, and the fill no longer sat under it.
///  * The gap, tail, tilt and squeeze all had constant floors, so they arrived
///    whole at sloppiness 1. They are multiplied by the strength now.
///
/// Mirrored by hand in `sloppyCirclePoints` (shapeSloppiness.ts).
fn draw_sloppy_circle(
    data: &mut [u8],
    w: i32,
    h: i32,
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
    color: [u8; 4],
    stroke_width: f64,
    sloppiness: f64,
) {
    let x = from_x.min(to_x);
    let y = from_y.min(to_y);
    let bw = (to_x - from_x).abs();
    let bh = (to_y - from_y).abs();
    let cx = x + bw / 2.0;
    let cy = y + bh / 2.0;
    // The SAME circle the clean branch and `fill_shape` use.
    let r = bw.min(bh) / 2.0;
    let seed = shape_wobble_seed(from_x, from_y, to_x, to_y);
    let strength = sketch_strength(sloppiness);
    let diag = (bw * bw + bh * bh).sqrt().max(1e-6);
    let amp = wobble_amp(diag, stroke_width, strength);
    let start_offset = pseudo_rand(seed) * 2.0 * PI;
    let gap = PI * CIRCLE_GAP * strength;
    let main_arc = 2.0 * PI - gap;
    let tilt = (pseudo_rand(seed + 2.0) - 0.5) * CIRCLE_TILT * strength;
    let tail_len = PI * (CIRCLE_TAIL + pseudo_rand(seed + 3.0) * CIRCLE_TAIL_RAND) * strength;
    let squeeze_amt = CIRCLE_SQUEEZE * strength;

    // `hair_noise` is the same three incommensurate frequencies the inline
    // closure here used, already normalized to a peak of 1, so `amp` means
    // what it says and the polyline and the circle wobble by the same amount.
    let noise = |angle: f64| -> f64 { hair_noise(angle, seed) * amp };

    // Segment count tracks the radius the way the clean branch does; a fixed
    // 60 showed its corners on a big circle, which was one more way the
    // outline changed the moment the slider left 0.
    let num_points = ((r * 4.0).ceil() as usize).clamp(60, 480);
    // Lead-in tail (fades to a point at its tip).
    let tail_steps = 10usize;
    let mut path: Vec<(f64, f64)> = Vec::with_capacity(tail_steps + num_points + 2);
    for i in 0..=tail_steps {
        let t = i as f64 / tail_steps as f64;
        let angle = start_offset - tail_len * (1.0 - t);
        let n = noise(angle) * t;
        let squeeze = 1.0 + (angle * 2.0 + seed).sin() * squeeze_amt;
        let inward = (1.0 - t) * (r * 0.15) * strength;
        let px = cx + (r * squeeze - inward + n) * (angle + tilt).cos();
        let py = cy + (r / squeeze - inward + n) * (angle + tilt).sin();
        path.push((px, py));
    }
    // Main arc — stops shy of a full turn so the ends visibly miss each other.
    for i in 0..=num_points {
        let t = i as f64 / num_points as f64;
        let angle = start_offset + t * main_arc;
        let n = noise(angle);
        let squeeze = 1.0 + (angle * 2.0 + seed).sin() * squeeze_amt;
        let px = cx + (r * squeeze + n) * (angle + tilt).cos();
        let py = cy + (r / squeeze + n) * (angle + tilt).sin();
        path.push((px, py));
    }
    draw_polyline(data, w as u32, h as u32, &path, color, stroke_width);
}

/* ------------------------------------------------------------------ */
/* Hand-drawn circle — shape 3                                         */
/* ------------------------------------------------------------------ */

/// Simple pseudo-random f64 in [0, 1) from a seed.
/// Uses a basic hash to get variety without pulling in a crate.
fn pseudo_rand(seed: f64) -> f64 {
    let bits = (seed * 1000.0 + 0.5).to_bits();
    let mixed = bits
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    (mixed >> 33) as f64 / (1u64 << 31) as f64
}

fn draw_hand_circle(
    data: &mut [u8],
    w: i32,
    h: i32,
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
    color: [u8; 4],
    stroke_width: f64,
) {
    let x = from_x.min(to_x);
    let y = from_y.min(to_y);
    let bw = (to_x - from_x).abs();
    let bh = (to_y - from_y).abs();
    if bw < 4.0 || bh < 4.0 {
        return;
    }

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
        draw_line_thick(
            data,
            w,
            h,
            tail_last.0,
            tail_last.1,
            circle_first.0,
            circle_first.1,
            color,
            stroke_width,
        );
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

#[cfg(test)]
mod geometry_tests {
    use super::*;

    /// `star_vertices` exactly as it stood before the point count existed —
    /// kept here, verbatim, as the reference the five-point case must match.
    /// The frontend's vitest pins the same ten vertices on its side.
    fn legacy_star_vertices(x0: f64, y0: f64, x1: f64, y1: f64) -> Vec<(f64, f64)> {
        let minx = x0.min(x1);
        let maxx = x0.max(x1);
        let miny = y0.min(y1);
        let maxy = y0.max(y1);
        let cx = (minx + maxx) * 0.5;
        let cy = (miny + maxy) * 0.5;
        let orx = (maxx - minx) * 0.5;
        let ory = (maxy - miny) * 0.5;
        let irx = orx * 0.5;
        let iry = ory * 0.5;
        let mut verts = Vec::with_capacity(10);
        for i in 0..10 {
            let (rx, ry) = if i % 2 == 0 { (orx, ory) } else { (irx, iry) };
            let a = -PI / 2.0 + i as f64 * PI / 5.0;
            verts.push((cx + rx * a.cos(), cy + ry * a.sin()));
        }
        verts
    }

    #[test]
    fn five_points_is_the_old_star_bit_for_bit() {
        for bbox in [
            (0.0, 0.0, 100.0, 100.0),
            (14.0, 10.0, 78.0, 66.0),
            (78.0, 66.0, 14.0, 10.0), // dragged up-left
            (3.25, 7.5, 3.75, 191.125),
        ] {
            let (x0, y0, x1, y1) = bbox;
            let old = legacy_star_vertices(x0, y0, x1, y1);
            let new = star_vertices_n(x0, y0, x1, y1, 5);
            assert_eq!(old.len(), 10);
            // Bits, not approximate equality: the vitest and the pixel hashes
            // both depend on the SAME doubles.
            let bits = |v: &[(f64, f64)]| -> Vec<(u64, u64)> {
                v.iter().map(|p| (p.0.to_bits(), p.1.to_bits())).collect()
            };
            assert_eq!(bits(&old), bits(&new), "bbox {bbox:?}");
        }
    }

    #[test]
    fn an_n_pointed_star_has_2n_vertices_tips_on_even_indices() {
        for n in 3..=12u32 {
            let v = star_vertices_n(0.0, 0.0, 100.0, 60.0, n);
            assert_eq!(v.len(), 2 * n as usize, "n = {n}");
            // The first tip is at 12 o'clock on the bbox top edge.
            assert!(
                (v[0].0 - 50.0).abs() < 1e-9 && v[0].1.abs() < 1e-9,
                "{:?}",
                v[0]
            );
            // Tips sit on the outer ellipse, valleys on the half-size one.
            for (i, &(x, y)) in v.iter().enumerate() {
                let e = ((x - 50.0) / 50.0).powi(2) + ((y - 30.0) / 30.0).powi(2);
                let want = if i % 2 == 0 { 1.0 } else { 0.25 };
                assert!((e - want).abs() < 1e-9, "n={n} i={i} e={e}");
            }
        }
        let seven = star_vertices_n(10.0, 10.0, 90.0, 90.0, 7);
        assert_eq!(seven.len(), 14, "a seven-point star has fourteen vertices");
    }

    #[test]
    fn a_zero_point_count_cannot_divide_by_zero() {
        let v = star_vertices_n(0.0, 0.0, 10.0, 10.0, 0);
        assert!(v.iter().all(|p| p.0.is_finite() && p.1.is_finite()));
    }

    #[test]
    fn the_triangle_is_isosceles_apex_up_and_fills_the_box() {
        assert_eq!(
            triangle_vertices(10.0, 20.0, 50.0, 80.0),
            vec![(30.0, 20.0), (50.0, 80.0), (10.0, 80.0)]
        );
        // Drag direction does not matter — the bbox is normalized first.
        assert_eq!(
            triangle_vertices(50.0, 80.0, 10.0, 20.0),
            triangle_vertices(10.0, 20.0, 50.0, 80.0)
        );
    }

    /// The sketch wobble is built from the UNROTATED outline — seeded from the
    /// unrotated endpoints — and only its finished points are turned. That is
    /// what the frontend does (the unrotated path inside an SVG `rotate()`),
    /// and it is why turning a sketchy shape does not re-roll its wobble.
    #[test]
    fn a_sketchy_rotated_outline_is_the_unrotated_wobble_turned() {
        let (w, h) = (96u32, 80u32);
        let (x0, y0, x1, y1) = (14.0, 10.0, 78.0, 66.0);
        let color = [200, 30, 30, 255];
        for kind in [0u32, 2, 8, 9, 10] {
            let rot = Rotation::about_bbox_center(33.0, x0, y0, x1, y1).unwrap(); // allow: rust-panic
            let mut got = vec![0u8; (w * h * 4) as usize];
            draw_shape(
                &mut got,
                w,
                h,
                x0,
                y0,
                x1,
                y1,
                kind,
                color,
                3.0,
                70.0,
                7,
                Some(rot),
            );

            let (verts, closed) = match kind {
                0 => (vec![(x0, y0), (x1, y0), (x1, y1), (x0, y1)], true),
                2 => (vec![(x0, y0), (x1, y1)], false),
                8 => (diamond_vertices(x0, y0, x1, y1), true),
                9 => (star_vertices_n(x0, y0, x1, y1, 7), true),
                _ => (triangle_vertices(x0, y0, x1, y1), true),
            };
            let seed = shape_wobble_seed(x0, y0, x1, y1);
            let turned: Vec<_> = sloppy_polyline_points(&verts, seed, 70.0, 3.0, closed)
                .into_iter()
                .map(|p| rot.apply(p))
                .collect();
            let mut want = vec![0u8; (w * h * 4) as usize];
            draw_polyline(&mut want, w, h, &turned, color, 3.0);
            assert!(got == want, "kind {kind}");
        }
    }

    #[test]
    fn rotation_matches_the_svg_rotate_formula() {
        // 90° clockwise on a y-down canvas: right of center goes to below it.
        let r = Rotation::about_bbox_center(90.0, 0.0, 0.0, 20.0, 20.0).unwrap(); // allow: rust-panic
        let (x, y) = r.apply((20.0, 10.0));
        assert!(
            (x - 10.0).abs() < 1e-9 && (y - 20.0).abs() < 1e-9,
            "({x}, {y})"
        );
        assert!(Rotation::about_bbox_center(0.0, 0.0, 0.0, 1.0, 1.0).is_none());
        assert!(Rotation::about_bbox_center(f64::NAN, 0.0, 0.0, 1.0, 1.0).is_none());
    }
}
