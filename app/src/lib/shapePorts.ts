// The eight points around a selected shape's bounding box that the canvas
// action bar hangs its Duplicate arrows and Connect pigtails on, and the
// arithmetic behind both. Pure, so it is tested without a DOM.
//
// Replaces lib/duplicatePadGeometry.ts (the four-way ⊕ pad opened from
// Review › Reselect). The rule that made that pad useful survives here
// unchanged: copies are counted PER PORT and measured from the ORIGINAL, so
// ← ← lays two copies marching left and a following ↑ goes above the source,
// not above the second copy.

export interface Pt {
  x: number;
  y: number;
}

/** A shape's box in IMAGE px, any corner order. */
export interface PortBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type PortId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface Port {
  id: PortId;
  /** Where on the box, as fractions (0..1) of its width/height. */
  ax: number;
  ay: number;
  /** Outward direction, one step per axis (-1, 0 or 1) in the shape's frame. */
  ux: number;
  uy: number;
  /** Plain-words direction for labels: "above", "to the right", … */
  where: string;
}

/** Clockwise from the top-left — the same eight the resize squares sit on. */
export const PORTS: readonly Port[] = [
  { id: "nw", ax: 0, ay: 0, ux: -1, uy: -1, where: "up and to the left" },
  { id: "n", ax: 0.5, ay: 0, ux: 0, uy: -1, where: "above" },
  { id: "ne", ax: 1, ay: 0, ux: 1, uy: -1, where: "up and to the right" },
  { id: "e", ax: 1, ay: 0.5, ux: 1, uy: 0, where: "to the right" },
  { id: "se", ax: 1, ay: 1, ux: 1, uy: 1, where: "down and to the right" },
  { id: "s", ax: 0.5, ay: 1, ux: 0, uy: 1, where: "below" },
  { id: "sw", ax: 0, ay: 1, ux: -1, uy: 1, where: "down and to the left" },
  { id: "w", ax: 0, ay: 0.5, ux: -1, uy: 0, where: "to the left" },
];

/** Shape kinds with a box worth duplicating beside or connecting to: rect 0,
 *  circle 1, diamond 8, star 9, triangle 10. A line or arrow has no "beside",
 *  a pin is a numbered sequence, and a pen path is not a box. */
export const BOX_KINDS: ReadonlySet<number> = new Set([0, 1, 8, 9, 10]);

/** Duplicate spacing, in IMAGE px — the bar's `[-] 20px [+]`. */
export const GAP_DEFAULT = 20;
export const GAP_STEP = 5;
export const GAP_MAX = 500;

export function clampGap(px: number): number {
  if (!Number.isFinite(px)) return GAP_DEFAULT;
  return Math.min(GAP_MAX, Math.max(0, Math.round(px)));
}

/** Below this on-screen size (the SHORTER side, screen px) a shape gets no
 *  action bar, arrows or pigtails: eight controls plus a toolbar around a
 *  shape that small cover it completely, and every grab would land on a
 *  button instead of the shape. Zoom in and they come back. */
export const MIN_ACTIONABLE_SCREEN_PX = 32;

export function tooSmallForActions(screenW: number, screenH: number): boolean {
  return Math.min(Math.abs(screenW), Math.abs(screenH)) < MIN_ACTIONABLE_SCREEN_PX;
}

/** Turn a vector `deg` clockwise on screen (y points down). */
function rotateVec(v: Pt, deg: number): Pt {
  if (!deg) return { x: v.x, y: v.y };
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function norm(box: PortBox) {
  const x = Math.min(box.x0, box.x1);
  const y = Math.min(box.y0, box.y1);
  const w = Math.abs(box.x1 - box.x0);
  const h = Math.abs(box.y1 - box.y0);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** A port's point, in the same space as `box`, with the shape's rotation
 *  (degrees clockwise about the box center) applied. */
export function portPoint(box: PortBox, rotation: number, port: Port): Pt {
  const b = norm(box);
  const local = rotateVec({ x: (port.ax - 0.5) * b.w, y: (port.ay - 0.5) * b.h }, rotation);
  return { x: b.cx + local.x, y: b.cy + local.y };
}

/** A port's outward direction as a unit vector, rotation applied. */
export function portDirection(rotation: number, port: Port): Pt {
  const len = Math.hypot(port.ux, port.uy) || 1;
  return rotateVec({ x: port.ux / len, y: port.uy / len }, rotation);
}

/**
 * Offset in IMAGE px for the `n`th copy out of `port` (n = 1 is the first),
 * measured from the ORIGINAL: one box plus `gap` per step on each axis the
 * port points along. A corner port steps both axes, so ↘ ↘ is a diagonal of
 * copies that touch nothing. A turned shape steps along its OWN axes, so
 * copies of a 30° square line up with it rather than with the screen.
 */
export function duplicateOffset(
  box: PortBox,
  rotation: number,
  port: Port,
  n: number,
  gap: number,
): Pt {
  const b = norm(box);
  const local = {
    x: port.ux * n * (b.w + gap),
    y: port.uy * n * (b.h + gap),
  };
  const d = rotateVec(local, rotation);
  return { x: Math.round(d.x), y: Math.round(d.y) };
}

export interface PortTarget {
  id: number;
  box: PortBox;
  rotation: number;
}

/**
 * Where a Connect drag lands: the nearest port of any target within `snap`
 * of the pointer, else the nearest port of a target whose box (grown by
 * `snap`) contains it. Null drops the connector — a line to nowhere is not
 * a diagram. `snap` is in the same units as the points.
 */
export function connectTarget(
  targets: readonly PortTarget[],
  p: Pt,
  snap: number,
): { id: number; port: PortId; point: Pt } | null {
  let best: { id: number; port: PortId; point: Pt; d: number } | null = null;
  const consider = (t: PortTarget) => {
    for (const port of PORTS) {
      const q = portPoint(t.box, t.rotation, port);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || d < best.d) best = { id: t.id, port: port.id, point: q, d };
    }
  };
  for (const t of targets) consider(t);
  const near = best as { id: number; port: PortId; point: Pt; d: number } | null;
  if (near && near.d <= snap) return { id: near.id, port: near.port, point: near.point };

  best = null;
  for (const t of targets) {
    const b = norm(t.box);
    // Inside test in the shape's own frame, so a turned box counts its corners.
    const local = rotateVec({ x: p.x - b.cx, y: p.y - b.cy }, -t.rotation);
    if (Math.abs(local.x) <= b.w / 2 + snap && Math.abs(local.y) <= b.h / 2 + snap) consider(t);
  }
  const inside = best as { id: number; port: PortId; point: Pt; d: number } | null;
  return inside ? { id: inside.id, port: inside.port, point: inside.point } : null;
}
