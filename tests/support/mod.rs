//! Shared replay-parity harness, used by `replay_parity.rs`,
//! `replay_determinism.rs`, and the ignored stubs in `replay_stubs.rs`.

// Shared across multiple independent integration-test binaries; not every
// one calls every helper here, so per-binary dead-code analysis will flag
// some as unused even though a sibling binary does use them.
#![allow(dead_code)]

use crate::fixtures::Fixture;
use stamp_tool::ops::{apply, Op, OpLog};
use stamp_tool::tiles::TileBuffer;

/// Apply `ops` two independent ways starting from the same `fixture` and
/// assert the resulting canvases are byte-identical:
///
/// 1. **Direct**: a blank buffer, `fixture.load_ops()` then `ops` applied
///    directly via [`apply`], one at a time, mutating in place.
/// 2. **Op-log replay**: the same combined op sequence recorded into a real
///    [`OpLog`] (`append` for each op), then reconstructed via
///    [`OpLog::replay`] — the nearest-keyframe-then-tail-ops path.
///
/// `fixture.load_ops()` is what makes side (2) "seeded with input": since
/// `OpLog` only ever starts blank, the fixture's pixels are themselves
/// recorded as the log's first ops. See SESSION_LOG.md, DECISION: seeded
/// input.
///
/// On mismatch, this reports the first differing pixel coordinate and both
/// values — hash-compare only tells you *that* it broke, not *where*.
pub fn assert_replay_parity(fixture: &Fixture, ops: &[Op]) {
    let combined: Vec<Op> = fixture
        .load_ops()
        .into_iter()
        .chain(ops.iter().cloned())
        .collect();

    // (1) Direct application.
    let mut direct = TileBuffer::new(fixture.width, fixture.height);
    for op in &combined {
        apply(op, &mut direct);
    }

    // (2) Record to a real OpLog, replay from the nearest keyframe.
    let mut log = OpLog::new(fixture.width, fixture.height);
    for op in combined.iter().cloned() {
        log.append(op);
    }
    let mut replayed = TileBuffer::new(0, 0);
    log.replay(&mut replayed);

    // (3) Byte-identical, zero tolerance.
    assert_buffers_identical(&direct, &replayed, fixture.name);
}

/// Same as [`assert_replay_parity`] but also asserts the keyframed replay
/// matches the from-scratch replay (`replay_full`) for the exact same log —
/// i.e. that crossing a keyframe boundary changes nothing observable. Used
/// where the caller wants that extra check inline (the combined test in
/// `replay_parity.rs` forces >50 ops specifically so this is a real check,
/// not a vacuous one).
pub fn assert_replay_parity_and_keyframe_equivalence(fixture: &Fixture, ops: &[Op]) {
    assert_replay_parity(fixture, ops);

    let combined: Vec<Op> = fixture
        .load_ops()
        .into_iter()
        .chain(ops.iter().cloned())
        .collect();
    let mut log = OpLog::new(fixture.width, fixture.height);
    for op in combined.iter().cloned() {
        log.append(op);
    }

    let mut fast = TileBuffer::new(0, 0);
    let mut full = TileBuffer::new(0, 0);
    log.replay(&mut fast);
    log.replay_full(&mut full);
    assert_buffers_identical(&fast, &full, fixture.name);
}

/// Assert that applying `ops` on top of `fixture` actually changes the
/// canvas from the fixture-only baseline.
///
/// `assert_replay_parity` alone can't distinguish "this op round-trips
/// through the op log correctly" from "this op is a no-op today, so of
/// course both sides agree" — a no-op op trivially satisfies parity. This
/// closes that gap: it fails for any op whose `apply()` doesn't yet mutate
/// the buffer (see the `TODO(tile-wiring)` no-ops in `ops::apply`), which is
/// exactly what makes the stubs in `replay_stubs.rs` an honest `#[ignore]`
/// instead of a vacuous pass.
pub fn assert_op_has_effect(fixture: &Fixture, ops: &[Op]) {
    let mut baseline = TileBuffer::new(fixture.width, fixture.height);
    for op in fixture.load_ops() {
        apply(&op, &mut baseline);
    }
    let mut with_ops = baseline.clone();
    for op in ops {
        apply(op, &mut with_ops);
    }
    assert_ne!(
        baseline.content_hash(),
        with_ops.content_hash(),
        "{}: op(s) had no visible effect on the canvas — apply() is still a \
         no-op for this op",
        fixture.name
    );
}

/// Hash-compare first (cheap, exact); on mismatch, scan for and report the
/// first differing pixel so a failure is debuggable instead of just "not
/// equal".
pub fn assert_buffers_identical(a: &TileBuffer, b: &TileBuffer, ctx: &str) {
    assert_eq!(a.width(), b.width(), "{ctx}: width mismatch");
    assert_eq!(a.height(), b.height(), "{ctx}: height mismatch");

    if a.content_hash() == b.content_hash() {
        return;
    }

    for y in 0..a.height() as i32 {
        for x in 0..a.width() as i32 {
            let pa = a.get_pixel(x, y);
            let pb = b.get_pixel(x, y);
            if pa != pb {
                panic!(
                    "{ctx}: replay parity mismatch at pixel ({x}, {y}): \
                     direct={pa:?} replayed={pb:?} \
                     (hashes: direct={:#018x} replayed={:#018x})",
                    a.content_hash(),
                    b.content_hash()
                );
            }
        }
    }

    // Hashes differed but no single pixel did — content_hash's own contract
    // (content-determined, iteration-order-independent) would be broken.
    panic!(
        "{ctx}: content_hash differed ({:#018x} vs {:#018x}) but no differing \
         pixel was found — this points at a bug in TileBuffer::content_hash \
         itself, not at the op(s) under test",
        a.content_hash(),
        b.content_hash()
    );
}
