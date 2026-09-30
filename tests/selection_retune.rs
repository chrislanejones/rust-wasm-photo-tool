//! The live-tolerance engine surface: `selection_coverage` (the readout),
//! intersect as a fourth combine mode, and `selection_retune` — re-running the
//! last click-once selection from the same seed without it behaving like a
//! second click.
//!
//! The fixture is a horizontal gray ramp, 10 levels per column, so tolerance
//! maps to a column count exactly: seeding at x = 0, tolerance `t` takes
//! columns `0..=t/10` — every row of each.

use stamp_tool::ImageHorseTool;

const W: u32 = 20;
const H: u32 = 12;

fn ramp_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    let mut buf = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let i = ((y * W + x) * 4) as usize;
            let v = (x * 10) as u8;
            buf[i..i + 4].copy_from_slice(&[v, v, v, 255]);
        }
    }
    t.load_image(&buf);
    t.recomposite();
    t
}

fn cols(n: u32) -> u32 {
    n * H
}

fn coverage(t: &ImageHorseTool) -> (u32, u32) {
    let c = t.selection_coverage();
    (c[0], c[1])
}

fn overlay_count(t: &ImageHorseTool) -> u32 {
    let ov = t.selection_overlay();
    (0..(W * H) as usize)
        .filter(|&i| !ov.is_empty() && ov[i * 4 + 3] > 0)
        .count() as u32
}

// ── selection_coverage ─────────────────────────────────────────────────────

#[test]
fn coverage_is_zero_of_total_with_nothing_selected() {
    let t = ramp_tool();
    assert_eq!(coverage(&t), (0, W * H));
}

#[test]
fn coverage_is_total_of_total_after_select_all() {
    let mut t = ramp_tool();
    t.select_all();
    assert_eq!(coverage(&t), (W * H, W * H));
}

#[test]
fn coverage_counts_a_known_shape_exactly() {
    let mut t = ramp_tool();
    t.rect_select(2.0, 3.0, 8.0, 7.0); // 6 × 4
    assert_eq!(coverage(&t), (24, W * H));
    assert_eq!(
        coverage(&t).0,
        overlay_count(&t),
        "the number matches the ants"
    );
}

#[test]
fn coverage_on_an_empty_canvas_does_not_divide_or_panic() {
    let t = ImageHorseTool::new(0, 0);
    assert_eq!(t.selection_coverage(), vec![0, 0]);
}

// ── intersect ───────────────────────────────────────────────────────────────

#[test]
fn intersect_keeps_only_the_overlap() {
    let mut t = ramp_tool();
    // The rect starts at column 1 so the wand is NOT a subset of it: a plain
    // replace (3 columns) and an intersect (2) must give different answers.
    t.rect_select(1.0, 0.0, 10.0, H as f64); // columns 1..10
    t.set_selection_combine(3);
    t.magic_wand_select(0.0, 5.0, 25); // columns 0..=2
    assert_eq!(coverage(&t).0, cols(2));
}

#[test]
fn intersect_with_nothing_selected_is_nothing() {
    let mut t = ramp_tool();
    t.set_selection_combine(3);
    t.magic_wand_select(0.0, 5.0, 25);
    assert!(!t.has_selection());
}

#[test]
fn combine_mode_clamps_to_intersect() {
    let mut t = ramp_tool();
    t.rect_select(1.0, 0.0, 10.0, H as f64);
    t.set_selection_combine(200); // clamps to 3, not to replace
    t.magic_wand_select(0.0, 5.0, 25);
    assert_eq!(coverage(&t).0, cols(2));
}

// ── selection_retune ────────────────────────────────────────────────────────

#[test]
fn retune_rewrites_the_click_in_place_with_no_new_step() {
    let mut t = ramp_tool();
    let d0 = t.undo_snapshot_count();
    t.magic_wand_select(0.0, 5.0, 25);
    assert_eq!(coverage(&t).0, cols(3));
    assert_eq!(t.undo_snapshot_count(), d0 + 1);

    assert!(t.selection_can_retune());
    t.selection_retune(55, 0);
    assert_eq!(coverage(&t).0, cols(6), "wider tolerance, more columns");
    t.selection_retune(15, 0);
    assert_eq!(coverage(&t).0, cols(2), "and it can shrink again");
    assert_eq!(t.undo_snapshot_count(), d0 + 1, "slider ticks push nothing");

    assert!(t.undo());
    assert!(
        !t.has_selection(),
        "one undo removes the click and every retune"
    );
}

#[test]
fn retune_combines_with_the_selection_from_before_the_click() {
    let mut t = ramp_tool();
    t.rect_select(15.0, 0.0, 20.0, H as f64); // columns 15..20
    t.set_selection_combine(1);
    t.magic_wand_select(0.0, 5.0, 25);
    assert_eq!(coverage(&t).0, cols(5) + cols(3));

    t.selection_retune(55, 0);
    t.selection_retune(25, 0);
    // Against the PREVIOUS RUN this would stay at 5 + 6 columns: a union
    // never shrinks. Against the pre-click base it comes back to 5 + 3.
    assert_eq!(coverage(&t).0, cols(5) + cols(3));
}

#[test]
fn retune_keeps_the_mode_the_click_was_made_with() {
    let mut t = ramp_tool();
    t.rect_select(15.0, 0.0, 20.0, H as f64);
    t.set_selection_combine(1);
    t.magic_wand_select(0.0, 5.0, 25);
    t.set_selection_combine(0); // the panel moved on; the click did not
    t.selection_retune(55, 0);
    assert_eq!(coverage(&t).0, cols(5) + cols(6));
}

#[test]
fn a_noop_click_then_retune_pushes_exactly_one_step() {
    let mut t = ramp_tool();
    t.magic_wand_select(0.0, 5.0, 25);
    let d = t.undo_snapshot_count();
    t.magic_wand_select(0.0, 5.0, 25); // same result — no step
    assert_eq!(t.undo_snapshot_count(), d);
    assert!(
        t.selection_can_retune(),
        "a no-op click is still re-tunable"
    );

    t.selection_retune(55, 0);
    assert_eq!(
        t.undo_snapshot_count(),
        d + 1,
        "the first change pushes the step"
    );
    t.selection_retune(75, 0);
    assert_eq!(t.undo_snapshot_count(), d + 1, "and only the first");

    assert!(t.undo());
    assert_eq!(coverage(&t).0, cols(3), "undo returns to before the retune");
}

#[test]
fn undo_makes_the_record_stale() {
    let mut t = ramp_tool();
    t.magic_wand_select(0.0, 5.0, 25);
    assert!(t.undo());
    assert!(!t.selection_can_retune());
    assert!(t.selection_retune(55, 0).is_empty(), "refused");
    assert!(!t.has_selection(), "and the refused run changed nothing");
}

#[test]
fn a_later_edit_makes_the_record_stale() {
    let mut t = ramp_tool();
    t.magic_wand_select(0.0, 5.0, 25);
    t.rect_select(10.0, 0.0, 12.0, 2.0);
    assert!(!t.selection_can_retune());
    let before = coverage(&t);
    t.selection_retune(55, 0);
    assert_eq!(coverage(&t), before);
}

#[test]
fn undo_then_a_new_edit_at_the_same_depth_is_still_stale() {
    // Depth alone cannot tell these apart — the generation can.
    let mut t = ramp_tool();
    t.magic_wand_select(0.0, 5.0, 25);
    assert!(t.undo());
    t.rect_select(10.0, 0.0, 12.0, 2.0);
    assert!(!t.selection_can_retune());
}

#[test]
fn marquee_and_select_all_are_not_retunable() {
    let mut t = ramp_tool();
    t.rect_select(0.0, 0.0, 4.0, 4.0);
    assert!(!t.selection_can_retune());
    t.magic_wand_select(0.0, 5.0, 25);
    t.select_all();
    assert!(!t.selection_can_retune());
}

#[test]
fn an_out_of_bounds_click_leaves_nothing_to_retune() {
    let mut t = ramp_tool();
    t.magic_wand_select(0.0, 5.0, 25);
    t.magic_wand_select(-5.0, 5.0, 25);
    assert!(!t.selection_can_retune());
}

#[test]
fn color_range_and_edge_aware_retune_their_own_kind() {
    let mut t = ramp_tool();
    t.color_range_select(0.0, 5.0, 25);
    t.selection_retune(55, 0);
    assert_eq!(
        coverage(&t).0,
        cols(6),
        "color range: every match, same count on a ramp"
    );

    t.magic_wand_select_edges(0.0, 5.0, 25, 255);
    t.selection_retune(55, 255);
    assert_eq!(
        coverage(&t).0,
        cols(6),
        "edge-aware with the wall off behaves as the wand"
    );
}

// The one selection writer that pushes NO history step: a Magic Eraser stroke
// replaces the selection with the painted mask. The generation does not move,
// so without its own clear the slider would re-run the wand over the paint.
#[cfg(feature = "patchmatch")]
#[test]
fn a_magic_eraser_stroke_ends_the_retune() {
    let mut t = ramp_tool();
    t.magic_wand_select(0.0, 5.0, 25);
    assert!(t.selection_can_retune());
    t.magic_eraser_brush_down(15.0, 6.0, 2.0, 1.0, "off");
    t.magic_eraser_brush_up();
    assert!(
        !t.selection_can_retune(),
        "the painted mask is not the wand's"
    );
    let painted = coverage(&t);
    t.selection_retune(55, 0);
    assert_eq!(coverage(&t), painted, "and the slider leaves it alone");
}
