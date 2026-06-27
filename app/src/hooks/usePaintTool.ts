import { useCallback, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

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

  const coords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * c.width) / r.width,
        y: ((e.clientY - r.top) * c.height) / r.height,
      };
    },
    [canvasRef],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t || e.button !== 0) return;
      painting.current = true;
      const { x, y } = coords(e);
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
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!painting.current) return;
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = coords(e);
      const changed = maskMode
        ? t.mask_paint_move(x, y)
        : erase
          ? t.erase_move(x, y)
          : t.paint_move(x, y);
      if (changed) flushToCanvas();
    },
    [toolRef, coords, erase, maskMode, flushToCanvas],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    const t = toolRef.current;
    const changed = maskMode
      ? t?.mask_paint_up()
      : erase
        ? t?.erase_up()
        : t?.paint_up();
    if (changed) flushToCanvas();
    syncState();
  }, [toolRef, erase, maskMode, flushToCanvas, syncState]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
