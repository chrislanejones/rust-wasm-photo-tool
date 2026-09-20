//! **The text settings survive the whole log.** ADR-060, and the two rows
//! below were RED when this file was written.
//!
//! The input is not a log this test wrote. It is
//! `tests/fixtures/oplog/v8-text-font-wrap-shape.frames.bin`: the bytes the
//! PRODUCTION build at edit.imagehorse.app (commit 34dd0d9) put in a browser's
//! IndexedDB on 2026-09-20, read back out and committed as a fixture. Six ops,
//! in this order:
//!
//! ```text
//!   0 TextAdd   1 TextFont   2 TextWrap   3 TextEdit   4 ShapeAdd   5 ShapeSloppiness
//! ```
//!
//! ## The bug this pins, measured one op at a time
//!
//! | cursor | ops applied      | font_id (v8.80)      | wrap_width (v8.80) |
//! |--------|------------------|----------------------|--------------------|
//! | 1      | TextAdd          | `""`                 | 0                  |
//! | 2      | + TextFont       | `"liberation-serif"` | 0                  |
//! | 3      | + TextWrap       | `"liberation-serif"` | **299**            |
//! | 4      | + **TextEdit**   | **`""`**             | **0**              |
//! | 6      | + the shape ops  | `""`                 | 0                  |
//!
//! **`Op::TextEdit` erased both.** It carries a whole `TextParams`, and
//! applying it REPLACED the annotation: `font_id`, `wrap_width`, `box_height`
//! and `perspective` are `#[serde(skip)]` on `TextParams` (ops.rs — that is
//! what kept the v2 wire layout byte-identical while four fields were added
//! beside it), so they decoded as defaults and everything `TextFont` and
//! `TextWrap` established before them was gone.
//!
//! The user-visible bug, reproduced in the browser the same night: type a text
//! in Liberation Serif, drag its box narrower, reload, "Resume editing" — the
//! text came back in Liberation Sans on one unwrapped line.
//!
//! ## The fix these rows now hold down
//!
//! Applying `TextEdit` MERGES: the payload's skipped fields are absent, not
//! chosen, so the annotation keeps its own. The whole argument lives on
//! `TextParams::carry_skipped_from`. No format version was taken — the wire
//! layout is untouched, so these exact production bytes replay correctly with
//! no migration step, and `tests/oplog_v7_v8_fixture_resume.rs` proves the same
//! for a v7 log.
//!
//! The shape rows below passed before the fix as well and are the harness
//! control: `ShapeAdd` + `ShapeSloppiness` ride the same replay and keep their
//! setting, so a red text row means the text path, not a broken fixture or a
//! mis-built engine.

use stamp_tool::ImageHorseTool;

const KEYFRAME_PNG: &[u8] = include_bytes!("fixtures/oplog/base-keyframe-276x276.png");
const FRAMES: &[u8] = include_bytes!("fixtures/oplog/v8-text-font-wrap-shape.frames.bin");
const ANNOTATIONS: &[u8] = include_bytes!("fixtures/oplog/base-annotations.v8.bin");
const OP_COUNT: u32 = 6;

/// Pull `"<key>":<value up to the next comma>` out of the annotations JSON.
/// The dependency-free reader `tests/oplog_v3_resume.rs` uses, for the same
/// reason: the crate has no serde_json dev-dependency.
fn field(json: &str, key: &str) -> String {
    let at = json
        .find(key)
        .unwrap_or_else(|| panic!("{key} missing from {json}"));
    let rest = &json[at + key.len()..];
    let end = rest.find(',').unwrap_or(rest.len());
    rest[..end].to_string()
}

fn replay_to(cursor: u32) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(276, 276);
    assert!(
        t.oplog_restore_png(KEYFRAME_PNG, ANNOTATIONS, FRAMES, cursor),
        "the captured production log must restore at cursor {cursor}"
    );
    t
}

#[test]
fn control_the_captured_log_restores_at_all() {
    // If this fails, nothing below means anything: the fixture, the keyframe
    // or the framing is wrong, not the engine.
    let t = replay_to(OP_COUNT);
    let j = t.get_text_annotations();
    assert!(
        j.contains("\"text\":\"wrap me across several lines please\""),
        "the text came back: {j}"
    );
}

#[test]
fn control_a_shape_keeps_its_sloppiness_across_the_same_replay() {
    // The twin setting shapes already kept. Green before the fix and after it.
    let t = replay_to(OP_COUNT);
    let j = t.get_shape_annotations();
    assert_eq!(
        field(&j, "\"sloppiness\":"),
        "50",
        "shapes keep theirs: {j}"
    );
}

#[test]
fn control_the_font_is_applied_before_the_edit() {
    // Proves the log really contains the face, so the failure this file was
    // written to catch was a LOSS and not a never-recorded value.
    let t = replay_to(2);
    let j = t.get_text_annotations();
    assert_eq!(
        field(&j, "\"font_id\":"),
        "\"liberation-serif\"",
        "TextFont applied: {j}"
    );
}

#[test]
fn control_the_dragged_width_is_applied_before_the_edit() {
    let t = replay_to(3);
    let j = t.get_text_annotations();
    assert_eq!(field(&j, "\"wrap_width\":"), "299", "TextWrap applied: {j}");
}

#[test]
fn the_font_survives_the_whole_log() {
    let t = replay_to(OP_COUNT);
    let j = t.get_text_annotations();
    assert_eq!(
        field(&j, "\"font_id\":"),
        "\"liberation-serif\"",
        "the face the user picked must survive replay (TextEdit erased it before ADR-060): {j}"
    );
}

#[test]
fn the_dragged_box_width_survives_the_whole_log() {
    let t = replay_to(OP_COUNT);
    let j = t.get_text_annotations();
    assert_eq!(
        field(&j, "\"wrap_width\":"),
        "299",
        "the box the user dragged must survive replay (TextEdit erased it before ADR-060): {j}"
    );
}
