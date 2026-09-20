//! ⚠️ EXPECTED RED. This file pins a bug that is NOT fixed yet, on purpose —
//! see FINDINGS-oplog-and-text-0919.md and docs/PARKING_LOT.md ("a dragged
//! text box does not survive a reload").
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
//! Replaying it through the real resume entry point, one op at a time:
//!
//! | cursor | ops applied      | font_id            | wrap_width |
//! |--------|------------------|--------------------|------------|
//! | 1      | TextAdd          | `""`               | 0          |
//! | 2      | + TextFont       | `"liberation-serif"` | 0        |
//! | 3      | + TextWrap       | `"liberation-serif"` | **299**  |
//! | 4      | + **TextEdit**   | **`""`**           | **0**      |
//! | 6      | + the shape ops  | `""`               | 0          |
//!
//! **`Op::TextEdit` erases both.** It carries a whole `TextParams`, and applying
//! it REPLACES the annotation: `font_id` is `#[serde(skip)]` on `TextParams`
//! (ops.rs — that is what kept the v2 wire layout byte-identical when the face
//! was added in v8) so it decodes as the default `""`, and `wrap_width` /
//! `box_height` come back as whatever the writer happened to hold. Everything
//! `TextFont` and `TextWrap` established before it is gone.
//!
//! The user-visible bug, reproduced in the browser the same night: type a text
//! in Liberation Serif, drag its box narrower, reload, "Resume editing" — the
//! text returns in Liberation Sans on one unwrapped line.
//!
//! WHY NO FIX HERE. Every repair is a format or format-semantics decision —
//! make `TextEdit` carry the appended fields, make apply MERGE instead of
//! replace, or re-emit `TextFont`/`TextWrap` after every edit — and the op-log
//! format is on its way from v8 to v9 (#187). Persisted formats get an ADR and
//! an attended session in this repo. This test is the red light that session
//! starts from.
//!
//! The shape rows below pass today and are the harness control: `ShapeAdd` +
//! `ShapeSloppiness` ride the same replay and keep their setting, so a red text
//! row means the text path, not a broken fixture or a mis-built engine.

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
    // The twin setting that was fixed for shapes. Green today.
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
    // Proves the log really contains the face, so the failure below is a LOSS
    // and not a never-recorded value.
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
fn red_the_font_survives_the_whole_log() {
    let t = replay_to(OP_COUNT);
    let j = t.get_text_annotations();
    assert_eq!(
        field(&j, "\"font_id\":"),
        "\"liberation-serif\"",
        "the face the user picked must survive replay (TextEdit erases it today): {j}"
    );
}

#[test]
fn red_the_dragged_box_width_survives_the_whole_log() {
    let t = replay_to(OP_COUNT);
    let j = t.get_text_annotations();
    assert_eq!(
        field(&j, "\"wrap_width\":"),
        "299",
        "the box the user dragged must survive replay (TextEdit erases it today): {j}"
    );
}
