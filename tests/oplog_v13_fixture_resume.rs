//! Real v13 bytes from the deployed master, captured through the Presets UI.
#![cfg(feature = "tiles")]
use stamp_tool::{
    ops::{decode_op_frames, Op},
    ImageHorseTool,
};

const PNG: &[u8] = include_bytes!("fixtures/oplog/v13-preset.base.png");
const ANNOTATIONS: &[u8] = include_bytes!("fixtures/oplog/v13-preset.annotations.bin");
const FRAMES: &[u8] = include_bytes!("fixtures/oplog/v13-preset.frames.bin");

#[test]
fn shipped_v13_preset_restores_byte_exact_and_can_continue_with_adjustments() {
    assert_eq!(
        FRAMES[4], 13,
        "the fixture was written by the shipped v13 engine"
    );
    let ops = decode_op_frames(FRAMES).expect("v13 frames");
    assert!(matches!(ops.as_slice(), [Op::TonalStack { .. }]));
    let mut t = ImageHorseTool::new(276, 276);
    t.set_oplog_undo(true);
    assert!(t.oplog_restore_png(PNG, ANNOTATIONS, FRAMES, 1));
    assert_eq!(
        t.composite_hash_hex(),
        "bd54e6beec882e34",
        "hash captured in the browser"
    );
    let preset = t.get_image_data();
    assert!(t.undo());
    assert!(!t.oplog_is_broken());
    assert!(t.redo());
    assert_eq!(t.get_image_data(), preset);
    assert!(t.tonal_preview_begin());
    assert!(t.adjust_apply(35.0, 130.0, 70.0, 20.0, -10.0, 0.0, 0.0));
    t.recomposite();
    assert!(t.undo());
    assert!(!t.oplog_is_broken());
    assert_eq!(t.get_image_data(), preset);
}
