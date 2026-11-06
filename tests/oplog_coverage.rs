//! The engine, not a pair of counters, says whether the op log still describes
//! the document. A log that restores cleanly but is missing an edit is the
//! worst outcome persistence has: a redaction can come back undone.
use stamp_tool::ImageHorseTool;

const MISSING: u8 = 0;
const COVERED: u8 = 1;
const OPEN: u8 = 2;

const W: u32 = 80;
const H: u32 = 40;

/// A gradient, so an effect always changes bytes.
fn tool() -> ImageHorseTool {
    let mut px = Vec::with_capacity((W * H * 4) as usize);
    for y in 0..H {
        for x in 0..W {
            px.extend_from_slice(&[(x * 3) as u8, (y * 6) as u8, ((x + y) * 2) as u8, 255]);
        }
    }
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&px);
    t
}

fn paint(t: &mut ImageHorseTool, x: f64) {
    t.paint_down(x, 10.0, 6.0, "#ff0000", 1.0, 1.0, "off");
    t.paint_up();
    t.recomposite();
}

fn effect(t: &mut ImageHorseTool, mode: &str) {
    t.effect_down(20.0, 28.0, 10.0, mode, 2, 8, "#000000", "off");
    t.effect_up();
    t.recomposite();
}

/// The gesture that used to hide an edit: deleting a pin renumbers the others,
/// so one undo step records several ops and the cursor runs ahead of undo depth.
fn pins_with_cursor_slack() -> ImageHorseTool {
    let mut t = tool();
    let first = t.add_pin_annotation(5.0, 5.0, 15.0, 15.0, 1, "#e03030", 0);
    t.add_pin_annotation(25.0, 5.0, 35.0, 15.0, 2, "#e03030", 0);
    t.add_pin_annotation(45.0, 5.0, 55.0, 15.0, 3, "#e03030", 0);
    t.recomposite();
    t.remove_pin_annotation(first);
    t.recomposite();
    assert!(
        t.undo_count() < t.oplog_cursor(),
        "the scenario needs slack"
    );
    t
}

#[test]
fn a_redaction_inside_the_cursor_slack_is_caught() {
    let mut t = pins_with_cursor_slack();
    assert_eq!(t.oplog_coverage(), COVERED);
    effect(&mut t, "solid");
    // What the old check saw: undo depth still under the cursor, nothing broken.
    assert!(t.undo_count() <= t.oplog_cursor());
    assert!(!t.oplog_is_broken());
    assert_eq!(t.oplog_coverage(), MISSING);
}

#[test]
fn every_unrecorded_effect_is_caught() {
    for mode in ["solid", "pixelate"] {
        let mut t = tool();
        paint(&mut t, 20.0);
        assert_eq!(t.oplog_coverage(), COVERED, "{mode}: before");
        effect(&mut t, mode);
        assert_eq!(t.oplog_coverage(), MISSING, "{mode}: after");
    }
}

#[test]
fn the_history_cap_cannot_hide_an_unrecorded_edit() {
    let mut t = tool();
    t.set_max_history(50); // the lowest cap the engine accepts
    for i in 0..60 {
        paint(&mut t, 4.0 + f64::from(i));
    }
    assert!(t.undo_count() <= t.oplog_cursor());
    effect(&mut t, "solid");
    assert!(
        t.undo_count() <= t.oplog_cursor(),
        "invisible to the counters"
    );
    assert_eq!(t.oplog_coverage(), MISSING);
}

#[test]
fn recorded_edits_stay_covered() {
    let mut t = tool();
    assert_eq!(t.oplog_coverage(), COVERED, "no edits yet");
    paint(&mut t, 20.0);
    assert_eq!(t.oplog_coverage(), COVERED, "stroke");
    effect(&mut t, "gaussian");
    assert_eq!(t.oplog_coverage(), COVERED, "blur");
    t.add_pin_annotation(45.0, 5.0, 55.0, 15.0, 1, "#e03030", 0);
    t.recomposite();
    assert_eq!(t.oplog_coverage(), COVERED, "annotation");
}

#[test]
fn undo_and_redo_stay_covered() {
    let mut t = tool();
    t.set_oplog_undo(true);
    paint(&mut t, 20.0);
    paint(&mut t, 40.0);
    t.undo();
    t.recomposite();
    assert_eq!(t.oplog_coverage(), COVERED, "undo");
    t.redo();
    t.recomposite();
    assert_eq!(t.oplog_coverage(), COVERED, "redo");
}

#[test]
fn an_edit_in_progress_is_not_a_verdict() {
    let mut t = tool();
    paint(&mut t, 20.0);
    t.paint_down(40.0, 20.0, 6.0, "#00ff00", 1.0, 1.0, "off");
    assert_eq!(t.oplog_coverage(), OPEN, "paint stroke");
    t.paint_up();
    t.recomposite();
    assert_eq!(t.oplog_coverage(), COVERED);

    t.effect_down(20.0, 28.0, 10.0, "solid", 2, 8, "#000000", "off");
    assert_eq!(t.oplog_coverage(), OPEN, "effect stroke");
    t.effect_up();
    t.recomposite();
    assert_eq!(
        t.oplog_coverage(),
        MISSING,
        "the same edit, once it is finished"
    );
}

#[test]
fn a_restored_log_is_covered_until_the_next_unrecorded_edit() {
    let mut t = pins_with_cursor_slack();
    paint(&mut t, 60.0);
    let (base, annotations) = (
        t.oplog_keyframe_pixels_rgba(0),
        t.oplog_keyframe_annotations(0),
    );
    let frames = t.oplog_encoded_ops(0, t.oplog_op_count() as u32);

    let mut restored = ImageHorseTool::new(1, 1);
    assert!(restored.oplog_restore(&base, W, H, &annotations, &frames, t.oplog_cursor() as u32));
    assert_eq!(restored.composite_hash_hex(), t.composite_hash_hex());
    assert_eq!(restored.oplog_coverage(), COVERED);
    effect(&mut restored, "solid");
    assert_eq!(restored.oplog_coverage(), MISSING);
}

#[test]
fn the_revision_moves_for_an_edit_no_op_counter_sees() {
    let mut t = pins_with_cursor_slack();
    let (revision, ops, cursor) = (
        t.oplog_edit_revision(),
        t.oplog_op_count(),
        t.oplog_cursor(),
    );
    effect(&mut t, "solid");
    assert_eq!((t.oplog_op_count(), t.oplog_cursor()), (ops, cursor));
    assert_ne!(t.oplog_edit_revision(), revision);
}

#[test]
fn the_revision_moves_for_a_clone_stamp_which_skips_snap() {
    let mut t = tool();
    paint(&mut t, 20.0);
    let revision = t.oplog_edit_revision();
    t.set_source(40, 20);
    t.begin_stroke(10.0, 30.0, "off");
    t.continue_stroke(14.0, 30.0);
    t.end_stroke(14.0, 30.0);
    t.recomposite();
    assert_ne!(t.oplog_edit_revision(), revision);
    assert_eq!(t.oplog_coverage(), MISSING);
}

#[test]
fn the_check_leaves_an_open_step_join_alone() {
    let mut t = tool();
    let id = t.add_pin_annotation(5.0, 5.0, 15.0, 15.0, 1, "#e03030", 0);
    t.recomposite();
    let undo = t.undo_count();
    t.continue_step();
    assert_eq!(t.oplog_coverage(), COVERED);
    t.remove_pin_annotation(id);
    t.recomposite();
    assert_eq!(t.undo_count(), undo, "the join survived the check");
}
