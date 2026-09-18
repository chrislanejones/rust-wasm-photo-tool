//! Shape rotation, the triangle (kind 10), and the star's point count.
//!
//! Rotation is stored as an angle beside the UNROTATED bbox and applied at
//! render and hit-test time — the same "a property, not baked pixels" rule
//! `shape_perspective.rs` pins for the quad. What each test below holds:
//!
//!   1. θ = 0 is byte-identical to the renderer before rotation existed, for
//!      every kind and style that existed then (hashes recorded on
//!      origin/master 4890bf1f, before the first edit);
//!   2. a rotated outline IS the outline through the rotated corners — crisp
//!      edges, exactly the pixels a polygon through those points gets;
//!   3. a rotated FILL covers the rotated area, not the unrotated one;
//!   4. a circle ignores θ unless it has a gradient (it is rotation-invariant
//!      otherwise, and the frontend preview does the same);
//!   5. the triangle and the n-point star render and hit-test on their edges,
//!      with an empty inside that is a miss;
//!   6. hit-testing happens in the shape's own frame;
//!   7. the wasm surface: one undo step per add/update, `update` leaves the
//!      quad alone, the JSON carries `rotation` and `starPoints`, and both are
//!      stored in ONE canonical form.
//!
//! Featureless on purpose (no `ops`/`tiles`), so plain `cargo test` and
//! `cargo clippy --all-targets` both compile and run it. The op-log half —
//! v8 encoding, v7 back-compat, the ShapeEdit replay fix — lives in
//! `src/ops.rs`'s test module and `src/ops_engine_parity.rs`, which are
//! already `tiles`-gated where they are declared.

use stamp_tool::ImageHorseTool;

const W: u32 = 96;
const H: u32 = 80;

/// A busy gradient, so a pixelate fill has something to average and a shape
/// that draws in the wrong place cannot hide on a flat background.
fn gradient() -> Vec<u8> {
    let mut v = Vec::with_capacity((W * H * 4) as usize);
    for y in 0..H {
        for x in 0..W {
            v.extend_from_slice(&[(x * 2) as u8, (y * 3) as u8, ((x + y) % 256) as u8, 255]);
        }
    }
    v
}

fn tool_on(bg: &[u8]) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(bg);
    t
}

fn white_tool() -> ImageHorseTool {
    tool_on(&vec![255u8; (W * H * 4) as usize])
}

/// FNV-1a — the same hash the engine's op-log sync check uses.
fn fnv(b: &[u8]) -> u64 {
    let mut h = 0xcbf2_9ce4_8422_2325u64;
    for &x in b {
        h ^= x as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

fn px(buf: &[u8], x: u32, y: u32) -> [u8; 4] {
    let i = ((y * W + x) * 4) as usize;
    [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

const KEYSTONE: [f32; 8] = [0.25, 0.0, 0.75, 0.0, 1.0, 1.0, 0.0, 1.0];

/// `add_shape_annotation_full` with the house style every fixture here uses:
/// red stroke 3, blue→green fill, fill block 8.
#[allow(clippy::too_many_arguments)]
fn add(
    t: &mut ImageHorseTool,
    kind: u8,
    bbox: (f64, f64, f64, f64),
    fill: u8,
    angle: u16,
    slop: u8,
    star_points: u8,
    rot: f64,
) -> u32 {
    let (x0, y0, x1, y1) = bbox;
    t.add_shape_annotation_full(
        kind,
        x0,
        y0,
        x1,
        y1,
        "#e02020",
        3.0,
        0,
        fill,
        "#2040e0",
        "#20e040",
        angle,
        8,
        slop,
        star_points,
        rot,
    )
}

const BOX: (f64, f64, f64, f64) = (14.0, 10.0, 78.0, 66.0);

// ── 1. θ = 0 is the old renderer, byte for byte ─────────────────────────────

/// (name, kind, fill_kind, sloppiness, gradient angle, warped, hash on
/// origin/master). Recorded BEFORE the first edit on this branch by driving
/// the pre-rotation `add_shape_annotation` over `gradient()`.
///
/// The rows that go through `sin`/`cos` (circle, star, every sketchy stroke,
/// the 45° gradient) depend on the platform libm rounding those the way x86-64
/// glibc does — CI (ubuntu) and the dev box both do. If a different platform
/// ever fails ONLY those rows while the trig-free ones pass, that is libm, not
/// a regression; if a trig-free row fails, the renderer changed.
const PINNED: [(&str, u8, u8, u8, u16, bool, u64); 20] = [
    // trig-free
    ("rect", 0, 0, 0, 0, false, 0xf35a78b8ee47aa85),
    ("rect_solid", 0, 1, 0, 0, false, 0x7fd2af8d1cf5a6dd),
    ("rect_grad0", 0, 2, 0, 0, false, 0x0d219395d47eeae9),
    ("rect_pix", 0, 3, 0, 0, false, 0xd119d91718cc8af3),
    ("line", 2, 0, 0, 0, false, 0x476755b9ab54043d),
    ("diamond", 8, 0, 0, 0, false, 0xe289d8d943ddd3a9),
    ("rect_warp", 0, 0, 0, 0, true, 0xd73da7c91766df4b),
    ("rect_solid_warp", 0, 1, 0, 0, true, 0x31ddf9e4538e3f04),
    // through sin/cos
    ("rect_sloppy", 0, 0, 60, 0, false, 0xcaa2f6a81fdafb5f),
    ("rect_grad45", 0, 2, 0, 45, false, 0xe4bd2b9613d00f45),
    ("circle", 1, 0, 0, 0, false, 0x4df4e9a85084d141),
    ("circle_sloppy", 1, 0, 60, 0, false, 0x0041c4ff41e1f3bc),
    ("circle_solid", 1, 1, 0, 0, false, 0x5ec15da6b6981315),
    ("circle_grad", 1, 2, 0, 45, false, 0xa997007fb811bf65),
    ("line_sloppy", 2, 0, 60, 0, false, 0x836fe9537367123e),
    ("diamond_sloppy", 8, 0, 60, 0, false, 0xc4cd5d3f60c7beaa),
    ("star", 9, 0, 0, 0, false, 0xca8a0f3666ebc007),
    ("star_sloppy", 9, 0, 60, 0, false, 0x9856aa98e32829b1),
    ("star_warp", 9, 0, 0, 0, true, 0x4c3ecd8e1a9e8785),
    ("circle_grad_warp", 1, 2, 0, 45, true, 0x6b70374bc43b30c5),
];

fn render_pinned_case(kind: u8, fill: u8, slop: u8, angle: u16, warp: bool, legacy: bool) -> u64 {
    let mut t = tool_on(&gradient());
    let (x0, y0, x1, y1) = BOX;
    let id = if legacy {
        t.add_shape_annotation(
            kind, x0, y0, x1, y1, "#e02020", 3.0, 0, fill, "#2040e0", "#20e040", angle, 8, slop,
        )
    } else {
        add(&mut t, kind, BOX, fill, angle, slop, 0, 0.0)
    };
    if warp {
        assert!(t.set_shape_perspective(id, &KEYSTONE));
    }
    fnv(&t.get_image_data())
}

#[test]
fn theta_zero_renders_byte_identical_to_before_rotation_existed() {
    let mut failed = Vec::new();
    for &(name, kind, fill, slop, angle, warp, want) in &PINNED {
        for legacy in [true, false] {
            let got = render_pinned_case(kind, fill, slop, angle, warp, legacy);
            if got != want {
                let entry = if legacy { "legacy" } else { "_full" };
                failed.push(format!("{name} via {entry}: 0x{got:016x} != 0x{want:016x}"));
            }
        }
    }
    assert!(
        failed.is_empty(),
        "θ = 0 changed pixels:\n{}",
        failed.join("\n")
    );
}

#[test]
fn the_classic_star_is_the_same_whether_its_points_say_0_or_5() {
    let pinned_star = PINNED.iter().find(|r| r.0 == "star").unwrap().6; // allow: rust-panic
    for points in [0u8, 5] {
        let mut t = tool_on(&gradient());
        add(&mut t, 9, BOX, 0, 0, 0, points, 0.0);
        assert_eq!(
            fnv(&t.get_image_data()),
            pinned_star,
            "star_points = {points} must be the five-point star"
        );
    }
}

// ── 2. a rotated outline is the outline through its rotated corners ────────

/// The engine's rotation, spelled the way the contract spells it (and the way
/// `drawing::Rotation` computes it), so the doubles come out identical.
fn rotate(p: (f64, f64), deg: f64, c: (f64, f64)) -> (f64, f64) {
    let t = deg * std::f64::consts::PI / 180.0;
    let (cos, sin) = (t.cos(), t.sin());
    let (dx, dy) = (p.0 - c.0, p.1 - c.1);
    (c.0 + dx * cos - dy * sin, c.1 + dx * sin + dy * cos)
}

fn flat(pts: &[(f64, f64)]) -> Vec<f64> {
    pts.iter().flat_map(|&(x, y)| [x, y]).collect()
}

/// Draw `pts` as a pen polyline in the house stroke — `draw_polyline` issues
/// the same thick segments the rotated outline does.
fn polyline_pixels(pts: &[(f64, f64)]) -> Vec<u8> {
    let mut t = white_tool();
    t.add_polyline_annotation(&flat(pts), "#e02020", 3.0);
    t.get_image_data()
}

#[test]
fn a_rotated_rect_is_exactly_the_polygon_through_its_rotated_corners() {
    let (x0, y0, x1, y1) = (24.0, 20.0, 72.0, 52.0);
    let c = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    for deg in [30.0, -65.0, 90.0, 180.0] {
        let mut t = white_tool();
        add(&mut t, 0, (x0, y0, x1, y1), 0, 0, 0, 0, deg);
        let rotated = t.get_image_data();

        let corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)];
        let pts: Vec<_> = corners.iter().map(|&p| rotate(p, deg, c)).collect();
        assert!(
            rotated == polyline_pixels(&pts),
            "{deg}°: the rotated rect's pixels differ from the polygon through its rotated corners"
        );
    }
}

#[test]
fn a_rotated_rect_puts_ink_on_its_rotated_corners_and_none_on_the_old_ones() {
    let (x0, y0, x1, y1) = (24.0, 20.0, 72.0, 60.0);
    let c = (48.0, 40.0);
    let mut t = white_tool();
    add(&mut t, 0, (x0, y0, x1, y1), 0, 0, 0, 0, 45.0);
    let buf = t.get_image_data();
    let inked = |(x, y): (f64, f64)| px(&buf, x.round() as u32, y.round() as u32)[1] < 200;
    for corner in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)] {
        let r = rotate(corner, 45.0, c);
        assert!(inked(r), "no ink at rotated corner {r:?}");
        // The unrotated corners are outside a 45°-turned rect of this aspect.
        assert!(
            !inked(corner),
            "ink left behind at the UNROTATED corner {corner:?}"
        );
    }
}

#[test]
fn a_rotated_line_turns_about_its_midpoint() {
    let (a, b) = ((20.0, 40.0), (76.0, 40.0));
    let c = (48.0, 40.0);
    let mut t = white_tool();
    add(&mut t, 2, (a.0, a.1, b.0, b.1), 0, 0, 0, 0, 90.0);
    let pts = [rotate(a, 90.0, c), rotate(b, 90.0, c)];
    assert!(t.get_image_data() == polyline_pixels(&pts));
}

#[test]
fn a_full_turn_is_stored_as_no_turn_and_draws_the_same_sketch() {
    // 360° normalizes to 0°, so it takes the unrotated route and draws the
    // same sketchy outline to the byte. (That the wobble is built UNROTATED
    // and turned afterwards is pinned white-box in `drawing.rs`, where the
    // wobble points are reachable.)
    let mut a = white_tool();
    add(&mut a, 8, BOX, 0, 0, 60, 0, 0.0);
    let mut b = white_tool();
    add(&mut b, 8, BOX, 0, 0, 60, 0, 360.0);
    assert!(a.get_image_data() == b.get_image_data());
    let mut r = white_tool();
    add(&mut r, 8, BOX, 0, 0, 60, 0, 30.0);
    assert!(
        a.get_image_data() != r.get_image_data(),
        "a real turn moves the ink"
    );
}

// ── 3. a rotated fill covers the rotated area ───────────────────────────────

#[test]
fn a_filled_rotated_rect_covers_its_rotated_area() {
    // A 40×40 square at 45° is a diamond with half-diagonal ≈ 28.3.
    let (x0, y0, x1, y1) = (28.0, 20.0, 68.0, 60.0);
    let mut t = white_tool();
    add(&mut t, 0, (x0, y0, x1, y1), 1, 0, 0, 0, 45.0);
    let buf = t.get_image_data();
    let is_fill = |x: u32, y: u32| {
        let p = px(&buf, x, y);
        p[2] > 150 && p[0] < 120 // the blue fill, not white, not the red stroke
    };
    assert!(is_fill(48, 40), "center");
    // Straight up from the center, past the unrotated top edge (y = 20) but
    // inside the diamond's top vertex (y ≈ 11.7): rotated area, filled.
    assert!(
        is_fill(48, 17),
        "inside the rotated square, outside the unrotated one"
    );
    // The unrotated square's corner region is outside the diamond: untouched.
    assert_eq!(
        px(&buf, 30, 22),
        [255, 255, 255, 255],
        "unrotated corner stays empty"
    );
}

#[test]
fn every_fill_kind_turns_with_the_rect() {
    for fill in [1u8, 2, 3] {
        let mut a = tool_on(&gradient());
        add(&mut a, 0, BOX, fill, 0, 0, 0, 0.0);
        let mut b = tool_on(&gradient());
        add(&mut b, 0, BOX, fill, 0, 0, 0, 30.0);
        assert!(
            a.get_image_data() != b.get_image_data(),
            "fill_kind {fill}: rotation changed nothing"
        );
    }
}

// ── 4. circles ──────────────────────────────────────────────────────────────

#[test]
fn a_circle_ignores_rotation_unless_its_fill_has_a_direction() {
    for (fill, angle) in [(0u8, 0u16), (1, 0), (3, 0)] {
        let mut a = tool_on(&gradient());
        add(&mut a, 1, BOX, fill, angle, 0, 0, 0.0);
        let mut b = tool_on(&gradient());
        add(&mut b, 1, BOX, fill, angle, 0, 0, 37.0);
        assert!(
            a.get_image_data() == b.get_image_data(),
            "fill_kind {fill}: a circle is rotation-invariant and must not be resampled"
        );
    }
    // A gradient has a direction, so a gradient circle DOES turn.
    let mut a = tool_on(&gradient());
    add(&mut a, 1, BOX, 2, 0, 0, 0, 0.0);
    let mut b = tool_on(&gradient());
    add(&mut b, 1, BOX, 2, 0, 0, 0, 90.0);
    assert!(a.get_image_data() != b.get_image_data());
}

// ── warp + rotation compose as "warp, then rotate" ──────────────────────────

#[test]
fn a_rotated_warped_shape_is_warped_then_rotated() {
    // KEYSTONE pulls the TOP edge in. Turned 180°, the narrow edge must end up
    // at the BOTTOM — which is only true if the rotation is applied after the
    // warp (rotating first and then warping in the rotated frame would keep
    // the narrow edge on top).
    let mut t = white_tool();
    let id = add(&mut t, 0, (20.0, 20.0, 76.0, 60.0), 1, 0, 0, 0, 180.0);
    assert!(t.set_shape_perspective(id, &KEYSTONE));
    let buf = t.get_image_data();
    let width_of_row = |y: u32| {
        (0..W)
            .filter(|&x| px(&buf, x, y) != [255, 255, 255, 255])
            .count()
    };
    let (top, bottom) = (width_of_row(24), width_of_row(56));
    assert!(
        bottom + 12 < top,
        "180° after a top keystone: bottom row ({bottom} px) should be the narrow one, top is {top}"
    );
}

// ── 5. the triangle and the n-point star ────────────────────────────────────

/// Mirrors `drawing::triangle_vertices`.
fn triangle(b: (f64, f64, f64, f64)) -> [(f64, f64); 3] {
    let (minx, miny, maxx, maxy) = (b.0.min(b.2), b.1.min(b.3), b.0.max(b.2), b.1.max(b.3));
    [((minx + maxx) * 0.5, miny), (maxx, maxy), (minx, maxy)]
}

fn mid(a: (f64, f64), b: (f64, f64)) -> (f64, f64) {
    ((a.0 + b.0) / 2.0, (a.1 + b.1) / 2.0)
}

#[test]
fn the_triangle_strokes_its_three_edges_and_nothing_else() {
    let mut t = white_tool();
    add(&mut t, 10, BOX, 0, 0, 0, 0, 0.0);
    let buf = t.get_image_data();
    let v = triangle(BOX);
    for (a, b) in [(v[0], v[1]), (v[1], v[2]), (v[2], v[0])] {
        let (x, y) = mid(a, b);
        assert!(
            px(&buf, x.round() as u32, y.round() as u32)[1] < 100,
            "no ink mid-edge at ({x}, {y})"
        );
    }
    // The bbox's top corners are outside an apex-up triangle.
    assert_eq!(px(&buf, 15, 11), [255, 255, 255, 255]);
    assert_eq!(px(&buf, 77, 11), [255, 255, 255, 255]);
    // And it is not filled, even when asked (fills stay rect/circle only).
    let mut f = white_tool();
    add(&mut f, 10, BOX, 1, 0, 0, 0, 0.0);
    assert_eq!(px(&f.get_image_data(), 46, 50), [255, 255, 255, 255]);
}

#[test]
fn a_triangle_hit_tests_its_edges_and_its_empty_inside_is_a_miss() {
    let mut t = white_tool();
    let id = add(&mut t, 10, BOX, 0, 0, 0, 0, 0.0) as i32;
    let v = triangle(BOX);
    for (a, b) in [(v[0], v[1]), (v[1], v[2]), (v[2], v[0])] {
        let (x, y) = mid(a, b);
        assert_eq!(t.shape_annotation_at(x, y), id, "edge midpoint ({x}, {y})");
    }
    assert_eq!(
        t.shape_annotation_at(46.0, 48.0),
        -1,
        "the empty inside is a miss"
    );
    assert_eq!(
        t.shape_annotation_at(16.0, 12.0),
        -1,
        "the bbox corner is not ink"
    );
}

/// Mirrors `drawing::star_vertices_n`.
fn star(b: (f64, f64, f64, f64), n: u32) -> Vec<(f64, f64)> {
    let (minx, miny, maxx, maxy) = (b.0.min(b.2), b.1.min(b.3), b.0.max(b.2), b.1.max(b.3));
    let (cx, cy) = ((minx + maxx) * 0.5, (miny + maxy) * 0.5);
    let (orx, ory) = ((maxx - minx) * 0.5, (maxy - miny) * 0.5);
    (0..2 * n)
        .map(|i| {
            let (rx, ry) = if i % 2 == 0 {
                (orx, ory)
            } else {
                (orx * 0.5, ory * 0.5)
            };
            let a = -std::f64::consts::PI / 2.0 + i as f64 * std::f64::consts::PI / n as f64;
            (cx + rx * a.cos(), cy + ry * a.sin())
        })
        .collect()
}

#[test]
fn a_seven_point_star_has_fourteen_vertices_and_hits_on_its_edges() {
    let big = (8.0, 4.0, 88.0, 76.0);
    let mut t = white_tool();
    let id = add(&mut t, 9, big, 0, 0, 0, 7, 0.0) as i32;
    let v = star(big, 7);
    assert_eq!(v.len(), 14);
    let buf = t.get_image_data();
    for i in 0..v.len() {
        let (x, y) = mid(v[i], v[(i + 1) % v.len()]);
        assert_eq!(
            t.shape_annotation_at(x, y),
            id,
            "edge {i} midpoint ({x}, {y})"
        );
        assert!(
            px(&buf, x.round() as u32, y.round() as u32)[1] < 150,
            "no ink on edge {i}"
        );
    }
    assert_eq!(
        t.shape_annotation_at(48.0, 40.0),
        -1,
        "the empty center is a miss"
    );
    // It really is a different star from the five-point one.
    let mut five = white_tool();
    add(&mut five, 9, big, 0, 0, 0, 0, 0.0);
    assert!(buf != five.get_image_data());
}

#[test]
fn star_points_are_clamped_to_3_through_12() {
    for (asked, stored) in [(1u8, 3u8), (2, 3), (3, 3), (12, 12), (13, 12), (255, 12)] {
        let mut t = white_tool();
        add(&mut t, 9, BOX, 0, 0, 0, asked, 0.0);
        let json = t.get_shape_annotations();
        assert!(
            json.contains(&format!("\"starPoints\":{stored},")),
            "asked {asked}, want {stored}: {json}"
        );
    }
}

// ── 6. hit-testing in the shape's own frame ─────────────────────────────────

#[test]
fn a_rotated_rect_hits_its_rotated_ring_and_misses_the_unrotated_only_corner() {
    // 60×24 box centered at (48, 40), turned 90°: it now stands 24 wide and
    // 60 tall. Stroke 3 → pad 6.
    let (x0, y0, x1, y1) = (18.0, 28.0, 78.0, 52.0);
    let mut t = white_tool();
    let id = add(&mut t, 0, (x0, y0, x1, y1), 0, 0, 0, 0, 90.0) as i32;
    // The rotated top edge runs along y = 10 (48 − 30), x 36..60.
    assert_eq!(t.shape_annotation_at(48.0, 10.0), id, "on the rotated ring");
    // The unrotated box's left end, (18, 40), is far outside the rotated one.
    assert_eq!(
        t.shape_annotation_at(18.0, 40.0),
        -1,
        "unrotated-only ring point"
    );
    assert_eq!(
        t.shape_annotation_at(20.0, 30.0),
        -1,
        "unrotated-only corner"
    );
    // The middle is still the empty inside.
    assert_eq!(t.shape_annotation_at(48.0, 40.0), -1, "empty inside");
}

#[test]
fn a_rotated_line_hits_along_its_rotated_direction() {
    let mut t = white_tool();
    let id = add(&mut t, 2, (20.0, 40.0, 76.0, 40.0), 0, 0, 0, 0, 90.0) as i32;
    assert_eq!(
        t.shape_annotation_at(48.0, 16.0),
        id,
        "on the now-vertical line"
    );
    assert_eq!(
        t.shape_annotation_at(22.0, 40.0),
        -1,
        "where the horizontal line used to be"
    );
}

#[test]
fn rotation_is_ignored_by_the_hit_test_of_kinds_that_ignore_it() {
    // An arrow (4) does not rotate, so its hit region must not either.
    let mut t = white_tool();
    let id = add(&mut t, 4, (20.0, 40.0, 76.0, 40.0), 0, 0, 0, 0, 90.0) as i32;
    assert_eq!(t.shape_annotation_at(30.0, 40.0), id);
}

// ── 7. the wasm surface ─────────────────────────────────────────────────────

#[test]
fn add_and_update_each_cost_exactly_one_undo_step() {
    let mut t = white_tool();
    let before = t.undo_count();
    let id = add(&mut t, 9, BOX, 0, 0, 0, 7, 30.0);
    assert_eq!(t.undo_count(), before + 1, "add = one step");
    let (x0, y0, x1, y1) = BOX;
    assert!(t.update_shape_annotation_full(
        id, 9, x0, y0, x1, y1, "#e02020", 3.0, 0, 0, "#000000", "#000000", 0, 8, 0, 9, -45.0,
    ));
    assert_eq!(t.undo_count(), before + 2, "update = one step");
    let labels = t.history_labels();
    assert!(
        labels.contains("Add Shape") && labels.contains("Edit Shape"),
        "{labels}"
    );

    // Undo puts the rotation and the point count back.
    t.undo();
    let json = t.get_shape_annotations();
    assert!(
        json.contains("\"rotation\":30,") && json.contains("\"starPoints\":7,"),
        "{json}"
    );
}

#[test]
fn update_leaves_the_perspective_quad_alone() {
    let mut t = white_tool();
    let id = add(&mut t, 0, BOX, 0, 0, 0, 0, 0.0);
    assert!(t.set_shape_perspective(id, &KEYSTONE));
    let (x0, y0, x1, y1) = BOX;
    assert!(t.update_shape_annotation_full(
        id, 0, x0, y0, x1, y1, "#00ff00", 3.0, 0, 0, "#000000", "#000000", 0, 8, 0, 0, 25.0,
    ));
    assert_eq!(t.shape_perspective_of(id), KEYSTONE.to_vec());
}

#[test]
fn update_of_a_missing_id_is_refused_without_a_history_step() {
    let mut t = white_tool();
    let before = t.undo_count();
    assert!(!t.update_shape_annotation_full(
        4242, 0, 1.0, 1.0, 9.0, 9.0, "#000000", 1.0, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 10.0,
    ));
    assert_eq!(t.undo_count(), before);
}

#[test]
fn the_json_carries_rotation_and_star_points() {
    let mut t = white_tool();
    add(&mut t, 9, BOX, 0, 0, 0, 7, 30.0);
    let json = t.get_shape_annotations();
    assert!(json.contains("\"rotation\":30,"), "{json}");
    assert!(json.contains("\"starPoints\":7,"), "{json}");
    // Every shape carries both keys, defaults included.
    let mut plain = white_tool();
    add(&mut plain, 0, BOX, 0, 0, 0, 0, 0.0);
    let json = plain.get_shape_annotations();
    assert!(
        json.contains("\"rotation\":0,") && json.contains("\"starPoints\":0,"),
        "{json}"
    );
}

#[test]
fn rotation_is_stored_normalized_to_minus_180_exclusive_through_180() {
    for (asked, stored) in [
        (0.0, "0"),
        (-0.0, "0"),
        (180.0, "180"),
        (-180.0, "180"),
        (540.0, "180"),
        (190.0, "-170"),
        (-190.0, "170"),
        (720.5, "0.5"),
        (f64::NAN, "0"),
        (f64::INFINITY, "0"),
    ] {
        let mut t = white_tool();
        add(&mut t, 0, BOX, 0, 0, 0, 0, asked);
        let json = t.get_shape_annotations();
        assert!(
            json.contains(&format!("\"rotation\":{stored},")),
            "asked {asked}, want {stored}: {json}"
        );
    }
}

#[test]
fn star_points_have_one_stored_form_per_meaning() {
    // The five-point star is stored as 0 whichever way it is asked for, so a
    // default star written today and a star from a pre-rotation document are
    // the same value — and the op-log diff sees no change between them.
    for asked in [0u8, 5] {
        let mut t = white_tool();
        add(&mut t, 9, BOX, 0, 0, 0, asked, 0.0);
        assert!(
            t.get_shape_annotations().contains("\"starPoints\":0,"),
            "asked {asked}"
        );
    }
    // A point count means nothing on any other kind, so it is not kept there.
    let mut t = white_tool();
    add(&mut t, 0, BOX, 0, 0, 0, 7, 0.0);
    assert!(t.get_shape_annotations().contains("\"starPoints\":0,"));
}

#[test]
fn restore_takes_rotation_and_star_points_without_a_history_step() {
    let mut t = white_tool();
    let before = t.undo_count();
    t.restore_shape_annotation_full(
        9, 14.0, 10.0, 78.0, 66.0, 224, 32, 32, 3.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 8,
        -120.0,
    );
    assert_eq!(t.undo_count(), before, "restore pushes no history");
    let json = t.get_shape_annotations();
    assert!(
        json.contains("\"rotation\":-120,") && json.contains("\"starPoints\":8,"),
        "{json}"
    );
    // And it renders exactly like the same shape added live.
    let mut live = white_tool();
    add(&mut live, 9, BOX, 0, 0, 0, 8, -120.0);
    assert!(t.get_image_data() == live.get_image_data());
}

#[test]
fn the_legacy_rust_signatures_mean_unrotated_and_five_points() {
    let (x0, y0, x1, y1) = BOX;
    let mut a = tool_on(&gradient());
    a.add_shape_annotation(
        9, x0, y0, x1, y1, "#e02020", 3.0, 0, 0, "#2040e0", "#20e040", 0, 8, 0,
    );
    let json = a.get_shape_annotations();
    assert!(
        json.contains("\"rotation\":0,") && json.contains("\"starPoints\":0,"),
        "{json}"
    );
    // ⚠️ The legacy `update_shape_annotation` resets both — it is documented
    // as doing so, and this pins that nobody quietly changes it.
    let mut t = white_tool();
    let id = add(&mut t, 9, BOX, 0, 0, 0, 7, 30.0);
    assert!(t.update_shape_annotation(
        id, 9, x0, y0, x1, y1, "#e02020", 3.0, 0, 0, "#000000", "#000000", 0, 8, 0,
    ));
    let json = t.get_shape_annotations();
    assert!(
        json.contains("\"rotation\":0,") && json.contains("\"starPoints\":0,"),
        "{json}"
    );
}

#[test]
fn a_duplicate_keeps_its_rotation_and_points() {
    let mut t = white_tool();
    let id = add(&mut t, 9, BOX, 0, 0, 0, 7, 30.0);
    let copy = t.duplicate_shape_annotation(id, 4.0, 4.0);
    assert!(copy > 0);
    let json = t.get_shape_annotations();
    assert_eq!(json.matches("\"rotation\":30,").count(), 2, "{json}");
    assert_eq!(json.matches("\"starPoints\":7,").count(), 2, "{json}");
}
