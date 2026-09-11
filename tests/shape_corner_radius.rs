//! Rounded rectangles (v8.75): a rectangle's `corner_radius` has to do four
//! things a user will check, in the order they will check them:
//!
//!   1. actually cut the corner — the fill AND the stroke, in the same place,
//!   2. land in the annotation DATA, so Reselect and a reload get it back
//!      rather than resurrecting a square box,
//!   3. change through `update_shape_annotation` like every other style
//!      field the panel owns,
//!   4. undo as exactly one step.
//!
//! Every other kind ignores the field — a circle has no corners — and radius
//! 0 is byte-for-byte the sharp rectangle, so the old path is untouched.

use stamp_tool::ImageHorseTool;

const W: u32 = 64;
const H: u32 = 64;
const WHITE: [u8; 4] = [255, 255, 255, 255];

fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    t.recomposite();
    t
}

/// One exported pixel — the artifact the download path writes, not the
/// on-screen preview.
fn px(t: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
    let d = t.render_with_annotations();
    let i = ((y * W + x) * 4) as usize;
    [d[i], d[i + 1], d[i + 2], d[i + 3]]
}

/// A 48×48 box at (8,8)-(56,56): black 2px stroke, optional solid red fill.
fn add_rect(t: &mut ImageHorseTool, fill_kind: u8, radius: u32) -> u32 {
    t.add_shape_annotation(
        0, 8.0, 8.0, 56.0, 56.0, "#000000", 2.0, 0, fill_kind, "#ff0000", "#000000", 0, 0, radius,
    )
}

/// Same box, re-styled in place with a new radius — what a slider drag on a
/// reselected rectangle produces once it reaches `commitEdit`.
fn set_radius(t: &mut ImageHorseTool, id: u32, fill_kind: u8, radius: u32) -> bool {
    t.update_shape_annotation(
        id, 0, 8.0, 8.0, 56.0, 56.0, "#000000", 2.0, 0, fill_kind, "#ff0000", "#000000", 0, 0,
        radius,
    )
}

/// Pull a numeric field out of the annotations JSON — the crate ships no JSON
/// parser to tests (same helper shape as `shape_recolour.rs`).
fn num(json: &str, key: &str) -> f64 {
    let at = json
        .find(key)
        .unwrap_or_else(|| panic!("no {key} in {json}"));
    let rest = &json[at + key.len()..];
    let end = rest
        .find(|c: char| c != '-' && c != '.' && !c.is_ascii_digit())
        .unwrap_or(rest.len());
    rest[..end].parse().unwrap()
}

fn stored_radius(t: &ImageHorseTool) -> u32 {
    num(&t.get_shape_annotations(), "\"corner_radius\":") as u32
}

// ── 1. the corner is actually cut ───────────────────────────────────────────

#[test]
fn radius_zero_is_the_sharp_rectangle() {
    // The default. The bbox corner is ink — fill or stroke, it is painted.
    let mut t = new_tool();
    add_rect(&mut t, 1, 0);
    assert_ne!(px(&t, 10, 10), WHITE, "a square box paints its corner");
    assert_eq!(
        px(&t, 32, 32),
        [255, 0, 0, 255],
        "and its centre is the fill"
    );
}

#[test]
fn radius_cuts_the_filled_corner() {
    // Radius 20 on the 48px box: the arc centre is (28,28), so the pixel at
    // (10,10) — 24px from it — lies outside the rounded outline entirely.
    let mut t = new_tool();
    add_rect(&mut t, 1, 20);
    assert_eq!(
        px(&t, 10, 10),
        WHITE,
        "the corner is cut away — no fill, no stroke"
    );
    assert_eq!(px(&t, 32, 32), [255, 0, 0, 255], "the interior still fills");
    assert_ne!(px(&t, 32, 8), WHITE, "the straight top edge still strokes");
    assert_ne!(
        px(&t, 32, 8),
        [255, 0, 0, 255],
        "…with the stroke, not the fill"
    );
}

#[test]
fn radius_cuts_the_stroked_corner_too() {
    // Outline only. With square corners the bbox corner pixel is stroke; with
    // a radius it is bare canvas — the stroke follows the same arc the fill
    // was clipped to, so the two can never disagree about where the corner is.
    let mut t = new_tool();
    add_rect(&mut t, 0, 20);
    assert_eq!(px(&t, 8, 8), WHITE, "no stroke at the sharp corner");
    assert_ne!(px(&t, 32, 8), WHITE, "the straight run is still stroked");
    assert_eq!(px(&t, 32, 32), WHITE, "and the interior is still empty");
}

#[test]
fn radius_clamps_to_half_the_shorter_side() {
    // A radius larger than the box degrades to a pill, never an inverted
    // corner: the centre must still be filled and the edge midpoint stroked.
    let mut t = new_tool();
    add_rect(&mut t, 1, 500);
    assert_eq!(px(&t, 32, 32), [255, 0, 0, 255]);
    assert_ne!(px(&t, 32, 8), WHITE);
    assert_eq!(px(&t, 9, 9), WHITE);
}

#[test]
fn other_kinds_ignore_the_radius() {
    // A circle with a radius set renders exactly like one without.
    let mut a = new_tool();
    a.add_shape_annotation(
        1, 8.0, 8.0, 56.0, 56.0, "#000000", 2.0, 0, 1, "#ff0000", "#000000", 0, 0, 0,
    );
    let mut b = new_tool();
    b.add_shape_annotation(
        1, 8.0, 8.0, 56.0, 56.0, "#000000", 2.0, 0, 1, "#ff0000", "#000000", 0, 0, 20,
    );
    assert_eq!(a.render_with_annotations(), b.render_with_annotations());
}

// ── 2. it lands in the annotation data ──────────────────────────────────────

#[test]
fn radius_lands_in_the_annotation_data() {
    let mut t = new_tool();
    add_rect(&mut t, 1, 20);
    assert_eq!(
        stored_radius(&t),
        20,
        "Reselect and reload rebuild from this"
    );
}

#[test]
fn radius_survives_the_restore_path() {
    let mut t = new_tool();
    t.restore_shape_annotation(
        0, 8.0, 8.0, 56.0, 56.0, 0, 0, 0, 2.0, 0, 1, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 20,
    );
    assert_eq!(stored_radius(&t), 20);
    assert_eq!(
        px(&t, 10, 10),
        WHITE,
        "and it renders rounded after a reload"
    );
}

// ── 3 + 4. update, then undo as one step ────────────────────────────────────

#[test]
fn update_rounds_a_square_box_and_undo_squares_it_again() {
    let mut t = new_tool();
    let id = add_rect(&mut t, 1, 0);
    assert_ne!(px(&t, 10, 10), WHITE, "precondition: square");

    assert!(set_radius(&mut t, id, 1, 20), "known id must be accepted");
    assert_eq!(stored_radius(&t), 20);
    assert_eq!(px(&t, 10, 10), WHITE, "the update rounds it");

    assert!(t.undo(), "one step to undo");
    assert_eq!(stored_radius(&t), 0, "undo restores the square box");
    assert_ne!(px(&t, 10, 10), WHITE);
}
