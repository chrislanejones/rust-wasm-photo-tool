//! Un-ignore these as each op's apply() lands in the tile-wiring session.
//! Green = replay is lossless for that op = safe to swap undo.
//!
//! `Op::Stroke`, `Op::Blur`, and `Op::TextAdd` are recorded faithfully
//! (postcard round-trips them, `OpLog::append` stores them) but `ops::apply`
//! is a documented no-op for all three today — see the `TODO(replay-parity)`
//! block in `src/ops.rs`. Each test below asserts two things:
//!
//! 1. `assert_replay_parity` — direct application matches op-log replay.
//!    This already passes today, because a no-op is trivially consistent
//!    with itself. It's here so that once `apply()` is implemented, this
//!    keeps checking the thing it's named for.
//! 2. `assert_op_has_effect` — the op actually changed the canvas versus
//!    the fixture-only baseline. This is what fails *today*: the whole
//!    point of `#[ignore]`ing these is that a real implementation must make
//!    this newly pass, not that the test is wrong.
//!
//! To activate an op once its `apply()` lands: delete that test's
//! `#[ignore = "..."]` line. One line per op. If `assert_op_has_effect`
//! still fails after that, `apply()` isn't wired for that variant yet.

mod fixtures;
mod support;

use fixtures::fixture;
use stamp_tool::ops::{BlurParams, Brush, Op, Rect, TextParams};
use support::{assert_op_has_effect, assert_replay_parity};

#[test]
#[ignore = "TODO(tile-wiring): Op::Stroke apply() is still a no-op (src/ops.rs)"]
fn stroke_parity() {
    let fx = fixture("solid_64");
    let ops = [Op::Stroke {
        points: vec![(5.0, 5.0), (30.0, 30.0), (50.0, 10.0)],
        brush: Brush {
            r: 20,
            g: 200,
            b: 60,
            a: 255,
            size: 8.0,
            hardness: 1.0,
            opacity: 1.0,
        },
    }];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
#[ignore = "TODO(tile-wiring): Op::Blur apply() is still a no-op (src/ops.rs)"]
fn blur_parity() {
    let fx = fixture("edge_96x64");
    let ops = [Op::Blur {
        rect: Rect {
            x: 30,
            y: 10,
            w: 40,
            h: 40,
        },
        params: BlurParams { intensity: 6 },
    }];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}

#[test]
#[ignore = "TODO(tile-wiring): Op::TextAdd apply() is still a no-op (src/ops.rs)"]
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
    })];
    assert_replay_parity(&fx, &ops);
    assert_op_has_effect(&fx, &ops);
}
