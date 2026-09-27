// Moved out of src/ops.rs verbatim (Track A, docs/AppShell-Refactor-Plan.md):
// the test module lived inside the production file. `use super::*` still
// resolves to the same module, so nothing below changed.

//! The v2 → v3 promise, pinned: **old data must still decode**.
//!
//! `USE_OPLOG_PERSISTENCE` ships ON, so a rejected log costs every user
//! their cross-reload undo history. v3 was shaped to make migration
//! possible (append-only variant, `#[serde(skip)]` on the new field,
//! trailing tuple element) — these tests are what stop that shape from
//! being "simplified" back into a breaking change.
use super::*;

fn a_text(id: u32) -> TextParams {
    TextParams {
        id,
        wrap_width: 0,
        box_height: 0,
        perspective: crate::perspective::IDENTITY_QUAD,
        font_id: String::new(),
        text: "hello".into(),
        x: 1,
        y: 2,
        font_size: 16.0,
        r: 1,
        g: 2,
        b: 3,
        bold: true,
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

/// A v2 writer emitted `[2] ++ postcard((texts, shapes, canvas))` — the
/// 3-tuple, with no wrap widths. Reconstructed here byte-for-byte.
fn v2_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
    let mut out = vec![2u8];
    let shapes: Vec<ShapeParams> = Vec::new();
    let canvas: Option<CanvasParams> = None;
    out.extend_from_slice(&postcard::to_allocvec(&(texts, &shapes, &canvas)).unwrap()); // allow: rust-panic
    out
}

#[test]
fn v2_blobs_still_decode_under_v3() {
    let texts = vec![a_text(7)];
    let (got, shapes, canvas) = decode_annotations(&v2_annotation_blob(&texts))
        .expect("a v2 annotation blob must still decode — users' logs depend on it"); // allow: rust-panic
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].text, "hello");
    assert_eq!(got[0].id, 7);
    assert_eq!(got[0].wrap_width, 0, "a v2 document meant 'do not wrap'");
    assert!(shapes.is_empty());
    assert!(canvas.is_none());
}

#[test]
fn v3_blobs_round_trip_the_wrap_width() {
    let mut t = a_text(9);
    t.wrap_width = 240;
    let blob = encode_annotations(&[t], &[], None);
    assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
    let (got, _, _) = decode_annotations(&blob).unwrap(); // allow: rust-panic
    assert_eq!(got[0].wrap_width, 240, "v3 carries the width");
}

#[test]
fn v2_op_bytes_still_decode_under_v3() {
    // Appending `TextWrap` must not renumber the variants already on disk.
    // A v2 writer produced these exact bytes for each op below.
    for op in [
        Op::TextAdd(a_text(1)),
        Op::TextEdit(a_text(2)),
        Op::TextRemove { id: 3 },
        Op::LayerMove {
            layer: 1,
            dx: 4,
            dy: 5,
        },
        Op::Crop {
            rect: Rect {
                x: 0,
                y: 0,
                w: 8,
                h: 8,
            },
        },
    ] {
        let mut v2_bytes = vec![2u8];
        v2_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap()); // allow: rust-panic
        let decoded = decode_op(&v2_bytes)
            .unwrap_or_else(|e| panic!("v2 bytes for {:?} rejected: {e:?}", op.label())); // allow: rust-panic
        assert_eq!(decoded, op, "v2 op must mean the same thing under v3");
    }
}

#[test]
fn text_params_wire_layout_is_unchanged_by_the_new_field() {
    // The `#[serde(skip)]` guarantee, measured: two TextParams differing
    // ONLY in wrap_width must serialize to identical bytes. If this fails,
    // every persisted TextAdd/TextEdit payload has shifted.
    let a = a_text(4);
    let mut b = a_text(4);
    b.wrap_width = 512;
    assert_eq!(
        postcard::to_allocvec(&a).unwrap(), // allow: rust-panic
        postcard::to_allocvec(&b).unwrap(), // allow: rust-panic
        "wrap_width must not appear on the wire"
    );
}

#[test]
fn v1_is_still_rejected_not_silently_migrated() {
    let mut v1 = vec![1u8];
    v1.extend_from_slice(&postcard::to_allocvec(&(vec![a_text(1)],)).unwrap()); // allow: rust-panic
    assert!(matches!(
        decode_annotations(&v1),
        Err(OpError::UnsupportedVersion(1))
    ));
}

#[test]
fn text_wrap_op_applies_to_the_right_annotation() {
    let mut doc = Document::new(32, 32);
    doc.texts.push(a_text(1));
    doc.texts.push(a_text(2));
    apply(
        &Op::TextWrap {
            id: 2,
            wrap_width: 180,
        },
        &mut doc,
    );
    assert_eq!(doc.texts[0].wrap_width, 0, "untouched");
    assert_eq!(doc.texts[1].wrap_width, 180);
}

// ── v4: the box's second axis ──────────────────────────────────────────
// Same four guarantees v3 had to prove, restated for `box_height`. They are
// separate tests rather than extra asserts on the v3 ones deliberately: if
// a later change breaks only the height, the failure should say so.

/// A v3 writer emitted `[3] ++ postcard((texts, shapes, canvas, wraps))` —
/// the 4-tuple, with no box heights. Reconstructed here byte-for-byte.
fn v3_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
    let mut out = vec![3u8];
    let shapes: Vec<ShapeParams> = Vec::new();
    let canvas: Option<CanvasParams> = None;
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    out.extend_from_slice(&postcard::to_allocvec(&(texts, &shapes, &canvas, &wraps)).unwrap()); // allow: rust-panic
    out
}

#[test]
fn v3_blobs_still_decode_under_v4() {
    // The load-bearing one. `ih_oplog_persist` ships ON, so every user who
    // has opened the app since v8.40 has v3 blobs in IndexedDB; rejecting
    // them would drop their cross-reload undo history.
    let mut t = a_text(7);
    t.wrap_width = 240;
    let (got, shapes, canvas) = decode_annotations(&v3_annotation_blob(&[t]))
        .expect("a v3 annotation blob must still decode — users' logs depend on it"); // allow: rust-panic
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].id, 7);
    assert_eq!(got[0].wrap_width, 240, "the v3 width survives the step");
    assert_eq!(
        got[0].box_height, 0,
        "a v3 document meant 'size the box to the text'"
    );
    assert!(shapes.is_empty());
    assert!(canvas.is_none());
}

#[test]
fn v4_blobs_round_trip_both_box_axes() {
    let mut t = a_text(9);
    t.wrap_width = 240;
    t.box_height = 310;
    let blob = encode_annotations(&[t], &[], None);
    assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
    let (got, _, _) = decode_annotations(&blob).unwrap(); // allow: rust-panic
    assert_eq!(got[0].wrap_width, 240);
    assert_eq!(got[0].box_height, 310, "v4 carries the height");
}

#[test]
fn v3_op_bytes_still_decode_under_v4() {
    // Appending `TextBoxHeight` must not renumber the variants already on
    // disk — `TextWrap` is the one appended last before it, so it is the
    // one that would break first.
    for op in [
        Op::TextAdd(a_text(1)),
        Op::TextRemove { id: 3 },
        Op::TextWrap {
            id: 5,
            wrap_width: 200,
        },
    ] {
        let mut v3_bytes = vec![3u8];
        v3_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap()); // allow: rust-panic
        let decoded = decode_op(&v3_bytes)
            .unwrap_or_else(|e| panic!("v3 bytes for {:?} rejected: {e:?}", op.label())); // allow: rust-panic
        assert_eq!(decoded, op, "v3 op must mean the same thing under v4");
    }
}

#[test]
fn text_params_wire_layout_is_unchanged_by_the_box_height_field() {
    // Same measurement as `..._by_the_new_field` above, for the second
    // skipped field. A regression here shifts every persisted
    // TextAdd/TextEdit payload.
    let a = a_text(4);
    let mut b = a_text(4);
    b.box_height = 512;
    assert_eq!(
        postcard::to_allocvec(&a).unwrap(), // allow: rust-panic
        postcard::to_allocvec(&b).unwrap(), // allow: rust-panic
        "box_height must not appear on the wire"
    );
}

#[test]
fn text_box_height_op_applies_to_the_right_annotation() {
    let mut doc = Document::new(32, 32);
    doc.texts.push(a_text(1));
    doc.texts.push(a_text(2));
    apply(
        &Op::TextBoxHeight {
            id: 2,
            box_height: 310,
        },
        &mut doc,
    );
    assert_eq!(doc.texts[0].box_height, 0, "untouched");
    assert_eq!(doc.texts[1].box_height, 310);
}

// ── v5: the corner quad ────────────────────────────────────────────────
// The same four guarantees a third time, restated for `perspective`. Kept
// as their own tests for the reason given above the v4 block: a failure
// should name the axis that broke.

/// A skewed but valid quad — the top edge pulled in, i.e. the keystone the
/// tool exists to produce.
fn a_quad() -> [(f32, f32); 4] {
    [(0.15, 0.0), (0.85, 0.0), (1.0, 1.0), (0.0, 1.0)]
}

/// A plain filled square, as `ShapeParams`. Local to this module for the
/// same reason `a_text` is: the migration tests must build their fixtures
/// from the fields they are asserting about, not inherit them.
fn a_shape(id: u32) -> ShapeParams {
    ShapeParams {
        id,
        kind: 0,
        x0: 4.0,
        y0: 4.0,
        x1: 24.0,
        y1: 24.0,
        r: 9,
        g: 8,
        b: 7,
        stroke_width: 2.0,
        arrow_style: 0,
        sloppiness: 0,
        number: 0,
        label_kind: 0,
        points: Vec::new(),
        fill_kind: 0,
        fill_r: 0,
        fill_g: 0,
        fill_b: 0,
        fill_a: 0,
        fill2_r: 0,
        fill2_g: 0,
        fill2_b: 0,
        fill2_a: 0,
        fill_angle: 0,
        fill_block: 0,
        perspective: crate::perspective::IDENTITY_QUAD,
    }
}

/// A v4 writer emitted `[4] ++ postcard((texts, shapes, canvas, wraps,
/// heights))` — the 5-tuple, with no quads. Reconstructed byte-for-byte.
fn v4_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
    let mut out = vec![4u8];
    let shapes: Vec<ShapeParams> = Vec::new();
    let canvas: Option<CanvasParams> = None;
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    let heights: Vec<u32> = texts.iter().map(|t| t.box_height).collect();
    out.extend_from_slice(
        &postcard::to_allocvec(&(texts, &shapes, &canvas, &wraps, &heights)).unwrap(), // allow: rust-panic
    );
    out
}

#[test]
fn v4_blobs_still_decode_under_v5() {
    // The load-bearing one, for the third time. Anyone who has opened the
    // app since v8.41 has v4 blobs in IndexedDB.
    let mut t = a_text(7);
    t.wrap_width = 240;
    t.box_height = 310;
    let (got, shapes, canvas) = decode_annotations(&v4_annotation_blob(&[t]))
        .expect("a v4 annotation blob must still decode — users' logs depend on it"); // allow: rust-panic
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].wrap_width, 240, "the v4 width survives the step");
    assert_eq!(got[0].box_height, 310, "the v4 height survives the step");
    assert_eq!(
        got[0].perspective,
        crate::perspective::IDENTITY_QUAD,
        "a v4 document meant 'no perspective' — NOT a collapsed all-zero quad"
    );
    assert!(shapes.is_empty());
    assert!(canvas.is_none());
}

#[test]
fn v5_blobs_round_trip_the_corner_quad() {
    let mut t = a_text(9);
    t.wrap_width = 240;
    t.box_height = 310;
    t.perspective = a_quad();
    let blob = encode_annotations(&[t], &[], None);
    assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
    let (got, _, _) = decode_annotations(&blob).unwrap(); // allow: rust-panic
    assert_eq!(got[0].wrap_width, 240);
    assert_eq!(got[0].box_height, 310);
    assert_eq!(got[0].perspective, a_quad(), "v5 carries the quad");
}

#[test]
fn v4_op_bytes_still_decode_under_v5() {
    // Appending `TextPerspective` and `PerspectiveWarp` must not renumber
    // the variants already on disk — `TextBoxHeight` was appended last
    // before them, so it is the one that would break first.
    for op in [
        Op::TextAdd(a_text(1)),
        Op::TextRemove { id: 3 },
        Op::TextWrap {
            id: 5,
            wrap_width: 200,
        },
        Op::TextBoxHeight {
            id: 5,
            box_height: 310,
        },
    ] {
        let mut v4_bytes = vec![4u8];
        v4_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap()); // allow: rust-panic
        let decoded = decode_op(&v4_bytes)
            .unwrap_or_else(|e| panic!("v4 bytes for {:?} rejected: {e:?}", op.label())); // allow: rust-panic
        assert_eq!(decoded, op, "v4 op must mean the same thing under v5");
    }
}

/// A v7 writer emitted `[7] ++ postcard((texts, shapes, canvas, wraps,
/// heights, quads, shape_quads, shape_sloppiness))` — the 8-tuple, with no
/// font ids. Reconstructed byte-for-byte rather than by calling the current
/// encoder, because an encoder that drifted would produce a test that
/// agrees with itself.
fn v7_annotation_blob(texts: &[TextParams]) -> Vec<u8> {
    let mut out = vec![7u8];
    let shapes: Vec<ShapeParams> = Vec::new();
    let canvas: Option<CanvasParams> = None;
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    let heights: Vec<u32> = texts.iter().map(|t| t.box_height).collect();
    let quads: Vec<[(f32, f32); 4]> = texts.iter().map(|t| t.perspective).collect();
    let shape_quads: Vec<[(f32, f32); 4]> = shapes.iter().map(|s| s.perspective).collect();
    let shape_sloppiness: Vec<u8> = shapes.iter().map(|s| s.sloppiness).collect();
    out.extend_from_slice(
        &postcard::to_allocvec(&(
            texts,
            &shapes,
            &canvas,
            &wraps,
            &heights,
            &quads,
            &shape_quads,
            &shape_sloppiness,
        ))
        .unwrap(), // allow: rust-panic
    );
    out
}

#[test]
fn v7_blobs_still_decode_under_v8() {
    // The load-bearing one, for the sixth time. Anyone who has opened the
    // app since v8.76 has v7 blobs in IndexedDB, and `ih_oplog_persist`
    // ships ON — a rejected log costs them their cross-reload undo.
    let mut t = a_text(11);
    t.wrap_width = 240;
    t.box_height = 310;
    t.perspective = a_quad();
    let (got, shapes, canvas) = decode_annotations(&v7_annotation_blob(&[t]))
        .expect("a v7 annotation blob must still decode — users' logs depend on it"); // allow: rust-panic
    assert_eq!(got.len(), 1);
    assert_eq!(got[0].wrap_width, 240, "the v7 width survives the step");
    assert_eq!(got[0].box_height, 310, "the v7 height survives the step");
    assert_eq!(
        got[0].perspective,
        a_quad(),
        "the v7 quad survives the step"
    );
    assert_eq!(
        got[0].font_id, "",
        "a v7 document meant the embedded Liberation Sans, because it was \
         the only face that existed — the skipped-field default and the \
         semantic default agree here, unlike the quad"
    );
    assert!(shapes.is_empty());
    assert!(canvas.is_none());
}

#[test]
fn v8_blobs_round_trip_the_font_id() {
    let mut t = a_text(12);
    t.wrap_width = 240;
    t.perspective = a_quad();
    t.font_id = "liberation-serif".into();
    let blob = encode_annotations(&[t], &[], None);
    assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
    let (got, _, _) = decode_annotations(&blob).unwrap(); // allow: rust-panic
    assert_eq!(got[0].wrap_width, 240);
    assert_eq!(got[0].perspective, a_quad());
    assert_eq!(got[0].font_id, "liberation-serif", "v8 carries the face");
}

#[test]
fn v7_op_bytes_still_decode_under_v8() {
    // Appending `TextFont` must not renumber the variants already on disk
    // — `ShapeSloppiness` was appended last before it, so it is the one
    // that would break first. `PerspectiveWarp` held that seat when this
    // test was written against v6; the two shape variants landed in front
    // of it while the branch waited, which is exactly the renumbering this
    // test exists to catch.
    for op in [
        Op::TextAdd(a_text(1)),
        Op::TextBoxHeight {
            id: 5,
            box_height: 310,
        },
        Op::TextPerspective {
            id: 5,
            quad: a_quad(),
        },
        Op::PerspectiveWarp {
            rect: Rect {
                x: 1,
                y: 2,
                w: 30,
                h: 40,
            },
            quad: a_quad(),
        },
        Op::ShapePerspective {
            id: 5,
            quad: a_quad(),
        },
        Op::ShapeSloppiness {
            id: 5,
            sloppiness: 80,
        },
    ] {
        let mut v7_bytes = vec![7u8];
        v7_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap()); // allow: rust-panic
        let decoded = decode_op(&v7_bytes)
            .unwrap_or_else(|e| panic!("v7 bytes for {:?} rejected: {e:?}", op.label())); // allow: rust-panic
        assert_eq!(decoded, op, "v7 op must mean the same thing under v8");
    }
}

#[test]
fn text_params_wire_layout_is_unchanged_by_the_font_id_field() {
    // FOURTH instance of the measurement, and the one that matters most:
    // `font_id` is a String, so if it ever reached the wire it would add a
    // length prefix AND its bytes, shifting every persisted
    // TextAdd/TextEdit payload in every user's IndexedDB by a variable
    // amount. Zero is the only acceptable answer.
    let a = a_text(4);
    let mut b = a_text(4);
    b.font_id = "a-very-long-typeface-identifier".into();
    assert_eq!(
        postcard::to_allocvec(&a).unwrap(), // allow: rust-panic
        postcard::to_allocvec(&b).unwrap(), // allow: rust-panic
        "font_id must not appear on the wire"
    );
}

#[test]
fn text_font_op_applies_to_the_right_annotation() {
    let mut doc = Document::new(32, 32);
    doc.texts.push(a_text(1));
    doc.texts.push(a_text(2));
    apply(
        &Op::TextFont {
            id: 2,
            font_id: "liberation-mono".into(),
        },
        &mut doc,
    );
    assert_eq!(doc.texts[0].font_id, "", "untouched");
    assert_eq!(doc.texts[1].font_id, "liberation-mono");
}

#[test]
fn text_params_wire_layout_is_unchanged_by_the_perspective_field() {
    // Third instance of the measurement. A regression here shifts every
    // persisted TextAdd/TextEdit payload in every user's IndexedDB.
    let a = a_text(4);
    let mut b = a_text(4);
    b.perspective = a_quad();
    assert_eq!(
        postcard::to_allocvec(&a).unwrap(), // allow: rust-panic
        postcard::to_allocvec(&b).unwrap(), // allow: rust-panic
        "perspective must not appear on the wire"
    );
}

#[test]
fn text_perspective_op_applies_to_the_right_annotation() {
    let mut doc = Document::new(32, 32);
    doc.texts.push(a_text(1));
    doc.texts.push(a_text(2));
    apply(
        &Op::TextPerspective {
            id: 2,
            quad: a_quad(),
        },
        &mut doc,
    );
    assert_eq!(
        doc.texts[0].perspective,
        crate::perspective::IDENTITY_QUAD,
        "untouched"
    );
    assert_eq!(doc.texts[1].perspective, a_quad());
}

#[test]
fn decoded_text_ops_never_carry_the_all_zero_quad() {
    // The regression this guards is subtle and expensive: an all-zero quad
    // decoded back into a live document compares unequal to the identity
    // the engine holds, so `oplog_sync_annotations` emits a fresh
    // TextPerspective op on every single sync. The log grows forever while
    // the user does nothing.
    let bytes = encode_op(&Op::TextAdd(a_text(1)));
    let Op::TextAdd(p) = decode_op(&bytes).unwrap() else {
        panic!("wrong variant"); // allow: rust-panic
    };
    assert_eq!(
        p.perspective,
        crate::perspective::IDENTITY_QUAD,
        "the skipped field must decode to the identity, not to zeros"
    );
}

/// A v5 writer emitted `[5] ++ postcard((texts, shapes, canvas, wraps,
/// heights, quads))` — the 6-tuple, with no SHAPE quads. Reconstructed
/// byte-for-byte.
fn v5_annotation_blob(texts: &[TextParams], shapes: &[ShapeParams]) -> Vec<u8> {
    let mut out = vec![5u8];
    let canvas: Option<CanvasParams> = None;
    let wraps: Vec<u32> = texts.iter().map(|t| t.wrap_width).collect();
    let heights: Vec<u32> = texts.iter().map(|t| t.box_height).collect();
    let quads: Vec<[(f32, f32); 4]> = texts.iter().map(|t| t.perspective).collect();
    out.extend_from_slice(
        &postcard::to_allocvec(&(texts, shapes, &canvas, &wraps, &heights, &quads)).unwrap(), // allow: rust-panic
    );
    out
}

#[test]
fn v5_blobs_still_decode_under_v6() {
    // The load-bearing one, for the fourth time. Anyone who has opened the
    // app since v8.42 has v5 blobs in IndexedDB, and every one of them
    // holds shapes whose quad element simply does not exist.
    let mut t = a_text(7);
    t.wrap_width = 240;
    t.perspective = a_quad();
    let (got, shapes, canvas) = decode_annotations(&v5_annotation_blob(&[t], &[a_shape(3)]))
        .expect("a v5 annotation blob must still decode — users' logs depend on it"); // allow: rust-panic
    assert_eq!(got[0].wrap_width, 240, "the v5 width survives the step");
    assert_eq!(got[0].perspective, a_quad(), "the v5 text quad survives it");
    assert_eq!(shapes.len(), 1);
    assert_eq!(
        shapes[0].perspective,
        crate::perspective::IDENTITY_QUAD,
        "a v5 document meant 'no perspective' on its shapes — NOT a collapsed all-zero quad"
    );
    assert!(canvas.is_none());
}

#[test]
fn v6_round_trips_the_shape_quad() {
    let mut sp = a_shape(2);
    sp.perspective = a_quad();
    let blob = encode_annotations(&[], &[sp], None);
    assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
    let (_, shapes, _) = decode_annotations(&blob).unwrap(); // allow: rust-panic
    assert_eq!(shapes[0].perspective, a_quad(), "v6 carries the shape quad");
}

#[test]
fn v5_op_bytes_still_decode_under_v6() {
    // Appending `ShapePerspective` must not renumber the variants already
    // on disk — `PerspectiveWarp` was appended last before it, so it is the
    // one that would break first.
    for op in [
        Op::ShapeAdd(a_shape(2)),
        Op::ShapeRemove { id: 2 },
        Op::TextPerspective {
            id: 5,
            quad: a_quad(),
        },
        Op::PerspectiveWarp {
            rect: Rect {
                x: 1,
                y: 2,
                w: 3,
                h: 4,
            },
            quad: a_quad(),
        },
    ] {
        let mut v5_bytes = vec![5u8];
        v5_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap()); // allow: rust-panic
        let decoded = decode_op(&v5_bytes)
            .unwrap_or_else(|e| panic!("v5 bytes for {:?} rejected: {e:?}", op.label())); // allow: rust-panic
        assert_eq!(decoded, op, "v5 op must mean the same thing under v6");
    }
}

#[test]
fn shape_params_wire_layout_is_unchanged_by_the_perspective_field() {
    // Fourth instance of the measurement, and the one with the most at
    // stake: ShapeAdd/ShapeEdit payloads have been persisted since v2.
    let a = a_shape(4);
    let mut b = a_shape(4);
    b.perspective = a_quad();
    assert_eq!(
        postcard::to_allocvec(&a).unwrap(), // allow: rust-panic
        postcard::to_allocvec(&b).unwrap(), // allow: rust-panic
        "perspective must not appear on the wire"
    );
}

#[test]
fn shape_perspective_op_applies_to_the_right_shape() {
    let mut doc = Document::new(32, 32);
    doc.shapes.push(a_shape(1));
    doc.shapes.push(a_shape(2));
    apply(
        &Op::ShapePerspective {
            id: 2,
            quad: a_quad(),
        },
        &mut doc,
    );
    assert_eq!(
        doc.shapes[0].perspective,
        crate::perspective::IDENTITY_QUAD,
        "untouched"
    );
    assert_eq!(doc.shapes[1].perspective, a_quad());
}

#[test]
fn decoded_shape_ops_never_carry_the_all_zero_quad() {
    // Same regression as `decoded_text_ops_never_carry_the_all_zero_quad`,
    // one struct over: an all-zero decode compares unequal to the live
    // identity, so the sync emits a ShapePerspective op forever while the
    // user does nothing.
    let bytes = encode_op(&Op::ShapeAdd(a_shape(1)));
    // Matched rather than let-else'd on purpose: rustfmt moves a trailing
    // comment out of a let-else head, so the `// allow: rust-panic` a
    // scrutinee `unwrap` needs cannot stay on its own line (guardrails.sh
    // names this exact hazard). A match keeps the one panic annotatable.
    match decode_op(&bytes) {
        Ok(Op::ShapeAdd(p)) => assert_eq!(
            p.perspective,
            crate::perspective::IDENTITY_QUAD,
            "the skipped field must decode to the identity, not to zeros"
        ),
        other => panic!("expected a ShapeAdd back, got {other:?}"), // allow: rust-panic
    }
}

#[test]
fn an_unwarped_shape_syncs_no_perspective_op() {
    // The other half of the same hazard, on the diff side: a plain shape
    // must produce exactly ShapeAdd and nothing else, or every recomposite
    // grows the log by one op.
    let mut doc = Document::new(32, 32);
    let mut s = crate::annotations::ShapeAnnotation {
        id: 9,
        kind: 0,
        ..Default::default()
    };
    s.x1 = 20.0;
    s.y1 = 20.0;
    let ops = annotation_sync_ops(&[], std::slice::from_ref(&s), &doc);
    assert_eq!(ops.len(), 1, "one ShapeAdd, no quad op: {ops:?}");
    // Feed it back and the log is now in sync — a second pass must be silent.
    for op in &ops {
        apply(op, &mut doc);
    }
    assert!(
        annotation_sync_ops(&[], std::slice::from_ref(&s), &doc).is_empty(),
        "a synced shape must produce no further ops"
    );
}

#[test]
fn a_warped_shape_syncs_its_quad_as_its_own_op() {
    let mut doc = Document::new(32, 32);
    let mut s = crate::annotations::ShapeAnnotation {
        id: 9,
        kind: 0,
        ..Default::default()
    };
    s.x1 = 20.0;
    s.y1 = 20.0;
    s.perspective = crate::perspective::NormQuad(a_quad());
    let ops = annotation_sync_ops(&[], std::slice::from_ref(&s), &doc);
    assert!(
        ops.iter()
            .any(|o| matches!(o, Op::ShapePerspective { id: 9, .. })),
        "the quad cannot ride on ShapeAdd — it must have its own op: {ops:?}"
    );
    for op in &ops {
        apply(op, &mut doc);
    }
    assert_eq!(doc.shapes[0].perspective, a_quad(), "replay carries it");
    assert!(
        annotation_sync_ops(&[], std::slice::from_ref(&s), &doc).is_empty(),
        "and a second pass is silent — the log must not grow on every sync"
    );
}

#[test]
fn perspective_warp_op_moves_pixels_into_the_quad() {
    let mut doc = Document::new(64, 64);
    // Fill a 20×20 block so there is something identifiable to move.
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 10,
                y: 10,
                w: 20,
                h: 20,
            },
            color: Rgba {
                r: 255,
                g: 0,
                b: 0,
                a: 255,
            },
        },
        &mut doc,
    );
    apply(
        &Op::PerspectiveWarp {
            rect: Rect {
                x: 10,
                y: 10,
                w: 20,
                h: 20,
            },
            // Same footprint, top edge pulled inward — a keystone.
            quad: [(14.0, 10.0), (26.0, 10.0), (30.0, 30.0), (10.0, 30.0)],
        },
        &mut doc,
    );
    let flat = doc.pixels_flat();
    let at = |x: usize, y: usize| -> [u8; 4] {
        let i = (y * 64 + x) * 4;
        [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]]
    };
    // The near (bottom) edge still spans the full width...
    assert_eq!(
        at(12, 28)[3],
        255,
        "bottom-left corner should still be covered"
    );
    // ...while the far (top) edge has retreated inward.
    assert_eq!(
        at(11, 11)[3],
        0,
        "top-left corner must be vacated by the keystone"
    );
    // And the source rect was moved, not copied: nothing outside the quad
    // keeps the original fill.
    assert_eq!(at(28, 11)[3], 0, "top-right corner must be vacated too");
}

/// A v6 writer emitted `[6] ++ postcard((texts, shapes, canvas, wraps,
/// heights, quads, shape_quads))` — the 7-tuple, with no sloppiness.
/// Reconstructed byte-for-byte.
fn v6_annotation_blob(shapes: &[ShapeParams]) -> Vec<u8> {
    let mut out = vec![6u8];
    let texts: Vec<TextParams> = Vec::new();
    let canvas: Option<CanvasParams> = None;
    let wraps: Vec<u32> = Vec::new();
    let heights: Vec<u32> = Vec::new();
    let quads: Vec<[(f32, f32); 4]> = Vec::new();
    let shape_quads: Vec<[(f32, f32); 4]> = shapes.iter().map(|s| s.perspective).collect();
    out.extend_from_slice(
        &postcard::to_allocvec(&(
            &texts,
            shapes,
            &canvas,
            &wraps,
            &heights,
            &quads,
            &shape_quads,
        ))
        .unwrap(), // allow: rust-panic
    );
    out
}

#[test]
fn v6_blobs_still_decode_under_v7() {
    // Fifth iteration of the load-bearing read. v6 blobs hold shapes whose
    // sloppiness element simply does not exist — they meant "firm", and
    // that must survive the step.
    let mut sp = a_shape(3);
    sp.perspective = a_quad();
    let (_, shapes, _) = decode_annotations(&v6_annotation_blob(&[sp]))
        .expect("a v6 annotation blob must still decode — users' logs depend on it"); // allow: rust-panic
    assert_eq!(shapes.len(), 1);
    assert_eq!(
        shapes[0].perspective,
        a_quad(),
        "the v6 shape quad survives the step"
    );
    assert_eq!(
        shapes[0].sloppiness, 0,
        "a v6 document meant 'firm' on its shapes — no sloppiness at all"
    );
}

#[test]
fn v7_round_trips_the_shape_sloppiness() {
    let mut sp = a_shape(2);
    sp.sloppiness = 80;
    let blob = encode_annotations(&[], &[sp], None);
    assert_eq!(blob[0], OP_FORMAT_VERSION, "writes the current version");
    let (_, shapes, _) = decode_annotations(&blob).unwrap(); // allow: rust-panic
    assert_eq!(shapes[0].sloppiness, 80, "v7 carries the shape sloppiness");
}

#[test]
fn v6_op_bytes_still_decode_under_v7() {
    // Appending `ShapeSloppiness` must not renumber the variants already
    // on disk — `PerspectiveWarp` was appended last before it, so it is the
    // one that would break first.
    for op in [
        Op::ShapeAdd(a_shape(2)),
        Op::ShapeRemove { id: 2 },
        Op::ShapePerspective {
            id: 2,
            quad: a_quad(),
        },
        Op::PerspectiveWarp {
            rect: Rect {
                x: 1,
                y: 2,
                w: 3,
                h: 4,
            },
            quad: a_quad(),
        },
    ] {
        let mut v6_bytes = vec![6u8];
        v6_bytes.extend_from_slice(&postcard::to_allocvec(&op).unwrap()); // allow: rust-panic
        let decoded = decode_op(&v6_bytes)
            .unwrap_or_else(|e| panic!("v6 bytes for {:?} rejected: {e:?}", op.label())); // allow: rust-panic
        assert_eq!(decoded, op, "v6 op must mean the same thing under v7");
    }
}

#[test]
fn shape_params_wire_layout_is_unchanged_by_sloppiness() {
    // Fifth instance of the measurement: ShapeAdd/ShapeEdit payloads have
    // been persisted since v2, so sloppiness must not appear on the wire
    // either — it rides in `encode_annotations` and `Op::ShapeSloppiness`.
    let a = a_shape(4);
    let mut b = a_shape(4);
    b.sloppiness = 100;
    assert_eq!(
        postcard::to_allocvec(&a).unwrap(), // allow: rust-panic
        postcard::to_allocvec(&b).unwrap(), // allow: rust-panic
        "sloppiness must not appear on the wire"
    );
}

#[test]
fn shape_sloppiness_op_applies_to_the_right_shape() {
    let mut doc = Document::new(32, 32);
    doc.shapes.push(a_shape(1));
    doc.shapes.push(a_shape(2));
    apply(
        &Op::ShapeSloppiness {
            id: 2,
            sloppiness: 40,
        },
        &mut doc,
    );
    assert_eq!(doc.shapes[0].sloppiness, 0, "untouched");
    assert_eq!(doc.shapes[1].sloppiness, 40);
}

#[test]
fn a_firm_shape_syncs_no_sloppiness_op() {
    // `an_unwarped_shape_syncs_no_perspective_op` guards the quad's twin
    // hazard; this one guards the sloppiness twin. A plain shape must
    // produce exactly ShapeAdd and nothing else, or every recomposite
    // grows the log by one op.
    let mut doc = Document::new(32, 32);
    let mut s = crate::annotations::ShapeAnnotation {
        id: 9,
        kind: 0,
        ..Default::default()
    };
    s.x1 = 20.0;
    s.y1 = 20.0;
    let ops = annotation_sync_ops(&[], std::slice::from_ref(&s), &doc);
    assert_eq!(ops.len(), 1, "one ShapeAdd, no sloppiness op: {ops:?}");
    // Feed it back and the log is now in sync — a second pass must be silent.
    for op in &ops {
        apply(op, &mut doc);
    }
    assert!(
        annotation_sync_ops(&[], std::slice::from_ref(&s), &doc).is_empty(),
        "a synced shape must produce no further ops"
    );
}

#[test]
fn a_sloppy_shape_syncs_its_sloppiness_as_its_own_op() {
    let mut doc = Document::new(32, 32);
    let mut s = crate::annotations::ShapeAnnotation {
        id: 9,
        kind: 0,
        ..Default::default()
    };
    s.x1 = 20.0;
    s.y1 = 20.0;
    s.sloppiness = 55;
    let ops = annotation_sync_ops(&[], std::slice::from_ref(&s), &doc);
    assert!(
        ops.iter()
            .any(|o| matches!(o, Op::ShapeSloppiness { id: 9, .. })),
        "the sloppiness cannot ride on ShapeAdd — it must have its own op: {ops:?}"
    );
    for op in &ops {
        apply(op, &mut doc);
    }
    assert_eq!(doc.shapes[0].sloppiness, 55, "replay carries it");
    assert!(
        annotation_sync_ops(&[], std::slice::from_ref(&s), &doc).is_empty(),
        "and a second pass is silent — the log must not grow on every sync"
    );
}
