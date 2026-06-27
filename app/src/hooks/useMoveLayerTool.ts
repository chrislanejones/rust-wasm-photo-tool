import { useCallback, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";

interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Plain composite blit (no state sync) — cheap, runs every drag frame. */
  flushToCanvas: () => void;
  /** Full re-sync (layer list + history labels) — runs once, on commit. */
  syncState: () => void;
}

/**
 * Move tool: drag to reposition the ACTIVE layer's content — its pixels and any
 * text/shape annotations sitting on it travel together. The drag is previewed
 * non-destructively in Rust via `set_move_preview` (the layer is composited
 * shifted without disturbing its stored pixels, so dragging past the edge and
 * back doesn't lose anything); on release `translate_active_layer` bakes the
 * total offset in as a single "Move Layer" history step. Offsets are whole
 * pixels.
 *
 * Pairs with paste-into-active-layer: paste drops content centred, then this
 * tool nudges it into place.
 */
export function useMoveLayerTool({
  toolRef,
  canvasRef,
  flushToCanvas,
  syncState,
}: Opts) {
  const dragging = useRef(false);
  // Drag origin in image-space pixels; the live offset is (cursor − start).
  const start = useRef({ x: 0, y: 0 });
  const offset = useRef({ dx: 0, dy: 0 });

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
      dragging.current = true;
      start.current = coords(e);
      offset.current = { dx: 0, dy: 0 };
    },
    [toolRef, coords],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging.current) return;
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = coords(e);
      const dx = Math.round(x - start.current.x);
      const dy = Math.round(y - start.current.y);
      // Skip frames that didn't move a whole pixel — no recomposite churn.
      if (dx === offset.current.dx && dy === offset.current.dy) return;
      offset.current = { dx, dy };
      t.set_move_preview(dx, dy);
      flushToCanvas();
    },
    [toolRef, coords, flushToCanvas],
  );

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const t = toolRef.current;
    if (!t) return;
    const { dx, dy } = offset.current;
    // Commit (clears the live preview inside Rust). A zero delta is a no-op and
    // records no history, so a plain click on the canvas does nothing.
    t.translate_active_layer(dx, dy);
    flushToCanvas();
    syncState();
  }, [toolRef, flushToCanvas, syncState]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
