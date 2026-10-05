// Geometry for the Shapes overlay's corner-radius dots (Figma's): where each
// dot sits, and what radius a drag on it means. Pure — no React, no DOM — so
// it is tested without either, like lib/shapeRotation.ts.
//
// Everything is in the shape's own UNROTATED frame, in canvas px. The overlay
// draws the dots inside the same `rotate()` group as the resize squares and
// hands `radiusAfterDrag` a pointer delta already turned into that frame
// (`toLocalDelta`), so a rotated shape needs nothing extra here.
import {
  closedOutline,
  cornerCount,
  type CornerRadii,
  type Point,
} from "@/lib/shapeSloppiness";

/** One draggable corner. */
export interface CornerHandle {
  /** Which entry of the radii this corner owns (0 for the star's one dot). */
  index: number;
  /** The sharp corner itself. */
  corner: Point;
  /** Unit vector from the corner into the shape, halfway between its edges. */
  bisector: Point;
  /** sin of half the corner's angle: a radius r puts the arc's center
   *  r / sinHalf along the bisector. */
  sinHalf: number;
  /** The largest radius this corner can take — the engine clamps the tangent
   *  points to half of each edge, and so does this. */
  maxR: number;
  /** Where the dot is drawn: at the arc's center, or a few screen px in from
   *  the corner while the radius is too small to get the dot off the resize
   *  square. */
  dot: Point;
}

/** How far in from its corner a dot sits at radius 0, in SCREEN px. */
const MIN_DOT_INSET = 14;
/** Below this on-screen size (the box's shorter side, screen px) the dots are
 *  hidden: they would crowd the resize squares. Figma does the same. */
const MIN_BOX_FOR_DOTS = 40;

export function cornerHandles(
  shape: string,
  start: Point,
  end: Point,
  starPoints: number | undefined,
  radii: CornerRadii,
  sx: number,
  sy: number,
): CornerHandle[] {
  const count = cornerCount(shape);
  if (count === 0) return [];
  const w = Math.abs(end.x - start.x) * sx;
  const h = Math.abs(end.y - start.y) * sy;
  if (Math.min(w, h) < MIN_BOX_FOR_DOTS) return [];
  const verts = closedOutline(shape, start, end, starPoints);
  if (!verts) return [];
  const n = verts.length;
  const scale = (sx + sy) / 2 || 1;
  const out: CornerHandle[] = [];
  // The star has one radius and one dot, on its top tip (vertex 0).
  for (let i = 0; i < (count === 1 ? 1 : count); i++) {
    const p = verts[i];
    const a = verts[(i + n - 1) % n];
    const b = verts[(i + 1) % n];
    const ax = a.x - p.x, ay = a.y - p.y;
    const bx = b.x - p.x, by = b.y - p.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    const ux = ax / la, uy = ay / la;
    const vx = bx / lb, vy = by / lb;
    const half = Math.acos(Math.min(Math.max(ux * vx + uy * vy, -1), 1)) / 2;
    const bl = Math.hypot(ux + vx, uy + vy);
    if (half < 1e-6 || bl < 1e-9) continue;
    const bisector = { x: (ux + vx) / bl, y: (uy + vy) / bl };
    const sinHalf = Math.sin(half);
    const maxR = (Math.min(la, lb) / 2) * Math.tan(half);
    const r = Math.min(radii[count === 1 ? 0 : i] ?? 0, maxR);
    const along = Math.max(r / sinHalf, MIN_DOT_INSET / scale);
    out.push({
      index: count === 1 ? 0 : i,
      corner: p,
      bisector,
      sinHalf,
      maxR,
      dot: { x: p.x + bisector.x * along, y: p.y + bisector.y * along },
    });
  }
  return out;
}

/** The radius after dragging `c`'s dot by (`dx`, `dy`) canvas px in the
 *  shape's own frame, from where it was when the drag began. Only the motion
 *  along the bisector counts — toward the middle rounds more, back toward the
 *  corner rounds less — and it moves the arc's center with the pointer, so
 *  the dot stays under it. Whole px, 0..maxR. */
export function radiusAfterDrag(
  c: CornerHandle,
  startRadii: CornerRadii,
  dx: number,
  dy: number,
): number {
  const from = Math.min(startRadii[c.index] ?? 0, c.maxR);
  const along = dx * c.bisector.x + dy * c.bisector.y;
  const r = from + along * c.sinHalf;
  // The epsilon keeps a maxR of 29.999999… (tan 45° in floating point) at 30.
  return Math.round(Math.min(Math.max(r, 0), Math.floor(c.maxR + 1e-6)));
}
