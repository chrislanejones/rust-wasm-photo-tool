//! Smart Callout v1 (Night 10-21, §3): a numbered pin, a label and the
//! leader joining them are three ordinary annotations — a pin (kind 5), an
//! arrow (kind 4) and a text — added and deleted as ONE undo step through
//! `continue_step`, on the snapshot path and on the op log. The join itself is
//! geometric (lib/callouts.ts), so nothing new is persisted.
use stamp_tool::ImageHorseTool;

const W: u32 = 200;
const H: u32 = 120;

fn tool(oplog: bool) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&vec![200u8; (W * H * 4) as usize]);
    t.set_oplog_undo(oplog);
    t
}

fn counts(t: &ImageHorseTool) -> (usize, usize) {
    (t.shape_annotation_count(), t.text_annotation_count())
}

fn label(t: &mut ImageHorseTool) -> u32 {
    t.add_text_annotation(
        "Step", 16.0, 20, 20, 20, false, 90, 40, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    )
}

/// Pin, then leader, then label — the order the Callout sub-tool uses.
fn add_callout(t: &mut ImageHorseTool) -> (u32, u32, u32) {
    let pin = t.insert_pin_annotation(20.0, 20.0, 40.0, 40.0, 1, "#e03030", 0);
    t.continue_step();
    let arrow = t.add_shape_annotation(
        4, 40.0, 30.0, 90.0, 45.0, "#e03030", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    t.continue_step();
    let text = label(t);
    (pin, arrow, text)
}

#[test]
fn adding_a_callout_is_one_step() {
    for oplog in [false, true] {
        let mut t = tool(oplog);
        t.recomposite();
        let steps = t.undo_count();
        add_callout(&mut t);
        t.recomposite();
        assert_eq!(counts(&t), (2, 1));
        assert_eq!(t.undo_count(), steps + 1, "pin + leader + label: one step");
        assert!(t.undo());
        assert_eq!(counts(&t), (0, 0), "one Ctrl+Z removes all three");
        assert!(t.redo());
        assert_eq!(counts(&t), (2, 1), "one redo brings all three back");
        if oplog {
            assert!(!t.oplog_is_broken(), "{}", t.oplog_status());
        }
    }
}

#[test]
fn deleting_a_callout_is_one_step() {
    for oplog in [false, true] {
        let mut t = tool(oplog);
        let (pin, arrow, text) = add_callout(&mut t);
        t.recomposite();
        let steps = t.undo_count();
        assert!(t.remove_pin_annotation(pin));
        t.continue_step();
        assert!(t.remove_shape_annotation(arrow));
        t.continue_step();
        assert!(t.remove_text_annotation(text));
        t.recomposite();
        assert_eq!(counts(&t), (0, 0));
        assert_eq!(t.undo_count(), steps + 1);
        assert!(t.undo());
        assert_eq!(counts(&t), (2, 1), "one Ctrl+Z restores all three");
        if oplog {
            assert!(!t.oplog_is_broken(), "{}", t.oplog_status());
        }
    }
}

#[test]
fn an_unused_continue_does_not_swallow_a_later_step() {
    let mut t = tool(false);
    t.add_pin_annotation(20.0, 20.0, 40.0, 40.0, 1, "#e03030", 0);
    let steps = t.undo_count();
    t.continue_step();
    t.recomposite(); // the flush after a call that pushed nothing
    label(&mut t);
    assert_eq!(t.undo_count(), steps + 1, "the label is its own step");
}
