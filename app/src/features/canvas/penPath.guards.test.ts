// ===== FILE: app/src/features/canvas/penPath.guards.test.ts =====
//
// The two guards the PenOverlay redesign added — ADR-024 Stage 3.5, the last
// step (`docs/pen-overlay-async-design.md`).
//
// `handlePenCommit` and `handlePenHitTest` were the final two convertible sites
// in the migration, and they outlived the other ~89 because neither is an
// `await` job. Both feed a synchronous decision in a state machine:
//
//   handlePenCommit   its return value IS the contract — `finish()` uses the
//                     new id to keep the just-drawn path selected
//   handlePenHitTest  consumed inside pointerdown to fork between "re-open the
//                     path under the cursor" and "drop a new anchor"
//
// Making them async opens two windows that could not exist before, and NOTHING
// else in this repo can see either one. The migration ratchet counts engine
// calls and both calls are properly awaited; tsc sees two well-typed async
// functions; eslint has no floating-promise rule configured here. Every failure
// mode is state-machine ordering, so it is these tests plus real gestures or
// nothing.
//
// Both guards are exported from the component module for exactly the reason a13
// exported `readUiSnapshot`: a guard that lives inside a `useCallback` closed
// over a ref has nowhere to be tested, and this repo has no component-render
// harness (vitest runs in `environment: "node"`, and the include glob is `.ts`
// only). Pulling the decision out is what makes it provable.
import { describe, it, expect, vi } from "vitest";
import { runExclusive, resolveHit } from "./penPath";

/** A promise plus its resolver, to hold a body open across two calls. */
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((r) => {
    release = r;
  });
  return { promise, release };
}

/** A flat cubic control sequence for an OPEN two-anchor path:
 *  [a0, a0.out, a1.in, a1] — the shape `serialize` emits and the engine
 *  hands back through `capture_pen_hit`. */
const OPEN_PATH = [10, 10, 20, 10, 40, 10, 50, 10];

/** The same, closed: a third anchor coincident with the first, which is how
 *  `deserialize` recognises a loop (it pops the repeat and moves its in-handle
 *  onto anchor 0). Two anchors + `closed: true` come back out. */
const CLOSED_PATH = [10, 10, 20, 10, 40, 10, 50, 10, 60, 10, 10, 20, 10, 10];

describe("runExclusive — the re-entrancy guard on finish()", () => {
  it("drops a second call while the first is still in flight", async () => {
    // THE HOLD-ENTER CASE, and the whole reason this guard exists.
    //
    // While `finish()` was synchronous it could not overlap itself: it cleared
    // `anchorsRef` before any second call could read it. Awaited, the window
    // between issuing the commit and clearing the anchors is open — and Enter
    // auto-repeats. Unguarded, the second keydown finds `editingIdRef` still
    // null and the anchors still there, takes the create branch again, and
    // commits THE SAME ANCHORS a second time: two identical paths stacked
    // exactly on top of each other, one undo step each.
    const gate = deferred();
    const body = vi.fn(async () => {
      await gate.promise;
    });
    const flag = { current: false };

    const first = runExclusive(flag, body);
    const second = runExclusive(flag, body);
    gate.release();
    await Promise.all([first, second]);

    expect(body).toHaveBeenCalledTimes(1);
  });

  it("runs again once the first call has finished", async () => {
    // Non-vacuity. A guard that rejected everything would also pass the test
    // above, and would leave the pen unable to commit a second path at all.
    const body = vi.fn(async () => {});
    const flag = { current: false };

    await runExclusive(flag, body);
    await runExclusive(flag, body);

    expect(body).toHaveBeenCalledTimes(2);
  });

  it("releases the flag when the body throws", async () => {
    // `finally`, not a trailing assignment. A commit that rejects — the worker
    // is gone, the engine threw — must not leave the pen permanently unable to
    // finish a path for the rest of the session.
    const flag = { current: false };
    const boom = vi.fn(async () => {
      throw new Error("commit failed");
    });

    await expect(runExclusive(flag, boom)).rejects.toThrow("commit failed");
    expect(flag.current).toBe(false);

    const after = vi.fn(async () => {});
    await runExclusive(flag, after);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("leaves the flag down after a normal run", async () => {
    const flag = { current: false };
    await runExclusive(flag, async () => {});
    expect(flag.current).toBe(false);
  });
});

describe("resolveHit — the staleness guard on the pen hit test", () => {
  it("discards a hit whose click has been superseded", async () => {
    // THE ONE THAT MATTERS: a good answer to a superseded question is still the
    // wrong answer. Click 1's hit test can resolve after click 2 has already
    // moved the overlay on; applying it there loads a path the user is no
    // longer pointing at, over state they have since changed.
    //
    // Note the hit here is perfectly valid — staleness has to win anyway. A
    // mutant that checks the sequence AFTER looking at the hit, or not at all,
    // dies here and only here.
    expect(resolveHit({ id: 7, points: OPEN_PATH }, 1, 2)).toEqual({ kind: "stale" });
  });

  it("applies a hit issued by the most recent click", async () => {
    // Non-vacuity for the above: same hit, matching sequence, must open.
    const outcome = resolveHit({ id: 7, points: OPEN_PATH }, 2, 2);
    expect(outcome.kind).toBe("open");
  });

  it("keeps the speculative anchor when nothing was under the click", () => {
    // The miss case is NOT a no-op. The caller has already placed an anchor
    // optimistically — that anchor is the first point of the new path, and it
    // is what the old synchronous fall-through used to add.
    expect(resolveHit(null, 1, 1)).toEqual({ kind: "keep-speculative" });
  });

  it("keeps the speculative anchor when the hit is not a usable path", () => {
    // A single-anchor result cannot be edited as a path, so it means the same
    // thing as a miss: keep drawing.
    expect(resolveHit({ id: 3, points: [10, 10] }, 1, 1)).toEqual({
      kind: "keep-speculative",
    });
  });

  it("returns the path's id, anchors and open/closed state", () => {
    const outcome = resolveHit({ id: 42, points: OPEN_PATH }, 5, 5);
    expect(outcome).toEqual({
      kind: "open",
      id: 42,
      closed: false,
      anchors: [
        { x: 10, y: 10, in: null, out: { x: 20, y: 10 } },
        { x: 50, y: 10, in: { x: 40, y: 10 }, out: null },
      ],
    });
  });

  it("carries the closed flag through, so a loop re-opens as a loop", () => {
    // Regression shape: losing `closed` re-opens a filled loop as an open
    // curve, and committing it back would break the fill.
    const outcome = resolveHit({ id: 8, points: CLOSED_PATH }, 1, 1);
    expect(outcome).toMatchObject({ kind: "open", closed: true });
    expect(outcome.kind === "open" && outcome.anchors).toHaveLength(2);
  });
});
