//! Projective (perspective) transforms — the homography solver and the
//! inverse-map resampler behind the Perspective tool.
//!
//! WHY A HOMOGRAPHY AND NOT A 2×3 AFFINE. Affine maps parallelograms to
//! parallelograms: it can shear and scale but it cannot make the far edge of
//! a plane shorter than the near edge, which is the whole point of the tool.
//! The projective map has two extra terms (`h6`, `h7` — the perspective
//! divide) and that is exactly what converts a rectangle into an arbitrary
//! convex quadrilateral.
//!
//! WHY THE SOLVE RUNS IN THE dst→src DIRECTION. Resampling is always done by
//! walking DESTINATION pixels and asking "where did this come from?" — the
//! forward direction leaves holes wherever the map expands. That normally
//! means solving src→dst and then inverting a 3×3. We skip the inversion
//! entirely by handing the solver the correspondences the other way round:
//! [`Homography::rect_from_quad`] returns the map that takes a point in the
//! warped quad straight back to a point in the source rectangle. One solve,
//! no matrix inverse, no second source of numerical error.
//!
//! This module is pure geometry over `&[u8]` RGBA — it holds no engine state
//! and allocates only its output buffer, the same contract `transform.rs` and
//! `text::rotate_pixels` keep.

/// A 3×3 projective transform in row-major order, normalised so `m[8] == 1`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Homography {
    m: [f64; 9],
}

/// Four corners, in the fixed order **top-left, top-right, bottom-right,
/// bottom-left** (clockwise from the top-left in screen coords, y-down).
///
/// Every consumer — the op log, the JSON the overlay reads, the drag rules in
/// `lib/perspective.ts` — uses this same winding. It is not derived anywhere;
/// it is a convention, so it is stated once here and never re-decided.
pub type Quad = [(f64, f64); 4];

/// The identity quad in NORMALISED space: the unit square.
///
/// Corners are stored normalised (0..1 across the tile) rather than in pixels
/// — see [`warp_normalised`] for why that is what makes the transform survive
/// a text edit.
pub const IDENTITY_QUAD: [(f32, f32); 4] = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)];

/// True when a quad is the identity (no perspective applied). Compared with a
/// small epsilon rather than `==` because the value makes a round trip through
/// f32 storage and a JS `number`, and an exact bit-compare on a dragged-back-
/// to-the-corner handle would keep a no-op warp alive forever.
pub fn is_identity(q: &[(f32, f32); 4]) -> bool {
    q.iter()
        .zip(IDENTITY_QUAD.iter())
        .all(|(a, b)| (a.0 - b.0).abs() < 1e-4 && (a.1 - b.1).abs() < 1e-4)
}

impl Homography {
    /// Solve the projective map taking `src[i]` to `dst[i]` for all four
    /// corners. Returns `None` when the correspondence is degenerate — three
    /// collinear points, a collapsed edge, or anything else that makes the 8×8
    /// system singular.
    ///
    /// The system is the standard DLT arrangement: with `h8` pinned to 1, each
    /// correspondence contributes two rows,
    ///
    /// ```text
    ///   h0·x + h1·y + h2                 − h6·x·u − h7·y·u = u
    ///                   h3·x + h4·y + h5 − h6·x·v − h7·y·v = v
    /// ```
    ///
    /// which is 8 equations in 8 unknowns — solved directly by Gaussian
    /// elimination with partial pivoting. No iteration, no least-squares: four
    /// corners is exactly determined, so an exact solve is both cheaper and
    /// more accurate than the general-case machinery.
    pub fn from_correspondences(src: &Quad, dst: &Quad) -> Option<Self> {
        let mut a = [[0.0f64; 9]; 8]; // 8 rows, 8 coefficients + RHS
        for i in 0..4 {
            let (x, y) = src[i];
            let (u, v) = dst[i];
            let r = i * 2;
            a[r] = [x, y, 1.0, 0.0, 0.0, 0.0, -x * u, -y * u, u];
            a[r + 1] = [0.0, 0.0, 0.0, x, y, 1.0, -x * v, -y * v, v];
        }

        // Gaussian elimination with partial pivoting.
        for col in 0..8 {
            // Pick the row with the largest magnitude in this column. Without
            // the pivot a quad with an axis-aligned edge (extremely common —
            // every quad starts as a rectangle) puts a structural zero on the
            // diagonal and the solve divides by it.
            let mut piv = col;
            for r in (col + 1)..8 {
                if a[r][col].abs() > a[piv][col].abs() {
                    piv = r;
                }
            }
            if a[piv][col].abs() < 1e-12 {
                return None; // singular — degenerate quad
            }
            a.swap(col, piv);

            let d = a[col][col];
            for v in a[col].iter_mut().skip(col) {
                *v /= d;
            }
            // Copied, not borrowed: eliminating row `r` reads the pivot row
            // while writing `r`, and `[f64; 9]` is `Copy` so taking it by value
            // is a register-sized move rather than a borrow-checker fight.
            let pivot = a[col];
            for (r, row) in a.iter_mut().enumerate() {
                if r == col {
                    continue;
                }
                let f = row[col];
                if f == 0.0 {
                    continue;
                }
                for (v, p) in row.iter_mut().zip(pivot.iter()).skip(col) {
                    *v -= f * p;
                }
            }
        }

        let mut m = [0.0f64; 9];
        for (i, row) in a.iter().enumerate() {
            m[i] = row[8];
        }
        m[8] = 1.0;
        if m.iter().any(|v| !v.is_finite()) {
            return None;
        }
        Some(Homography { m })
    }

    /// The map from a point inside `quad` back to a point inside the axis-
    /// aligned rectangle `(0,0)..(w,h)` — i.e. the inverse map the resampler
    /// wants, obtained by solving in that direction rather than by inverting.
    pub fn rect_from_quad(quad: &Quad, w: f64, h: f64) -> Option<Self> {
        let rect: Quad = [(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)];
        Self::from_correspondences(quad, &rect)
    }

    /// Apply the transform to a point. Returns `None` when the point lands on
    /// the horizon (the projective divide goes to zero), which is where a
    /// too-extreme quad sends pixels off to infinity.
    pub fn apply(&self, x: f64, y: f64) -> Option<(f64, f64)> {
        let m = &self.m;
        let d = m[6] * x + m[7] * y + m[8];
        if d.abs() < 1e-12 {
            return None;
        }
        Some((
            (m[0] * x + m[1] * y + m[2]) / d,
            (m[3] * x + m[4] * y + m[5]) / d,
        ))
    }
}

/// True when the four corners form a non-self-intersecting convex quad wound
/// the way [`Quad`] promises. A dragged handle can easily cross an edge and
/// turn the quad into a bow-tie; the homography for a bow-tie is perfectly
/// solvable and renders as a mirrored mess, so the check happens here rather
/// than being left to look like a rendering bug.
///
/// Convexity is the sign of the cross product at each vertex: all four the
/// same sign means convex, a mixed bag means either concave or crossed.
///
/// A degenerate vertex — a collapsed edge, or three collinear corners — is
/// REJECTED, not skipped. Skipping it was the original shape of this function
/// and it let `[(0,0), (0,0), (10,10), (0,10)]` through as "valid": the two
/// duplicated corners contribute a zero cross, the survivors agree on a sign,
/// and a collapsed quad reads as convex. The pixel path happened to survive
/// that (the solver refuses the singular system a moment later), but only
/// after the caller had already pushed a history snapshot for a warp that
/// never happened.
///
/// The test is scale-free on purpose. The cross product is divided by the two
/// edge lengths, making it `sin(angle)` — dimensionless — so the SAME
/// threshold is correct for a normalised quad in 0..1 and an absolute one
/// spanning thousands of pixels. An absolute epsilon cannot be: 1e-9 is
/// enormous next to a normalised quad's areas and invisible next to a
/// pixel-space one.
pub fn is_valid_quad(q: &Quad) -> bool {
    let mut sign = 0i32;
    for i in 0..4 {
        let (ax, ay) = q[i];
        let (bx, by) = q[(i + 1) % 4];
        let (cx, cy) = q[(i + 2) % 4];
        let (e1x, e1y) = (bx - ax, by - ay);
        let (e2x, e2y) = (cx - bx, cy - by);
        let l1 = (e1x * e1x + e1y * e1y).sqrt();
        let l2 = (e2x * e2x + e2y * e2y).sqrt();
        if l1 < 1e-12 || l2 < 1e-12 {
            return false; // collapsed edge
        }
        let sin = (e1x * e2y - e1y * e2x) / (l1 * l2);
        if sin.abs() < 1e-6 {
            return false; // straight vertex — the quad has degenerated to a triangle
        }
        let s = if sin > 0.0 { 1 } else { -1 };
        if sign == 0 {
            sign = s;
        } else if sign != s {
            return false;
        }
    }
    sign != 0
}

/// The bounding box of a quad, as `(min_x, min_y, width, height)` in whole
/// pixels with the box grown outward to integer bounds.
fn quad_bounds(q: &Quad) -> (i32, i32, u32, u32) {
    let min_x = q.iter().map(|p| p.0).fold(f64::INFINITY, f64::min);
    let max_x = q.iter().map(|p| p.0).fold(f64::NEG_INFINITY, f64::max);
    let min_y = q.iter().map(|p| p.1).fold(f64::INFINITY, f64::min);
    let max_y = q.iter().map(|p| p.1).fold(f64::NEG_INFINITY, f64::max);
    let x0 = min_x.floor() as i32;
    let y0 = min_y.floor() as i32;
    let w = (max_x.ceil() - min_x.floor()).max(1.0) as u32;
    let h = (max_y.ceil() - min_y.floor()).max(1.0) as u32;
    (x0, y0, w, h)
}

/// Result of a warp: the pixels plus where they sit relative to the source
/// rectangle's origin. Mirrors what `text::rotate_pixels` returns, because the
/// consumer is the same — a tile with an offset from its anchor point.
pub struct Warped {
    pub pixels: Vec<u8>,
    pub w: u32,
    pub h: u32,
    /// Offset of the output's top-left from the source rect's top-left. A warp
    /// that pushes a corner up and left produces negative offsets, exactly as
    /// a rotation does.
    pub offset_x: i32,
    pub offset_y: i32,
}

/// Resample `src` (RGBA, `w`×`h`) into the destination quad, in the source
/// buffer's own coordinate space.
///
/// Bilinear, alpha-weighted. The weighting matters: text tiles and layer
/// content are mostly transparent, and interpolating straight RGB across a
/// transparent neighbour drags that neighbour's undefined colour into the
/// visible edge as a dark or white fringe. Weighting each sample by its own
/// alpha and dividing back out at the end keeps the edge the colour the
/// opaque side actually is.
///
/// Returns `None` for a degenerate or self-crossing quad — the caller keeps
/// the unwarped pixels rather than rendering a bow-tie.
pub fn warp_rgba(src: &[u8], w: u32, h: u32, quad: &Quad) -> Option<Warped> {
    if w == 0 || h == 0 || src.len() < (w as usize * h as usize * 4) {
        return None;
    }
    if !is_valid_quad(quad) {
        return None;
    }
    let inv = Homography::rect_from_quad(quad, w as f64, h as f64)?;
    let (ox, oy, out_w, out_h) = quad_bounds(quad);

    // A pathological quad can nominally cover the whole plane. Cap the output
    // so a slipped handle cannot ask for a multi-gigabyte allocation; 4× the
    // source area in each axis is far past any usable perspective and still
    // small enough to be a rounding error next to the images this app opens.
    if out_w > w.saturating_mul(8).max(4096) || out_h > h.saturating_mul(8).max(4096) {
        return None;
    }

    let mut out = vec![0u8; out_w as usize * out_h as usize * 4];
    let sw = w as i32;
    let sh = h as i32;

    for ny in 0..out_h {
        let dy = (oy + ny as i32) as f64 + 0.5;
        for nx in 0..out_w {
            let dx = (ox + nx as i32) as f64 + 0.5;
            let Some((sx, sy)) = inv.apply(dx, dy) else {
                continue;
            };
            // Sample at pixel centres — subtract the half-pixel added above.
            let sx = sx - 0.5;
            let sy = sy - 0.5;
            let x0 = sx.floor() as i32;
            let y0 = sy.floor() as i32;
            if x0 < -1 || y0 < -1 || x0 >= sw || y0 >= sh {
                continue;
            }
            let fx = sx - x0 as f64;
            let fy = sy - y0 as f64;

            let mut acc = [0.0f64; 4];
            let mut wsum = 0.0f64;
            let mut asum = 0.0f64;
            for (dxi, dyi, bw) in [
                (0, 0, (1.0 - fx) * (1.0 - fy)),
                (1, 0, fx * (1.0 - fy)),
                (0, 1, (1.0 - fx) * fy),
                (1, 1, fx * fy),
            ] {
                let px = x0 + dxi;
                let py = y0 + dyi;
                if px < 0 || py < 0 || px >= sw || py >= sh || bw <= 0.0 {
                    continue;
                }
                let i = ((py * sw + px) * 4) as usize;
                let a = src[i + 3] as f64;
                // RGB is premultiplied by alpha for the blend, then divided
                // back out — the fringe fix described above.
                acc[0] += src[i] as f64 * a * bw;
                acc[1] += src[i + 1] as f64 * a * bw;
                acc[2] += src[i + 2] as f64 * a * bw;
                acc[3] += a * bw;
                asum += a * bw;
                wsum += bw;
            }
            if wsum <= 0.0 || acc[3] <= 0.0 {
                continue;
            }
            let di = ((ny * out_w + nx) * 4) as usize;
            let inv_a = 1.0 / asum;
            out[di] = (acc[0] * inv_a).round().clamp(0.0, 255.0) as u8;
            out[di + 1] = (acc[1] * inv_a).round().clamp(0.0, 255.0) as u8;
            out[di + 2] = (acc[2] * inv_a).round().clamp(0.0, 255.0) as u8;
            // Alpha itself is a plain bilinear blend of coverage, normalised
            // by the geometric weight rather than by alpha.
            out[di + 3] = (acc[3] / wsum).round().clamp(0.0, 255.0) as u8;
        }
    }

    Some(Warped {
        pixels: out,
        w: out_w,
        h: out_h,
        offset_x: ox,
        offset_y: oy,
    })
}

/// Warp using a NORMALISED quad — corners in 0..1 across the source buffer.
///
/// WHY NORMALISED IS THE STORED FORM, and the single most important decision
/// in this module: it is what makes the transform VECTOR rather than baked.
/// A text annotation's tile is rebuilt from scratch whenever the words, the
/// font size, the wrap width or the box height change, and it comes back a
/// different pixel size every time. Corners stored in pixels would mean the
/// perspective silently drifts — or falls off the tile entirely — the moment
/// somebody fixes a typo. Corners stored as fractions of the tile describe the
/// SHAPE, so the same quad re-applies correctly to whatever the tile becomes.
/// Edit the words, and the text re-wraps and re-warps together.
pub fn warp_normalised(src: &[u8], w: u32, h: u32, quad: &[(f32, f32); 4]) -> Option<Warped> {
    if is_identity(quad) {
        return None; // nothing to do — caller keeps the original tile
    }
    let px: Quad = [
        (quad[0].0 as f64 * w as f64, quad[0].1 as f64 * h as f64),
        (quad[1].0 as f64 * w as f64, quad[1].1 as f64 * h as f64),
        (quad[2].0 as f64 * w as f64, quad[2].1 as f64 * h as f64),
        (quad[3].0 as f64 * w as f64, quad[3].1 as f64 * h as f64),
    ];
    warp_rgba(src, w, h, &px)
}

/// Lift the pixels in `rect` out of an RGBA plane and resample them into
/// `quad` (absolute coords in the same plane), leaving the source rectangle
/// transparent.
///
/// ⚠️ THIS IS THE ONLY IMPLEMENTATION. The live engine
/// (`ImageHorseTool::perspective_warp_region`) and the op-log replay
/// (`Op::PerspectiveWarp`) both call straight through to it, because
/// `ops_engine_parity` asserts the two produce byte-identical output and two
/// hand-kept copies of a resampler will not stay identical — the rounding
/// alone would drift. Any change here changes both by construction.
///
/// The source rectangle is CLEARED rather than left in place: this is a move,
/// the same as dragging a selection under Free Transform in Photoshop, not a
/// stamp. Leaving it would double the content on every warp and there would be
/// no way to undo half of it.
///
/// Returns false and leaves `data` untouched when the quad is degenerate or
/// the rect is empty — a rejected gesture must not half-apply.
pub fn warp_region_in_place(
    data: &mut [u8],
    img_w: u32,
    img_h: u32,
    rect: (i32, i32, u32, u32),
    quad: &Quad,
) -> bool {
    let (rx, ry, rw, rh) = rect;
    if rw == 0 || rh == 0 || img_w == 0 || img_h == 0 {
        return false;
    }
    if data.len() != img_w as usize * img_h as usize * 4 {
        return false;
    }
    // The quad arrives in absolute canvas coords; the resampler works in the
    // lifted region's own space, so rebase it onto the rect origin.
    let local: Quad = [
        (quad[0].0 - rx as f64, quad[0].1 - ry as f64),
        (quad[1].0 - rx as f64, quad[1].1 - ry as f64),
        (quad[2].0 - rx as f64, quad[2].1 - ry as f64),
        (quad[3].0 - rx as f64, quad[3].1 - ry as f64),
    ];

    let region = crate::transform::copy_region(data, img_w as i32, img_h as i32, rx, ry, rw, rh);
    let Some(warped) = warp_rgba(&region, rw, rh, &local) else {
        return false;
    };

    // Clear the source rect only AFTER the warp has succeeded — the early
    // return above is what makes a rejected quad a no-op rather than a hole.
    for y in ry.max(0)..(ry + rh as i32).min(img_h as i32) {
        for x in rx.max(0)..(rx + rw as i32).min(img_w as i32) {
            let i = ((y * img_w as i32 + x) * 4) as usize;
            data[i..i + 4].copy_from_slice(&[0, 0, 0, 0]);
        }
    }

    crate::transform::paste_region(
        data,
        img_w as i32,
        img_h as i32,
        &warped.pixels,
        warped.w,
        warped.h,
        rx + warped.offset_x,
        ry + warped.offset_y,
    );
    true
}

/// Read a flat `[x0,y0,…,x3,y3]` f32 quad (the form that crosses the wasm
/// boundary and the op log) into the f64 [`Quad`] the solver works in.
pub fn quad_from_pairs(q: &[(f32, f32); 4]) -> Quad {
    [
        (q[0].0 as f64, q[0].1 as f64),
        (q[1].0 as f64, q[1].1 as f64),
        (q[2].0 as f64, q[2].1 as f64),
        (q[3].0 as f64, q[3].1 as f64),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(w: u32, h: u32, c: [u8; 4]) -> Vec<u8> {
        let mut v = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            v.extend_from_slice(&c);
        }
        v
    }

    #[test]
    fn identity_correspondence_is_the_identity_map() {
        let q: Quad = [(0.0, 0.0), (10.0, 0.0), (10.0, 20.0), (0.0, 20.0)];
        let h = Homography::from_correspondences(&q, &q).unwrap(); // allow: rust-panic
        for (x, y) in [(0.0, 0.0), (5.0, 5.0), (10.0, 20.0), (3.3, 17.1)] {
            let (u, v) = h.apply(x, y).unwrap(); // allow: rust-panic
            assert!((u - x).abs() < 1e-9, "x {x} -> {u}");
            assert!((v - y).abs() < 1e-9, "y {y} -> {v}");
        }
    }

    #[test]
    fn rect_from_quad_inverts_the_forward_map() {
        // A genuine keystone: top edge narrower than the bottom.
        let quad: Quad = [(20.0, 0.0), (80.0, 0.0), (100.0, 50.0), (0.0, 50.0)];
        let fwd = Homography::from_correspondences(
            &[(0.0, 0.0), (10.0, 0.0), (10.0, 5.0), (0.0, 5.0)],
            &quad,
        )
        .unwrap(); // allow: rust-panic
        let back = Homography::rect_from_quad(&quad, 10.0, 5.0).unwrap(); // allow: rust-panic

        // Round trip every corner and a couple of interior points.
        for (x, y) in [(0.0, 0.0), (10.0, 0.0), (10.0, 5.0), (0.0, 5.0), (4.0, 2.5)] {
            let (u, v) = fwd.apply(x, y).unwrap(); // allow: rust-panic
            let (rx, ry) = back.apply(u, v).unwrap(); // allow: rust-panic
            assert!((rx - x).abs() < 1e-6, "round trip x: {x} -> {u} -> {rx}");
            assert!((ry - y).abs() < 1e-6, "round trip y: {y} -> {v} -> {ry}");
        }
    }

    #[test]
    fn axis_aligned_quad_solves_despite_structural_zeros() {
        // This is the case that fails without partial pivoting: every quad
        // starts life as a rectangle, so this is the FIRST solve the tool ever
        // runs, not an edge case.
        let quad: Quad = [(0.0, 0.0), (64.0, 0.0), (64.0, 32.0), (0.0, 32.0)];
        assert!(Homography::rect_from_quad(&quad, 64.0, 32.0).is_some());
    }

    #[test]
    fn degenerate_quads_are_rejected_not_solved() {
        // Collapsed edge (two corners identical).
        let collapsed: Quad = [(0.0, 0.0), (0.0, 0.0), (10.0, 10.0), (0.0, 10.0)];
        assert!(Homography::rect_from_quad(&collapsed, 10.0, 10.0).is_none());
        // All four collinear.
        let line: Quad = [(0.0, 0.0), (5.0, 0.0), (10.0, 0.0), (15.0, 0.0)];
        assert!(Homography::rect_from_quad(&line, 10.0, 10.0).is_none());
    }

    #[test]
    fn bow_tie_is_not_a_valid_quad() {
        // Swapping two adjacent corners crosses the edges. Solvable, but it
        // renders mirrored — which is why validity is checked separately from
        // solvability.
        let bow: Quad = [(0.0, 0.0), (10.0, 10.0), (10.0, 0.0), (0.0, 10.0)];
        assert!(!is_valid_quad(&bow));
        assert!(warp_rgba(&solid(10, 10, [255, 0, 0, 255]), 10, 10, &bow).is_none());
        let ok: Quad = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)];
        assert!(is_valid_quad(&ok));
    }

    #[test]
    fn collapsed_and_collinear_quads_are_invalid() {
        // The regression the epsilon-skip version shipped with: two duplicated
        // corners contribute a zero cross, the survivors agree on a sign, and
        // the whole collapsed quad read as convex. Found by the TS twin's test.
        let collapsed: Quad = [(0.0, 0.0), (0.0, 0.0), (10.0, 10.0), (0.0, 10.0)];
        assert!(!is_valid_quad(&collapsed), "a collapsed edge is not a quad");

        // Three corners on one line — the quad has become a triangle.
        let triangle: Quad = [(0.0, 0.0), (5.0, 0.0), (10.0, 0.0), (0.0, 10.0)];
        assert!(!is_valid_quad(&triangle), "a straight vertex is not a quad");

        let point: Quad = [(3.0, 3.0); 4];
        assert!(!is_valid_quad(&point));
    }

    #[test]
    fn validity_threshold_is_scale_free() {
        // The same shape at two wildly different scales must get the same
        // answer — this is why the cross product is divided by the edge
        // lengths. A normalised quad (0..1) and a pixel-space one are both
        // real inputs: text uses the former, the region warp the latter.
        let small: Quad = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)];
        let large: Quad = [(0.0, 0.0), (4000.0, 0.0), (4000.0, 3000.0), (0.0, 3000.0)];
        assert!(is_valid_quad(&small));
        assert!(is_valid_quad(&large));

        let small_bow: Quad = [(0.0, 0.0), (1.0, 1.0), (1.0, 0.0), (0.0, 1.0)];
        let large_bow: Quad = [(0.0, 0.0), (4000.0, 3000.0), (4000.0, 0.0), (0.0, 3000.0)];
        assert!(!is_valid_quad(&small_bow));
        assert!(!is_valid_quad(&large_bow));
    }

    #[test]
    fn identity_normalised_quad_is_a_no_op() {
        let src = solid(8, 8, [1, 2, 3, 255]);
        assert!(
            warp_normalised(&src, 8, 8, &IDENTITY_QUAD).is_none(),
            "identity must short-circuit so the caller keeps the original tile"
        );
        assert!(is_identity(&IDENTITY_QUAD));
        assert!(!is_identity(&[
            (0.1, 0.0),
            (1.0, 0.0),
            (1.0, 1.0),
            (0.0, 1.0)
        ]));
    }

    #[test]
    fn warp_preserves_a_solid_colour_in_the_interior() {
        // A keystone of a flat red field must stay flat red where it covers —
        // any colour drift here is a resampling bug.
        let src = solid(32, 32, [200, 40, 60, 255]);
        let quad: Quad = [(8.0, 0.0), (24.0, 0.0), (32.0, 32.0), (0.0, 32.0)];
        let out = warp_rgba(&src, 32, 32, &quad).unwrap(); // allow: rust-panic
        let cx = out.w / 2;
        let cy = out.h / 2;
        let i = ((cy * out.w + cx) * 4) as usize;
        assert_eq!(
            &out.pixels[i..i + 3],
            &[200, 40, 60],
            "interior colour drifted"
        );
        assert_eq!(out.pixels[i + 3], 255, "interior alpha dropped");
    }

    #[test]
    fn warp_reports_negative_offsets_when_the_quad_grows_left_and_up() {
        let src = solid(16, 16, [9, 9, 9, 255]);
        let quad: Quad = [(-10.0, -6.0), (16.0, 0.0), (16.0, 16.0), (0.0, 16.0)];
        let out = warp_rgba(&src, 16, 16, &quad).unwrap(); // allow: rust-panic
        assert_eq!(out.offset_x, -10);
        assert_eq!(out.offset_y, -6);
        assert!(
            out.w >= 26 && out.h >= 22,
            "output must cover the quad bounds"
        );
    }

    #[test]
    fn transparent_neighbours_do_not_fringe_the_edge() {
        // Half opaque white, half fully transparent BLACK. A naive bilinear
        // blend pulls that black into the visible edge as a grey halo; the
        // alpha-weighted blend must not.
        let (w, h) = (16u32, 16u32);
        let mut src = vec![0u8; (w * h * 4) as usize];
        for y in 0..h {
            for x in 0..w {
                let i = ((y * w + x) * 4) as usize;
                if x < w / 2 {
                    src[i..i + 4].copy_from_slice(&[255, 255, 255, 255]);
                } // else stays [0,0,0,0]
            }
        }
        let quad: Quad = [(2.0, 0.0), (14.0, 0.0), (16.0, 16.0), (0.0, 16.0)];
        let out = warp_rgba(&src, w, h, &quad).unwrap(); // allow: rust-panic
        for i in (0..out.pixels.len()).step_by(4) {
            let a = out.pixels[i + 3];
            if a > 200 {
                assert!(
                    out.pixels[i] > 200,
                    "opaque output pixel darkened to {} — transparent black bled in",
                    out.pixels[i]
                );
            }
        }
    }
}
