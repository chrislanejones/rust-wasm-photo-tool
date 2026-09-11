/** Direction of one ⊕ on the duplicate pad. */
export type PadDirection = "up" | "down" | "left" | "right";

/** Shape kinds the pad works on: 0 rect, 1 circle. A line, arrow, pin or pen
 *  path has no "same-sized copy beside it" that means anything. */
export const PAD_KINDS: ReadonlySet<number> = new Set([0, 1]);

/** Gap between successive copies, as a fraction of the shape's own size on
 *  that axis, with a floor so tiny shapes still separate visibly. */
const PAD_GAP_FRACTION = 0.12;
export const PAD_GAP_MIN_PX = 8;

export interface PadBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Offset in IMAGE px for the `n`th copy in `dir`, measured from the ORIGINAL
 * shape (n = 1 is the first copy).
 *
 * Multiplying by `n` rather than stepping from the last copy is what makes
 * each direction independent: ← ← lays two rectangles marching left, and a
 * subsequent ↑ goes above the SOURCE rather than above the second copy. An
 * anchor that followed the newest copy would staircase diagonally instead,
 * which is not what a diagram wants.
 *
 * Corner order is not assumed — a shape dragged right-to-left stores x1 < x0,
 * and a negative width would send copies the wrong way.
 */
export function padOffset(
  box: PadBox,
  dir: PadDirection,
  n: number,
): { dx: number; dy: number } {
  const w = Math.abs(box.x1 - box.x0);
  const h = Math.abs(box.y1 - box.y0);
  const stepX = w + Math.max(PAD_GAP_MIN_PX, Math.round(w * PAD_GAP_FRACTION));
  const stepY = h + Math.max(PAD_GAP_MIN_PX, Math.round(h * PAD_GAP_FRACTION));
  return {
    dx: dir === "left" ? -n * stepX : dir === "right" ? n * stepX : 0,
    dy: dir === "up" ? -n * stepY : dir === "down" ? n * stepY : 0,
  };
}
