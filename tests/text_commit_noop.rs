//! A text commit that changes nothing is not an undo step (Night 10-24).
//!
//! Leaving the Text tool commits whatever is open in its editor. A text that
//! was opened and left alone — say right after a Placement, then a switch to
//! Pins — went through `update_text_annotation` with its own values, which
//! pushed a snapshot and recorded no op: `undo_count` +1 with the op count
//! unchanged, so the next Ctrl+Z appeared to do nothing.

use stamp_tool::ImageHorseTool;

fn tool_with_text() -> (ImageHorseTool, u32) {
    let mut t = ImageHorseTool::new(200, 120);
    t.set_oplog_undo(true);
    let id = t.add_text_annotation(
        "Note", 18.0, 10, 20, 30, false, 40, 50, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    );
    t.recomposite();
    (t, id)
}

/// The commit `useTextTool` makes for a text left as it was opened.
fn commit(t: &mut ImageHorseTool, id: u32, text: &str, x: i32) -> bool {
    t.update_text_annotation(
        id, text, 18.0, 10, 20, 30, false, x, 50, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
    )
}

#[test]
fn an_unchanged_commit_pushes_no_step() {
    let (mut t, id) = tool_with_text();
    let steps = t.undo_count();
    let ops = t.oplog_op_count();
    assert!(
        commit(&mut t, id, "Note", 40),
        "the text is there, so the commit succeeds"
    );
    t.recomposite();
    assert_eq!(t.undo_count(), steps, "nothing changed, so no undo step");
    assert_eq!(t.oplog_op_count(), ops);
    // The one Ctrl+Z left takes the text away: it undoes the add, not a no-op.
    assert!(t.undo());
    assert_eq!(t.get_text_annotations(), "[]");
    assert!(!t.oplog_is_broken());
}

#[test]
fn a_changed_commit_is_still_one_step() {
    let (mut t, id) = tool_with_text();
    let steps = t.undo_count();
    let hash = t.composite_hash_hex();
    assert!(commit(&mut t, id, "Note", 90));
    t.recomposite();
    assert_eq!(t.undo_count(), steps + 1, "a moved text is a step");
    assert!(commit(&mut t, id, "Notes", 90));
    t.recomposite();
    assert_eq!(t.undo_count(), steps + 2, "a retyped text is a step");
    assert!(t.undo());
    assert!(t.undo());
    assert_eq!(t.composite_hash_hex(), hash);
    assert!(!t.oplog_is_broken(), "both steps replayed from the log");
}
