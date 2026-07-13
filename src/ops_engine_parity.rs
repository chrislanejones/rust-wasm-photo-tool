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
//! - Blur: every dab centre, including `effect_move`'s interpolated ones
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
    t.effect_down(down.0, down.1, 24.0, "blur", 6, 12, "#000000");
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
        250, 250, 200, 230, 6, 4, 0,
    );
    t.recomposite();

    let mut doc = seeded_doc(&px, 128, 96);
    apply(
        &Op::TextAdd(TextParams {
            id,
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
        "undo me", 20.0, 0, 0, 0, true, 8, 10, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
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
    t.effect_down(48.0, 40.0, 30.0, "pixelate", 6, 8, "#000000");
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
    let (decoded, dw, dh) = crate::codec::decode_png(&base_png).expect("engine PNG decodes");
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
    let replay = t.oplog.as_ref().unwrap().live_document().composite_flat();
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
