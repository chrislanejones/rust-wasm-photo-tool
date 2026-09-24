// The live Tolerance slider's scheduler: debounce the ticks, keep at most ONE
// engine run in flight, and only ever show the newest answer.
//
// WHY NOT DROP-STALE ALONE (the lasso's live wire does that). The lasso's
// preview is a pure read, so firing one per mouse-move and discarding all but
// the last is harmless. `selection_retune` MUTATES the selection. Firing one
// per tick would queue a flood fill per tick behind the worker's FIFO port —
// on a big photo that backlog is the stutter — and every one of them would
// still run. So a tick that arrives while a run is in flight does not start
// another: it replaces the pending value, and the pending value runs when the
// current one returns. Superseded ticks never reach the engine at all.
//
// A result is shown only if nothing newer was asked for while it ran. The
// engine ends on the last run it executed, and that run's result is the one
// that reaches the screen — so the overlay and the engine cannot disagree.

export interface LiveRetune<V> {
  /** A new slider value. Runs after `delayMs` of quiet, or after the run in
   *  flight returns, whichever is later. */
  schedule(value: V): void;
  /** Forget anything pending and ignore the answer of a run in flight — a new
   *  click has made them all meaningless. The in-flight run still completes
   *  in the engine; the next click replaces its result there too. */
  cancel(): void;
}

export interface LiveRetuneOptions<V, R> {
  /** Quiet time before a tick runs. A function is read on every tick, so the
   *  caller can stretch it when a run is known to be slow (a big document):
   *  a long enough quiet time means "update when the drag pauses". */
  delayMs: number | (() => number);
  run: (value: V) => Promise<R>;
  /** The answer to the newest value asked for. */
  onResult: (result: R, value: V) => void;
  /** Nothing pending and nothing in flight — the slider has settled. */
  onIdle?: () => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export function createLiveRetune<V, R>(opts: LiveRetuneOptions<V, R>): LiveRetune<V> {
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let seq = 0; // moves on every schedule() and cancel()
  let timer: unknown = null;
  let ready: { value: V; seq: number } | null = null;
  let inFlight = false;

  const pump = () => {
    if (inFlight || !ready) return;
    const job = ready;
    ready = null;
    inFlight = true;
    opts
      .run(job.value)
      .then(
        (r) => {
          if (job.seq === seq) opts.onResult(r, job.value);
        },
        () => {
          // A failed run shows nothing new; the next tick or click retries.
        },
      )
      .finally(() => {
        inFlight = false;
        pump();
        if (!inFlight && !ready && timer === null) opts.onIdle?.();
      });
  };

  return {
    schedule(value) {
      const mine = ++seq;
      if (timer !== null) clearTimer(timer);
      const delay = typeof opts.delayMs === "function" ? opts.delayMs() : opts.delayMs;
      timer = setTimer(() => {
        timer = null;
        ready = { value, seq: mine };
        pump();
      }, delay);
    },
    cancel() {
      seq++;
      if (timer !== null) clearTimer(timer);
      timer = null;
      ready = null;
    },
  };
}
