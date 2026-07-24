//! The non-committing hover preview (`selection_preview`): it returns a
//! tinted overlay of the region a click WOULD grab, using the same mask core
//! as the committing producers — and it must never touch the stored selection
//! or the undo history. Pure perception.

use stamp_tool::ImageHorseTool;

const W: u32 = 24;
const H: u32 = 16;

/// A tool whose composite is two flat colour fields: left half red, right half
/// blue — so a wand flood from the left grabs a known, bounded region.
fn split_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    let mut px = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let i = ((y * W + x) * 4) as usize;
            let left = x < W / 2;
            px[i] = if left { 200 } else { 40 };
            px[i + 1] = 40;
            px[i + 2] = if left { 40 } else { 200 };
            px[i + 3] = 255;
        }
    }
    t.load_image(&px);
    t.recomposite();
    t
}

/// Pixels with non-zero alpha in an overlay RGBA, and their first colour seen.
fn covered(ov: &[u8]) -> (usize, Option<[u8; 3]>) {
    let mut n = 0;
    let mut color = None;
    for px in ov.chunks_exact(4) {
        if px[3] > 0 {
            n += 1;
            color.get_or_insert([px[0], px[1], px[2]]);
        }
    }
    (n, color)
}

#[test]
fn preview_covers_the_region_a_click_would_grab() {
    let t = split_tool();
    // Wand (kind 0) from the left field, tight tolerance → the left half only.
    let ov = t.selection_preview(3.0, 8.0, 0, 20, 0, 1);
    let (n, _) = covered(&ov);
    assert_eq!(n, (W / 2 * H) as usize, "preview = the left colour field");
}

#[test]
fn preview_matches_what_the_committing_wand_selects() {
    let t = split_tool();
    // The preview's covered pixel COUNT must equal the committed selection's.
    let ov = t.selection_preview(3.0, 8.0, 0, 20, 0, 1);
    let (preview_n, _) = covered(&ov);

    let mut t2 = split_tool();
    t2.magic_wand_select(3.0, 8.0, 20);
    let sel_n = t2
        .selection_overlay()
        .chunks_exact(4)
        .filter(|p| p[3] > 0)
        .count();
    assert_eq!(preview_n, sel_n, "preview region == the click's region");
}

#[test]
fn tint_1_is_green_and_tint_2_is_red() {
    let t = split_tool();
    let (_, add) = covered(&t.selection_preview(3.0, 8.0, 0, 20, 0, 1));
    let (_, sub) = covered(&t.selection_preview(3.0, 8.0, 0, 20, 0, 2));
    assert_eq!(add, Some([34, 197, 94]), "add previews green");
    assert_eq!(sub, Some([239, 68, 68]), "subtract previews red");
}

#[test]
fn preview_never_touches_selection_or_history() {
    let mut t = split_tool();
    let steps_before = t.undo_snapshot_count();
    assert!(!t.has_selection());

    // Many previews, different points/kinds/tints.
    for _ in 0..5 {
        let _ = t.selection_preview(3.0, 8.0, 0, 20, 0, 1);
        let _ = t.selection_preview(20.0, 8.0, 2, 20, 0, 2);
    }
    assert!(!t.has_selection(), "preview must not store a selection");
    assert_eq!(
        t.undo_snapshot_count(),
        steps_before,
        "preview must push no history step"
    );
    assert!(
        !t.undo(),
        "nothing to undo — preview left history untouched"
    );
}

#[test]
fn preview_over_a_live_selection_leaves_it_intact() {
    let mut t = split_tool();
    t.magic_wand_select(3.0, 8.0, 20); // commit the left field
    let before = t.selection_overlay();
    // Preview the OTHER field in subtract mode — must not alter the selection.
    let _ = t.selection_preview(20.0, 8.0, 0, 20, 0, 2);
    assert_eq!(
        t.selection_overlay(),
        before,
        "the committed mask is unchanged"
    );
}

#[test]
fn preview_is_empty_out_of_bounds_and_on_an_empty_region() {
    let t = split_tool();
    assert!(
        t.selection_preview(-5.0, -5.0, 0, 20, 0, 1).is_empty(),
        "out of bounds → nothing to preview"
    );
    // A wand with zero tolerance still grabs at least the seed pixel, so use
    // OOB for the empty case; a genuinely empty region can't arise from a
    // valid seed (the seed is always in its own region).
    assert!(
        t.selection_preview(1000.0, 1000.0, 2, 20, 0, 2).is_empty(),
        "far out of bounds → empty"
    );
}
