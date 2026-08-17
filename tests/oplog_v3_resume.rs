//! v3 logs must still resume under v4 — the whole reason the text box's
//! second axis was built as a prefix-extension instead of a new schema.
//!
//! `ih_oplog_persist` ships ON, so every user who has opened Image Horse
//! since v8.40 has v3 op frames and v3 base-annotation blobs sitting in
//! IndexedDB with no backup and no server copy. If v4 rejected them, those
//! users would silently lose their cross-reload undo history on the first
//! load after the update — the log would return "nothing persisted" and the
//! archive path would carry the resume with a shorter history.
//!
//! The codec-level guarantees are pinned next to the codec
//! (`v3_blobs_still_decode_under_v4`, `v3_op_bytes_still_decode_under_v4` in
//! src/ops.rs). This file pins the thing those cannot: that the REAL resume
//! entry point — `oplog_restore`, the function the app actually calls on
//! boot — accepts a stream written entirely by a v3 writer and rebuilds the
//! document from it.
//!
//! Why it exists at all: the browser fixture for this path could not be run.
//! Driving the v4 build against a master-written database exercised only the
//! ARCHIVE resume, because that origin's `opLogs` and `keyframes` stores were
//! empty — an absent fixture reads exactly like a passing one, so the gap is
//! closed here in code instead.

use stamp_tool::ops::{CanvasParams, Op, ShapeParams, TextParams};
use stamp_tool::ImageHorseTool;

/// Pull the first `"<key>":<number>` out of the annotations JSON. Same
/// dependency-free reader `tests/shape_recolour.rs` uses — the crate has no
/// serde_json dev-dependency and this is not worth adding one for.
fn num(json: &str, key: &str) -> i64 {
    let at = json
        .find(key)
        .unwrap_or_else(|| panic!("{key} missing from {json}"));
    let rest = &json[at + key.len()..];
    let end = rest
        .find(|c: char| c != '-' && !c.is_ascii_digit())
        .unwrap_or(rest.len());
    rest[..end].parse().unwrap()
}

/// Byte-for-byte what a **v3** writer emitted for a base-annotation blob:
/// `[3] ++ postcard((texts, shapes, canvas, wraps))` — the 4-tuple, with no
/// box heights. Reconstructed here rather than produced by the current
/// encoder, which would defeat the point by writing v4.
fn v3_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
    let mut out = vec![3u8];
    let shapes: Vec<ShapeParams> = Vec::new();
    let canvas: Option<CanvasParams> = None;
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    out.extend_from_slice(&postcard::to_allocvec(&(texts, &shapes, &canvas, &wraps)).unwrap());
    out
}

/// Byte-for-byte what a **v3** writer emitted for a framed op stream:
/// `[u32 LE frame-length][3][postcard(op)]` per op.
fn v3_op_frames(ops: &[Op]) -> Vec<u8> {
    let mut out = Vec::new();
    for op in ops {
        let mut frame = vec![3u8];
        frame.extend_from_slice(&postcard::to_allocvec(op).unwrap());
        out.extend_from_slice(&(frame.len() as u32).to_le_bytes());
        out.extend_from_slice(&frame);
    }
    out
}

fn a_text(id: u32, text: &str) -> TextParams {
    TextParams {
        id,
        wrap_width: 0,
        box_height: 0,
        text: text.into(),
        x: 4,
        y: 6,
        font_size: 16.0,
        r: 255,
        g: 255,
        b: 255,
        bold: false,
        rotation_deg: 0.0,
        background_kind: 0,
        bg_r: 0,
        bg_g: 0,
        bg_b: 0,
        bg_a: 0,
        bg_padding: 0,
        bg_corner_radius: 0,
        bg_tail: 0,
        shadow_box: false,
        shadow_text: false,
        shadow_r: 0,
        shadow_g: 0,
        shadow_b: 0,
        shadow_a: 0,
        shadow_dx: 0,
        shadow_dy: 0,
        shadow_blur: 0,
    }
}

const W: u32 = 64;
const H: u32 = 48;

fn base() -> Vec<u8> {
    vec![30u8; (W as usize) * (H as usize) * 4]
}

#[test]
fn a_v3_log_still_resumes_under_v4() {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&base());

    // A v3 session: text added, then its box dragged wider. Both ops framed
    // the way v3 framed them.
    let ops = [
        Op::TextAdd(a_text(1, "resume me")),
        Op::TextWrap {
            id: 1,
            wrap_width: 240,
        },
    ];
    let ok = t.oplog_restore(
        &base(),
        W,
        H,
        &v3_annotation_blob(&[]),
        &v3_op_frames(&ops),
        ops.len() as u32,
    );
    assert!(ok, "a v3 log must resume, not be rejected");

    let j = t.get_text_annotations();
    assert!(
        j.contains("\"text\":\"resume me\""),
        "the text came back: {j}"
    );
    assert_eq!(
        num(&j, "\"wrap_width\":"),
        240,
        "the v3 TextWrap op still applies — appending TextBoxHeight after it \
         must not renumber it"
    );
    assert_eq!(
        num(&j, "\"box_height\":"),
        0,
        "a v3 document meant 'size the box to the text' on the new axis"
    );
}

#[test]
fn a_v3_base_annotation_blob_still_resumes_under_v4() {
    // The other half: annotations that were LIVE before the log started, so
    // they ride in the base blob rather than in an op. A v2->v3 regression
    // here would strand them.
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&base());

    let mut pre = a_text(7, "pre-log");
    pre.wrap_width = 180;
    let ok = t.oplog_restore(&base(), W, H, &v3_annotation_blob(&[pre]), &[], 0);
    assert!(ok, "a v3 base blob must resume, not be rejected");

    let j = t.get_text_annotations();
    assert!(
        j.contains("\"text\":\"pre-log\""),
        "annotation restored: {j}"
    );
    assert_eq!(num(&j, "\"wrap_width\":"), 180, "v3 carried the width");
    assert_eq!(num(&j, "\"box_height\":"), 0);
}

#[test]
fn a_v4_log_round_trips_both_box_axes_through_the_real_resume() {
    // The new axis, end to end through the same entry point — so the pair of
    // tests above is a comparison and not just an assertion that old bytes
    // decode to zeros.
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&base());

    let ops = [
        Op::TextAdd(a_text(1, "boxed")),
        Op::TextWrap {
            id: 1,
            wrap_width: 240,
        },
        Op::TextBoxHeight {
            id: 1,
            box_height: 310,
        },
    ];
    let ok = t.oplog_restore(
        &base(),
        W,
        H,
        &stamp_tool::ops::encode_annotations(&[], &[], None),
        &stamp_tool::ops::encode_op_frames(&ops),
        ops.len() as u32,
    );
    assert!(ok);

    let j = t.get_text_annotations();
    assert_eq!(num(&j, "\"wrap_width\":"), 240);
    assert_eq!(
        num(&j, "\"box_height\":"),
        310,
        "the height survives the resume"
    );
    assert_eq!(
        num(&j, "\"tile_h\":"),
        310,
        "and the rebuilt tile is actually that tall — the height is not just \
         stored, it is rendered"
    );
}
