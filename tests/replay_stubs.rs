//! Formerly the `#[ignore]`d stubs for the recorded-but-not-applied ops —
//! now ACTIVE: `apply()` is implemented for Stroke, Blur, and TextAdd (plus
//! TextEdit/TextRemove/ShapeAdd/ShapeRemove/LayerMove) via the engine's own
//! kernels (see `src/ops.rs`, "Apply fidelity"). Each test asserts both
//! sides of the original contract:
//!
//! 1. `assert_replay_parity` — direct application matches op-log replay,
//!    byte-identical, pixels AND rendered composite.
//! 2. `assert_op_has_effect` — the op visibly changed the composite versus
//!    the fixture-only baseline (what used to fail while apply() was a
//!    no-op).
//!
//! Engine-vs-replay parity (the live brush/blur/text paths against op
//! replay) lives in `src/ops_engine_parity.rs`'s unit tests, which drive a
//! real `ImageHorseTool`.

mod fixtures;
mod support;

use fixtures::fixture;
use stamp_tool::ops::{Brush, Op, TextParams};
use support::{assert_op_has_effect, assert_replay_parity};

#[test]
fn stroke_parity() {
    let fx = fixture("solid_64");
    let ops = [Op::Stroke {
        points: vec![(5.0, 5.0), (30.0, 30.0), (50.0, 10.0)],
        brush: Brush {
            r: 20,
            g: 200,
            b: 60,
            radius: 4.0,
            hardness: 1.0,
            opacity: 1.0,
            erase: false,
        },
    }];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
fn stroke_parity_soft_translucent() {
    // The hard cases for coverage math: soft edge (falloff band) and
    // sub-unity opacity, crossing the fixture's colour bands.
    let fx = fixture("gradient_128");
    let ops = [Op::Stroke {
        points: vec![(10.0, 100.0), (100.0, 20.0), (120.0, 90.0)],
        brush: Brush {
            r: 200,
            g: 40,
            b: 10,
            radius: 9.0,
            hardness: 0.3,
            opacity: 0.55,
            erase: false,
        },
    }];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
fn erase_stroke_parity() {
    let fx = fixture("edge_96x64");
    let ops = [Op::Stroke {
        points: vec![(40.0, 20.0), (60.0, 40.0)],
        brush: Brush {
            r: 0,
            g: 0,
            b: 0,
            radius: 6.0,
            hardness: 0.8,
            opacity: 0.7,
            erase: true,
        },
    }];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
fn blur_parity() {
    let fx = fixture("edge_96x64");
    // Dab centres in stamp order across the sharp edge — order-dependent by
    // construction (each dab reads the previous dabs' output).
    let ops = [Op::Blur {
        points: vec![(44.0, 20.0), (48.0, 26.0), (52.0, 32.0)],
        radius: 14.0,
        intensity: 6,
    }];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
fn text_add_parity() {
    let fx = fixture("gradient_128");
    let ops = [Op::TextAdd(TextParams {
        id: 1,
        text: "hi".into(),
        x: 10,
        y: 20,
        font_size: 24.0,
        r: 0,
        g: 0,
        b: 0,
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
    })];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
fn text_rotated_with_background_parity() {
    // Rotation + background + shadow exercise the full annotation-tile
    // build path (rotate_pixels, bg fill, shadow blur) through replay.
    let fx = fixture("solid_64");
    let ops = [Op::TextAdd(TextParams {
        id: 3,
        text: "ok".into(),
        x: 8,
        y: 12,
        font_size: 16.0,
        r: 255,
        g: 255,
        b: 255,
        bold: false,
        rotation_deg: 20.0,
        background_kind: 1,
        bg_r: 30,
        bg_g: 30,
        bg_b: 200,
        bg_a: 255,
        bg_padding: 4,
        bg_corner_radius: 3,
        bg_tail: 0,
        shadow_box: true,
        shadow_text: false,
        shadow_r: 0,
        shadow_g: 0,
        shadow_b: 0,
        shadow_a: 160,
        shadow_dx: 2,
        shadow_dy: 2,
        shadow_blur: 3,
    })];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}
