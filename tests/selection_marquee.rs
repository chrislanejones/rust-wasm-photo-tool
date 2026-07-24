//! Marquee producers: `rect_select` / `ellipse_select` — the drag-gesture
//! selection shapes. Pure, deterministic, no UI. Both ride
//! `apply_produced_selection`, so combine modes (replace/add/subtract) are
//! covered here too, through `set_selection_combine`.
//!
//! Read-back convention matches tests/selection_boolean.rs: a pixel is
//! selected iff its overlay alpha is non-zero; an empty/None selection
//! returns an empty overlay.

use stamp_tool::ImageHorseTool;

const W: u32 = 20;
const H: u32 = 12;

/// Filled rectangle mask over `[x0,x1) × [y0,y1)`.
fn rect(x0: u32, y0: u32, x1: u32, y1: u32) -> Vec<bool> {
    let mut m = vec![false; (W * H) as usize];
    for y in y0..y1 {
        for x in x0..x1 {
            m[(y * W + x) as usize] = true;
        }
    }
    m
}

fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![128u8; (W * H * 4) as usize]);
    t
}

/// The current selection, decoded from the overlay's alpha channel.
fn selected(t: &ImageHorseTool) -> Vec<bool> {
    let ov = t.selection_overlay();
    if ov.is_empty() {
        return vec![false; (W * H) as usize];
    }
    (0..(W * H) as usize).map(|i| ov[i * 4 + 3] > 0).collect()
}

fn count(m: &[bool]) -> usize {
    m.iter().filter(|&&b| b).count()
}

fn at(m: &[bool], x: u32, y: u32) -> bool {
    m[(y * W + x) as usize]
}

// ── rect_select ─────────────────────────────────────────────────────────────

#[test]
fn rect_select_is_exactly_the_integer_rect() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 10.0, 8.0);
    assert_eq!(selected(&t), rect(2, 2, 10, 8));
}

#[test]
fn rect_select_normalises_corner_order() {
    let mut t = new_tool();
    t.rect_select(10.0, 8.0, 2.0, 2.0); // dragged up-left
    assert_eq!(
        selected(&t),
        rect(2, 2, 10, 8),
        "corner order must not matter"
    );
}

#[test]
fn rect_select_snaps_a_sub_pixel_drag_outward() {
    let mut t = new_tool();
    // floor(3.2)=3, ceil(3.9)=4 → exactly pixel (3,5)
    t.rect_select(3.2, 5.1, 3.9, 5.8);
    let got = selected(&t);
    assert_eq!(count(&got), 1);
    assert!(at(&got, 3, 5));
}

#[test]
fn rect_select_clamps_an_overshooting_drag_to_the_canvas() {
    let mut t = new_tool();
    t.rect_select(-5.0, -7.0, 500.0, 300.0);
    assert_eq!(
        count(&selected(&t)),
        (W * H) as usize,
        "an over-canvas drag selects everything, no panic"
    );
}

#[test]
fn rect_select_fully_off_canvas_replaces_with_nothing() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    assert!(t.has_selection());
    // Replace-mode with an off-canvas rect = Photoshop's empty-marquee
    // deselect, and it must read as None, not a zero-area selection.
    t.rect_select(50.0, 50.0, 60.0, 60.0);
    assert!(!t.has_selection());
    assert!(t.selection_overlay().is_empty());
}

#[test]
fn degenerate_drag_deselects_in_replace_mode() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    assert!(t.has_selection());
    t.rect_select(4.0, 4.0, 4.0, 4.0); // zero-area drag
    assert!(
        !t.has_selection(),
        "empty marquee replaces with no selection"
    );
}

// ── ellipse_select ──────────────────────────────────────────────────────────

#[test]
fn ellipse_selects_centre_but_not_bounding_corners() {
    let mut t = new_tool();
    t.ellipse_select(2.0, 2.0, 12.0, 12.0); // circle r=5 centred at (7,7)
    let got = selected(&t);
    assert!(at(&got, 7, 7), "centre is in");
    assert!(at(&got, 2, 7), "left edge midpoint is in");
    assert!(!at(&got, 2, 2), "bounding-box corner is out");
    assert!(!at(&got, 11, 2), "every corner is out");
    // strictly between the inscribed diamond and the full box
    let box_count = count(&rect(2, 2, 12, 12));
    let c = count(&got);
    assert!(
        c > box_count / 2 && c < box_count,
        "π/4 of the box, roughly"
    );
}

#[test]
fn ellipse_dragged_past_the_edge_is_cropped_not_squashed() {
    let mut t = new_tool();
    // Circle r=6 centred at (0,6): only the right half is on-canvas.
    t.ellipse_select(-6.0, 0.0, 6.0, 12.0);
    let got = selected(&t);
    assert!(at(&got, 0, 6), "on-canvas part of the centre row is in");
    assert!(at(&got, 5, 6), "rightmost pixel of the radius is in");
    assert!(
        !at(&got, 5, 0),
        "top-right stays out — shape kept, not squashed"
    );
}

#[test]
fn one_pixel_ellipse_drag_selects_its_pixel() {
    let mut t = new_tool();
    t.ellipse_select(3.0, 5.0, 4.0, 6.0);
    let got = selected(&t);
    assert_eq!(count(&got), 1);
    assert!(at(&got, 3, 5));
}

// ── combine modes through the marquee producers ────────────────────────────

#[test]
fn rect_marquee_unions_under_combine_mode_1() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    t.set_selection_combine(1);
    t.rect_select(6.0, 4.0, 14.0, 10.0);
    let want: Vec<bool> = rect(2, 2, 8, 8)
        .iter()
        .zip(&rect(6, 4, 14, 10))
        .map(|(&a, &b)| a || b)
        .collect();
    assert_eq!(selected(&t), want, "combine=1 must union the two marquees");
}

#[test]
fn ellipse_marquee_subtracts_under_combine_mode_2() {
    let mut t = new_tool();
    t.rect_select(0.0, 0.0, 20.0, 12.0); // everything
    t.set_selection_combine(2);
    t.ellipse_select(2.0, 2.0, 12.0, 12.0);
    let got = selected(&t);
    assert!(!at(&got, 7, 7), "ellipse interior was subtracted");
    assert!(at(&got, 2, 2), "box corner outside the ellipse survives");
    assert!(at(&got, 15, 5), "pixels outside the drag rect survive");
}

#[test]
fn combine_mode_survives_between_marquees_until_reset() {
    // JS pushes set_selection_combine before EVERY op; the engine keeps the
    // last value. Pin that: two unions without a reset both add.
    let mut t = new_tool();
    t.rect_select(0.0, 0.0, 4.0, 4.0);
    t.set_selection_combine(1);
    t.rect_select(8.0, 0.0, 12.0, 4.0);
    t.rect_select(16.0, 0.0, 20.0, 4.0);
    assert_eq!(count(&selected(&t)), 48, "three 4×4 islands");
    t.set_selection_combine(0);
    t.rect_select(0.0, 8.0, 4.0, 12.0);
    assert_eq!(count(&selected(&t)), 16, "replace mode drops the islands");
}

// ── downstream composition ──────────────────────────────────────────────────

#[test]
fn marquee_selection_feeds_selection_to_new_layer() {
    let mut t = new_tool();
    t.rect_select(3.0, 3.0, 9.0, 9.0);
    let id = t.selection_to_new_layer(false);
    assert_ne!(id, 0, "a marquee selection must lift to a new layer");
    assert!(
        !t.has_selection(),
        "to-new-layer deselects, same as from any producer"
    );
}
