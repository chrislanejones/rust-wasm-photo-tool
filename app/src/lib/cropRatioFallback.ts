// The locked-ratio crop drag, in TypeScript — the fallback `useDrawingTools`
// uses while the engine's `constrain_crop_to_ratio` is not cached yet (the
// first frames after load). Moved out of the hook unchanged: a pure function
// of the drag and the ratio, so it can be tested without a canvas.
import type { Point } from "@/lib/shapeSloppiness";

/** The crop rect for a drag `start`→`end` locked to `ratio` (`[w, h]`):
 *  the drag's dominant axis wins, the box grows away from `start` toward the
 *  pointer, and the result is whole pixels, at least 1×1, never above/left of
 *  the image origin. */
export function constrainCropFallback(
  start: Point,
  end: Point,
  ratio: readonly [number, number],
): { x: number; y: number; w: number; h: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const r = ratio[0] / ratio[1];
  const wide = Math.abs(dy) === 0 || Math.abs(dx) / Math.max(Math.abs(dy), 1e-9) > r;
  const w = wide ? Math.abs(dx) : Math.abs(dy) * r;
  const h = wide ? Math.abs(dx) / r : Math.abs(dy);
  let x = start.x;
  let y = start.y;
  if (dx < 0) x -= w;
  if (dy < 0) y -= h;
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
  };
}

/** The crop rect for a FREE drag (no ratio locked): the box the two points
 *  span, unrounded — the crop tool rounds it when it commits. */
export function freeCropRect(start: Point, end: Point): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}
