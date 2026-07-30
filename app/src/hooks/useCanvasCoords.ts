import { useCallback } from "react";

/**
 * Maps a mouse event to IMAGE-space canvas coordinates.
 *
 * The canvas is displayed at whatever size layout gives it, but its backing
 * store is the image's true pixel size — so every tool that talks to the engine
 * has to divide out that scale before handing coordinates to Rust. This is that
 * division, and nothing else.
 *
 * Returns `{x: 0, y: 0}` when the canvas ref is empty rather than throwing:
 * callers run inside pointer handlers that can fire during teardown, and every
 * one of them immediately guards on the tool ref anyway.
 *
 * Extracted from `usePaintTool`, `useMoveLayerTool` and `useMagicEraserTool`,
 * where it was byte-identical three times over (fallow `dup:1002f0a8`). It is
 * deliberately ONLY the coordinate mapping: those three hooks' pointer
 * lifecycles look alike to a clone detector but are genuinely different
 * gestures, and folding them together would need a flag per difference. See
 * docs/PARKING_LOT.md for the copies still living in other hooks.
 *
 * The callback identity is stable for a stable `canvasRef`, matching the
 * `useCallback(..., [canvasRef])` each hook used before — so downstream
 * dependency arrays that list `coords` keep the same behaviour.
 */
export function useCanvasCoords(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  return useCallback(
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
}
