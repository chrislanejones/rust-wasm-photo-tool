//! Determinism + keyframe-equivalence tests for the op log — the core
//! correctness properties keyframed replay depends on, independent of any
//! one op's pixel semantics (that's `replay_parity.rs`'s job).

mod fixtures;
mod support;

use fixtures::fixture;
use stamp_tool::ops::{
    decode_op, encode_op, LevelsParams, Op, OpError, Rect, Rgba, OP_FORMAT_VERSION,
};
use stamp_tool::tiles::TileBuffer;
use support::assert_buffers_identical;

/// A log built from a fixture's load ops plus a longer deterministic mix of
/// implemented ops — long enough (>50) to span multiple keyframes.
fn mixed_log(fixture_name: &str, n: usize) -> stamp_tool::ops::OpLog {
    let fx = fixture(fixture_name);
    let mut log = stamp_tool::ops::OpLog::new(fx.width, fx.height);
    for op in fx.load_ops() {
        log.append(op);
    }
    for i in 0..n {
        let op = match i % 3 {
            0 => Op::FillRegion {
                rect: Rect {
                    x: (i as i32 * 3) % (fx.width.max(1) as i32),
                    y: (i as i32 * 5) % (fx.height.max(1) as i32),
                    w: 3,
                    h: 3,
                },
                color: Rgba {
                    r: i as u8,
                    g: 50,
                    b: 150,
                    a: 255,
                },
            },
            1 => Op::Levels(LevelsParams {
                black: 8,
                white: 240,
                gamma: 1.05,
            }),
            _ => Op::FillRegion {
                rect: Rect {
                    x: 0,
                    y: 0,
                    w: 1,
                    h: 1,
                },
                color: Rgba {
                    r: 0,
                    g: (i as u8).wrapping_mul(7),
                    b: 0,
                    a: 255,
                },
            },
        };
        log.append(op);
    }
    log
}

// ---------------------------------------------------------------------
// Determinism: replaying the same log twice gives identical hashes.
// ---------------------------------------------------------------------

#[test]
fn replay_same_log_twice_is_deterministic() {
    let log = mixed_log("gradient_128", 120);
    let mut a = TileBuffer::new(0, 0);
    let mut b = TileBuffer::new(0, 0);
    log.replay(&mut a);
    log.replay(&mut b);
    assert_buffers_identical(&a, &b, "replay-twice");
    // And matches the log's own live buffer maintained incrementally while
    // appending — three independent code paths, one answer.
    assert_buffers_identical(&a, log.buffer(), "replay-vs-live");
}

#[test]
fn replay_is_deterministic_across_multiple_fixtures() {
    for &name in fixtures::ALL_FIXTURES {
        let log = mixed_log(name, 75);
        let mut a = TileBuffer::new(0, 0);
        let mut b = TileBuffer::new(0, 0);
        log.replay(&mut a);
        log.replay(&mut b);
        assert_buffers_identical(&a, &b, name);
    }
}

// ---------------------------------------------------------------------
// Keyframe equivalence: replay-from-keyframe == full-replay-from-zero.
// This is the core correctness property keyframing depends on.
// ---------------------------------------------------------------------

#[test]
fn keyframe_replay_equals_full_replay_for_same_target() {
    // Comfortably more than KEYFRAME_INTERVAL (50) so multiple keyframes
    // exist and `replay()` actually restores a non-zero keyframe rather
    // than falling back to the index-0 one.
    let log = mixed_log("solid_64", 150);
    assert!(
        log.len() > stamp_tool::ops::KEYFRAME_INTERVAL * 2,
        "test needs to span multiple keyframes; got {} ops",
        log.len()
    );

    let mut fast = TileBuffer::new(0, 0);
    let mut full = TileBuffer::new(0, 0);
    log.replay(&mut fast); // nearest keyframe + tail ops
    log.replay_full(&mut full); // from index 0, ignoring later keyframes
    assert_buffers_identical(&fast, &full, "keyframe-vs-full");
}

#[test]
fn keyframe_replay_equals_full_replay_at_every_op_count() {
    // Not just the final state — every prefix length, including exact
    // keyframe boundaries and the ops immediately before/after one. Uses
    // `truncate` to walk the log backwards, which is itself the undo path.
    let mut log = mixed_log("edge_96x64", 130);
    let total = log.len();
    let checkpoints: Vec<usize> = (0..=total).filter(|n| n % 17 == 0 || *n == total).collect();

    for &n in checkpoints.iter().rev() {
        log.truncate(n);
        let mut fast = TileBuffer::new(0, 0);
        let mut full = TileBuffer::new(0, 0);
        log.replay(&mut fast);
        log.replay_full(&mut full);
        assert_buffers_identical(&fast, &full, &format!("n={n}"));
    }
}

// ---------------------------------------------------------------------
// Version guard: a bumped format-version byte is rejected cleanly.
// ---------------------------------------------------------------------

#[test]
fn bumped_format_version_is_rejected_cleanly() {
    let op = Op::Levels(LevelsParams {
        black: 1,
        white: 254,
        gamma: 1.0,
    });
    let mut bytes = encode_op(&op);
    assert_eq!(bytes[0], OP_FORMAT_VERSION);

    bytes[0] = OP_FORMAT_VERSION.wrapping_add(1);
    let result = decode_op(&bytes);
    assert_eq!(
        result,
        Err(OpError::UnsupportedVersion(
            OP_FORMAT_VERSION.wrapping_add(1)
        )),
        "a bumped version byte must be rejected with a clear error, not panic or mis-decode"
    );
}

#[test]
fn empty_byte_stream_is_rejected_cleanly() {
    assert_eq!(decode_op(&[]), Err(OpError::Empty));
}

#[test]
fn truncated_payload_after_valid_version_byte_is_rejected_not_panicking() {
    // A valid version byte followed by a payload too short to decode any
    // variant must return a clean Decode error, never panic.
    let bytes = [OP_FORMAT_VERSION, 0xFF];
    match decode_op(&bytes) {
        Err(OpError::Decode) | Err(OpError::UnsupportedVersion(_)) => {}
        other => panic!("expected a clean decode error, got {other:?}"),
    }
}
