//! Diagram shapes — the flowchart, basic and block-arrow shapes people reach
//! for first in Lucidchart and draw.io, as shape kinds 11..=40.
//!
//! Every one is a small PROGRAM in the unit square (0,0)-(1,1), stretched over
//! the drag bbox the same way the diamond and triangle are. A program draws
//! one CLOSED outline (what gets stroked, filled, clipped and hit-tested) and
//! any number of OPEN detail strokes on top of it (a cylinder's front rim, the
//! bars of a predefined process, a cube's inner edges). Details are ink only:
//! they are never filled and never hit-tested.
//!
//! The table below is mirrored by hand in `app/src/lib/diagramShapes.ts`, and
//! `diagramShapes.parity.test.ts` reads THIS FILE and fails when the two
//! tables differ — so a shape is changed here first, then there.
//!
//! Opcodes (a flat `f64` slice, operands follow each code):
//!
//! | code | operands | meaning |
//! |---|---|---|
//! | 0 | x y | start the outline |
//! | 1 | x y | line to |
//! | 2 | cx cy x y | quadratic curve to, 16 segments |
//! | 3 | cx cy rx ry a0 a1 | elliptical arc from `a0`° to `a1`° (y-down, so 90° is the bottom), one segment per 6° |
//! | 4 | x y | start a new open detail stroke |
//!
//! No new field rides on the shape and the op log is untouched: a diagram
//! shape is a `kind` byte the log already carries, plus the existing bbox,
//! rotation, stroke, sloppiness and fill.

use std::f64::consts::PI;

/// First and last diagram kind byte.
pub const FIRST: u8 = 11;
pub const LAST: u8 = 40;

/// Whether `kind` is one of the diagram shapes.
pub fn is_diagram_kind(kind: u8) -> bool {
    (FIRST..=LAST).contains(&kind)
}

// TABLE-BEGIN — mirrored in app/src/lib/diagramShapes.ts (parity-tested).
/// The program for a diagram kind, or `None` for every other kind.
#[rustfmt::skip]
pub fn program(kind: u8) -> Option<&'static [f64]> {
    Some(match kind {
        // ── Flowchart ──
        // 11 Terminator (start / end): a stadium.
        11 => &[0.0, 0.15, 0.0, 1.0, 0.85, 0.0, 3.0, 0.85, 0.5, 0.15, 0.5, -90.0, 90.0, 1.0, 0.15, 1.0, 3.0, 0.15, 0.5, 0.15, 0.5, 90.0, 270.0],
        // 12 Data (input / output): a parallelogram.
        12 => &[0.0, 0.2, 0.0, 1.0, 1.0, 0.0, 1.0, 0.8, 1.0, 1.0, 0.0, 1.0],
        // 13 Document: a page with a wavy foot.
        13 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.85, 2.0, 0.75, 0.65, 0.5, 0.85, 2.0, 0.25, 1.05, 0.0, 0.85],
        // 14 Multiple documents: three stacked pages.
        14 => &[0.0, 0.16, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.72, 1.0, 0.92, 0.72, 1.0, 0.92, 0.8, 1.0, 0.84, 0.8, 1.0, 0.84, 0.87, 2.0, 0.63, 0.75, 0.42, 0.87, 2.0, 0.21, 0.99, 0.0, 0.87, 1.0, 0.0, 0.16, 1.0, 0.08, 0.16, 1.0, 0.08, 0.08, 1.0, 0.16, 0.08,
                4.0, 0.08, 0.16, 1.0, 0.84, 0.16, 1.0, 0.84, 0.8,
                4.0, 0.16, 0.08, 1.0, 0.92, 0.08, 1.0, 0.92, 0.72],
        // 15 Predefined process (subroutine): a box with inner side bars.
        15 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
                4.0, 0.1, 0.0, 1.0, 0.1, 1.0,
                4.0, 0.9, 0.0, 1.0, 0.9, 1.0],
        // 16 Manual input: a box with a sloped top.
        16 => &[0.0, 0.0, 0.25, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0],
        // 17 Manual operation: a trapezoid, wide edge up.
        17 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.8, 1.0, 1.0, 0.2, 1.0],
        // 18 Preparation: a long hexagon.
        18 => &[0.0, 0.2, 0.0, 1.0, 0.8, 0.0, 1.0, 1.0, 0.5, 1.0, 0.8, 1.0, 1.0, 0.2, 1.0, 1.0, 0.0, 0.5],
        // 19 Database: a cylinder, with the front of its lid drawn.
        19 => &[0.0, 0.0, 0.15, 3.0, 0.5, 0.15, 0.5, 0.15, 180.0, 360.0, 1.0, 1.0, 0.85, 3.0, 0.5, 0.85, 0.5, 0.15, 0.0, 180.0,
                4.0, 0.0, 0.15, 3.0, 0.5, 0.15, 0.5, 0.15, 180.0, 0.0],
        // 20 Internal storage: a box ruled across the top and down the left.
        20 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
                4.0, 0.15, 0.0, 1.0, 0.15, 1.0,
                4.0, 0.0, 0.15, 1.0, 1.0, 0.15],
        // 21 Off-page connector: a box pointing down.
        21 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.6, 1.0, 0.5, 1.0, 1.0, 0.0, 0.6],
        // 22 Delay: a D.
        22 => &[0.0, 0.0, 0.0, 1.0, 0.5, 0.0, 3.0, 0.5, 0.5, 0.5, 0.5, -90.0, 90.0, 1.0, 0.0, 1.0],
        // 23 Display: a pointed left end and a round right one.
        23 => &[0.0, 0.0, 0.5, 1.0, 0.2, 0.0, 1.0, 0.8, 0.0, 3.0, 0.8, 0.5, 0.2, 0.5, -90.0, 90.0, 1.0, 0.2, 1.0],
        // 24 Stored data: round on the left, hollowed on the right.
        24 => &[0.0, 0.15, 0.0, 1.0, 1.0, 0.0, 3.0, 1.0, 0.5, 0.15, 0.5, 270.0, 90.0, 1.0, 0.15, 1.0, 3.0, 0.15, 0.5, 0.15, 0.5, 90.0, 270.0],
        // 25 Merge: a triangle, point down.
        25 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.5, 1.0],
        // 26 Card: a box with its top-left corner clipped.
        26 => &[0.0, 0.2, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.2],
        // 27 Punched tape: wavy top and bottom.
        27 => &[0.0, 0.0, 0.1, 2.0, 0.25, 0.3, 0.5, 0.1, 2.0, 0.75, -0.1, 1.0, 0.1, 1.0, 1.0, 0.9, 2.0, 0.75, 0.7, 0.5, 0.9, 2.0, 0.25, 1.1, 0.0, 0.9],
        // 28 Summing junction: a circle with an X.
        28 => &[0.0, 1.0, 0.5, 3.0, 0.5, 0.5, 0.5, 0.5, 0.0, 360.0,
                4.0, 0.146, 0.146, 1.0, 0.854, 0.854,
                4.0, 0.854, 0.146, 1.0, 0.146, 0.854],
        // ── Basic ──
        // 29 Pentagon.
        29 => &[0.0, 0.5, 0.0, 1.0, 1.0, 0.38, 1.0, 0.81, 1.0, 1.0, 0.19, 1.0, 1.0, 0.0, 0.38],
        // 30 Octagon.
        30 => &[0.0, 0.29, 0.0, 1.0, 0.71, 0.0, 1.0, 1.0, 0.29, 1.0, 1.0, 0.71, 1.0, 0.71, 1.0, 1.0, 0.29, 1.0, 1.0, 0.0, 0.71, 1.0, 0.0, 0.29],
        // 31 Cloud: nine scallops.
        31 => &[0.0, 0.496, 0.057, 2.0, 0.749, -0.103, 0.789, 0.223, 2.0, 1.04, 0.175, 0.929, 0.364, 2.0, 1.11, 0.596, 0.83, 0.725, 2.0, 0.892, 0.99, 0.67, 0.885, 2.0, 0.479, 1.138, 0.32, 0.836, 2.0, 0.087, 0.979, 0.13, 0.747, 2.0, -0.117, 0.608, 0.104, 0.391, 2.0, -0.052, 0.18, 0.181, 0.194, 2.0, 0.247, -0.106, 0.496, 0.057],
        // 32 Callout: a speech box with a tail.
        32 => &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.75, 1.0, 0.45, 0.75, 1.0, 0.25, 1.0, 1.0, 0.28, 0.75, 1.0, 0.0, 0.75],
        // 33 Cross: a plus sign.
        33 => &[0.0, 0.33, 0.0, 1.0, 0.67, 0.0, 1.0, 0.67, 0.33, 1.0, 1.0, 0.33, 1.0, 1.0, 0.67, 1.0, 0.67, 0.67, 1.0, 0.67, 1.0, 1.0, 0.33, 1.0, 1.0, 0.33, 0.67, 1.0, 0.0, 0.67, 1.0, 0.0, 0.33, 1.0, 0.33, 0.33],
        // 34 Cube.
        34 => &[0.0, 0.0, 0.25, 1.0, 0.25, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.75, 1.0, 0.75, 1.0, 1.0, 0.0, 1.0,
                4.0, 0.0, 0.25, 1.0, 0.75, 0.25, 1.0, 1.0, 0.0,
                4.0, 0.75, 0.25, 1.0, 0.75, 1.0],
        // 35 Note: a page with a folded corner.
        35 => &[0.0, 0.0, 0.0, 1.0, 0.8, 0.0, 1.0, 1.0, 0.2, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
                4.0, 0.8, 0.0, 1.0, 0.8, 0.2, 1.0, 1.0, 0.2],
        // ── Block arrows ──
        // 36 Block arrow.
        36 => &[0.0, 0.0, 0.25, 1.0, 0.6, 0.25, 1.0, 0.6, 0.0, 1.0, 1.0, 0.5, 1.0, 0.6, 1.0, 1.0, 0.6, 0.75, 1.0, 0.0, 0.75],
        // 37 Double block arrow.
        37 => &[0.0, 0.0, 0.5, 1.0, 0.3, 0.0, 1.0, 0.3, 0.25, 1.0, 0.7, 0.25, 1.0, 0.7, 0.0, 1.0, 1.0, 0.5, 1.0, 0.7, 1.0, 1.0, 0.7, 0.75, 1.0, 0.3, 0.75, 1.0, 0.3, 1.0],
        // 38 Four-way arrow.
        38 => &[0.0, 0.5, 0.0, 1.0, 0.7, 0.2, 1.0, 0.6, 0.2, 1.0, 0.6, 0.4, 1.0, 0.8, 0.4, 1.0, 0.8, 0.3, 1.0, 1.0, 0.5, 1.0, 0.8, 0.7, 1.0, 0.8, 0.6, 1.0, 0.6, 0.6, 1.0, 0.6, 0.8, 1.0, 0.7, 0.8, 1.0, 0.5, 1.0, 1.0, 0.3, 0.8, 1.0, 0.4, 0.8, 1.0, 0.4, 0.6, 1.0, 0.2, 0.6, 1.0, 0.2, 0.7, 1.0, 0.0, 0.5, 1.0, 0.2, 0.3, 1.0, 0.2, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 0.2, 1.0, 0.3, 0.2],
        // 39 Chevron.
        39 => &[0.0, 0.0, 0.0, 1.0, 0.75, 0.0, 1.0, 1.0, 0.5, 1.0, 0.75, 1.0, 1.0, 0.0, 1.0, 1.0, 0.25, 0.5],
        // 40 Step (a process arrow).
        40 => &[0.0, 0.0, 0.0, 1.0, 0.75, 0.0, 1.0, 1.0, 0.5, 1.0, 0.75, 1.0, 1.0, 0.0, 1.0],
        _ => return None,
    })
}
// TABLE-END

/// A diagram shape flattened onto its bbox.
pub struct Geometry {
    /// The closed outline — no repeated closing point.
    pub outline: Vec<(f64, f64)>,
    /// Open detail strokes drawn over the outline.
    pub details: Vec<Vec<(f64, f64)>>,
    /// The outline has curves, so a sketchy stroke wobbles smoothly round it
    /// (`sloppy_loop_points`) instead of overshooting every chord's corner.
    pub smooth: bool,
}

/// Flatten `kind`'s program over the bbox `(x0,y0)-(x1,y1)`; `None` for a
/// kind that is not a diagram shape. Mirrored by hand in `diagramGeometry`
/// (diagramShapes.ts) — the same operations in the same order, so the overlay
/// preview strokes the points the engine strokes.
pub fn geometry(kind: u8, x0: f64, y0: f64, x1: f64, y1: f64) -> Option<Geometry> {
    let prog = program(kind)?;
    let minx = x0.min(x1);
    let miny = y0.min(y1);
    let w = x0.max(x1) - minx;
    let h = y0.max(y1) - miny;
    let map = |u: f64, v: f64| (minx + u * w, miny + v * h);
    let mut outline: Vec<(f64, f64)> = Vec::new();
    let mut details: Vec<Vec<(f64, f64)>> = Vec::new();
    let mut smooth = false;
    // Unit-space pen position, and whether the pen is in a detail stroke.
    let (mut px, mut py) = (0.0, 0.0);
    let mut in_detail = false;
    let mut i = 0;
    while i < prog.len() {
        let op = prog[i] as u8;
        let mut pts: Vec<(f64, f64)> = Vec::new();
        match op {
            0 | 4 => {
                px = prog[i + 1];
                py = prog[i + 2];
                in_detail = op == 4;
                if in_detail {
                    details.push(Vec::new());
                }
                pts.push((px, py));
                i += 3;
            }
            1 => {
                px = prog[i + 1];
                py = prog[i + 2];
                pts.push((px, py));
                i += 3;
            }
            2 => {
                let (cx, cy, ex, ey) = (prog[i + 1], prog[i + 2], prog[i + 3], prog[i + 4]);
                for k in 1..=16 {
                    let t = k as f64 / 16.0;
                    let a = (1.0 - t) * (1.0 - t);
                    let b = 2.0 * (1.0 - t) * t;
                    let c = t * t;
                    pts.push((a * px + b * cx + c * ex, a * py + b * cy + c * ey));
                }
                px = ex;
                py = ey;
                if !in_detail {
                    smooth = true;
                }
                i += 5;
            }
            3 => {
                let (cx, cy, rx, ry, a0, a1) = (
                    prog[i + 1],
                    prog[i + 2],
                    prog[i + 3],
                    prog[i + 4],
                    prog[i + 5],
                    prog[i + 6],
                );
                let segs = ((a1 - a0).abs() / 6.0).ceil().max(2.0) as usize;
                for k in 1..=segs {
                    let a = (a0 + (a1 - a0) * (k as f64 / segs as f64)) * PI / 180.0;
                    pts.push((cx + rx * a.cos(), cy + ry * a.sin()));
                }
                (px, py) = *pts.last().unwrap_or(&(px, py));
                if !in_detail {
                    smooth = true;
                }
                i += 7;
            }
            // An unknown opcode is a broken table; stop rather than misread
            // operands as opcodes.
            _ => break,
        }
        let target = if in_detail {
            match details.last_mut() {
                Some(d) => d,
                None => break,
            }
        } else {
            &mut outline
        };
        target.extend(pts.into_iter().map(|(u, v)| map(u, v)));
    }
    // A loop that returns to its start (the summing junction's full circle)
    // must not carry a zero-length closing edge.
    if outline.len() > 1 {
        let (f, l) = (outline[0], outline[outline.len() - 1]);
        if (f.0 - l.0).abs() < 1e-9 && (f.1 - l.1).abs() < 1e-9 {
            outline.pop();
        }
    }
    Some(Geometry {
        outline,
        details,
        smooth,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_has_a_closed_outline_inside_its_box() {
        for kind in FIRST..=LAST {
            let g = geometry(kind, 10.0, 20.0, 110.0, 220.0).expect("diagram kind"); // allow: rust-panic (test)
            assert!(g.outline.len() >= 3, "kind {kind}: outline too short");
            for &(x, y) in g.outline.iter().chain(g.details.iter().flatten()) {
                assert!(x.is_finite() && y.is_finite(), "kind {kind}");
                // Curves may bow a hair past the box (the cloud's scallops are
                // normalized to it); nothing may wander off.
                assert!((8.0..=112.0).contains(&x), "kind {kind}: x {x}");
                assert!((15.0..=225.0).contains(&y), "kind {kind}: y {y}");
            }
        }
    }

    #[test]
    fn non_diagram_kinds_have_no_program() {
        for kind in [0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 41, 255] {
            assert!(
                geometry(kind, 0.0, 0.0, 10.0, 10.0).is_none(),
                "kind {kind}"
            );
            assert!(!is_diagram_kind(kind));
        }
    }

    #[test]
    fn a_full_circle_drops_its_repeated_closing_point() {
        let g = geometry(28, 0.0, 0.0, 100.0, 100.0).unwrap(); // allow: rust-panic (test)
        let (f, l) = (g.outline[0], g.outline[g.outline.len() - 1]);
        assert!((f.0 - l.0).abs() > 1e-6 || (f.1 - l.1).abs() > 1e-6);
        assert_eq!(g.details.len(), 2);
        assert!(g.smooth);
    }

    #[test]
    fn straight_shapes_are_not_smooth_and_details_do_not_count() {
        assert!(!geometry(12, 0.0, 0.0, 10.0, 10.0).unwrap().smooth); // allow: rust-panic (test)
        assert!(!geometry(34, 0.0, 0.0, 10.0, 10.0).unwrap().smooth); // allow: rust-panic (test)
        assert!(geometry(19, 0.0, 0.0, 10.0, 10.0).unwrap().smooth); // allow: rust-panic (test)
    }

    #[test]
    fn a_reversed_drag_is_the_same_shape() {
        let a = geometry(13, 0.0, 0.0, 50.0, 40.0).unwrap(); // allow: rust-panic (test)
        let b = geometry(13, 50.0, 40.0, 0.0, 0.0).unwrap(); // allow: rust-panic (test)
        assert_eq!(a.outline, b.outline);
    }
}
