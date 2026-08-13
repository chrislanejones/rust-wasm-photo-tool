import { useCallback, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { isSmartEdgeEnabled } from "@/lib/smartEdge";
import { useToolStore } from "@/stores/useToolStore";
import { useCanvasCoords } from "./useCanvasCoords";

interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
  /** Eraser variant: drive `erase_down/move/up` (clear alpha) instead of
   *  `paint_down/move/up` (lay down colour). Same stroke engine in Rust. */
  erase?: boolean;
  /** Mask variant: drive `mask_paint_down/move/up` — paint the active layer's
   *  grayscale mask (non-destructive) instead of pixels. Takes precedence over
   *  `erase`. Uses the Paint brush's size/opacity/hardness/stabilizer. */
  maskMode?: boolean;
  /** Grey value laid into the mask when `maskMode`: 0 = hide, 255 = reveal. */
  maskValue?: number;
}

/**
 * Thin pointer-event forwarder for the paint brush (and, with `erase`, the
 * eraser). All the stroke logic lives in Rust behind `paint_down/move/up` (or
 * `erase_down/move/up`): hex-colour parsing, the configurable edge hardness, the
 * stabilizer ("lazy mouse") leash, the stroke state machine, and per-stroke
 * opacity (overlapping dabs combine by max coverage, so a 50% stroke stays a
 * true 50% instead of building up toward opaque). JS only maps the event to
 * canvas-space coords and re-flushes the canvas when Rust reports it changed
 * pixels. The eraser shares all of it — it just scrubs alpha in the recomposite.
 */
export function usePaintTool({
  toolRef,
  canvasRef,
  settings,
  flushToCanvas,
  syncState,
  erase = false,
  maskMode = false,
  maskValue = 0,
}: Opts) {
  const painting = useRef(false);

  // Smart Brush (behind ih_smart_edge). Read straight from the store rather
  // than drilled through Opts — it's the same shape of tool state as the
  // selection kind, and every caller of this hook would otherwise have to
  // thread two props it doesn't care about.
  const smartBrush = useToolStore((s) => s.smartBrush);
  const smartBrushStrength = useToolStore((s) => s.smartBrushStrength);

  const coords = useCanvasCoords(canvasRef);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t || e.button !== 0) return;
      painting.current = true;
      const { x, y } = coords(e);

      // Push the Smart Brush config before the stroke opens: `set_smart_brush`
      // takes effect from the next `paint_begin`, and `paint_down` below is
      // what calls it. Only for the colour brush — containing an ERASER at an
      // edge is a different feature with a different answer, and guessing at it
      // here would ship a behaviour nobody asked for.
      //
      // Called unconditionally (not just when on) so that turning the switch or
      // the toggle OFF actually reaches the engine and frees its cost map,
      // instead of leaving the last stroke's setting latched.
      if (!maskMode && !erase) {
        t.set_smart_brush(
          isSmartEdgeEnabled() && smartBrush,
          smartBrushStrength,
        );
      }

      if (maskMode) {
        t.mask_paint_down(
          x,
          y,
          settings.brushSize,
          maskValue,
          settings.brushOpacity / 100,
          settings.brushHardness / 100,
          settings.paintStabilizer,
        );
      } else if (erase) {
        t.erase_down(
          x,
          y,
          settings.eraserSize,
          settings.eraserOpacity / 100,
          settings.eraserHardness / 100,
          settings.paintStabilizer,
        );
      } else {
        t.paint_down(
          x,
          y,
          settings.brushSize,
          settings.brushColor,
          settings.brushOpacity / 100,
          settings.brushHardness / 100,
          settings.paintStabilizer,
        );
      }
      flushToCanvas();
    },
    [
      toolRef,
      coords,
      erase,
      maskMode,
      maskValue,
      settings.brushSize,
      settings.brushColor,
      settings.brushOpacity,
      settings.brushHardness,
      settings.eraserSize,
      settings.eraserOpacity,
      settings.eraserHardness,
      settings.paintStabilizer,
      flushToCanvas,
      smartBrush,
      smartBrushStrength,
    ],
  );

  // ── v8.34 — EXPLICIT BACKPRESSURE: one move in flight, latest wins ────────
  //
  // The comment this replaces said "deliberately not drop-stale: discarding
  // the late one would discard PAINT — a stroke with holes in it." That fear
  // is right for dropping a SENT call and wrong for coalescing UNSENT ones,
  // and the difference put the shipped brush seventeen seconds behind the
  // cursor. `paint_move` draws the SEGMENT from the last landed point
  // (`paint_stroke_to(lx, ly, x, y)` — src/paint.rs:787), so skipping
  // intermediate coordinates loses curve detail between samples, never
  // continuity. It is also exactly the input the engine has always received:
  // the old synchronous handler BLOCKED the main thread, so the browser
  // coalesced pointer events to the engine's service rate for us.
  //
  // The worker handler yields instead of blocking, so that accidental
  // backpressure vanished: at a real mouse's event rate (~120–420 Hz measured)
  // every move queued a `paint_move` plus a flush burst, arrivals outran
  // service, and a 1.4 s stroke banked **17.0 s** of queue (measured, v8.33
  // production build). Frames stayed at 60 fps throughout — the failure is
  // ink LATENCY, invisible to every frame-gap instrument this arc used.
  //
  // So the backpressure is now explicit:
  //   • at most ONE move call in flight; while it runs, the newest
  //     coordinates overwrite `pendingMove` (latest wins, unsent ones only)
  //   • the flush is scheduled at most once per animation frame — the blit
  //     draws whatever the engine holds NOW, so per-move flushes only added
  //     queue traffic (5.7 messages per event, measured)
  //
  // Mode flags are read per iteration but cannot change mid-drag —
  // `painting.current` gates entry and a mode switch requires the pointer.
  const moveInFlight = useRef(false);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const flushQueued = useRef(false);

  const scheduleFlush = useCallback(() => {
    if (flushQueued.current) return;
    flushQueued.current = true;
    requestAnimationFrame(() => {
      flushQueued.current = false;
      flushToCanvas();
    });
  }, [flushToCanvas]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!painting.current) return;
      if (!toolRef.current) return;
      pendingMove.current = coords(e);
      if (moveInFlight.current) return; // coalesce: newest coords already stored
      moveInFlight.current = true;
      void (async () => {
        try {
          while (pendingMove.current) {
            const { x, y } = pendingMove.current;
            pendingMove.current = null;
            const t = toolRef.current;
            if (!t) break;
            // `await` on each BRANCH of the ternary, not around it: the audit
            // reads the text immediately before the receiver, so a wrapped
            // await would count as three un-awaited calls and move the gate.
            const changed = maskMode
              ? await t.mask_paint_move(x, y)
              : erase
                ? await t.erase_move(x, y)
                : await t.paint_move(x, y);
            if (changed) scheduleFlush();
          }
        } finally {
          moveInFlight.current = false;
        }
      })();
    },
    [toolRef, coords, erase, maskMode, scheduleFlush],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    // v8.34 — stroke-end handoff for the coalescer above. An UNSENT pending
    // move is discarded (its segment would land after `*_up()` committed the
    // stroke; `paint_last` is cleared by then so it would no-op anyway), and
    // the rAF flush gate is reset so a tab hidden mid-stroke — where rAF never
    // fires and the gate would stay latched — cannot wedge every later flush.
    // FIFO does the rest: this `*_up()` posts AFTER any move already in
    // flight, so the last landed segment is inside the committed stroke.
    pendingMove.current = null;
    flushQueued.current = false;
    const t = toolRef.current;
    if (maskMode) t?.mask_paint_up();
    else if (erase) t?.erase_up();
    else t?.paint_up();
    // ALWAYS flush at stroke end — never gate this on what *_up() returns.
    //
    // Those return whether the STABILIZER had catch-up pixels left to paint, and
    // with the stabilizer off (the default) that is false for every ordinary
    // stroke: the pixels all landed during paint_move. But `*_up()` is also where
    // the op log COMMITS the stroke (paint.rs — `rec_stroke.take()`), and
    // flushToCanvas is what publishes that op: it calls registerOplogStats (the
    // diagnostics Op Log gauge) AND onOplogFlush (the debounced persistence
    // writer).
    //
    // So gating the flush on the return value meant a finished stroke was
    // recorded but never published: the gauge sat at "0 ops" on a document that
    // had just recorded one — the 0/0 that stalled the dogfood — and, worse, the
    // op's SAVE was never scheduled until some later interaction happened to
    // flush. Reloading right after your last stroke could drop it.
    //
    // Cost of flushing unconditionally: one recomposite+blit per STROKE END. Not
    // per frame — the zero-copy per-frame path is untouched.
    flushToCanvas();
    syncState();
  }, [toolRef, erase, maskMode, flushToCanvas, syncState]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
