// The v8.34 brush backpressure, extracted into the ONE place PARKING_LOT.md
// called for — so paint, eraser, mask, clone stamp and blur can share a single
// implementation instead of each growing its own slightly-different copy.
//
// WHY THIS EXISTS (the short form of usePaintTool's account): the pre-worker
// engine BLOCKED the main thread, so the browser coalesced pointer events down
// to the engine's service rate for free. A worker yields instead, so a real
// mouse's 120–420 Hz reaches the port unthrottled and the FIFO fills with
// obsolete cursor positions — the paint brush banked 17.0 s of ink lag on a
// 1.4 s stroke; the clone stamp, measured 2026-08-14, banked a backlog that
// outlived the port's 30 s call timeout. The engine was never the problem;
// the INPUT pipeline lost its accidental flow control.
//
// The discipline, identical to v8.34's:
//   • at most ONE move call in flight; while it runs, newer coordinates
//     overwrite `pending` (latest wins — UNSENT ones only, a sent call is
//     never abandoned)
//   • the flush is scheduled at most once per animation frame — the blit
//     draws whatever the engine holds NOW, so per-move flushes are pure
//     queue traffic
//
// Coalescing is SAFE for stroke tools because every per-move engine call
// (`paint_move`, `erase_move`, `continue_stroke`, `effect_move`) strokes the
// SEGMENT from the last landed point: skipping intermediate coordinates loses
// curve detail between samples, never continuity. It is also exactly the input
// the engine received in the blocking era.
//
// A plain factory rather than a hook so the semantics are unit-testable
// without React (see strokeCoalescer.test.ts); consumers hold one instance in
// a ref for the component's life.
//
// CONSUMERS: useCloneStamp (v8.41, first). usePaintTool still carries the
// original inline copy this was extracted from — migrating measured-good code
// was out of scope for the clone-stamp session — and AppShell's blurMove has
// neither half yet. Both moves are filed in PARKING_LOT.md; when you make
// them, delete the inline copy rather than letting the two drift.

export interface StrokePoint {
  x: number;
  y: number;
}

/** The per-move engine call. Return `false` to skip the flush for this move
 *  (paint's "did anything change" contract); anything else — including
 *  `undefined`, for fire-and-forget calls like `continue_stroke` — schedules
 *  one. May be sync (local engine) or async (worker port). */
export type SendMove = (
  x: number,
  y: number,
) => Promise<boolean | void> | boolean | void;

export interface StrokeCoalescer {
  /** Record the newest pointer position and, if no call is in flight, start
   *  the service loop. While a call IS in flight, the position simply
   *  replaces the previous unsent one. */
  submit(p: StrokePoint, send: SendMove): void;
  /** Stroke ended: discard the unsent pending move (its segment would land
   *  after `*_up()`/`end_stroke` committed the stroke) and reset the rAF
   *  flush gate — a tab hidden mid-stroke never fires rAF and would latch it,
   *  wedging every later flush. A move already SENT is unaffected: the port
   *  is FIFO, so the caller's end-stroke call posts behind it and the last
   *  landed segment is inside the committed stroke. */
  strokeEnd(): void;
  /** One flush per animation frame, however often it is asked for. */
  scheduleFlush(): void;
}

export function createStrokeCoalescer(
  flush: () => void,
  // Injectable for tests; the default is the real thing.
  raf: (cb: () => void) => void = (cb) => requestAnimationFrame(cb),
): StrokeCoalescer {
  let inFlight = false;
  let pending: StrokePoint | null = null;
  let flushQueued = false;

  const scheduleFlush = () => {
    if (flushQueued) return;
    flushQueued = true;
    raf(() => {
      flushQueued = false;
      flush();
    });
  };

  const submit = (p: StrokePoint, send: SendMove) => {
    pending = p;
    if (inFlight) return; // coalesce: newest coords already stored
    inFlight = true;
    (async () => {
      try {
        while (pending) {
          const { x, y } = pending;
          pending = null;
          const changed = await send(x, y);
          if (changed !== false) scheduleFlush();
        }
      } finally {
        inFlight = false;
      }
    })().catch(() => {
      // A rejected send — in practice a port call that hit the 30 s
      // engine-call timeout — must not become an unhandled rejection, and
      // must not wedge the stroke: `finally` above already released the
      // gate, so the very next pointermove restarts the loop. The move that
      // rejected is dropped, which is the same outcome as coalescing it.
    });
  };

  const strokeEnd = () => {
    pending = null;
    flushQueued = false;
  };

  return { submit, strokeEnd, scheduleFlush };
}
