// The stroke gate — is ink flowing right now? (v8.33)
//
// ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────
//
// Signed-in autosave calls `capture_state()` — the WHOLE document, measured at
// 29.5 MB on a 2078² photo with strokes on it — 2.5 s after the last edit.
// Behind the worker (the default since v8.32) that call occupies the engine for
// hundreds of milliseconds and its reply occupies the port, and the port is
// FIFO by invariant: a `paint_move` issued behind it waits for all of it.
// Measured on production: a round trip that normally takes 0.3 ms took
// **406.9 ms** when issued behind a capture.
//
// The debounce keys on the undo count, so it arms at every STROKE END — which
// places the capture ~2.5 s later, exactly where the user's next stroke begins.
// Result: the ink stops following the cursor for ~half a second, once per
// stroke, only when signed in. Reported by Chris within hours of a14; demo
// mode never runs the capture, which is why every logged-out measurement
// (a13, the coverage run) sailed through at 60 fps.
//
// The fix is scheduling, not machinery: the capture is legitimate work that
// must simply never CONTEND with a live stroke. Autosave awaits `whenIdle()`
// before touching the engine.
//
// ── WHY THE CLOSE SIGNAL IS window.pointerup ────────────────────────────────
//
// The gate opens on canvas pointerdown but closes on WINDOW pointerup, because
// tools keep strokes alive outside the canvas bounds via window listeners —
// closing on canvas pointerleave would call a stroke finished while paint is
// still landing. The asymmetric failure costs decide the design: a gate stuck
// OPEN starves autosave (user data with no backup), a gate stuck CLOSED merely
// re-creates today's half-second hiccup. So the failsafe attacks the stuck-open
// case: a stroke "in flight" longer than MAX_STROKE_MS is presumed abandoned
// (a missed up event) and the gate opens itself.
//
// Deliberately NOT wired into `isDrawingRef` — that ref is clone-stamp-private
// state, and borrowing it here would couple autosave to one tool's internals.
// This module is a plain counter that any pointer surface can drive.

const MAX_STROKE_MS = 15_000;

let strokeDepth = 0;
let openedAt = 0;
/** When the last real stroke ended (0 = never). Only a pointerup that closed
 *  an open stroke moves it — window pointerup fires for button clicks too. */
let lastStrokeEndAt = 0;
let waiters: (() => void)[] = [];

function release(): void {
  const w = waiters;
  waiters = [];
  for (const fn of w) fn();
}

/** A stroke began on an engine-drawing surface. */
export function strokeDown(): void {
  strokeDepth += 1;
  openedAt = Date.now();
}

/** The pointer came up — anywhere. Safe to call without a matching down
 *  (window pointerup fires for clicks on buttons too); depth never goes
 *  negative, so stray ups cannot wedge the gate shut. */
export function strokeUp(): void {
  if (strokeDepth > 0) {
    strokeDepth -= 1;
    lastStrokeEndAt = Date.now();
  }
  if (strokeDepth === 0) release();
}

/** Is ink flowing right now? Exposed for tests and diagnostics. */
export function strokeActive(): boolean {
  if (strokeDepth > 0 && Date.now() - openedAt > MAX_STROKE_MS) {
    // Failsafe: a missed pointerup must not starve autosave forever.
    strokeDepth = 0;
    release();
  }
  return strokeDepth > 0;
}

/**
 * Resolves when no stroke is in flight — immediately if none is.
 *
 * `maxWaitMs` bounds the wait the same way the failsafe bounds the gate:
 * autosave protects user data with no backup, so "wait politely, but never
 * forever" is the contract. The default comfortably exceeds MAX_STROKE_MS so
 * the failsafe fires first in the stuck case.
 */
export function whenStrokeIdle(maxWaitMs = 20_000): Promise<void> {
  if (!strokeActive()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== done);
      resolve();
    }, maxWaitMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    waiters.push(done);
  });
}

/**
 * Resolves once no stroke is in flight AND none has ended in the last
 * `quietMs` — i.e. the user has actually paused, not merely lifted the pen.
 *
 * WHY `whenStrokeIdle` IS NOT ENOUGH (10-07). The autosave timer arms at
 * stroke end and fires `delay` later, which is exactly where the next stroke
 * tends to begin. `whenStrokeIdle` only guarantees the capture does not START
 * mid-stroke; once started, `capture_state()` PNG-encodes the composite, every
 * undo snapshot and every layer — measured 1.1–1.6 s on the worker for a
 * 2068×1556 document with two strokes — and a stroke that begins 100 ms later
 * queues every `paint_move` behind it. That is the "wait to see my stroke"
 * report. Requiring a quiet window means a burst of strokes defers the save
 * until the burst is over, and `maxWaitMs` bounds the deferral the same way
 * `whenStrokeIdle` bounds its wait: user data with no backup is never starved.
 */
export function whenStrokeQuiet(quietMs: number, maxWaitMs = 20_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  return new Promise((resolve) => {
    const check = () => {
      void whenStrokeIdle(Math.max(0, deadline - Date.now())).then(() => {
        const now = Date.now();
        const remaining = lastStrokeEndAt === 0 ? 0 : quietMs - (now - lastStrokeEndAt);
        if (remaining <= 0 || now >= deadline) {
          resolve();
          return;
        }
        setTimeout(check, Math.min(remaining, deadline - now));
      });
    };
    check();
  });
}

/** Test hook: reset module state between cases. */
export function resetStrokeGate(): void {
  strokeDepth = 0;
  openedAt = 0;
  lastStrokeEndAt = 0;
  waiters = [];
}
