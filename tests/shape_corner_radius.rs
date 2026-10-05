//! Shape corner radii (ADR-082) — Figma's corner radius on the rect, diamond,
//! star and triangle, uniform or one corner at a time.
//!
//!   1. square corners (no radii) draw exactly what they drew before, which
//!      the pinned hashes in `shape_rotation.rs` already hold for every kind;
//!   2. a rounded, filled rect leaves its bbox corners empty and still fills
//!      its middle and the straight runs of its edges;
//!   3. one corner rounded leaves the other three square;
//!   4. a radius bigger than the shape is clamped, not inverted;
//!   5. the wasm surface: JSON carries `cornerRadii`, the stored form is
//!      canonical per kind, update/restore/duplicate/resize carry them.
//!
//! Featureless, like `shape_rotation.rs`; the op-log half lives in
//! `src/ops.rs` and `src/ops_engine_parity.rs`.

use stamp_tool::ImageHorseTool;

const W: u32 = 96;
const H: u32 = 80;
const BOX: (f64, f64, f64, f64) = (14.0, 10.0, 78.0, 66.0);

fn white_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    t
}

fn px(buf: &[u8], x: u32, y: u32) -> [u8; 4] {
    let i = ((y * W + x) * 4) as usize;
    [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

/// Red stroke 1, solid blue fill.
fn add(t: &mut ImageHorseTool, kind: u8, fill: u8, radii: &[u16]) -> u32 {
    let (x0, y0, x1, y1) = BOX;
    t.add_shape_annotation_full(
        kind, x0, y0, x1, y1, "#e02020", 1.0, 0, fill, "#2040e0", "#2040e0", 0, 8, 0, 0, 0.0, radii,
    )
}

const WHITE: [u8; 4] = [255, 255, 255, 255];

#[test]
fn a_rounded_filled_rect_leaves_its_bbox_corners_empty() {
    let mut t = white_tool();
    add(&mut t, 0, 1, &[16, 16, 16, 16]);
    let buf = t.get_image_data();
    // 2 px in from each bbox corner: inside the square, outside a 16 px arc.
    for (x, y) in [(16, 12), (76, 12), (76, 64), (16, 64)] {
        assert_eq!(px(&buf, x, y), WHITE, "corner ({x}, {y}) is rounded off");
    }
    assert_ne!(px(&buf, 46, 38), WHITE, "the middle is filled");
    // The straight runs of the edges still carry ink.
    assert_ne!(px(&buf, 46, 10), WHITE, "top edge");
    assert_ne!(px(&buf, 14, 38), WHITE, "left edge");
}

#[test]
fn one_rounded_corner_leaves_the_other_three_square() {
    let mut t = white_tool();
    // TR only — what shift-dragging the top-right dot produces.
    add(&mut t, 0, 1, &[0, 20, 0, 0]);
    let buf = t.get_image_data();
    assert_eq!(px(&buf, 76, 12), WHITE, "TR is rounded");
    for (x, y) in [(16, 12), (76, 64), (16, 64)] {
        assert_ne!(px(&buf, x, y), WHITE, "corner ({x}, {y}) stays square");
    }
}

#[test]
fn an_unfilled_rounded_rect_strokes_its_arcs_not_its_corners() {
    let mut t = white_tool();
    add(&mut t, 0, 0, &[16, 16, 16, 16]);
    let buf = t.get_image_data();
    assert_eq!(px(&buf, 14, 10), WHITE, "no ink on the square corner");
    // The arc's midpoint: center (30, 26), radius 16, at 225°.
    let s = std::f64::consts::FRAC_1_SQRT_2;
    let (ax, ay): (f64, f64) = (30.0 - 16.0 * s, 26.0 - 16.0 * s);
    let (ax, ay) = (ax.round() as u32, ay.round() as u32);
    let near = (ax - 1..=ax + 1).any(|x| (ay - 1..=ay + 1).any(|y| px(&buf, x, y) != WHITE));
    assert!(near, "ink on the arc near ({ax}, {ay})");
}

#[test]
fn a_radius_bigger_than_the_shape_is_clamped_to_a_capsule() {
    let mut t = white_tool();
    add(&mut t, 0, 1, &[5000, 5000, 5000, 5000]);
    let buf = t.get_image_data();
    // Clamped to half of each edge: the short side (56) gives a 28 px radius
    // on top and bottom, so the shape is a stadium, still filled in the middle.
    assert_ne!(px(&buf, 46, 38), WHITE, "the middle is still filled");
    assert_eq!(px(&buf, 16, 12), WHITE, "the corners are gone");
}

#[test]
fn every_cornered_kind_takes_a_radius_and_changes_its_pixels() {
    for kind in [0u8, 8, 9, 10] {
        let mut sharp = white_tool();
        add(&mut sharp, kind, 1, &[]);
        let mut round = white_tool();
        add(&mut round, kind, 1, &[10, 10, 10, 10]);
        assert_ne!(
            sharp.get_image_data(),
            round.get_image_data(),
            "kind {kind} rounds its corners"
        );
    }
}

#[test]
fn zero_radii_are_the_square_shape_byte_for_byte() {
    for kind in [0u8, 8, 9, 10] {
        let mut legacy = white_tool();
        let (x0, y0, x1, y1) = BOX;
        legacy.add_shape_annotation(
            kind, x0, y0, x1, y1, "#e02020", 1.0, 0, 1, "#2040e0", "#2040e0", 0, 8, 0,
        );
        let mut zero = white_tool();
        add(&mut zero, kind, 1, &[0, 0, 0, 0]);
        assert_eq!(
            legacy.get_image_data(),
            zero.get_image_data(),
            "kind {kind}"
        );
    }
}

#[test]
fn a_sketchy_rounded_rect_renders_and_stays_near_its_outline() {
    let mut t = white_tool();
    let (x0, y0, x1, y1) = BOX;
    t.add_shape_annotation_full(
        0,
        x0,
        y0,
        x1,
        y1,
        "#e02020",
        2.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        8,
        80,
        0,
        0.0,
        &[14, 14, 14, 14],
    );
    let buf = t.get_image_data();
    assert!(buf.chunks(4).any(|p| p != WHITE), "draws something");
    assert_eq!(px(&buf, 46, 38), WHITE, "the inside stays empty");
}

#[test]
fn radii_are_stored_canonical_per_kind() {
    let mut t = white_tool();
    add(&mut t, 0, 0, &[1, 2, 3, 4]);
    add(&mut t, 9, 0, &[7, 99, 99, 99]);
    add(&mut t, 10, 0, &[1, 2, 3, 4]);
    add(&mut t, 1, 0, &[5, 5, 5, 5]);
    add(&mut t, 2, 0, &[5, 5, 5, 5]);
    add(&mut t, 8, 0, &[6]);
    let json = t.get_shape_annotations();
    for want in [
        "\"cornerRadii\":[1,2,3,4]", // rect: per corner
        "\"cornerRadii\":[7,7,7,7]", // star: one radius, first wins
        "\"cornerRadii\":[1,2,3,0]", // triangle: three corners
        "\"cornerRadii\":[6,0,0,0]", // short slice: zeros past its end
    ] {
        assert!(json.contains(want), "{want} in {json}");
    }
    assert_eq!(
        json.matches("\"cornerRadii\":[0,0,0,0]").count(),
        2,
        "circle and line have no corners: {json}"
    );
}

#[test]
fn update_restore_and_duplicate_carry_the_radii() {
    let mut t = white_tool();
    let id = add(&mut t, 0, 1, &[]);
    let (x0, y0, x1, y1) = BOX;
    let before = t.undo_count();
    assert!(t.update_shape_annotation_full(
        id,
        0,
        x0,
        y0,
        x1,
        y1,
        "#e02020",
        1.0,
        0,
        1,
        "#2040e0",
        "#2040e0",
        0,
        8,
        0,
        0,
        0.0,
        &[3, 4, 5, 6],
    ));
    assert_eq!(t.undo_count(), before + 1, "one undo step");
    assert!(t
        .get_shape_annotations()
        .contains("\"cornerRadii\":[3,4,5,6]"));
    let dup = t.duplicate_shape_annotation(id, 4.0, 4.0);
    assert!(dup > 0);
    assert_eq!(
        t.get_shape_annotations()
            .matches("\"cornerRadii\":[3,4,5,6]")
            .count(),
        2
    );

    let mut r = white_tool();
    let before = r.undo_count();
    r.restore_shape_annotation_full(
        0,
        x0,
        y0,
        x1,
        y1,
        224,
        32,
        32,
        1.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        8,
        0,
        0,
        0.0,
        &[9, 9, 9, 9],
    );
    assert_eq!(r.undo_count(), before, "restore pushes no history");
    assert!(r
        .get_shape_annotations()
        .contains("\"cornerRadii\":[9,9,9,9]"));
}

#[test]
fn an_image_resize_scales_the_radii_with_the_shape() {
    let mut t = white_tool();
    add(&mut t, 0, 0, &[10, 0, 20, 0]);
    t.resize(W * 2, H * 2);
    assert!(
        t.get_shape_annotations()
            .contains("\"cornerRadii\":[20,0,40,0]"),
        "{}",
        t.get_shape_annotations()
    );
}
