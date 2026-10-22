//! Engine-vs-replay parity — the Stage 3 gold gate.
//!
//! Each test drives the REAL engine path (the same wasm-bindgen methods JS
//! calls: `paint_down`/`paint_move`/`paint_up`, `effect_down`/`effect_move`/
//! `effect_up`, `add_text_annotation`), reads the resulting composite, and
//! asserts that replaying the equivalent [`Op`] over a [`Document`] seeded
//! with the same starting pixels reproduces it BYTE-FOR-BYTE. Zero
//! tolerance: a green run here means "undo via replay shows the user the
//! exact pixels the tool drew".
//!
//! The ops are constructed the way the Stage-4 recorder records them:
//! - Stroke: the down point + each `paint_move` point (stabilizer off ⇒ the
//!   painted polyline IS the input polyline).
//! - Blur: every dab center, including `effect_move`'s interpolated ones
//!   (recomputed here with the same formula `effect_move` uses; the live
//!   recorder hooks `apply_effect_dab` itself, so it can't drift).
//! - Text: the exact parameter set passed to `add_text_annotation`.

use crate::ops::{apply, Brush, Document, Op, TextParams};
use crate::ImageHorseTool;

/// Deterministic multi-band RGBA test image (opaque, banded rows with a
/// vertical seam) — busy enough that a misplaced dab or offset shows up.
fn seed_pixels(w: u32, h: u32) -> Vec<u8> {
    let mut px = Vec::with_capacity((w * h * 4) as usize);
    for y in 0..h {
        for x in 0..w {
            let seam = if x >= w / 2 { 60u8 } else { 0u8 };
            px.extend_from_slice(&[
                ((y * 7) % 256) as u8,
                (255 - ((y * 5) % 256) as u8).saturating_sub(seam),
                ((x * 3) % 256) as u8,
                255,
            ]);
        }
    }
    px
}

/// A tool with the seed image loaded as its single layer.
fn seeded_tool(w: u32, h: u32) -> (ImageHorseTool, Vec<u8>) {
    let px = seed_pixels(w, h);
    let mut t = ImageHorseTool::new(w, h);
    t.load_image(&px);
    (t, px)
}

/// A document seeded with the same starting pixels.
fn seeded_doc(px: &[u8], w: u32, h: u32) -> Document {
    let mut doc = Document::new(w, h);
    doc.pixels.blit_from_flat(px, w, h);
    doc
}

/// Byte-compare the engine's composite against the document's composite,
/// reporting the first differing pixel on mismatch.
fn assert_flat_identical(engine: &[u8], replay: &[u8], w: u32, ctx: &str) {
    assert_eq!(engine.len(), replay.len(), "{ctx}: length mismatch");
    if engine == replay {
        return;
    }
    for i in (0..engine.len()).step_by(4) {
        if engine[i..i + 4] != replay[i..i + 4] {
            let px_index = i / 4;
            let x = px_index % w as usize;
            let y = px_index / w as usize;
            panic!(
                "{ctx}: engine-vs-replay mismatch at pixel ({x}, {y}): \
                 engine={:?} replay={:?}",
                &engine[i..i + 4],
                &replay[i..i + 4]
            );
        }
    }
    unreachable!("{ctx}: buffers compare unequal but no differing pixel found");
}

#[test]
fn stroke_replay_matches_live_brush_hard_opaque() {
    let (mut t, px) = seeded_tool(96, 80);
    let points = [(12.0, 14.0), (60.0, 40.0), (80.0, 20.0)];
    // size 9 → radius 4.5 exactly; stabilizer OFF so the painted polyline is
    // exactly `points`.
    t.paint_down(points[0].0, points[0].1, 9.0, "#14c83c", 1.0, 1.0, "off");
    t.paint_move(points[1].0, points[1].1);
    t.paint_move(points[2].0, points[2].1);
    t.paint_up();
    t.recomposite();

    let mut doc = seeded_doc(&px, 96, 80);
    apply(
        &Op::Stroke {
            points: points.to_vec(),
            brush: Brush {
                r: 0x14,
                g: 0xc8,
                b: 0x3c,
                radius: 4.5,
                hardness: 1.0,
                opacity: 1.0,
                erase: false,
            },
        },
        &mut doc,
    );

    assert_flat_identical(
        &t.composite_cache,
        &doc.composite_flat(),
        96,
        "hard opaque stroke",
    );
}

#[test]
fn stroke_replay_matches_live_brush_soft_translucent() {
    // Soft edge + partial opacity: the coverage falloff band and the
    // Porter-Duff blend both have to agree bit-for-bit.
    let (mut t, px) = seeded_tool(120, 90);
    let points = [(20.0, 70.0), (55.0, 25.0), (100.0, 60.0), (110.0, 30.0)];
    t.paint_down(points[0].0, points[0].1, 17.0, "#c82a0a", 0.55, 0.3, "off");
    for p in &points[1..] {
        t.paint_move(p.0, p.1);
    }
    t.paint_up();
    t.recomposite();

    let mut doc = seeded_doc(&px, 120, 90);
    apply(
        &Op::Stroke {
            points: points.to_vec(),
            brush: Brush {
                r: 0xc8,
                g: 0x2a,
                b: 0x0a,
                radius: 8.5,
                hardness: 0.3,
                opacity: 0.55,
                erase: false,
            },
        },
        &mut doc,
    );

    assert_flat_identical(
        &t.composite_cache,
        &doc.composite_flat(),
        120,
        "soft translucent stroke",
    );
}

#[test]
fn erase_replay_matches_live_eraser() {
    let (mut t, px) = seeded_tool(80, 80);
    let points = [(30.0, 30.0), (55.0, 50.0)];
    t.erase_down(points[0].0, points[0].1, 12.0, 0.8, 0.6, "off");
    t.erase_move(points[1].0, points[1].1);
    t.erase_up();
    t.recomposite();

    let mut doc = seeded_doc(&px, 80, 80);
    apply(
        &Op::Stroke {
            points: points.to_vec(),
            brush: Brush {
                r: 0,
                g: 0,
                b: 0,
                radius: 6.0,
                hardness: 0.6,
                opacity: 0.8,
                erase: true,
            },
        },
        &mut doc,
    );

    assert_flat_identical(
        &t.composite_cache,
        &doc.composite_flat(),
        80,
        "erase stroke",
    );
}

/// Recompute `effect_move`'s dab interpolation — the same formula, kept in
/// one obvious place so the test constructs the op the way the recorder
/// will.
fn effect_dab_centers(down: (f64, f64), moves: &[(f64, f64)], radius: f64) -> Vec<(f64, f64)> {
    let mut dabs = vec![down];
    let mut last = down;
    for &(x, y) in moves {
        let dx = x - last.0;
        let dy = y - last.1;
        let dist = (dx * dx + dy * dy).sqrt();
        let step = (radius * 0.5).max(1.0);
        let steps = (dist / step).ceil() as u32;
        for i in 1..=steps {
            let t = i as f64 / steps as f64;
            dabs.push((last.0 + dx * t, last.1 + dy * t));
        }
        last = (x, y);
    }
    dabs
}

#[test]
fn blur_replay_matches_live_blur_brush() {
    let (mut t, px) = seeded_tool(100, 70);
    let down = (30.0, 30.0);
    let moves = [(52.0, 38.0), (70.0, 55.0)];
    // size 24 → radius 12; intensity 6; mode "blur" (the default arm).
    t.effect_down(down.0, down.1, 24.0, "blur", 6, 12, "#000000", "off");
    for &(x, y) in &moves {
        t.effect_move(x, y);
    }
    t.effect_up();
    t.recomposite();

    let mut doc = seeded_doc(&px, 100, 70);
    apply(
        &Op::Blur {
            points: effect_dab_centers(down, &moves, 12.0),
            radius: 12.0,
            intensity: 6,
        },
        &mut doc,
    );

    assert_flat_identical(
        &t.composite_cache,
        &doc.composite_flat(),
        100,
        "blur brush stroke",
    );
}

#[test]
fn text_add_replay_matches_live_annotation() {
    let (mut t, px) = seeded_tool(128, 96);
    let id = t.add_text_annotation(
        "Parity!", 24.0, 10, 200, 40, true, 14, 22, 15.0, // rotated
        1,    // rect background
        250, 250, 200, 230, 6, 4, 0, "",
    );
    t.recomposite();

    let mut doc = seeded_doc(&px, 128, 96);
    apply(
        &Op::TextAdd(TextParams {
            id,
            wrap_width: 0,
            box_height: 0,
            perspective: crate::perspective::IDENTITY_QUAD,
            font_id: String::new(),
            text: "Parity!".into(),
            x: 14,
            y: 22,
            font_size: 24.0,
            r: 10,
            g: 200,
            b: 40,
            bold: true,
            rotation_deg: 15.0,
            background_kind: 1,
            bg_r: 250,
            bg_g: 250,
            bg_b: 200,
            bg_a: 230,
            bg_padding: 6,
            bg_corner_radius: 4,
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
        }),
        &mut doc,
    );

    assert_flat_identical(
        &t.composite_cache,
        &doc.composite_flat(),
        128,
        "text annotation",
    );
}

#[test]
fn layer_move_replay_matches_live_move_commit() {
    let (mut t, px) = seeded_tool(64, 64);
    t.translate_active_layer(7, -4);
    t.recomposite();

    let mut doc = seeded_doc(&px, 64, 64);
    apply(
        &Op::LayerMove {
            layer: 0,
            dx: 7,
            dy: -4,
        },
        &mut doc,
    );

    assert_flat_identical(&t.composite_cache, &doc.composite_flat(), 64, "layer move");
}

// ── Stage 4: recorder + op-log undo, end to end ────────────────────────────

/// Composite hash helper for the undo tests (recomposite first, like the JS
/// flush the app always performs after an action).
fn composite_hash(t: &mut ImageHorseTool) -> u64 {
    t.recomposite();
    ImageHorseTool::oplog_flat_hash(&t.composite_cache)
}

fn stroke(t: &mut ImageHorseTool, from: (f64, f64), to: (f64, f64), color: &str) {
    t.paint_down(from.0, from.1, 8.0, color, 1.0, 0.9, "off");
    t.paint_move(to.0, to.1);
    t.paint_up();
    t.recomposite();
}

#[test]
fn oplog_undo_redo_round_trips_recorded_strokes() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);

    stroke(&mut t, (10.0, 10.0), (60.0, 40.0), "#ff0000");
    let h1 = composite_hash(&mut t);
    stroke(&mut t, (20.0, 60.0), (80.0, 20.0), "#0044ff");
    let h2 = composite_hash(&mut t);
    assert_eq!(t.oplog_op_count(), 2, "both strokes recorded");
    assert!(t.oplog_active());

    // Undo twice through the op log — byte-exact earlier states.
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h1, "undo #1 = state after stroke 1");
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h0, "undo #2 = base state");
    assert_eq!(t.oplog_cursor(), 0);
    assert!(!t.oplog_is_broken(), "clean undos never break the log");

    // Redo both — byte-exact again.
    assert!(t.redo());
    assert_eq!(composite_hash(&mut t), h1);
    assert!(t.redo());
    assert_eq!(composite_hash(&mut t), h2);

    // Undo, then BRANCH with a new stroke: redo tail drops.
    assert!(t.undo());
    stroke(&mut t, (5.0, 70.0), (40.0, 70.0), "#00aa00");
    assert_eq!(t.oplog_op_count(), 2, "branch replaced the redo tail");
    assert_eq!(t.oplog_cursor(), 2);
}

#[test]
fn oplog_undo_covers_text_annotations_via_recomposite_diff() {
    let (mut t, _px) = seeded_tool(128, 96);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);

    let id = t.add_text_annotation(
        "undo me", 20.0, 0, 0, 0, true, 8, 10, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    );
    let h1 = composite_hash(&mut t); // recomposite → diff records TextAdd
    assert_eq!(t.oplog_op_count(), 1, "TextAdd recorded by the diff");
    assert_ne!(h0, h1);

    t.remove_text_annotation(id);
    let h2 = composite_hash(&mut t);
    assert_eq!(t.oplog_op_count(), 2, "TextRemove recorded");
    assert_eq!(h0, h2, "text is non-destructive");

    assert!(t.undo(), "undo the remove");
    assert_eq!(composite_hash(&mut t), h1, "text is back, byte-exact");
    assert!(t.undo(), "undo the add");
    assert_eq!(composite_hash(&mut t), h0);
    assert!(!t.oplog_is_broken());
}

#[test]
fn oplog_breaks_on_unrecorded_edit_and_falls_back_to_snapshots() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);

    let h0 = composite_hash(&mut t);
    stroke(&mut t, (10.0, 10.0), (60.0, 40.0), "#ff0000");
    let h1 = composite_hash(&mut t);

    // An UNRECORDED edit: pixelate via the real effects driver (snaps a
    // snapshot, records no op).
    t.effect_down(48.0, 40.0, 30.0, "pixelate", 6, 8, "#000000", "off");
    t.effect_up();
    let h2 = composite_hash(&mut t);
    assert_ne!(h1, h2, "pixelate visibly changed the canvas");
    assert_eq!(t.oplog_op_count(), 1, "no op recorded for pixelate");

    // Undo: the sync check must fail, break the log, and fall back to the
    // snapshot path — landing on the pre-pixelate state regardless.
    assert!(t.undo());
    assert!(t.oplog_is_broken(), "hash mismatch broke the log");
    assert_eq!(
        composite_hash(&mut t),
        h1,
        "snapshot fallback undid pixelate"
    );

    assert!(t.undo(), "snapshot undo keeps working");
    assert_eq!(composite_hash(&mut t), h0);
}

// ── Persistence: encode → "reload" → restore, byte-identical ───────────────
// The night-project Task C gate at the engine level: a real session's log is
// exported through the SAME surface the JS write path uses
// (oplog_encoded_ops / keyframe pixels + annotations), then restored into a
// FRESH engine (simulated reload) via oplog_restore. Zero-tolerance hash
// assertions, keyframe boundaries crossed, undo depth exercised after the
// round trip.

#[test]
fn persist_restore_round_trip_is_byte_identical_across_keyframes() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);

    // A real session: 54 strokes (keyframe at 50 gets crossed) + a text add
    // + a text edit = 56 ops.
    for i in 0..54u32 {
        let y = 8.0 + (i as f64) * 1.2;
        stroke(&mut t, (8.0, y), (60.0, y + 3.0), "#3366cc");
    }
    let id = t.add_text_annotation(
        "persisted",
        18.0,
        250,
        30,
        30,
        false,
        10,
        30,
        5.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
    );
    t.recomposite();
    t.update_text_annotation(
        id,
        "persisted!",
        18.0,
        250,
        30,
        30,
        true,
        12,
        32,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
    );
    t.recomposite();

    let total = t.oplog_op_count() as u32;
    assert!(total >= 56, "session recorded ({total} ops)");
    let h_full = composite_hash(&mut t);

    // Pre-compute the state two undos back (then return to full).
    assert!(t.undo() && t.undo());
    let h_minus2 = composite_hash(&mut t);
    assert!(t.redo() && t.redo());
    assert_eq!(composite_hash(&mut t), h_full);

    // "Persist": exactly what the JS write path pulls out.
    let frames = t.oplog_encoded_ops(0, total);
    assert!(!frames.is_empty());
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    assert_eq!(base_px.len(), (bw as usize) * (bh as usize) * 4);

    // "Reload": a fresh engine, nothing shared.
    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(
        t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total),
        "restore accepted"
    );

    // Byte-identical composite, full log rebuilt, text annotation LIVE.
    assert_eq!(
        composite_hash(&mut t2),
        h_full,
        "restored state == pre-reload, byte-exact"
    );
    assert_eq!(t2.oplog_op_count() as u32, total);
    assert_eq!(t2.oplog_cursor() as u32, total);
    assert!(!t2.oplog_is_broken());
    assert_eq!(
        t2.layers[0].text_annotations.len(),
        1,
        "text survived as a live annotation"
    );
    assert_eq!(t2.layers[0].text_annotations[0].text, "persisted!");

    // THE claim: undo works after reload — through the rebuilt log,
    // crossing the interior keyframe boundary.
    assert!(t2.undo() && t2.undo());
    assert_eq!(
        composite_hash(&mut t2),
        h_minus2,
        "post-reload undo == pre-reload undo, byte-exact"
    );
    assert!(!t2.oplog_is_broken());

    // Resume mid-history: restoring straight to cursor = total-2 lands on
    // the same state without any undo.
    let mut t3 = ImageHorseTool::new(bw, bh);
    assert!(t3.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total - 2));
    assert_eq!(composite_hash(&mut t3), h_minus2);
}

#[test]
fn persist_restore_keeps_base_annotations_live() {
    // A base document that ALREADY had a live text annotation (e.g. from a
    // pre-log restore path): after persist→restore, ops that edit it by id
    // must still apply — proving base annotations round-trip as live lists,
    // not baked pixels.
    let text = TextParams {
        wrap_width: 0,
        box_height: 0,
        perspective: crate::perspective::IDENTITY_QUAD,
        font_id: String::new(),
        id: 1,
        text: "base".into(),
        x: 6,
        y: 8,
        font_size: 14.0,
        r: 0,
        g: 0,
        b: 0,
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
    };
    let base_ann = crate::ops::encode_annotations(std::slice::from_ref(&text), &[], None);
    let base_px = seed_pixels(64, 48);
    let edited = TextParams {
        wrap_width: 0,
        box_height: 0,
        perspective: crate::perspective::IDENTITY_QUAD,
        font_id: String::new(),
        text: "edited".into(),
        bold: true,
        ..text
    };
    let frames = crate::ops::encode_op_frames(&[Op::TextEdit(edited)]);

    let mut t = ImageHorseTool::new(64, 48);
    assert!(t.oplog_restore(&base_px, 64, 48, &base_ann, &frames, 1));
    assert_eq!(t.layers[0].text_annotations.len(), 1);
    assert_eq!(
        t.layers[0].text_annotations[0].text, "edited",
        "edit applied to the base annotation"
    );
    assert!(t.layers[0].text_annotations[0].bold);
}

#[test]
fn restore_rejects_torn_or_mismatched_input_without_changing_state() {
    let (mut t, _px) = seeded_tool(48, 48);
    stroke(&mut t, (5.0, 5.0), (30.0, 30.0), "#123456");
    let before = composite_hash(&mut t);

    // Torn frame stream (length prefix promises more bytes than exist).
    let torn = vec![200u8, 0, 0, 0, 1, 2, 3];
    assert!(!t.oplog_restore(&vec![0u8; 48 * 48 * 4], 48, 48, &[], &torn, 0));
    // Wrong pixel-buffer size for the claimed dims.
    assert!(!t.oplog_restore(&[0u8; 16], 48, 48, &[], &[], 0));
    // Cursor past the op count.
    assert!(!t.oplog_restore(&vec![0u8; 48 * 48 * 4], 48, 48, &[], &[], 5));

    assert_eq!(
        composite_hash(&mut t),
        before,
        "failed restores changed nothing"
    );
}

#[test]
fn multi_layer_archive_restore_reads_inactive_not_broken() {
    // Regression: the real-gallery check (2026-07-11) found archive-restored
    // 2-layer photos reading "broken → snapshots" after the first stroke.
    // Cause: a snap during a transient single-layer moment lazily started an
    // EMPTY log; the layer stack then grew, and the first record marked the
    // stale log broken. A stale EMPTY log must be dropped, not treated as
    // desynced history.
    //
    // ADR-016 rescopes what "grew" means: a Canvas + Photo artboard is ONE
    // content layer and now records (see
    // `default_artboard_document_records_ops_and_undo_replays_byte_identically`),
    // so the out-of-scope document this guards is a genuinely multi-CONTENT
    // one. The invariant under test is unchanged: stale empty log ⇒ inactive,
    // never broken.
    let (mut t, _px) = seeded_tool(64, 48);
    t.set_oplog_undo(true);

    // Transient single-layer snap (as during loadFromSaved, pre-stack).
    t.crop(0, 0, 64, 48); // snaps → lazily starts an empty log
    assert!(t.oplog_op_count() >= 1 || t.oplog_active());

    let (mut t2, px2) = seeded_tool(64, 48);
    t2.set_oplog_undo(true);
    // Force the exact stale state: start an empty log while single-layer...
    t2.oplog_maybe_start();
    assert!(t2.oplog.is_some());

    // ...then rebuild the stack the way an archive restore does: a photo plus
    // a pasted layer = TWO content layers, genuinely out of scope. (The photo
    // is named "Background", as `load_image` documents are — and the legacy
    // read must not mistake it for a Canvas.)
    let paste = vec![0u8; 64 * 48 * 4];
    t2.begin_layer_restore();
    t2.push_restored_layer(&px2, 64, 48, "Background", true, 1.0);
    t2.push_restored_layer(&paste, 64, 48, "Pasted", true, 1.0);
    t2.finish_layer_restore(1);
    assert_eq!(t2.content_layer_count(), 2, "genuinely multi-layer");
    assert!(t2.oplog.is_some(), "the stale EMPTY log is still attached");

    // First stroke on the multi-layer doc: must NOT mark broken — the stale
    // empty log is dropped and the doc reads inactive.
    stroke(&mut t2, (5.0, 5.0), (30.0, 20.0), "#ff0000");
    assert!(
        !t2.oplog_is_broken(),
        "stale empty log must not read as broken"
    );
    assert!(
        !t2.oplog_active(),
        "multi-content-layer doc is inactive, not broken"
    );
    assert_eq!(t2.oplog_op_count(), 0);

    // Undo still works via snapshots, untouched.
    assert!(t2.undo());
}

#[test]
fn persist_restore_via_engine_png_is_byte_identical_with_transparency() {
    // The 2026-07-11 real-gallery check caught base-keyframe corruption
    // when keyframes round-tripped through the BROWSER's PNG path
    // (OffscreenCanvas encode / createImageBitmap decode apply color-space
    // + premultiplication transforms). This pins the fix: the ENGINE's own
    // PNG codec carries the base keyframe, byte-exact — including
    // semi-transparent and fully-transparent-with-nonzero-RGB pixels,
    // which are exactly what premultiplication mangles.
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);

    // Real edits incl. an ERASE (creates semi/fully transparent pixels
    // with surviving RGB) and a soft translucent stroke.
    stroke(&mut t, (10.0, 10.0), (70.0, 30.0), "#cc3311");
    t.erase_down(30.0, 20.0, 14.0, 0.6, 0.5, "off");
    t.erase_move(55.0, 25.0);
    t.erase_up();
    t.recomposite();
    stroke(&mut t, (15.0, 60.0), (80.0, 65.0), "#1133cc");
    let total = t.oplog_op_count() as u32;
    assert!(total >= 3);
    let h_full = composite_hash(&mut t);

    // Persist through the PNG surface (what the JS write path now stores).
    let base_png = t.oplog_keyframe_png(0);
    assert!(!base_png.is_empty(), "keyframe PNG exported");
    let base_ann = t.oplog_keyframe_annotations(0);
    let frames = t.oplog_encoded_ops(0, total);

    // Sanity: the PNG really decodes back to the exact keyframe pixels.
    let (decoded, dw, dh) = crate::codec::decode_png(&base_png).expect("engine PNG decodes"); // allow: rust-panic
    assert_eq!((dw, dh), (96, 80));
    assert_eq!(
        decoded,
        t.oplog_keyframe_pixels_rgba(0),
        "engine PNG round trip is byte-identical (transparency included)"
    );

    // "Reload" into a fresh engine via the PNG restore entry point.
    let mut t2 = ImageHorseTool::new(96, 80);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore_png(&base_png, &base_ann, &frames, total));
    assert_eq!(
        composite_hash(&mut t2),
        h_full,
        "PNG-carried restore == pre-reload, byte-exact"
    );

    // Corrupt PNG is rejected without touching state.
    let before = composite_hash(&mut t2);
    assert!(!t2.oplog_restore_png(&[1, 2, 3, 4], &base_ann, &frames, total));
    assert_eq!(composite_hash(&mut t2), before);
}

#[test]
fn history_labels_synthesize_from_ops_after_restore() {
    // Post-restore, the snapshot stacks are empty but the log holds the
    // history — the panel labels must come from the ops (and revert to the
    // snapshot labels whenever the stacks are live again).
    let (mut t, _px) = seeded_tool(64, 48);
    t.set_oplog_undo(true);
    stroke(&mut t, (5.0, 5.0), (30.0, 20.0), "#ff0000");
    stroke(&mut t, (10.0, 30.0), (40.0, 35.0), "#00ff00");
    let total = t.oplog_op_count() as u32;

    let base_png = t.oplog_keyframe_png(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let frames = t.oplog_encoded_ops(0, total);

    let mut t2 = ImageHorseTool::new(64, 48);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore_png(&base_png, &base_ann, &frames, total));
    assert_eq!(
        t2.history_labels(),
        "undo:Paint|undo:Paint|current:Current State",
        "labels synthesized from the restored ops"
    );
    assert!(t2.undo());
    assert_eq!(
        t2.history_labels(),
        "undo:Paint|current:Current State|redo:Paint",
        "cursor position reflected as undo/redo split"
    );
}

#[test]
fn restored_artboard_document_reports_its_log_depth_not_zero() {
    // F6's fourth link (2026-08-13): restore replayed the log, then
    // `undo_count()` reported 0 — its gate was `layers.len() == 1`, which the
    // rebuilt artboard Canvas fails (2 layers), so the count fell through to
    // the deliberately-cleared snapshot stack while `try_oplog_undo` stood
    // ready to rewind. ADR-016 made recording Canvas-aware; the COUNTS kept
    // the stale predicate. This is the DEFAULT document shape, so every
    // artboard resume showed undo 0.
    let (mut t, _px) = artboard_tool(64, 48, 12);
    t.set_oplog_undo(true);
    stroke(&mut t, (16.0, 16.0), (60.0, 40.0), "#ff0000");
    stroke(&mut t, (20.0, 50.0), (70.0, 20.0), "#0044ff");
    let total = t.oplog_op_count() as u32;
    assert_eq!(total, 2);

    let base_png = t.oplog_keyframe_png(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let frames = t.oplog_encoded_ops(0, total);

    // Reload at cursor 1: one op behind the tip — both directions populated.
    let mut t2 = ImageHorseTool::new(64, 48);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore_png(&base_png, &base_ann, &frames, 1));
    assert_eq!(t2.layer_count(), 2, "the artboard Canvas was rebuilt");
    assert_eq!(t2.undo_count(), 1, "undo depth = the log cursor, not 0");
    assert_eq!(t2.redo_count(), 1, "redo depth = ops past the cursor");
    assert_eq!(
        t2.history_labels(),
        "undo:Paint|current:Current State|redo:Paint",
        "the History panel synthesizes from the ops on an artboard too"
    );
    // The reported depth is real: undo actually rewinds.
    assert!(t2.undo());
    assert_eq!(t2.undo_count(), 0);
    assert_eq!(t2.redo_count(), 2);
}

// ── ADR-016: the Canvas is metadata, so the DEFAULT document is in scope ────
//
// `canvasArtboard` is ON by default, so `load_image_artboard` — Canvas fill +
// Photo — is the shape of nearly every document in the wild. `oplog_record`
// used to refuse it outright (`layers.len() != 1`), which meant op-log undo and
// persistence recorded NOTHING for anyone on defaults: dark by construction,
// not by flag. These tests are the proof that they are not. The first one is
// the deliverable: it fails on the pre-ADR-016 engine (0 ops recorded).

/// The DEFAULT document: a photo imported onto an artboard canvas.
fn artboard_tool(w: u32, h: u32, pad: u32) -> (ImageHorseTool, Vec<u8>) {
    let px = seed_pixels(w, h);
    let mut t = ImageHorseTool::new(w, h);
    t.load_image_artboard(&px, w, h, pad, 20, 40, 60, 255);
    (t, px)
}

#[test]
fn default_artboard_document_is_one_content_layer() {
    let (t, _px) = artboard_tool(64, 48, 12);
    assert_eq!(
        t.layer_count(),
        2,
        "Canvas + Photo: a two-layer stack to the user"
    );
    assert_eq!(
        t.content_layer_count(),
        1,
        "...and ONE pixel layer to the op log — the whole point"
    );
    assert_eq!((t.width(), t.height()), (64 + 24, 48 + 24), "photo + 2*pad");
    assert!(t.layers[0].is_canvas(), "the fill is the Canvas");
    assert_eq!(t.layers[0].name, "Canvas");
    assert!(!t.layers[1].is_canvas(), "the photo is content");
}

#[test]
fn default_artboard_document_records_ops_and_undo_replays_byte_identically() {
    // THE deliverable. This document recorded nothing before ADR-016.
    let (mut t, _px) = artboard_tool(64, 48, 12);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);

    stroke(&mut t, (16.0, 16.0), (60.0, 40.0), "#ff0000");
    let h1 = composite_hash(&mut t);
    stroke(&mut t, (20.0, 50.0), (70.0, 20.0), "#0044ff");
    let h2 = composite_hash(&mut t);

    assert_eq!(t.oplog_op_count(), 2, "a DEFAULT document RECORDS (was: 0)");
    assert!(
        t.oplog_active(),
        "the log is live on a Canvas + Photo document"
    );
    assert!(!t.oplog_is_broken());

    // The log's composite must equal the engine's byte for byte — i.e.
    // Document::composite_flat reproduced the Canvas fill UNDER the content
    // exactly as composite_layers_into does. This is what the sync check
    // hashes; one rounding step out and every Canvas log would break.
    let replay = t.oplog.as_ref().unwrap().live_document().composite_flat(); // allow: rust-panic
    assert_flat_identical(&t.composite_cache, &replay, t.width(), "canvas document");

    // Undo replays through the log — byte-exact, both steps.
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h1, "undo #1 byte-exact");
    assert!(t.undo());
    assert_eq!(
        composite_hash(&mut t),
        h0,
        "undo #2 = the imported document"
    );
    assert!(!t.oplog_is_broken(), "clean undos never break the log");

    // The replay restored the CONTENT layer, not the artboard fill: the stack
    // is still a stack, and the Canvas is still the Canvas.
    assert_eq!(t.layer_count(), 2, "undo did not flatten the document");
    assert_eq!(t.content_layer_count(), 1);
    assert!(t.layers[0].is_canvas());

    assert!(t.redo() && t.redo());
    assert_eq!(composite_hash(&mut t), h2, "redo byte-exact");
}

#[test]
fn a_second_content_layer_still_leaves_oplog_scope() {
    // The Canvas stops counting; a REAL second layer must still count. The log
    // must not start claiming documents it cannot replay.
    let (mut t, _px) = artboard_tool(64, 48, 12);
    t.set_oplog_undo(true);
    stroke(&mut t, (16.0, 16.0), (60.0, 40.0), "#ff0000");
    let h1 = composite_hash(&mut t);
    assert!(t.oplog_active());

    t.add_layer("Pasted"); // a genuine second CONTENT layer
    assert_eq!(t.content_layer_count(), 2);
    assert_eq!(t.layer_count(), 3, "Canvas + Photo + Pasted");
    assert!(!t.oplog_active(), "two content layers ⇒ out of scope");

    stroke(&mut t, (20.0, 20.0), (40.0, 40.0), "#00ff00");
    assert_eq!(
        t.oplog_op_count(),
        1,
        "the second layer's stroke is NOT recorded"
    );
    assert!(
        t.oplog_is_broken(),
        "out of scope ⇒ broken ⇒ snapshot undo takes over"
    );

    // Snapshot undo still works — the fallback is intact.
    assert!(t.undo());
    assert_eq!(
        composite_hash(&mut t),
        h1,
        "snapshot undo of the second-layer stroke"
    );
}

#[test]
fn editing_the_canvas_layer_leaves_scope_instead_of_recording_onto_the_photo() {
    // The Canvas is a real, selectable layer. If the user paints on it, the log
    // cannot represent the edit — its document IS the content plane. Recording
    // the stroke anyway would replay it onto the PHOTO. So: out of scope,
    // broken, snapshot undo. Never silently wrong.
    let (mut t, _px) = artboard_tool(64, 48, 12);
    t.set_oplog_undo(true);
    stroke(&mut t, (16.0, 16.0), (60.0, 40.0), "#ff0000");
    let h1 = composite_hash(&mut t);
    assert_eq!(t.oplog_op_count(), 1);

    let canvas_id = t.layers[0].id;
    assert!(t.set_active_layer(canvas_id), "the user selects the Canvas");
    stroke(&mut t, (2.0, 2.0), (10.0, 10.0), "#00ff00");

    assert_eq!(
        t.oplog_op_count(),
        1,
        "the canvas stroke was NOT recorded as a content op"
    );
    assert!(
        t.oplog_is_broken(),
        "editing the Canvas leaves op-log scope"
    );

    assert!(t.undo(), "snapshot undo takes over");
    assert_eq!(
        composite_hash(&mut t),
        h1,
        "and lands on the pre-canvas-stroke state"
    );
}

#[test]
fn canvas_document_persist_restore_round_trip_rebuilds_the_fill() {
    // ADR-016 step 5: the parity round trip on a Canvas + content document.
    // The persisted pixel plane is the CONTENT layer alone, so the fill has to
    // survive as METADATA or the restored artboard comes back transparent.
    let (mut t, _px) = artboard_tool(64, 48, 10);
    t.set_oplog_undo(true);
    for i in 0..6u32 {
        let y = 14.0 + (i as f64) * 4.0;
        stroke(&mut t, (12.0, y), (70.0, y + 2.0), "#3366cc");
    }
    let total = t.oplog_op_count() as u32;
    assert_eq!(total, 6);
    let h_full = composite_hash(&mut t);

    // "Persist" — exactly what the JS write path pulls out.
    let frames = t.oplog_encoded_ops(0, total);
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    assert!(
        !base_ann.is_empty(),
        "the Canvas is persisted even with zero annotations"
    );

    // "Reload": a fresh engine that has NO Canvas layer at all.
    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(t2.canvas_idx().is_none(), "fresh engine: no Canvas");

    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total));

    assert_eq!(
        t2.canvas_idx(),
        Some(0),
        "the Canvas was rebuilt from metadata"
    );
    assert_eq!(t2.layer_count(), 2);
    assert_eq!(t2.content_layer_count(), 1);
    assert_eq!(
        composite_hash(&mut t2),
        h_full,
        "restored composite byte-exact — fill included"
    );

    assert!(t2.undo(), "and undo still replays after the reload");
    assert!(!t2.oplog_is_broken());
}

#[test]
fn legacy_restore_recovers_the_canvas_from_a_uniform_background_layer() {
    // Documents persisted before `kind` existed name their artboard fill
    // "Background". They must still open as Canvas + Photo: this is live user
    // data with no backup.
    let (w, h) = (64u32, 48u32);
    let fill = [20u8, 40, 60, 255].repeat((w * h) as usize);
    let photo = seed_pixels(w, h);

    let mut t = ImageHorseTool::new(w, h);
    t.begin_layer_restore();
    t.push_restored_layer(&fill, w, h, "Background", true, 1.0);
    t.push_restored_layer(&photo, w, h, "Photo", true, 1.0);
    t.finish_layer_restore(1);

    assert!(
        t.layers[0].is_canvas(),
        "the legacy fill is recovered as the Canvas"
    );
    assert_eq!(
        t.layers[0].name, "Canvas",
        "renamed to the one name that means it"
    );
    assert_eq!(
        t.content_layer_count(),
        1,
        "so a restored legacy artboard is in op-log scope too"
    );
}

#[test]
fn legacy_restore_does_not_mistake_a_photo_named_background_for_the_canvas() {
    // The pre-mortem's document, and the reason the legacy read checks pixels
    // and not just the name: artboard OFF ⇒ `load_image` named the PHOTO
    // "Background" ⇒ the user pasted a layer. By NAME this is indistinguishable
    // from an artboard document. Calling the photo a Canvas would drop it from
    // every export and hand the op log the wrong content plane. A photo is not
    // a uniform fill — that is what saves it.
    let (w, h) = (64u32, 48u32);
    let photo = seed_pixels(w, h);
    let paste = vec![0u8; (w * h * 4) as usize];

    let mut t = ImageHorseTool::new(w, h);
    t.begin_layer_restore();
    t.push_restored_layer(&photo, w, h, "Background", true, 1.0);
    t.push_restored_layer(&paste, w, h, "Layer 2", true, 1.0);
    t.finish_layer_restore(1);

    assert!(
        !t.layers[0].is_canvas(),
        "a PHOTO named Background is content"
    );
    assert!(t.canvas_idx().is_none());
    assert_eq!(
        t.content_layer_count(),
        2,
        "two content layers ⇒ correctly out of op-log scope"
    );
}

#[test]
fn export_excluding_canvas_keeps_the_photo_of_an_artboard_off_document() {
    // The bug the name match shipped: `load_image` names the photo
    // "Background", so an artboard-OFF document that gained ANY second layer
    // had its PHOTO excluded from the canvas-background-off export. Keyed on
    // `kind` there is no Canvas here, so nothing is excluded.
    let (mut t, _px) = seeded_tool(48, 32);
    t.add_layer("Pasted");
    let full = t.get_image_data();
    let exported = t.get_image_data_excluding_background();

    assert!(
        exported.iter().any(|&b| b != 0),
        "the export is not blank — the photo survived"
    );
    assert_eq!(exported, full, "no Canvas ⇒ nothing to exclude");
}

#[test]
fn the_canvas_stays_pinned_to_the_bottom_of_the_stack() {
    // The export and op-log paths take "Canvas ⇒ index 0" as an invariant
    // (excluding it is a slice, not a copy). A Canvas above content would also
    // hide the photo behind an opaque fill.
    let (mut t, _px) = artboard_tool(64, 48, 8);
    let canvas_id = t.layers[0].id;
    let photo_id = t.layers[1].id;

    assert!(!t.move_layer(canvas_id, 1), "the Canvas cannot be moved up");
    assert_eq!(t.canvas_idx(), Some(0));

    assert!(
        !t.move_layer(photo_id, 0),
        "and nothing can slide beneath it"
    );
    assert_eq!(t.canvas_idx(), Some(0));
    assert!(!t.layers[1].is_canvas());
}

// ── The path the APP actually takes ─────────────────────────────────────────
// Every test above builds its artboard with `load_image_artboard`. The APP does
// NOT: `useCloneStamp.loadImageFromPixels` loads the photo native with
// `load_image` and THEN borders it with `set_artboard_border` (the idempotent,
// absolute one), so that a fresh import, a gallery switch and an AI result all
// normalise through the same call. Those are two different code paths into the
// same shape, and only one of them was under test — which is exactly how a
// feature passes its suite and is dead in the product.

/// Import the way the app imports: native load, then border.
fn app_import_tool(w: u32, h: u32, pad: u32) -> (ImageHorseTool, Vec<u8>) {
    let px = seed_pixels(w, h);
    let mut t = ImageHorseTool::new(w, h);
    t.load_image(&px);
    t.set_artboard_border(pad, 20, 40, 60, 255);
    (t, px)
}

#[test]
fn the_apps_own_import_path_yields_one_content_layer_with_the_photo_active() {
    let (t, _px) = app_import_tool(64, 48, 12);
    assert_eq!(t.layer_count(), 2, "Canvas + Photo");
    assert_eq!(t.content_layer_count(), 1, "one PIXEL layer (ADR-016)");
    assert!(t.layers[0].is_canvas(), "the fill is the Canvas");
    // set_artboard_border inserts the Canvas at index 0, shifting the photo to 1.
    // If `active` didn't shift with it, the ACTIVE layer would silently become the
    // Canvas — and `oplog_in_scope()` (content_idx() == active) would be false
    // forever, so nothing would ever record on a real import.
    assert_eq!(t.active, 1, "the PHOTO stays active, not the Canvas");
}

#[test]
fn the_apps_own_import_path_records_a_paint_stroke() {
    let (mut t, _px) = app_import_tool(64, 48, 12);
    t.set_oplog_undo(true);
    stroke(&mut t, (16.0, 16.0), (60.0, 40.0), "#ff0000");
    assert!(
        t.oplog_active(),
        "the log must be live on the app's own document"
    );
    assert!(!t.oplog_is_broken(), "and not broken");
    assert_eq!(
        t.oplog_op_count(),
        1,
        "a paint stroke on the document the app ACTUALLY creates must record"
    );
}

// ── The 2026-07-14 A/B data loss, pinned at the engine ──────────────────────
// `snap()` captures an empty log's base BEFORE the mutation it precedes, and
// `set_artboard_border` is a snap-without-record mutator — so the app's own
// import armed the log with the PRE-artboard document (photo dims, no Canvas).
// With zero edits nothing ever rebased it, persistence wrote it to disk, and
// restore rebuilt it verbatim: 220×170 came back as 200×150, Canvas destroyed.
// These tests fail on that engine.

#[test]
fn the_apps_own_import_path_arms_with_the_post_artboard_base() {
    // The A/B repro's shape: import, edit NOTHING. The armed log's base must
    // be the document the user is LOOKING at — 88×72 with the Canvas as
    // metadata — not the 64×48 pre-artboard photo `snap("Canvas Border")`
    // captured before the border was applied.
    let (t, _px) = app_import_tool(64, 48, 12);
    assert_eq!(t.oplog_op_count(), 0, "edit-free: the log is empty");
    assert_eq!(
        (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0)),
        (88, 72),
        "the empty log's base is the POST-artboard document"
    );
    let ann = t.oplog_keyframe_annotations(0);
    let (_, _, canvas) =
        crate::ops::decode_annotations(&ann).expect("base annotations blob decodes"); // allow: rust-panic
    let canvas = canvas.expect("the base carries the Canvas as metadata"); // allow: rust-panic
    assert_eq!(
        (canvas.r, canvas.g, canvas.b, canvas.a),
        (20, 40, 60, 255),
        "and it is the import's actual fill"
    );
}

#[test]
fn a_zero_op_persisted_base_restores_the_full_artboard_document() {
    // Defense in depth: the TS layer no longer persists (or restores) zero-op
    // logs at all, but if a zero-op base ever DOES reach `oplog_restore`, it
    // must rebuild the complete visual — full dims, Canvas included — not the
    // bare content plane the A/B repro handed back.
    let (mut t, _px) = app_import_tool(64, 48, 12);
    let h_engine = composite_hash(&mut t);

    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    let frames = t.oplog_encoded_ops(0, 0);
    assert!(frames.is_empty(), "zero ops persisted");

    let mut t2 = ImageHorseTool::new(1, 1);
    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, 0));
    assert_eq!(
        (t2.width(), t2.height()),
        (88, 72),
        "dimensions round-trip (the repro came back 64×48)"
    );
    assert_eq!(t2.canvas_idx(), Some(0), "the Canvas layer is rebuilt");
    assert_eq!(t2.layer_count(), 2, "Canvas + Photo");
    assert_eq!(t2.content_layer_count(), 1);
    assert_eq!(
        composite_hash(&mut t2),
        h_engine,
        "restored composite byte-exact, fill included"
    );
}

#[test]
fn app_flow_stroke_persist_restore_keeps_the_canvas() {
    // The EXACT app sequence for check 3 of the flip A/B — including the two
    // details every other parity test skips: `clear_history()` after the
    // border (loadImageFromPixels does this) and the TRANSPARENT default
    // backing (bg_a = 0; the tests above all use an opaque fill).
    let px = seed_pixels(64, 48);
    let mut t = ImageHorseTool::new(64, 48);
    t.load_image(&px);
    t.set_artboard_border(12, 0, 0, 0, 0); // transparent default backing
    t.clear_history();
    t.set_oplog_undo(true);
    stroke(&mut t, (16.0, 16.0), (60.0, 40.0), "#ff0000");

    assert_eq!(t.oplog_op_count(), 1, "the stroke recorded");
    let len = t.oplog_op_count() as u32;
    let frames = t.oplog_encoded_ops(0, len);
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    assert_eq!((bw, bh), (88, 72), "the base is the POST-artboard document");
    let h_engine = composite_hash(&mut t);

    let mut t2 = ImageHorseTool::new(1, 1);
    assert!(
        t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, len),
        "the persisted log restores"
    );
    assert_eq!((t2.width(), t2.height()), (88, 72), "dimensions round-trip");
    assert_eq!(t2.canvas_idx(), Some(0), "the Canvas layer is rebuilt");
    assert_eq!(t2.layer_count(), 2, "Canvas + Photo");
    assert_eq!(t2.content_layer_count(), 1);
    assert_eq!(
        composite_hash(&mut t2),
        h_engine,
        "restored composite byte-exact, stroke and Canvas included"
    );
}

#[test]
fn restore_rejects_a_pre_canvas_v1_annotations_blob() {
    // A legacy base persisted before the Canvas rode the annotations blob
    // (format version 1) must NOT be guessed at: `oplog_restore` returns
    // false, changes nothing, and the caller falls through to the working
    // copy — which restores the full stack correctly.
    let (mut t, _px) = app_import_tool(64, 48, 12);
    let before = composite_hash(&mut t);
    let v1_blob = [1u8, 0, 0]; // version byte 1 + arbitrary body
    assert!(
        !t.oplog_restore(&vec![0u8; 88 * 72 * 4], 88, 72, &v1_blob, &[], 0),
        "a v1 annotations blob is rejected by the version byte"
    );
    assert_eq!(
        composite_hash(&mut t),
        before,
        "the rejected restore changed nothing"
    );
}

#[test]
fn oplog_undo_restores_export_quality_too() {
    // REGRESSION, ADR-031. The op-log replay path returns before
    // `restore_snapshot`, so it never restored non-pixel parameters — it popped
    // the lockstep snapshot and discarded it wholesale. Quality silently did
    // not undo in exactly the configuration production ships (tiles + oplog
    // undo on, single content layer).
    //
    // The unit tests in lib.rs could not catch this: a bare tool has no started
    // log, so they fall through to the snapshot path even under --features
    // tiles. It took a human clicking Ctrl+Z on a real build.
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);

    // A recorded stroke, so the log is live and undo takes the op-log path.
    stroke(&mut t, (10.0, 10.0), (60.0, 40.0), "#ff0000");
    assert!(
        t.oplog_active(),
        "log must be live or this tests the wrong path"
    );

    assert_eq!(t.export_quality(), 75, "default");
    t.push_compress_marker(40);
    assert_eq!(t.export_quality(), 40, "apply took effect");

    // A second stroke so the next undo is unambiguously an op-log undo.
    stroke(&mut t, (20.0, 60.0), (80.0, 20.0), "#0044ff");

    assert!(t.undo(), "undo the second stroke");
    assert!(t.undo(), "undo the compress marker");
    assert_eq!(
        t.export_quality(),
        75,
        "quality must come back through the op-log path, not just the snapshot path"
    );

    assert!(t.redo());
    assert_eq!(t.export_quality(), 40, "redo restores it as well");
}

// ── Levels: the live tool against `Op::Levels` ─────────────────────────────

/// The live Levels tool and the op it records produce the same pixels. They
/// share one LUT function, so this pins the part that could still differ: which
/// pixels each one walks and what it leaves alone.
#[test]
fn levels_replay_matches_live_levels_apply() {
    let (mut t, px) = seeded_tool(64, 64);
    assert!(t.levels_apply(24, 210, 1.35));
    t.recomposite();

    let mut doc = seeded_doc(&px, 64, 64);
    apply(
        &Op::Levels(crate::ops::LevelsParams {
            black: 24,
            white: 210,
            gamma: 1.35,
        }),
        &mut doc,
    );

    assert_flat_identical(&t.composite_cache, &doc.composite_flat(), 64, "levels");
}

/// Levels is the first tonal adjustment that RECORDS instead of breaking the
/// log (ADR-052's six adjustments all break it). A preview must record nothing;
/// the commit records exactly one op; op-log undo and redo are byte-exact.
///
/// ⚠️ ENGINE-LEVEL ONLY. This drives the engine directly. In the running app,
/// undo of ANY recorded op — a plain paint stroke too — currently falls back to
/// snapshot undo and breaks the log, because something in the app's flush path
/// (never run here) desyncs it. So green here does NOT mean Levels keeps undo
/// depth for users yet. See docs/PARKING_LOT.md and ADR-054.
#[test]
fn levels_records_one_op_and_oplog_undo_restores_it() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);

    assert!(t.tonal_preview_begin());
    t.levels_preview_set(10, 240, 0.9);
    t.levels_preview_set(30, 220, 1.3);
    assert!(t.levels_apply(30, 220, 1.3));
    let h1 = composite_hash(&mut t);
    assert_ne!(h0, h1);

    assert_eq!(
        t.oplog_op_count(),
        1,
        "the preview recorded nothing; apply recorded one"
    );
    assert!(t.oplog_active());
    assert!(
        !t.oplog_is_broken(),
        "recording Levels leaves the engine's log healthy (engine-level; see the note above)"
    );

    assert!(t.undo());
    assert_eq!(
        composite_hash(&mut t),
        h0,
        "op-log undo restores the original"
    );
    assert!(t.redo());
    assert_eq!(
        composite_hash(&mut t),
        h1,
        "op-log redo restores the levels"
    );
}

// ── v8: rotated, n-point shapes through the real engine and a reload ───────

/// A sketchy, rotated seven-point star — then warped, then MOVED — persisted
/// and restored into a fresh engine. Every skipped field has to cross the
/// codec for the restored composite to match, and the move is the ShapeEdit
/// that used to wipe them on replay (see `a_decoded_shape_edit_keeps_the_side_op_fields`).
#[test]
fn a_rotated_warped_star_survives_persist_restore_byte_identical() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let id = t.add_shape_annotation_full(
        9,
        14.0,
        10.0,
        70.0,
        60.0,
        "#e02020",
        3.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        0,
        40,
        7,
        30.0,
        &[6],
    );
    t.recomposite();
    assert!(t.set_shape_perspective(id, &[0.2, 0.0, 0.8, 0.0, 1.0, 1.0, 0.0, 1.0]));
    t.recomposite();
    let h_before_move = composite_hash(&mut t);
    assert!(t.update_shape_annotation_full(
        id,
        9,
        20.0,
        14.0,
        76.0,
        64.0,
        "#e02020",
        3.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        0,
        40,
        7,
        30.0,
        &[6],
    ));
    t.recomposite();
    let h_full = composite_hash(&mut t);
    assert_ne!(h_before_move, h_full, "the move moved something");
    assert!(!t.oplog_is_broken(), "the live log follows every step");

    let total = t.oplog_op_count() as u32;
    let frames = t.oplog_encoded_ops(0, total);
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));

    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total));
    assert_eq!(
        composite_hash(&mut t2),
        h_full,
        "restored == pre-reload, byte-exact: rotation, points, radii, sketch and warp all crossed the codec"
    );
    assert!(!t2.oplog_is_broken());
    let json = t2.get_shape_annotations();
    assert!(
        json.contains("\"rotation\":30,")
            && json.contains("\"starPoints\":7,")
            && json.contains("\"cornerRadii\":[6,6,6,6],"),
        "{json}"
    );

    // Undo the move after the reload: the replayed ShapeEdit must not have
    // eaten the fields the side ops own.
    assert!(t2.undo());
    assert_eq!(
        composite_hash(&mut t2),
        h_before_move,
        "post-reload undo, byte-exact"
    );
    assert!(!t2.oplog_is_broken());
}

/// WAS a known gap (PARKING_LOT, "one gesture can record several ops, and
/// op-log undo rewinds only one"); fixed by gesture markers, op-log v12.
///
/// `try_oplog_undo` used to rewind exactly ONE op per snapshot. A shape added with a
/// non-default skipped field records ShapeAdd PLUS a side op for it
/// (ShapeSloppiness since v7; ShapeRotation / ShapeStarPoints since v8) under
/// the one "Add Shape" snapshot, so the first undo only rewinds the side op.
/// In memory the ShapeAdd still carries the value, so that press changes
/// nothing on screen, and every later undo lands one gesture late. Ignored
/// until the log learns gesture boundaries; run with `--ignored` to see it.
#[test]
fn one_undo_removes_a_seven_point_star() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    t.add_shape_annotation_full(
        9,
        14.0,
        10.0,
        70.0,
        60.0,
        "#e02020",
        3.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        0,
        0,
        7,
        0.0,
        &[],
    );
    t.recomposite();
    assert!(t.undo());
    assert_eq!(
        t.shape_annotation_count(),
        0,
        "one undo removes the shape it added"
    );
    assert_eq!(composite_hash(&mut t), h0);
}

// ── One gesture, one undo (op-log v12) ──────────────────────────────────────
//
// A shape with a non-default skipped field records ShapeAdd PLUS a side op
// under one snapshot. Undo must take the whole gesture back, on the op-log
// path (a snapshot-path undo with a live log marks it broken, so
// `!oplog_is_broken()` after the undo is the proof of which path ran), and
// redo must bring it back byte-exact.

#[allow(clippy::too_many_arguments)]
fn add_shape(
    t: &mut ImageHorseTool,
    kind: u8,
    sloppiness: u8,
    star_points: u8,
    rotation_deg: f64,
    radii: &[u16],
    at: (f64, f64),
) -> u32 {
    let id = t.add_shape_annotation_full(
        kind,
        at.0,
        at.1,
        at.0 + 40.0,
        at.1 + 30.0,
        "#e02020",
        3.0,
        0,
        0,
        "#000000",
        "#000000",
        0,
        0,
        sloppiness,
        star_points,
        rotation_deg,
        radii,
    );
    t.recomposite();
    id
}

/// Undo once, check the shape count and composite, check the op-log path
/// survived; redo once, check it all came back.
fn one_undo_one_redo(t: &mut ImageHorseTool, h_before: u64, n_before: usize) {
    let h_after = composite_hash(t);
    let n_after = t.shape_annotation_count();
    assert!(t.undo());
    assert_eq!(
        t.shape_annotation_count(),
        n_before,
        "one undo takes the gesture back"
    );
    assert_eq!(composite_hash(t), h_before, "undo is byte-exact");
    assert!(!t.oplog_is_broken(), "undo stayed on the op-log path");
    assert!(t.redo());
    assert_eq!(t.shape_annotation_count(), n_after);
    assert_eq!(composite_hash(t), h_after, "redo is byte-exact");
    assert!(!t.oplog_is_broken(), "redo stayed on the op-log path");
}

#[test]
fn one_undo_removes_a_rounded_rectangle() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (10.0, 10.0));
    one_undo_one_redo(&mut t, h0, 0);
}

#[test]
fn one_undo_removes_a_rotated_sloppy_rectangle() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    add_shape(&mut t, 0, 40, 0, 30.0, &[], (10.0, 10.0));
    one_undo_one_redo(&mut t, h0, 0);
}

#[test]
fn one_undo_removes_only_the_duplicate() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let id = add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (10.0, 10.0));
    let h1 = composite_hash(&mut t);
    assert!(t.duplicate_shape_annotation(id, 20.0, 20.0) > 0);
    t.recomposite();
    one_undo_one_redo(&mut t, h1, 1);
}

#[test]
fn three_gestures_undo_in_order() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (8.0, 8.0));
    let ha = composite_hash(&mut t);
    add_shape(&mut t, 0, 0, 0, 0.0, &[], (40.0, 30.0));
    let hb = composite_hash(&mut t);
    stroke(&mut t, (5.0, 70.0), (90.0, 70.0), "#2040e0");
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), hb, "first undo: the stroke");
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), ha, "second undo: B");
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h0, "third undo: A, whole");
    assert_eq!(t.shape_annotation_count(), 0);
    assert!(!t.oplog_is_broken());
}

#[test]
fn undo_count_counts_gestures_not_ops() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    add_shape(&mut t, 9, 30, 7, 15.0, &[], (10.0, 10.0));
    assert!(t.oplog_op_count() > 2, "one gesture, several ops");
    assert_eq!(t.undo_count(), 1);
}

/// Persist, reload into a fresh engine (snapshot stack empty), undo once: the
/// markers alone must find where the rounded rectangle's gesture began.
#[test]
fn after_a_reload_one_undo_still_removes_a_rounded_rectangle() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    stroke(&mut t, (5.0, 70.0), (90.0, 70.0), "#2040e0");
    let h_stroke = composite_hash(&mut t);
    add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (10.0, 10.0));
    let h_full = composite_hash(&mut t);
    let total = t.oplog_op_count() as u32;
    let frames = t.oplog_encoded_ops(0, total);
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));

    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total));
    assert_eq!(composite_hash(&mut t2), h_full);
    assert_eq!(t2.undo_count(), 2, "two gestures after the reload");
    assert!(t2.undo());
    assert_eq!(t2.shape_annotation_count(), 0);
    assert_eq!(composite_hash(&mut t2), h_stroke);
    assert!(t2.redo());
    assert_eq!(composite_hash(&mut t2), h_full);
    assert!(!t2.oplog_is_broken());
}

/// An old (v11) log has no markers. It must keep opening, and undo exactly as
/// it always did: one op per press.
#[test]
fn a_v11_log_without_markers_undoes_one_op_per_press() {
    use crate::ops::{decode_op_frames, encode_op_frames, Op};
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (10.0, 10.0));
    let total = t.oplog_op_count() as u32;
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    // Strip the markers and stamp every frame v11, which is what a v9.28 build
    // wrote for the same gesture.
    let legacy: Vec<Op> = decode_op_frames(&t.oplog_encoded_ops(0, total))
        .unwrap() // allow: rust-panic
        .into_iter()
        .filter(|op| !matches!(op, Op::SameGesture))
        .collect();
    assert_eq!(legacy.len(), 2, "ShapeAdd + ShapeCornerRadii");
    let mut frames = encode_op_frames(&legacy);
    let mut i = 0;
    while i + 4 < frames.len() {
        let n = u32::from_le_bytes(frames[i..i + 4].try_into().unwrap()) as usize; // allow: rust-panic
        frames[i + 4] = 11;
        i += 4 + n;
    }

    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, 2));
    assert_eq!(t2.undo_count(), 2, "one op, one step, as before");
    assert!(t2.undo());
    assert_eq!(t2.oplog_cursor(), 1);
    assert_eq!(
        t2.shape_annotation_count(),
        1,
        "the first press only rewinds the side op"
    );
    assert!(t2.undo());
    assert_eq!(t2.shape_annotation_count(), 0);
    assert!(!t2.oplog_is_broken());
}

/// A gesture that records nothing must not move the cursor, and must not eat
/// the undo of the gesture before it.
#[test]
fn a_no_op_gesture_leaves_the_cursor_alone() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (10.0, 10.0));
    let h1 = composite_hash(&mut t);
    let c = t.oplog_cursor();
    t.snap("Nothing");
    t.recomposite();
    assert_eq!(t.oplog_cursor(), c, "no op, no marker, no move");
    assert!(t.undo(), "the empty step undoes");
    assert_eq!(composite_hash(&mut t), h1);
    assert_eq!(t.oplog_cursor(), c);
    assert!(t.undo(), "and the shape is still one undo away");
    assert_eq!(t.shape_annotation_count(), 0);
    assert_eq!(composite_hash(&mut t), h0);
    assert!(!t.oplog_is_broken());
}

/// A step that records NO op is not the same as a step that changed nothing.
/// A resize snaps and records nothing, and an empty log rebases onto the
/// resized document at the next recomposite, so the log stays "in sync". The
/// first v12 build read that as an empty gesture and popped it without
/// restoring a pixel: Ctrl+Z after Apply Resize left the photo resized
/// (`e2e/resize-photo-size.spec.ts` caught it in CI).
#[test]
fn undo_of_an_unrecorded_resize_puts_the_size_back() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    t.resize(48, 40);
    t.recomposite();
    assert_eq!((t.width, t.height), (48, 40));
    assert!(t.undo());
    assert_eq!((t.width, t.height), (96, 80), "undo puts the size back");
    assert_eq!(composite_hash(&mut t), h0);
    assert!(t.redo());
    assert_eq!((t.width, t.height), (48, 40), "redo resizes again");
}

/// The same after a recorded gesture: the resize still undoes, and the stroke
/// before it is still one more undo away.
#[test]
fn undo_of_a_resize_after_a_stroke_puts_both_back_in_order() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    stroke(&mut t, (5.0, 70.0), (90.0, 70.0), "#2040e0");
    let h1 = composite_hash(&mut t);
    t.resize(48, 40);
    t.recomposite();
    assert!(t.undo());
    assert_eq!((t.width, t.height), (96, 80), "undo puts the size back");
    assert_eq!(composite_hash(&mut t), h1);
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h0, "then the stroke");
}

// ── Presets: the first tonal op (op-log v13, issue #37) ────────────────────
//
// ADR-055 left `preset_apply` unrecorded: it snapped "Preset" and wrote the
// five filters straight into the layer, so the next undo found a log that
// disagreed with the engine, marked it broken, and fell back to whole-image
// snapshots for the rest of the session. `Op::TonalStack` records it. The
// proof of which undo path ran is the same as for gestures above: a snapshot
// undo with a live log sets `oplog_is_broken()`, so it must stay false, and
// the cursor must move.

/// Vivid's five values, in the units ADR-055 pins (shadows and highlights are
/// absolute 8-bit, so tens, not fractions). Order: brightness, contrast,
/// saturation, shadows, highlights — `preset_apply`'s argument order.
const VIVID: (f64, f64, f64, f64, f64) = (0.04, 1.35, 1.25, 12.0, 8.0);
const FADE: (f64, f64, f64, f64, f64) = (0.06, 0.72, 0.85, 0.0, 0.0);

fn preset(t: &mut ImageHorseTool, p: (f64, f64, f64, f64, f64)) -> bool {
    let changed = t.preset_apply(p.0, p.1, p.2, p.3, p.4);
    t.recomposite();
    changed
}

#[test]
fn a_preset_records_one_op_and_undo_stays_on_the_oplog_path() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);

    // Hover first, the way the panel does: the preview must record nothing.
    assert!(t.tonal_preview_begin());
    assert!(t.preset_preview_set(FADE.0, FADE.1, FADE.2, FADE.3, FADE.4));
    assert!(t.preset_preview_set(VIVID.0, VIVID.1, VIVID.2, VIVID.3, VIVID.4));
    assert!(preset(&mut t, VIVID));
    let h1 = composite_hash(&mut t);
    assert_ne!(h0, h1, "the preset changed the photo");

    assert_eq!(
        t.oplog_op_count(),
        1,
        "the hover recorded nothing; apply recorded one"
    );
    assert_eq!(t.oplog_cursor(), 1);
    assert_eq!(t.undo_count(), 1);
    assert!(
        !t.oplog_is_broken(),
        "recording a preset leaves the log healthy"
    );

    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h0, "undo is byte-exact");
    assert!(!t.oplog_is_broken(), "undo stayed on the op-log path");
    assert_eq!(t.oplog_cursor(), 0, "the undo seeked the log");
    assert_eq!(t.oplog_op_count(), 1, "the op stays as the redo tail");

    assert!(t.redo());
    assert_eq!(composite_hash(&mut t), h1, "redo is byte-exact");
    assert!(!t.oplog_is_broken(), "redo stayed on the op-log path");
    assert_eq!(t.oplog_cursor(), 1);
}

/// The DEFAULT document (Canvas + Photo, ADR-016): the content layer has a
/// transparent frame around the photo, which is exactly where a replay that
/// walked different pixels than the live filters would show up.
#[test]
fn a_preset_on_the_default_artboard_document_undoes_on_the_oplog_path() {
    let (mut t, _px) = artboard_tool(64, 48, 12);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    assert!(preset(&mut t, VIVID));
    let h1 = composite_hash(&mut t);
    assert_eq!(t.oplog_op_count(), 1);
    assert!(!t.oplog_is_broken());

    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h0, "undo is byte-exact");
    assert!(!t.oplog_is_broken(), "undo stayed on the op-log path");
    assert!(t.redo());
    assert_eq!(composite_hash(&mut t), h1, "redo is byte-exact");
    assert!(!t.oplog_is_broken());
    assert_eq!(t.layer_count(), 2, "the Canvas is still the Canvas");
}

/// A preset between two strokes: three gestures, undone in order, all on the
/// log, and the log's own composite equals the engine's at every step.
#[test]
fn a_preset_between_strokes_undoes_in_order() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    let h0 = composite_hash(&mut t);
    stroke(&mut t, (5.0, 10.0), (90.0, 30.0), "#2040e0");
    let h1 = composite_hash(&mut t);
    assert!(preset(&mut t, FADE));
    let h2 = composite_hash(&mut t);
    stroke(&mut t, (5.0, 70.0), (90.0, 50.0), "#e02020");
    assert_eq!(t.oplog_op_count(), 3);
    assert_eq!(t.undo_count(), 3);

    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h2, "first undo: the second stroke");
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h1, "second undo: the preset");
    assert!(t.undo());
    assert_eq!(composite_hash(&mut t), h0, "third undo: the first stroke");
    assert!(!t.oplog_is_broken(), "every undo stayed on the op-log path");
}

/// Persist, reload into a fresh engine (snapshot stack empty, so undo runs
/// from the log alone), undo, redo. This is the case snapshot undo can never
/// cover: before #37 a preset in the log made `oplog_restore` replay a log
/// that did not contain it.
#[test]
fn after_a_reload_a_preset_still_undoes_and_redoes() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    stroke(&mut t, (5.0, 70.0), (90.0, 70.0), "#2040e0");
    let h_stroke = composite_hash(&mut t);
    assert!(preset(&mut t, VIVID));
    let h_full = composite_hash(&mut t);
    assert!(!t.oplog_is_broken());

    let total = t.oplog_op_count() as u32;
    let frames = t.oplog_encoded_ops(0, total);
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));

    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total));
    assert_eq!(
        composite_hash(&mut t2),
        h_full,
        "the restored document wears the preset, byte-exact"
    );
    assert_eq!(t2.undo_count(), 2, "stroke + preset after the reload");
    assert!(t2.undo());
    assert_eq!(
        composite_hash(&mut t2),
        h_stroke,
        "post-reload undo, byte-exact"
    );
    assert!(!t2.oplog_is_broken());
    assert!(t2.redo());
    assert_eq!(
        composite_hash(&mut t2),
        h_full,
        "post-reload redo, byte-exact"
    );
    assert!(!t2.oplog_is_broken());
}

/// A preset that changes nothing costs no undo step, so it must not record an
/// op either: an op with no snapshot would break the one-op-one-step lockstep.
#[test]
fn an_identity_preset_records_nothing() {
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    stroke(&mut t, (5.0, 10.0), (90.0, 30.0), "#2040e0");
    assert!(!preset(&mut t, (0.0, 1.0, 1.0, 0.0, 0.0)));
    assert_eq!(t.oplog_op_count(), 1, "only the stroke");
    assert_eq!(t.undo_count(), 1);
    assert!(!t.oplog_is_broken());
}

/// Old saves keep working. A log written by a v12 build (v9.28 + #356) holds
/// a stroke, a two-op rounded rectangle joined by a `SameGesture` marker, and
/// a Levels apply, every frame stamped 12. The new build must open it and
/// undo it gesture by gesture, byte-exact, on the op-log path.
#[test]
fn a_v12_log_without_tonal_ops_still_opens_and_undoes() {
    use crate::ops::{decode_op_frames, encode_op_frames};
    let (mut t, _px) = seeded_tool(96, 80);
    t.set_oplog_undo(true);
    stroke(&mut t, (5.0, 70.0), (90.0, 70.0), "#2040e0");
    let h1 = composite_hash(&mut t);
    add_shape(&mut t, 0, 0, 0, 0.0, &[6, 6, 6, 6], (10.0, 10.0));
    let h2 = composite_hash(&mut t);
    assert!(t.levels_apply(24, 210, 1.35));
    let h3 = composite_hash(&mut t);
    let total = t.oplog_op_count() as u32;
    let base_px = t.oplog_keyframe_pixels_rgba(0);
    let base_ann = t.oplog_keyframe_annotations(0);
    let (bw, bh) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));

    let ops = decode_op_frames(&t.oplog_encoded_ops(0, total)).unwrap(); // allow: rust-panic
    assert!(
        ops.iter().any(|op| matches!(op, Op::SameGesture)),
        "the fixture carries a v12 gesture marker"
    );
    let mut frames = encode_op_frames(&ops);
    let mut i = 0;
    while i + 4 < frames.len() {
        let n = u32::from_le_bytes(frames[i..i + 4].try_into().unwrap()) as usize; // allow: rust-panic
        frames[i + 4] = 12;
        i += 4 + n;
    }

    let mut t2 = ImageHorseTool::new(bw, bh);
    t2.set_oplog_undo(true);
    assert!(t2.oplog_restore(&base_px, bw, bh, &base_ann, &frames, total));
    assert_eq!(
        composite_hash(&mut t2),
        h3,
        "the v12 log replays byte-exact"
    );
    assert_eq!(t2.undo_count(), 3, "stroke, rectangle, levels");
    assert!(t2.undo());
    assert_eq!(composite_hash(&mut t2), h2, "undo the levels");
    assert!(t2.undo());
    assert_eq!(composite_hash(&mut t2), h1, "undo the whole rectangle");
    assert!(!t2.oplog_is_broken());
}

/// The live preset and the op it records produce the same pixels, on both
/// document shapes. Both call `presets::apply_stack`; this pins what could
/// still differ — which bytes each one walks.
#[test]
fn tonal_stack_replay_matches_live_preset_apply() {
    let (mut t, px) = seeded_tool(64, 64);
    assert!(preset(&mut t, VIVID));
    let mut doc = seeded_doc(&px, 64, 64);
    apply(
        &Op::TonalStack {
            brightness: VIVID.0,
            contrast: VIVID.1,
            highlights: VIVID.4,
            shadows: VIVID.3,
            saturation: VIVID.2,
        },
        &mut doc,
    );
    assert_flat_identical(&t.composite_cache, &doc.composite_flat(), 64, "preset");

    // The artboard document: the log's own live composite after recording.
    let (mut a, _px) = artboard_tool(64, 48, 12);
    a.set_oplog_undo(true);
    assert!(preset(&mut a, VIVID));
    let replay = a.oplog.as_ref().unwrap().live_document().composite_flat(); // allow: rust-panic
    assert_flat_identical(&a.composite_cache, &replay, a.width(), "preset on canvas");
}

/// The op carries the values exactly as `preset_apply` received them — the
/// ADR-055 units, never normalized — and is written as v13.
#[test]
fn the_recorded_tonal_stack_carries_the_units_untouched() {
    use crate::ops::{decode_op_frames, OP_FORMAT_VERSION};
    let (mut t, _px) = seeded_tool(32, 32);
    t.set_oplog_undo(true);
    assert!(preset(&mut t, VIVID));
    let frames = t.oplog_encoded_ops(0, 1);
    assert_eq!(
        frames[4], OP_FORMAT_VERSION,
        "frames use the current format"
    );
    let ops = decode_op_frames(&frames).unwrap(); // allow: rust-panic
    assert_eq!(
        ops,
        vec![Op::TonalStack {
            brightness: 0.04,
            contrast: 1.35,
            highlights: 8.0,
            shadows: 12.0,
            saturation: 1.25,
        }],
        "shadows 12 is twelve 8-bit levels, not 12/255"
    );
    assert_eq!(
        ops[0].label(),
        "Preset",
        "the History panel row after a reload"
    );
}

// Adjustments replaces absolute settings on a session base. Presets' cumulative
// TonalStack cannot encode that operation (clipping has no exact inverse).
const ADJUST_IDENTITY: [f64; 7] = [0.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0];

fn adjust_release(t: &mut ImageHorseTool, a: [f64; 7]) -> u64 {
    assert!(t.adjust_commit(a[0], a[1], a[2], a[3], a[4], a[5], a[6]));
    t.recomposite();
    assert!(!t.oplog_is_broken());
    let replay = t
        .oplog
        .as_ref()
        .expect("recorded log") // allow: rust-panic
        .live_document()
        .composite_flat();
    assert_flat_identical(
        &t.composite_cache,
        &replay,
        t.width(),
        "Adjustments release",
    );
    composite_hash(t)
}

fn restored_tool(t: &ImageHorseTool) -> ImageHorseTool {
    let (w, h) = (t.oplog_keyframe_width(0), t.oplog_keyframe_height(0));
    let mut restored = ImageHorseTool::new(w, h);
    restored.set_oplog_undo(true);
    assert!(restored.oplog_restore(
        &t.oplog_keyframe_pixels_rgba(0),
        w,
        h,
        &t.oplog_keyframe_annotations(0),
        &t.oplog_encoded_ops(0, t.oplog_op_count() as u32),
        t.oplog_cursor() as u32,
    ));
    restored
}

#[test]
fn adjustments_releases_reset_and_reload_preserve_every_undo_step() {
    for artboard in [false, true] {
        let (mut t, _) = if artboard {
            artboard_tool(32, 24, 8)
        } else {
            seeded_tool(32, 24)
        };
        t.set_oplog_undo(true);
        let mut hashes = vec![composite_hash(&mut t)];
        assert!(t.tonal_preview_begin());
        // Deliberate clipping, followed by a change to every filter (including
        // sharpen/blur), followed by exact reset and another release.
        for a in [
            [100.0, 300.0, 100.0, 0.0, 0.0, 0.0, 0.0],
            [35.0, 140.0, 65.0, 25.0, -30.0, 20.0, 5.0],
            ADJUST_IDENTITY,
            [-20.0, 80.0, 130.0, -10.0, 40.0, 0.0, 0.0],
        ] {
            hashes.push(adjust_release(&mut t, a));
        }
        assert_eq!(hashes[3], hashes[0], "reset is exact even after clipping");
        assert_eq!(t.oplog_op_count(), 4);
        assert_eq!(t.undo_count(), 4);
        let mut t = restored_tool(&t);
        assert_eq!(composite_hash(&mut t), hashes[4]);
        for expected in hashes[..4].iter().rev() {
            assert!(t.undo());
            assert_eq!(&composite_hash(&mut t), expected);
            assert!(
                !t.oplog_is_broken(),
                "snapshot fallback cannot satisfy this"
            );
        }
        for expected in &hashes[1..] {
            assert!(t.redo());
            assert_eq!(&composite_hash(&mut t), expected);
            assert!(!t.oplog_is_broken());
        }
    }
}

#[test]
fn adjustments_preview_identity_duplicate_and_apply_record_only_commits() {
    let (mut t, _) = seeded_tool(32, 24);
    t.set_oplog_undo(true);
    assert!(t.tonal_preview_begin());
    assert!(t.adjust_preview_set(70.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
    assert_eq!(t.oplog_op_count(), 0);
    assert!(!t.adjust_commit(0.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
    assert!(t.adjust_apply(30.0, 110.0, 120.0, 5.0, 10.0, 0.0, 0.0));
    t.recomposite();
    assert!(!t.tonal_preview_active());
    assert_eq!(t.oplog_op_count(), 1);
    let frames = t.oplog_encoded_ops(0, 1);
    assert_eq!((frames[4], frames[5]), (14, 24), "append-only wire index");
    let ops = crate::ops::decode_op_frames(&frames).expect("frames"); // allow: rust-panic
    assert_eq!(ops[0].label(), "Adjustments");
    assert_eq!(
        ops[0],
        Op::Adjustments {
            new_session: true,
            brightness: 30.0,
            contrast: 110.0,
            saturation: 120.0,
            shadows: 5.0,
            highlights: 10.0,
            sharpen: 0.0,
            blur: 0.0,
        }
    );
    assert!(t.tonal_preview_begin());
    adjust_release(&mut t, [20.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0]);
    assert!(!t.adjust_apply(20.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0));
    assert_eq!(
        t.oplog_op_count(),
        2,
        "Apply doesn't duplicate the last release"
    );
    assert!(!restored_tool(&t).oplog_is_broken());
}

#[test]
fn adjustments_new_sessions_and_branches_capture_the_current_pixels() {
    let (mut t, _) = seeded_tool(32, 24);
    t.set_oplog_undo(true);
    assert!(t.tonal_preview_begin());
    let first = adjust_release(&mut t, [30.0, 120.0, 80.0, 5.0, 10.0, 0.0, 0.0]);
    t.tonal_preview_cancel();
    stroke(&mut t, (2.0, 5.0), (28.0, 20.0), "#2040e0");
    let painted = composite_hash(&mut t);
    assert!(t.tonal_preview_begin());
    let final_hash = adjust_release(&mut t, [-20.0, 90.0, 150.0, 0.0, 0.0, 0.0, 0.0]);
    let mut r = restored_tool(&t);
    assert_eq!(composite_hash(&mut r), final_hash);
    assert!(r.undo());
    assert_eq!(composite_hash(&mut r), painted);
    assert!(r.undo());
    assert_eq!(composite_hash(&mut r), first);
    assert!(r.tonal_preview_begin());
    let branched = adjust_release(&mut r, [15.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0]);
    assert_eq!(r.oplog_op_count(), 2, "new release replaces the redo tail");
    assert_eq!(composite_hash(&mut restored_tool(&r)), branched);
}

#[test]
fn adjustments_session_survives_keyframes_and_keyframe_pruning() {
    let (mut t, _) = seeded_tool(8, 8);
    t.set_oplog_undo(true);
    assert!(t.tonal_preview_begin());
    let mut hashes = vec![composite_hash(&mut t)];
    // More than the resident keyframe budget, while never leaving this session.
    for i in 0..300 {
        hashes.push(adjust_release(
            &mut t,
            [f64::from(i % 90 + 1), 120.0, 80.0, 0.0, 0.0, 0.0, 0.0],
        ));
    }
    let mut r = restored_tool(&t);
    for expected in hashes[..300].iter().rev() {
        assert!(r.undo());
        assert_eq!(&composite_hash(&mut r), expected);
        assert!(!r.oplog_is_broken());
    }
}
