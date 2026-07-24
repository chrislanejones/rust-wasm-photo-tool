//! `selection_to_new_layer` — "Layer Via Copy / Layer Via Cut" (Ctrl+J /
//! Ctrl+Shift+J). Session-level coverage driving the method exactly as the JS
//! handlers do: wand-select a distinguishable region, place it on a new layer,
//! then verify both layers (isolated via visibility, since `get_image_data`
//! composites only visible layers), the guard, and that the whole operation is
//! ONE undo step even though it both mutates pixels and inserts a layer.

use stamp_tool::ImageHorseTool;

const W: u32 = 20;
const H: u32 = 20;

const RED: [u8; 4] = [200, 30, 30, 255];
const BLUE: [u8; 4] = [30, 30, 200, 255];

/// Left half solid red, right half solid blue — a tolerance-0 wand click in
/// the left half selects exactly the red region.
fn two_tone() -> Vec<u8> {
    let mut v = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let c = if x < W / 2 { RED } else { BLUE };
            let i = ((y * W + x) * 4) as usize;
            v[i..i + 4].copy_from_slice(&c);
        }
    }
    v
}

fn doc_with_left_half_selected() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&two_tone());
    t.recomposite();
    let overlay = t.magic_wand_select(2.0, 2.0, 0);
    assert!(!overlay.is_empty(), "wand click must select the red half");
    t
}

fn px(buf: &[u8], x: u32, y: u32) -> [u8; 4] {
    let i = ((y * W + x) * 4) as usize;
    [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

#[test]
fn copy_keeps_the_source_intact_and_the_new_layer_holds_only_the_selection() {
    let mut t = doc_with_left_half_selected();
    let src_id = t.active_layer_id();
    assert_eq!(t.layer_count(), 1);

    let new_id = t.selection_to_new_layer(false);
    assert_ne!(new_id, 0, "a real selection must produce a layer");
    assert_ne!(new_id, src_id);
    assert_eq!(t.layer_count(), 2, "exactly one layer added");
    assert_eq!(
        t.active_layer_id(),
        new_id,
        "the new layer becomes active (add_layer semantics)"
    );
    assert!(
        !t.has_selection(),
        "deselects after, like delete_selection — no stale mask over the copy"
    );

    // Source layer alone: every original pixel still there (copy, not cut).
    t.set_layer_visible(new_id, false);
    let src_only = t.get_image_data();
    assert_eq!(px(&src_only, 2, 2), RED, "selected pixels intact on source");
    assert_eq!(px(&src_only, 15, 2), BLUE, "unselected pixels intact");

    // New layer alone: the selection, and ONLY the selection.
    t.set_layer_visible(new_id, true);
    t.set_layer_visible(src_id, false);
    let new_only = t.get_image_data();
    assert_eq!(px(&new_only, 2, 2), RED, "selected pixels copied");
    assert_eq!(px(&new_only, 9, 17), RED, "whole selected region copied");
    assert_eq!(
        px(&new_only, 15, 2),
        [0, 0, 0, 0],
        "non-selected pixels must be fully transparent on the new layer"
    );
}

#[test]
fn cut_clears_the_selection_on_the_source_and_moves_it_to_the_new_layer() {
    let mut t = doc_with_left_half_selected();
    let src_id = t.active_layer_id();

    let new_id = t.selection_to_new_layer(true);
    assert_ne!(new_id, 0);
    assert_eq!(t.layer_count(), 2);
    assert!(!t.has_selection());

    // Source layer alone: the selected half is gone (transparent), the rest
    // untouched — exactly what delete_selection would have left.
    t.set_layer_visible(new_id, false);
    let src_only = t.get_image_data();
    assert_eq!(
        px(&src_only, 2, 2),
        [0, 0, 0, 0],
        "cut must clear the selected pixels on the source layer"
    );
    assert_eq!(px(&src_only, 15, 2), BLUE, "unselected pixels intact");

    // New layer alone: holds the cut pixels.
    t.set_layer_visible(new_id, true);
    t.set_layer_visible(src_id, false);
    let new_only = t.get_image_data();
    assert_eq!(px(&new_only, 2, 2), RED, "cut pixels live on the new layer");
    assert_eq!(px(&new_only, 15, 2), [0, 0, 0, 0]);

    // Copy + cut together must reconstruct the original image exactly.
    t.set_layer_visible(src_id, true);
    assert_eq!(
        t.get_image_data(),
        two_tone(),
        "source-with-hole under the cut layer must composite back to the original"
    );
}

#[test]
fn returns_zero_and_mutates_nothing_without_a_selection() {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&two_tone());
    t.recomposite();

    let undo_before = t.undo_count();
    assert_eq!(t.selection_to_new_layer(false), 0);
    assert_eq!(t.selection_to_new_layer(true), 0);
    assert_eq!(t.layer_count(), 1, "no layer added");
    assert_eq!(t.undo_count(), undo_before, "no history pushed");
    assert_eq!(t.get_image_data(), two_tone(), "no pixel touched");
}

#[test]
fn the_whole_operation_is_one_undo_step_for_both_copy_and_cut() {
    for cut in [false, true] {
        let mut t = doc_with_left_half_selected();
        let before = t.get_image_data();
        let undo_before = t.undo_count();

        assert_ne!(t.selection_to_new_layer(cut), 0);
        assert_eq!(
            t.undo_count(),
            undo_before + 1,
            "exactly one snapshot for the compound op (cut = {cut}) — no \
             second 'Add Layer' entry"
        );

        assert!(t.undo(), "undo must succeed (cut = {cut})");
        assert_eq!(t.layer_count(), 1, "layer insertion undone (cut = {cut})");
        assert_eq!(
            t.get_image_data(),
            before,
            "one undo restores the exact original pixels (cut = {cut})"
        );
    }
}
