//! A pen polyline (kind 6) hit-tests on its INK, not its bounding box
//! (PARKING_LOT 2026-09-18, Night 10-07 §1.5).
//!
//! #172 moved the `kind == 6` arm inside a branch whose condition never
//! admitted a 6, so the arm was dead and a polyline fell through to the
//! padded-bbox rule: a click ~100px from any ink inside an L-shaped stroke
//! still selected it, and a drag started inside a large freehand loop
//! reselected the loop. An UNFILLED polyline now joins the edges branch,
//! which is what `app/src/lib/annotationHitTest.ts` already did.
//!
//! Featureless on purpose, so plain `cargo test` and
//! `cargo clippy --all-targets` both compile and run it.

use stamp_tool::ImageHorseTool;

fn l_stroke() -> (ImageHorseTool, i32) {
    let mut t = ImageHorseTool::new(200, 200);
    t.load_image(&vec![255u8; 200 * 200 * 4]);
    // (20,20) → (20,180) → (180,180), 4px black.
    let id = t.restore_polyline_annotation(&[20.0, 20.0, 20.0, 180.0, 180.0, 180.0], 0, 0, 0, 4.0);
    (t, id as i32)
}

#[test]
fn a_click_far_from_the_ink_inside_the_l_misses() {
    let (t, _) = l_stroke();
    // About 100px from either leg, inside the stroke's bbox.
    assert_eq!(t.shape_annotation_at(150.0, 30.0), -1);
    assert_eq!(t.shape_annotation_at(100.0, 100.0), -1);
}

#[test]
fn a_click_on_the_ink_hits() {
    let (t, id) = l_stroke();
    assert_eq!(t.shape_annotation_at(20.0, 100.0), id, "the vertical leg");
    assert_eq!(
        t.shape_annotation_at(100.0, 180.0),
        id,
        "the horizontal leg"
    );
    assert_eq!(
        t.shape_annotation_at(27.0, 60.0),
        id,
        "within pad + 4 of the leg"
    );
}

#[test]
fn just_past_the_tolerance_misses() {
    let (t, _) = l_stroke();
    // pad = max(4/2, 6) = 6, tolerance 6 + 4 = 10px from the segment.
    assert_eq!(t.shape_annotation_at(31.0, 60.0), -1);
}
