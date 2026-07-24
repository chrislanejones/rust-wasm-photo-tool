//! Selection changes as undo/redo + History steps: each select, add,
//! subtract, select-all and deselect is one snapshot (`snap_selection`),
//! no-op changes push nothing, and selection-only steps are TRANSPARENT to
//! the op log — undoing one never moves the log cursor or breaks it.

use stamp_tool::ImageHorseTool;

const W: u32 = 20;
const H: u32 = 12;

fn new_tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![128u8; (W * H * 4) as usize]);
    // Warm the composite — the wand's seed guard reads it, and the JS app
    // always flushes (recomposites) before a user can click.
    t.recomposite();
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

// ── one step per change, none per no-op ─────────────────────────────────────

#[test]
fn each_select_is_one_undo_step_and_round_trips() {
    let mut t = new_tool();
    let d0 = t.undo_snapshot_count();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    assert_eq!(t.undo_snapshot_count(), d0 + 1, "one step per select");
    let first = selected(&t);

    assert!(t.undo(), "the select undoes");
    assert!(!t.has_selection(), "undo restores the empty pre-state");
    assert!(t.redo(), "and redoes");
    assert_eq!(selected(&t), first, "redo restores the exact mask");
}

#[test]
fn replace_undo_restores_the_previous_selection() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    let a = selected(&t);
    t.rect_select(10.0, 2.0, 16.0, 8.0); // replaces A
    assert_ne!(selected(&t), a);
    assert!(t.undo());
    assert_eq!(
        selected(&t),
        a,
        "undo of a replace = the previous selection"
    );
}

#[test]
fn add_combine_is_its_own_step() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    let a = selected(&t);
    t.set_selection_combine(1);
    t.rect_select(10.0, 2.0, 16.0, 8.0);
    assert!(count(&selected(&t)) > count(&a), "union grew the selection");
    assert!(t.undo());
    assert_eq!(selected(&t), a, "undoing the add leaves the first select");
}

#[test]
fn a_click_reproducing_the_same_selection_pushes_nothing() {
    let mut t = new_tool();
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    let d = t.undo_snapshot_count();
    t.rect_select(2.0, 2.0, 8.0, 8.0); // byte-identical result
    assert_eq!(t.undo_snapshot_count(), d, "no-op select pushes no step");
    // Subtracting a disjoint region is also a no-op.
    t.set_selection_combine(2);
    t.rect_select(14.0, 9.0, 18.0, 11.0);
    assert_eq!(
        t.undo_snapshot_count(),
        d,
        "disjoint subtract pushes no step"
    );
}

#[test]
fn deselect_and_select_all_are_undoable_and_guarded() {
    let mut t = new_tool();
    let d0 = t.undo_snapshot_count();
    t.clear_selection();
    assert_eq!(t.undo_snapshot_count(), d0, "deselect of nothing = no step");

    t.select_all();
    assert_eq!(t.undo_snapshot_count(), d0 + 1);
    t.select_all();
    assert_eq!(t.undo_snapshot_count(), d0 + 1, "already-all = no step");

    t.clear_selection();
    assert!(!t.has_selection());
    assert!(t.undo(), "Deselect undoes");
    assert_eq!(count(&selected(&t)), (W * H) as usize, "back to all");
}

#[test]
fn deleting_a_selection_restores_the_mask_on_undo() {
    let mut t = new_tool();
    t.rect_select(3.0, 3.0, 9.0, 9.0);
    let sel = selected(&t);
    assert!(t.delete_selection());
    assert!(!t.has_selection(), "delete deselects");
    assert!(t.undo(), "undo the delete");
    assert_eq!(
        selected(&t),
        sel,
        "the pixels AND the mask both come back — the snapshot carries the selection"
    );
}

#[test]
fn history_labels_name_the_selection_steps() {
    let mut t = new_tool();
    // On the uniform test image the wand takes everything — a real step.
    t.magic_wand_select(5.0, 5.0, 24);
    t.clear_selection();
    // A small marquee, then a DISJOINT union (a union over select-all would
    // be a no-op and rightly push nothing — that's the guard working).
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    t.set_selection_combine(1);
    t.rect_select(12.0, 2.0, 18.0, 8.0);
    let labels = t.history_labels();
    assert!(labels.contains("Magic Wand"), "got: {labels}");
    assert!(labels.contains("Deselect"), "got: {labels}");
    assert!(labels.contains("Marquee"), "got: {labels}");
    assert!(labels.contains("Add Selection"), "got: {labels}");
}

// ── op-log transparency (the lockstep invariant) ───────────────────────────

#[cfg(feature = "tiles")]
#[test]
fn selection_undo_never_moves_the_oplog_cursor() {
    let mut t = new_tool();
    t.set_oplog_undo(true);

    // One RECORDED op…
    t.paint_down(3.0, 3.0, 8.0, "#14c83c", 1.0, 0.9, "off");
    t.paint_move(15.0, 9.0);
    t.paint_up();
    t.recomposite();
    let ops = t.oplog_op_count();
    assert!(ops >= 1, "the stroke recorded");
    let cursor_after_stroke = t.oplog_cursor();

    // …then a selection-only step on top.
    t.rect_select(2.0, 2.0, 8.0, 8.0);
    assert!(t.has_selection());

    // Undo #1 pops the SELECTION step: mask gone, log untouched, not broken.
    assert!(t.undo());
    assert!(!t.has_selection(), "selection step undone");
    assert_eq!(
        t.oplog_cursor(),
        cursor_after_stroke,
        "a selection-only undo must not seek the op log"
    );
    assert!(!t.oplog_is_broken(), "and must not mark it broken");

    // Undo #2 pops the stroke through the op-log path — lockstep intact.
    assert!(t.undo());
    assert_eq!(
        t.oplog_cursor(),
        cursor_after_stroke - 1,
        "stroke rewound via the log"
    );
    assert!(!t.oplog_is_broken());

    // Redo both: stroke first (log), then the selection (snapshot).
    assert!(t.redo());
    assert_eq!(t.oplog_cursor(), cursor_after_stroke);
    assert!(t.redo());
    assert!(
        t.has_selection(),
        "selection redone through the snapshot path"
    );
    assert_eq!(
        t.oplog_cursor(),
        cursor_after_stroke,
        "redo of it didn't seek either"
    );
    assert!(!t.oplog_is_broken());
}
