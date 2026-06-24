import { useCallback, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
}

/**
 * Thin pointer-event forwarder for the paint brush. All the brush logic now
 * lives in Rust behind `paint_down` / `paint_move` / `paint_up`: hex-colour
 * parsing, the stabilizer ("lazy mouse") leash, the stroke state machine, and
 * per-stroke opacity (overlapping dabs combine by max coverage, so a 50% stroke
 * stays a true 50% instead of building up toward opaque). JS only maps the event
 * to canvas-space coords and re-flushes the canvas when Rust reports it painted.
 */
export function usePaintTool({
  toolRef,
  canvasRef,
  settings,
  flushToCanvas,
  syncState,
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
      t.paint_down(
        x,
        y,
        settings.brushSize,
        settings.brushColor,
        settings.brushOpacity / 100,
        settings.paintStabilizer,
      );
      flushToCanvas();
    },
    [
      toolRef,
      coords,
      settings.brushSize,
      settings.brushColor,
      settings.brushOpacity,
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
      if (t.paint_move(x, y)) flushToCanvas();
    },
    [toolRef, coords, flushToCanvas],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    const t = toolRef.current;
    if (t && t.paint_up()) flushToCanvas();
    syncState();
  }, [toolRef, flushToCanvas, syncState]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
