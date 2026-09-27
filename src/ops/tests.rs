// Moved out of src/ops.rs verbatim (Track A, docs/AppShell-Refactor-Plan.md):
// the test module lived inside the production file. `use super::*` still
// resolves to the same module, so nothing below changed.

use super::*;

fn test_brush() -> Brush {
    Brush {
        r: 10,
        g: 20,
        b: 30,
        radius: 6.0,
        hardness: 0.8,
        opacity: 0.5,
        erase: false,
    }
}

fn test_text(id: u32) -> TextParams {
    TextParams {
        id,
        wrap_width: 0,
        box_height: 0,
        perspective: crate::perspective::IDENTITY_QUAD,
        font_id: String::new(),
        text: "hi".into(),
        x: 3,
        y: 4,
        font_size: 18.0,
        r: 0,
        g: 0,
        b: 0,
        bold: true,
        rotation_deg: 12.5,
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

fn test_shape(id: u32) -> ShapeParams {
    ShapeParams {
        id,
        kind: 1,
        x0: 10.0,
        y0: 10.0,
        x1: 40.0,
        y1: 40.0,
        r: 255,
        g: 0,
        b: 0,
        stroke_width: 2.0,
        arrow_style: 0,
        sloppiness: 0,
        number: 0,
        label_kind: 0,
        points: Vec::new(),
        fill_kind: 1,
        fill_r: 0,
        fill_g: 128,
        fill_b: 255,
        fill_a: 200,
        fill2_r: 0,
        fill2_g: 0,
        fill2_b: 0,
        fill2_a: 0,
        fill_angle: 0,
        fill_block: 0,
        perspective: crate::perspective::IDENTITY_QUAD,
    }
}

fn sample_ops() -> Vec<Op> {
    vec![
        Op::Stroke {
            points: vec![(1.0, 2.0), (3.5, 4.5)],
            brush: test_brush(),
        },
        Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 10,
                h: 10,
            },
            color: Rgba {
                r: 1,
                g: 2,
                b: 3,
                a: 255,
            },
        },
        Op::Blur {
            points: vec![(15.0, 15.0), (18.0, 16.5)],
            radius: 10.0,
            intensity: 7,
        },
        Op::Levels(LevelsParams {
            black: 16,
            white: 235,
            gamma: 1.2,
        }),
        Op::Crop {
            rect: Rect {
                x: 2,
                y: 2,
                w: 100,
                h: 100,
            },
        },
        Op::TextAdd(test_text(1)),
        Op::TextEdit(TextParams {
            wrap_width: 0,
            box_height: 0,
            text: "bye".into(),
            bold: false,
            rotation_deg: 0.0,
            ..test_text(1)
        }),
        Op::TextRemove { id: 1 },
        Op::ShapeAdd(test_shape(2)),
        Op::ShapeRemove { id: 2 },
        Op::ShapeSloppiness {
            id: 2,
            sloppiness: 65,
        },
        Op::LayerMove {
            layer: 0,
            dx: -5,
            dy: 7,
        },
    ]
}

#[test]
fn postcard_round_trip_every_variant() {
    for op in sample_ops() {
        let bytes = encode_op(&op);
        assert_eq!(bytes[0], OP_FORMAT_VERSION, "version byte prefix");
        let back = decode_op(&bytes).expect("decode"); // allow: rust-panic
        assert_eq!(op, back, "round-trip mismatch for {op:?}");
    }
}

#[test]
fn version_byte_rejects_bumped_version() {
    let op = Op::TextRemove { id: 9 };
    let mut bytes = encode_op(&op);
    bytes[0] = OP_FORMAT_VERSION + 1;
    assert_eq!(
        decode_op(&bytes),
        Err(OpError::UnsupportedVersion(OP_FORMAT_VERSION + 1))
    );
    assert_eq!(decode_op(&[]), Err(OpError::Empty));
}

#[test]
fn fill_region_applies_and_clamps_to_bounds() {
    let mut doc = Document::new(300, 300);
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 290,
                y: 290,
                w: 50,
                h: 50,
            },
            color: Rgba {
                r: 9,
                g: 8,
                b: 7,
                a: 255,
            },
        },
        &mut doc,
    );
    assert_eq!(doc.pixels.get_pixel(299, 299), [9, 8, 7, 255]);
    // Out of bounds was clamped away — nothing materialised past the edge.
    assert_eq!(doc.pixels.get_pixel(300, 300), [0, 0, 0, 0]);
}

#[test]
fn crop_changes_bounds_content_and_shifts_annotations() {
    let mut doc = Document::new(300, 300);
    doc.pixels.set_pixel(60, 60, [1, 2, 3, 255]);
    doc.texts.push(test_text(1));
    doc.texts[0].x = 60;
    doc.texts[0].y = 60;
    apply(
        &Op::Crop {
            rect: Rect {
                x: 50,
                y: 50,
                w: 100,
                h: 100,
            },
        },
        &mut doc,
    );
    assert_eq!(doc.width(), 100);
    assert_eq!(doc.height(), 100);
    // (60,60) is now (10,10) after the crop origin shift — pixels AND
    // annotations, exactly like crop_in_place.
    assert_eq!(doc.pixels.get_pixel(10, 10), [1, 2, 3, 255]);
    assert_eq!((doc.texts[0].x, doc.texts[0].y), (10, 10));
}

#[test]
fn levels_is_pure_and_leaves_transparent_pixels() {
    let mut doc = Document::new(4, 4);
    doc.pixels.set_pixel(0, 0, [100, 100, 100, 255]);
    doc.pixels.set_pixel(1, 0, [100, 100, 100, 0]); // transparent — must not change
    apply(
        &Op::Levels(LevelsParams {
            black: 0,
            white: 255,
            gamma: 1.0,
        }),
        &mut doc,
    );
    // Identity levels (0..255, gamma 1) leaves opaque pixels unchanged.
    assert_eq!(doc.pixels.get_pixel(0, 0), [100, 100, 100, 255]);
    assert_eq!(doc.pixels.get_pixel(1, 0), [100, 100, 100, 0]);

    // A real remap changes opaque RGB but not the transparent pixel's RGB.
    apply(
        &Op::Levels(LevelsParams {
            black: 64,
            white: 192,
            gamma: 1.0,
        }),
        &mut doc,
    );
    assert_ne!(doc.pixels.get_pixel(0, 0)[0], 100);
    assert_eq!(doc.pixels.get_pixel(1, 0), [100, 100, 100, 0]);
}

#[test]
fn stroke_paints_center_and_leaves_far_pixels() {
    let mut doc = Document::new(64, 64);
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 64,
                h: 64,
            },
            color: Rgba {
                r: 200,
                g: 200,
                b: 200,
                a: 255,
            },
        },
        &mut doc,
    );
    apply(
        &Op::Stroke {
            points: vec![(10.0, 32.0), (50.0, 32.0)],
            brush: Brush {
                r: 20,
                g: 200,
                b: 60,
                radius: 4.0,
                hardness: 1.0,
                opacity: 1.0,
                erase: false,
            },
        },
        &mut doc,
    );
    // A hard, opaque brush lays pure color on the stroke line...
    assert_eq!(doc.pixels.get_pixel(30, 32), [20, 200, 60, 255]);
    // ...and leaves pixels beyond the radius untouched.
    assert_eq!(doc.pixels.get_pixel(30, 45), [200, 200, 200, 255]);
}

#[test]
fn erase_stroke_scrubs_alpha() {
    let mut doc = Document::new(32, 32);
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 32,
                h: 32,
            },
            color: Rgba {
                r: 50,
                g: 60,
                b: 70,
                a: 255,
            },
        },
        &mut doc,
    );
    apply(
        &Op::Stroke {
            points: vec![(16.0, 16.0)],
            brush: Brush {
                r: 0,
                g: 0,
                b: 0,
                radius: 5.0,
                hardness: 1.0,
                opacity: 1.0,
                erase: true,
            },
        },
        &mut doc,
    );
    assert_eq!(doc.pixels.get_pixel(16, 16)[3], 0, "center fully erased");
    assert_eq!(
        doc.pixels.get_pixel(2, 2),
        [50, 60, 70, 255],
        "far corner untouched"
    );
}

#[test]
fn blur_softens_an_edge_deterministically() {
    let mut doc = Document::new(64, 64);
    // Sharp vertical edge: left black, right white.
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 32,
                h: 64,
            },
            color: Rgba {
                r: 0,
                g: 0,
                b: 0,
                a: 255,
            },
        },
        &mut doc,
    );
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 32,
                y: 0,
                w: 32,
                h: 64,
            },
            color: Rgba {
                r: 255,
                g: 255,
                b: 255,
                a: 255,
            },
        },
        &mut doc,
    );
    let op = Op::Blur {
        points: vec![(32.0, 32.0)],
        radius: 12.0,
        intensity: 6,
    };
    let mut a = doc.clone();
    let mut b = doc.clone();
    apply(&op, &mut a);
    apply(&op, &mut b);
    assert_eq!(
        a.pixels.content_hash(),
        b.pixels.content_hash(),
        "same op, same input → identical output"
    );
    let px = a.pixels.get_pixel(32, 32);
    assert!(px[0] > 10 && px[0] < 245, "edge pixel blended, got {px:?}");
}

#[test]
fn text_add_then_remove_restores_baseline_composite() {
    let mut doc = Document::new(64, 64);
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 64,
                h: 64,
            },
            color: Rgba {
                r: 240,
                g: 240,
                b: 240,
                a: 255,
            },
        },
        &mut doc,
    );
    let baseline = doc.composite_hash();
    apply(&Op::TextAdd(test_text(1)), &mut doc);
    let with_text = doc.composite_hash();
    assert_ne!(baseline, with_text, "text visibly changed the composite");
    apply(
        &Op::TextEdit(TextParams {
            wrap_width: 0,
            box_height: 0,
            text: "edited".into(),
            ..test_text(1)
        }),
        &mut doc,
    );
    let edited = doc.composite_hash();
    assert_ne!(with_text, edited, "edit visibly changed the composite");
    apply(&Op::TextRemove { id: 1 }, &mut doc);
    assert_eq!(
        baseline,
        doc.composite_hash(),
        "text is non-destructive: remove restores the baseline exactly"
    );
}

#[test]
fn shape_add_then_remove_restores_baseline_composite() {
    let mut doc = Document::new(64, 64);
    apply(
        &Op::FillRegion {
            rect: Rect {
                x: 0,
                y: 0,
                w: 64,
                h: 64,
            },
            color: Rgba {
                r: 10,
                g: 20,
                b: 30,
                a: 255,
            },
        },
        &mut doc,
    );
    let baseline = doc.composite_hash();
    apply(&Op::ShapeAdd(test_shape(7)), &mut doc);
    assert_ne!(baseline, doc.composite_hash(), "shape visible");
    apply(&Op::ShapeRemove { id: 7 }, &mut doc);
    assert_eq!(baseline, doc.composite_hash(), "remove restores baseline");
}

#[test]
fn layer_move_translates_pixels_and_annotations() {
    let mut doc = Document::new(32, 32);
    doc.pixels.set_pixel(5, 5, [9, 9, 9, 255]);
    doc.texts.push(test_text(1));
    doc.texts[0].x = 5;
    doc.texts[0].y = 5;
    apply(
        &Op::LayerMove {
            layer: 0,
            dx: 3,
            dy: -2,
        },
        &mut doc,
    );
    assert_eq!(doc.pixels.get_pixel(8, 3), [9, 9, 9, 255]);
    assert_eq!((doc.texts[0].x, doc.texts[0].y), (8, 3));
}

/// Build a log with `n` mixed ops (deterministic).
fn mixed_log(n: usize) -> OpLog {
    let mut log = OpLog::new(512, 512);
    for i in 0..n {
        let op = match i % 3 {
            0 => Op::FillRegion {
                rect: Rect {
                    x: (i % 400) as i32,
                    y: (i % 400) as i32,
                    w: 20,
                    h: 20,
                },
                color: Rgba {
                    r: (i as u8),
                    g: 100,
                    b: 50,
                    a: 255,
                },
            },
            1 => Op::Levels(LevelsParams {
                black: 8,
                white: 240,
                gamma: 1.05,
            }),
            _ => Op::Stroke {
                points: vec![(i as f64, i as f64), (i as f64 + 9.0, i as f64 + 4.0)],
                brush: Brush {
                    r: 0,
                    g: 0,
                    b: 0,
                    radius: 2.0,
                    hardness: 1.0,
                    opacity: 1.0,
                    erase: false,
                },
            },
        };
        log.append(op);
    }
    log
}

#[test]
fn replay_is_deterministic() {
    let log = mixed_log(120);
    let mut a = TileBuffer::new(0, 0);
    let mut b = TileBuffer::new(0, 0);
    log.replay(&mut a);
    log.replay(&mut b);
    assert_eq!(a.content_hash(), b.content_hash());
    // And matches the live buffer the log maintained while appending.
    assert_eq!(a.content_hash(), log.buffer().content_hash());
}

#[test]
fn keyframe_replay_equals_full_replay() {
    // 120 ops => keyframes at 0, 50, 100.
    let log = mixed_log(120);
    assert!(log.keyframe_count() >= 3, "expected multiple keyframes");
    let mut fast = TileBuffer::new(0, 0);
    let mut full = TileBuffer::new(0, 0);
    log.replay(&mut fast); // nearest keyframe (100) + 20 ops
    log.replay_full(&mut full); // from index 0
    assert_eq!(fast.content_hash(), full.content_hash());
}

#[test]
fn undo_truncate_correctness() {
    let mut log = mixed_log(70);
    let hash_full = log.buffer().content_hash();

    // Snapshot the state at 60 ops via an independent rebuild.
    let log60 = mixed_log(60);
    let hash60 = log60.buffer().content_hash();

    // Truncate the 70-op log back to 60 — must match the freshly-built 60.
    log.truncate(60);
    assert_eq!(log.len(), 60);
    assert_eq!(log.buffer().content_hash(), hash60);
    assert_ne!(log.buffer().content_hash(), hash_full);

    // Branch: append a new op after the undo. Tail is gone; history linear.
    log.append(Op::FillRegion {
        rect: Rect {
            x: 0,
            y: 0,
            w: 5,
            h: 5,
        },
        color: Rgba {
            r: 200,
            g: 0,
            b: 0,
            a: 255,
        },
    });
    assert_eq!(log.len(), 61);
    let mut replayed = TileBuffer::new(0, 0);
    log.replay(&mut replayed);
    assert_eq!(replayed.content_hash(), log.buffer().content_hash());
}

#[test]
fn seek_undo_redo_round_trip_and_branch() {
    let mut log = mixed_log(10);
    let h10 = log.buffer().content_hash();
    let h5 = mixed_log(5).buffer().content_hash();

    // Undo to 5 without losing ops — redo must still be possible.
    assert!(log.seek(5));
    assert_eq!(log.cursor(), 5);
    assert_eq!(log.len(), 10, "ops retained across seek");
    assert_eq!(log.buffer().content_hash(), h5);

    // Redo back to 10 — exact state.
    assert!(log.seek(10));
    assert_eq!(log.buffer().content_hash(), h10);

    // Undo again, then BRANCH: append drops the tail.
    assert!(log.seek(5));
    log.append(Op::FillRegion {
        rect: Rect {
            x: 1,
            y: 1,
            w: 3,
            h: 3,
        },
        color: Rgba {
            r: 9,
            g: 9,
            b: 9,
            a: 255,
        },
    });
    assert_eq!(log.len(), 6, "tail dropped on branch");
    assert_eq!(log.cursor(), 6);
    assert!(!log.seek(10), "past-end seek rejected");
}

#[test]
fn keyframe_pruning_keeps_seeks_exact() {
    // 250 ops → keyframes at 0,50,...,250; pruning keeps 0 + last 3.
    let log = mixed_log(250);
    assert_eq!(
        log.keyframe_count(),
        1 + KEYFRAMES_IN_MEMORY,
        "old keyframes pruned"
    );
    // A seek far behind the kept keyframes replays from the base — must
    // still be byte-exact.
    let mut rewound = mixed_log(250);
    assert!(rewound.seek(20));
    assert_eq!(
        rewound.buffer().content_hash(),
        mixed_log(20).buffer().content_hash(),
        "seek behind pruned keyframes is exact via base replay"
    );
}

#[test]
fn annotation_state_survives_keyframe_replay() {
    // Text added before a keyframe boundary must still exist (and
    // composite identically) after a keyframed rebuild.
    let mut log = OpLog::new(128, 128);
    log.append(Op::TextAdd(test_text(1)));
    for i in 0..60 {
        log.append(Op::FillRegion {
            rect: Rect {
                x: i,
                y: i,
                w: 10,
                h: 10,
            },
            color: Rgba {
                r: 100,
                g: 0,
                b: 0,
                a: 255,
            },
        });
    }
    let rebuilt = log.replay_document();
    assert_eq!(rebuilt.texts.len(), 1, "annotation survived the keyframe");
    assert_eq!(
        rebuilt.composite_hash(),
        log.document().composite_hash(),
        "keyframed rebuild composites identically to the live document"
    );
}
