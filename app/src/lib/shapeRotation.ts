// Rotation for the six drawable shapes — the geometry the edit overlay needs,
// kept out of CanvasArea so it can be tested without a DOM.
//
// THE MODEL. A shape keeps its UNROTATED box (`start`/`end`, what every other
// piece of the app already reads) plus a `rotation` in degrees, clockwise on
// screen, about the box center. The engine draws it the same way
// (`render_shape_into`), so the overlay can wrap its unrotated preview in an
// SVG `rotate(θ cx cy)` and land on exactly the pixels the commit will draw.
//
// A LINE IS THE EXCEPTION. It already has a natural rotation — its two
// endpoints — so turning it moves the endpoints and leaves `rotation` at 0.
// One representation per shape, never two that can disagree.

export interface Pt {
  x: number;
  y: number;
}

/** (-180, 180] — the range the engine stores. */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Rotate `p` about `c`, clockwise on screen (y-down). The same matrix SVG's
 *  `rotate()` uses, and the one the engine's contract names. */
export function rotatePoint(p: Pt, c: Pt, deg: number): Pt {
  if (!deg) return { x: p.x, y: p.y };
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

export function boxCenter(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** A screen-space pointer delta expressed along the shape's own axes, so the
 *  resize math — written for an upright box — works on a turned one. */
export function toLocalDelta(dx: number, dy: number, deg: number): { dx: number; dy: number } {
  const p = rotatePoint({ x: dx, y: dy }, { x: 0, y: 0 }, -deg);
  return { dx: p.x, dy: p.y };
}

/** Degrees to snap to while Shift is held. */
const ROTATE_SNAP_DEG = 15;

/**
 * The rotation after dragging the rotate handle from `grab` to `now` about
 * `center`. Adds the ANGULAR DELTA to where it started rather than reading
 * the pointer's absolute angle — the handle rests below the box, so the
 * absolute angle would flip the shape ~180° the moment it was grabbed (the
 * text handle learned this first; same fix).
 */
export function rotationAfterDrag(
  center: Pt,
  grab: Pt,
  now: Pt,
  startDeg: number,
  snap = false,
): number {
  const a0 = Math.atan2(grab.y - center.y, grab.x - center.x);
  const a1 = Math.atan2(now.y - center.y, now.x - center.x);
  let next = startDeg + ((a1 - a0) * 180) / Math.PI;
  if (snap) next = Math.round(next / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
  return normalizeDeg(Math.round(next));
}

/**
 * Keep the edge opposite a resize handle where it was on screen.
 *
 * Resizing happens in the shape's own frame, which moves the box center — and
 * the center is the rotation pivot, so an upright-frame resize alone would make
 * the whole shape slide sideways as it grows. For any fixed point p the world
 * position is C + R(p − C); after the center moves by d the same point lands
 * (I − R)·d away from where it was, whichever point on the fixed edge you
 * pick. Translating the new box back by that amount pins the edge.
 */
export function pinAfterResize(
  oldStart: Pt,
  oldEnd: Pt,
  newStart: Pt,
  newEnd: Pt,
  deg: number,
): { start: Pt; end: Pt } {
  if (!deg) return { start: newStart, end: newEnd };
  const c0 = boxCenter(oldStart, oldEnd);
  const c1 = boxCenter(newStart, newEnd);
  const d = { x: c1.x - c0.x, y: c1.y - c0.y };
  const rd = rotatePoint(d, { x: 0, y: 0 }, deg);
  const corr = { x: d.x - rd.x, y: d.y - rd.y };
  return {
    start: { x: newStart.x - corr.x, y: newStart.y - corr.y },
    end: { x: newEnd.x - corr.x, y: newEnd.y - corr.y },
  };
}

/** Turn a line by `deltaDeg` about its midpoint — a line's rotation lives in
 *  its endpoints (see the header). */
export function rotateSegment(start: Pt, end: Pt, deltaDeg: number): { start: Pt; end: Pt } {
  const c = boxCenter(start, end);
  return { start: rotatePoint(start, c, deltaDeg), end: rotatePoint(end, c, deltaDeg) };
}

const RESIZE_CURSORS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
const HANDLE_ANGLE: Record<string, number> = {
  n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
};

/** The resize cursor that points the way a handle actually faces once the
 *  box is turned — an `n-resize` arrow on a handle rotated 90° would point
 *  along the edge instead of across it. */
export function rotatedResizeCursor(handle: string, deg: number): string {
  const base = HANDLE_ANGLE[handle];
  if (base === undefined) return "move";
  const turned = (((base + deg) % 360) + 360) % 360;
  return `${RESIZE_CURSORS[Math.round(turned / 45) % 8]}-resize`;
}
