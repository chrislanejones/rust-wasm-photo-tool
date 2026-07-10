//! Replay-parity harness + coverage for every currently-*implemented* op:
//! `FillRegion`, `Crop`, `Levels`. See `support::assert_replay_parity` for
//! the mechanics and `tests/fixtures/mod.rs` for the input images.
//!
//! A failing test here means direct `apply()` and op-log replay disagree —
//! a real replay bug, not a test artifact. Per the session brief: don't fix
//! the engine here, `#[ignore]` with a `BUG:` note and log it loudly in
//! SESSION_LOG.md for the tile-wiring session.

mod fixtures;
mod support;

use fixtures::fixture;
use stamp_tool::ops::{Op, Rect, Rgba};
use support::{assert_replay_parity, assert_replay_parity_and_keyframe_equivalence};

// ---------------------------------------------------------------------
// Fixture sanity: the generic FillRegion-RLE reconstruction must be
// byte-exact for every fixture, independent of everything else in this
// file. If this ever fails, the bug is in tests/fixtures/mod.rs, not in
// the engine.
// ---------------------------------------------------------------------
#[test]
fn fixture_load_ops_reconstruct_pixels_exactly() {
    use stamp_tool::ops::apply;
    use stamp_tool::tiles::TileBuffer;

    for &name in fixtures::ALL_FIXTURES {
        let fx = fixture(name);
        let mut buf = TileBuffer::new(fx.width, fx.height);
        for op in fx.load_ops() {
            apply(&op, &mut buf);
        }
        let mut out = vec![0u8; fx.pixels.len()];
        assert!(
            buf.blit_to_flat(&mut out),
            "{name}: blit_to_flat wrong length"
        );
        assert_eq!(
            out, fx.pixels,
            "{name}: load_ops did not reconstruct pixels exactly"
        );
    }
}

// ---------------------------------------------------------------------
// FillRegion
// ---------------------------------------------------------------------

#[test]
fn fill_region_in_bounds() {
    let fx = fixture("solid_64");
    let ops = [Op::FillRegion {
        rect: Rect {
            x: 10,
            y: 10,
            w: 20,
            h: 20,
        },
        color: Rgba {
            r: 5,
            g: 6,
            b: 7,
            a: 255,
        },
    }];
    assert_replay_parity(&fx, &ops);
}

#[test]
fn fill_region_edge_touching() {
    let fx = fixture("edge_96x64");
    // Rect that starts inside and runs exactly to the canvas edge.
    let ops = [Op::FillRegion {
        rect: Rect {
            x: 80,
            y: 40,
            w: 16,
            h: 24,
        },
        color: Rgba {
            r: 200,
            g: 0,
            b: 0,
            a: 255,
        },
    }];
    assert_replay_parity(&fx, &ops);
}

#[test]
fn fill_region_fully_covering() {
    let fx = fixture("gradient_128");
    let ops = [Op::FillRegion {
        rect: Rect {
            x: 0,
            y: 0,
            w: fx.width,
            h: fx.height,
        },
        color: Rgba {
            r: 1,
            g: 2,
            b: 3,
            a: 255,
        },
    }];
    assert_replay_parity(&fx, &ops);
}

// ---------------------------------------------------------------------
// Crop
// ---------------------------------------------------------------------

#[test]
fn crop_interior() {
    let fx = fixture("gradient_128");
    let ops = [Op::Crop {
        rect: Rect {
            x: 20,
            y: 30,
            w: 50,
            h: 40,
        },
    }];
    assert_replay_parity(&fx, &ops);
}

#[test]
fn crop_to_edge() {
    let fx = fixture("edge_96x64");
    // Rect that runs from an interior origin all the way to the far corner.
    let ops = [Op::Crop {
        rect: Rect {
            x: 40,
            y: 10,
            w: 56,
            h: 54,
        },
    }];
    assert_replay_parity(&fx, &ops);
}

#[test]
fn crop_to_1px() {
    let fx = fixture("solid_64");
    let ops = [Op::Crop {
        rect: Rect {
            x: 5,
            y: 5,
            w: 1,
            h: 1,
        },
    }];
    assert_replay_parity(&fx, &ops);
}

// ---------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------

#[test]
fn levels_identity() {
    let fx = fixture("gradient_128");
    let ops = [Op::Levels(stamp_tool::ops::LevelsParams {
        black: 0,
        white: 255,
        gamma: 1.0,
    })];
    assert_replay_parity(&fx, &ops);
}

#[test]
fn levels_extreme() {
    let fx = fixture("gradient_128");
    let ops = [Op::Levels(stamp_tool::ops::LevelsParams {
        black: 250,
        white: 251,
        gamma: 8.0,
    })];
    assert_replay_parity(&fx, &ops);
}

// ---------------------------------------------------------------------
// Combined: fill -> crop -> levels, padded out past a keyframe boundary.
// ---------------------------------------------------------------------

#[test]
fn combined_fill_crop_levels_crosses_keyframe_boundary() {
    let fx = fixture("edge_96x64");

    let mut ops = Vec::new();
    // Padding FillRegion ops so the log crosses a real keyframe boundary
    // (KEYFRAME_INTERVAL = 50) before the fill/crop/levels sequence under
    // test — proving replay is correct when the target ops don't start
    // right after a keyframe.
    for i in 0..40u32 {
        ops.push(Op::FillRegion {
            rect: Rect {
                x: (i % 90) as i32,
                y: (i % 60) as i32,
                w: 2,
                h: 2,
            },
            color: Rgba {
                r: i as u8,
                g: 10,
                b: 20,
                a: 255,
            },
        });
    }
    ops.push(Op::FillRegion {
        rect: Rect {
            x: 4,
            y: 4,
            w: 30,
            h: 20,
        },
        color: Rgba {
            r: 9,
            g: 9,
            b: 9,
            a: 255,
        },
    });
    ops.push(Op::Crop {
        rect: Rect {
            x: 2,
            y: 2,
            w: 60,
            h: 40,
        },
    });
    ops.push(Op::Levels(stamp_tool::ops::LevelsParams {
        black: 10,
        white: 230,
        gamma: 1.3,
    }));
    // More padding after, so the *end* of the log (what replay() actually
    // targets) is also well past the boundary.
    for i in 0..15u32 {
        ops.push(Op::FillRegion {
            rect: Rect {
                x: (i % 50) as i32,
                y: (i % 30) as i32,
                w: 3,
                h: 3,
            },
            color: Rgba {
                r: 0,
                g: i as u8,
                b: 0,
                a: 255,
            },
        });
    }

    // With `edge_96x64`'s load_ops (2 ops) plus 56 ops above, the combined
    // log is comfortably >50 ops — assert that here so the test fails loudly
    // if fixture-reconstruction cost ever changes instead of silently
    // testing a shorter, non-crossing log.
    let total = fx.load_ops().len() + ops.len();
    assert!(
        total > stamp_tool::ops::KEYFRAME_INTERVAL,
        "test no longer crosses a keyframe boundary: {total} ops <= {}",
        stamp_tool::ops::KEYFRAME_INTERVAL
    );

    assert_replay_parity_and_keyframe_equivalence(&fx, &ops);
}
