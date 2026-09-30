//! Refine on hand-drawn 16×16 selections, through the engine's public API.
//! Each fixture is a picture: `#` selected, `.` not. The expected results are
//! pictures too, so a failure shows exactly which pixels moved.

use stamp_tool::ImageHorseTool;

const W: u32 = 16;
const H: u32 = 16;

/// A 6×6 block with a 1-px hole, a 2×2 island (4 px) and a 1-px island.
const FIXTURE: [&str; 16] = [
    "................",
    "................",
    "..######....##..",
    "..######....##..",
    "..##.###........",
    "..######........",
    "..######........",
    "..######........",
    "................",
    "................",
    "................",
    "................",
    "............#...",
    "................",
    "................",
    "................",
];

fn tool_with(rows: &[&str; 16]) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    t.recomposite();
    let mask: Vec<u8> = rows
        .iter()
        .flat_map(|r| r.bytes().map(|b| (b == b'#') as u8))
        .collect();
    t.selection_union(&mask);
    t
}

fn picture(t: &ImageHorseTool) -> Vec<String> {
    let ov = t.selection_overlay();
    (0..H as usize)
        .map(|y| {
            (0..W as usize)
                .map(|x| {
                    let i = y * W as usize + x;
                    if !ov.is_empty() && ov[i * 4 + 3] > 0 {
                        '#'
                    } else {
                        '.'
                    }
                })
                .collect()
        })
        .collect()
}

fn count(t: &ImageHorseTool) -> u32 {
    t.selection_coverage()[0]
}

#[test]
fn the_fixture_reads_back_as_drawn() {
    let t = tool_with(&FIXTURE);
    assert_eq!(picture(&t), FIXTURE);
    assert_eq!(count(&t), 36 - 1 + 4 + 1);
}

#[test]
fn remove_islands_drops_components_under_n_and_keeps_n() {
    let mut t = tool_with(&FIXTURE);
    t.selection_refine_apply(4, 0, 0, 0);
    let mut want = FIXTURE;
    want[12] = "................"; // the 1-px island goes; the 4-px one stays
    assert_eq!(picture(&t), want);
}

#[test]
fn remove_islands_5_takes_the_2x2_too() {
    let mut t = tool_with(&FIXTURE);
    t.selection_refine_apply(5, 0, 0, 0);
    let mut want = FIXTURE;
    want[12] = "................";
    want[2] = "..######........";
    want[3] = "..######........";
    assert_eq!(picture(&t), want);
}

#[test]
fn fill_holes_closes_the_hole_and_leaves_the_background() {
    let mut t = tool_with(&FIXTURE);
    t.selection_refine_apply(0, 6, 0, 0);
    let mut want = FIXTURE;
    want[4] = "..######........";
    assert_eq!(picture(&t), want);
}

#[test]
fn contract_takes_one_ring_off_after_clean_up() {
    let mut t = tool_with(&FIXTURE);
    // Clean first (the 1-px island and the hole go), then contract by 1: the
    // 6×6 block loses its rim to a 4×4 core, and the 2×2 island — every pixel
    // of which touches an unselected one — disappears.
    t.selection_refine_apply(4, 6, 0, -1);
    let mut want = ["................"; 16];
    for row in want.iter_mut().take(7).skip(3) {
        *row = "...####.........";
    }
    assert_eq!(picture(&t), want);
}

#[test]
fn expand_adds_one_ring() {
    let mut rows = ["................"; 16];
    rows[7] = ".......#........";
    let mut t = tool_with(&rows);
    t.selection_refine_apply(0, 0, 0, 1);
    let mut want = ["................"; 16];
    for row in want.iter_mut().take(9).skip(6) {
        *row = "......###.......";
    }
    assert_eq!(picture(&t), want);
}

#[test]
fn smooth_takes_off_a_spur() {
    let rows: [&str; 16] = [
        "................",
        "................",
        "..######........",
        "..#########.....",
        "..######........",
        "..######........",
        "..######........",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
    ];
    let mut t = tool_with(&rows);
    t.selection_refine_apply(0, 0, 1, 0);
    let got = picture(&t);
    assert_eq!(got[3], "..######........", "the 3-px spur is gone");
    assert_eq!(got[2], "..######........", "the block keeps its shape");
}

#[test]
fn apply_is_one_undo_step_and_preview_is_none() {
    let mut t = tool_with(&FIXTURE);
    let d = t.undo_snapshot_count();
    let before = picture(&t);
    let ov = t.selection_refine_preview(4, 6, 0, 0);
    assert!(!ov.is_empty());
    assert_eq!(t.undo_snapshot_count(), d, "preview pushes nothing");
    assert_eq!(picture(&t), before, "and leaves the selection alone");
    // 40 drawn, the 1-px island out (−1), the 1-px hole filled (+1).
    assert_eq!(
        t.selection_refine_preview_coverage()[0],
        40,
        "readout shows the preview"
    );

    t.selection_refine_apply(4, 6, 0, 0);
    assert_eq!(t.undo_snapshot_count(), d + 1, "apply is one step");
    assert_eq!(count(&t), 40);
    assert!(t.undo());
    assert_eq!(picture(&t), before, "one undo restores it");
}

#[test]
fn apply_with_all_zero_pushes_nothing() {
    let mut t = tool_with(&FIXTURE);
    let d = t.undo_snapshot_count();
    t.selection_refine_apply(0, 0, 0, 0);
    assert_eq!(t.undo_snapshot_count(), d);
}

#[test]
fn add_mask_from_selection_needs_a_selection() {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![255u8; (W * H * 4) as usize]);
    let id = t.active_layer_id();
    assert!(
        !t.add_layer_mask_from(id, 2, 0),
        "reveal selection with none"
    );
    assert!(!t.has_layer_mask(id));
    assert!(
        t.add_layer_mask_from(id, 1, 0),
        "hide entire layer works without one"
    );
    assert!(t.has_layer_mask(id));
    assert!(!t.add_layer_mask_from(id, 0, 0), "a second mask is refused");
}

/// The composite's alpha as a picture: `#` where the layer shows, `.` where
/// the mask hides it (the base is opaque, so alpha is 255 or 0 with no feather).
fn alpha_picture(t: &ImageHorseTool) -> Vec<String> {
    let rgba = t.capture_composite().rgba;
    (0..H as usize)
        .map(|y| {
            (0..W as usize)
                .map(|x| {
                    if rgba[(y * W as usize + x) * 4 + 3] > 0 {
                        '#'
                    } else {
                        '.'
                    }
                })
                .collect()
        })
        .collect()
}

fn masked(source: u8) -> ImageHorseTool {
    let mut t = tool_with(&FIXTURE);
    let id = t.active_layer_id();
    let d = t.undo_snapshot_count();
    assert!(t.add_layer_mask_from(id, source, 0));
    assert_eq!(
        t.undo_snapshot_count(),
        d + 1,
        "source {source} is one step"
    );
    t
}

#[test]
fn reveal_selection_shows_exactly_the_selection() {
    assert_eq!(alpha_picture(&masked(2)), FIXTURE);
}

#[test]
fn hide_selection_shows_exactly_the_rest() {
    let want: Vec<String> = FIXTURE
        .iter()
        .map(|r| {
            r.chars()
                .map(|c| if c == '#' { '.' } else { '#' })
                .collect()
        })
        .collect();
    assert_eq!(alpha_picture(&masked(3)), want);
}

#[test]
fn show_and_hide_entire_layer() {
    assert_eq!(alpha_picture(&masked(0)), ["################"; 16]);
    assert_eq!(alpha_picture(&masked(1)), ["................"; 16]);
}

#[test]
fn a_feathered_reveal_reaches_exactly_two_pixels() {
    // Two radius-1 passes reach 2 px, measured as a square (Chebyshev), so a
    // 10×10 block at 3..13 leaves the image corner 3 px out and its middle 4 in.
    let mut rows = ["................"; 16];
    for row in rows.iter_mut().take(13).skip(3) {
        *row = "...##########...";
    }
    let mut t = tool_with(&rows);
    let id = t.active_layer_id();
    assert!(t.add_layer_mask_from(id, 2, 1));
    let rgba = t.capture_composite().rgba;
    let a = |x: usize, y: usize| rgba[(y * W as usize + x) * 4 + 3];
    assert_eq!(a(7, 7), 255, "4 px in stays solid");
    assert!(
        a(3, 7) > 0 && a(3, 7) < 255,
        "the edge is soft: {}",
        a(3, 7)
    );
    assert!(a(1, 1) > 0, "2 px out (diagonally) is reached");
    assert_eq!(a(0, 0), 0, "3 px out is not");
}

#[test]
fn smooth_closes_a_pinhole() {
    // Open alone keeps a 1-px hole; the close half of Smooth fills it.
    // Expected picture cross-checked against an independent dilate/erode.
    let mut rows = ["................"; 16];
    for row in rows.iter_mut().take(10).skip(2) {
        *row = "..########......";
    }
    rows[5] = "..###.####......";
    let mut t = tool_with(&rows);
    t.selection_refine_apply(0, 0, 1, 0);
    let mut want = ["................"; 16];
    for row in want.iter_mut().take(10).skip(2) {
        *row = "..########......";
    }
    assert_eq!(picture(&t), want);
}

#[test]
fn a_preview_that_selects_nothing_is_a_transparent_overlay_not_an_empty_one() {
    let mut rows = ["................"; 16];
    rows[7] = ".......#........";
    let mut t = tool_with(&rows);
    let ov = t.selection_refine_preview(0, 0, 0, -1); // contract a single pixel away
    assert_eq!(
        ov.len(),
        (W * H * 4) as usize,
        "full size, so the canvas clears"
    );
    assert!(ov.iter().all(|&b| b == 0), "and fully transparent");
    assert_eq!(t.selection_refine_preview_coverage()[0], 0);
    assert!(t.has_selection(), "the preview never touched the selection");
}
