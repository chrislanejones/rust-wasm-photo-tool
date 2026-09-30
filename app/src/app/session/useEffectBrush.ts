import { useCallback, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { ToolSettings } from "@/lib/types";
import { createStrokeCoalescer, type StrokeCoalescer } from "@/lib/strokeCoalescer";

/**
 * The effect brush — blur, pixelate and redact, the three modes of the Blur
 * tool — as its own down/move/up trio.
 *
 * Extracted from AppShell for the same reason `usePenActions` was: one domain
 * sharing one set of dependencies (the engine, `getCoords`, and the six blur
 * fields of ToolSettings), and nothing else in AppShell reads any of it. The
 * `isBlurringRef` gate and the stroke coalescer were only ever touched by
 * these three handlers, so they move with them rather than sitting a thousand
 * lines away from their only callers.
 *
 * Nothing about the behavior changes. The three contracts that make this
 * correct are all preserved verbatim below, and they are the reason the
 * comments are long — each one records a bug that shipped.
 */
export function useEffectBrush(
  stamp: ReturnType<typeof useCloneStamp>,
  getCoords: (e: React.MouseEvent<HTMLCanvasElement>) => { x: number; y: number },
  toolSettings: ToolSettings,
) {
  const isBlurringRef = useRef(false);

  // `async` is carried, not needed. `effect_down` consumes no return value, so
  // this is fire-and-forget and Stage 3.5 has no work here. It shares the
  // `Stamp["onMouseDown"]` slot with the clone stamp's handler, which IS async
  // now, and the alternative — a second, widened handler type — would only move
  // the conflict to CanvasArea, whose `hookResult` prop is
  // `ReturnType<typeof useCloneStamp>` directly. Nothing changes at runtime:
  // React ignores the returned promise.
  const blurDown = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = stamp.toolRef.current;
      if (!t || e.button !== 0) return;
      isBlurringRef.current = true;
      const { x, y } = getCoords(e);
      // Mode branch, hex parse (redaction), undo-snap, and per-stroke
      // interpolation all live in Rust now (effect_down / effect_move / _up).
      t.effect_down(
        x,
        y,
        toolSettings.blurSize,
        toolSettings.blurMode,
        toolSettings.blurIntensity,
        toolSettings.pixelSize,
        toolSettings.redactColor,
        toolSettings.paintStabilizer,
      );
      stamp.flushToCanvas();
    },
    [
      stamp,
      getCoords,
      toolSettings.blurMode,
      toolSettings.blurSize,
      toolSettings.blurIntensity,
      toolSettings.pixelSize,
      toolSettings.redactColor,
      toolSettings.paintStabilizer,
    ],
  );

  // v8.41 — the v8.34 backpressure, via the shared coalescer (the LAST of the
  // three brushes to get it: paint v8.34, clone stamp earlier today, now this).
  //
  // This handler used to await one `effect_move` per pointer event AND call
  // `flushToCanvas()` per event — no in-flight gate, no rAF gate — the worst
  // shape of the three, asking for a full recomposite at mouse rate. Its old
  // comment argued "every dab must land, so it does NOT drop-stale", which
  // v8.34 overturned: right for a call already SENT, wrong for coalescing
  // UNSENT ones, because `effect_move` strokes the SEGMENT from the last
  // landed point — skipped coordinates cost curve detail between samples,
  // never continuity. Measured on the clone stamp, the unfixed shape banked
  // 10.8 s of queue on a 1.4 s stroke at a 200 px brush; blur's per-move cost
  // (a kernel over the brush area) is higher still.
  //
  // `effect_move`'s "did anything change" bool is returned from the send, so
  // the coalescer's flush gate preserves the old guard exactly: moves that
  // blurred nothing schedule no flush.
  // Only the flush half rides the rAF gate; syncState stays a stroke-end
  // affair (blurUp below).
  const blurFlushRef = useRef(stamp.flushToCanvas);
  blurFlushRef.current = stamp.flushToCanvas;
  const blurSchedRef = useRef<StrokeCoalescer | null>(null);
  if (blurSchedRef.current === null) {
    blurSchedRef.current = createStrokeCoalescer(() => blurFlushRef.current());
  }
  const blurSched = blurSchedRef.current;

  const blurMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBlurringRef.current) return;
      if (!stamp.toolRef.current) return;
      blurSched.submit(getCoords(e), async (x, y) => {
        const t = stamp.toolRef.current;
        if (!t) return false;
        return await t.effect_move(x, y);
      });
    },
    [stamp, getCoords, blurSched],
  );

  const blurUp = useCallback(() => {
    if (!isBlurringRef.current) return;
    isBlurringRef.current = false;
    // Same stroke-end handoff as paint/clone: drop the unsent pending move
    // (its segment would land after `effect_up` committed) and reset the rAF
    // gate a hidden tab would latch. FIFO orders `effect_up` after any move
    // still in flight.
    blurSched.strokeEnd();
    stamp.toolRef.current?.effect_up();
    // Flush directly at stroke end — the last landed dabs may only have a
    // scheduled frame that never fires in a hidden tab, and `effect_up` is
    // where the op log commits the stroke; paint's onMouseUp documents the
    // save-scheduling half of this at length.
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp, blurSched]);

  return { blurDown, blurMove, blurUp };
}
