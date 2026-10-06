// The eight points around a selected shape's bounding box that the canvas
// action bar hangs its Duplicate arrows and Connect pigtails on, and the
// arithmetic behind both. Pure, so it is tested without a DOM.
//
// Replaces lib/duplicatePadGeometry.ts (the four-way ⊕ pad opened from
// Review › Reselect). The rule that made that pad useful survives here
// unchanged: copies are counted PER PORT and measured from the ORIGINAL, so
// ← ← lays two copies marching left and a following ↑ goes above the source,
// not above the second copy.
//
// Connect works on the OUTLINE, not the box: a connector to a circle's
// north-east port lands on the circle, not on the empty corner of its box
// (`outlinePoint`). Duplicate keeps the box ports — its arrows say which way
// the copies go, and the box is what they are laid out by.
//
// Connectors stay attached by GEOMETRY, not by a stored link: an arrow end
// sitting on a box's outline port is attached to it (`attachedEnds`), and when
// the box moves the end moves to the same port on the new outline
// (`reroutedConnectors`). Nothing new is saved, so undo, autosave, export and
// documents from before this existed all agree on what is connected.

import { starVertices, triangleVertices } from "./shapeSloppiness";

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
  /** Engine kind byte — picks the outline the ports sit on. Absent = rect. */
  kind?: number;
  /** Star point count (kind 9); 0 or absent = the classic 5. */
  starPoints?: number;
}

/** Shape kind bytes with an outline that is not their box. */
const CIRCLE = 1;
const DIAMOND = 8;
const STAR = 9;
const TRIANGLE = 10;

/** The closed outline of a polygon kind, in the box's own (unrotated) px. */
function outlinePolygon(box: PortBox, kind: number, starPoints?: number): Pt[] | null {
  const { x0, y0, x1, y1 } = box;
  if (kind === TRIANGLE) return triangleVertices(x0, y0, x1, y1);
  if (kind === STAR) return starVertices(x0, y0, x1, y1, starPoints ?? 0);
  if (kind === DIAMOND) {
    const b = norm(box);
    return [
      { x: b.cx, y: b.y },
      { x: b.x + b.w, y: b.cy },
      { x: b.cx, y: b.y + b.h },
      { x: b.x, y: b.cy },
    ];
  }
  return null;
}

/** Nearest hit of the ray `o + t·d` (t > 0) on the closed polygon `poly`. */
function rayHit(o: Pt, d: Pt, poly: readonly Pt[]): Pt | null {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den;
    const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den;
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return Number.isFinite(best) ? { x: o.x + d.x * best, y: o.y + d.y * best } : null;
}

/**
 * A port's point ON THE SHAPE: where the line from the box center out to the
 * box port crosses the outline. A rect's outline is its box, so it is
 * `portPoint`; an ellipse puts the corner ports at 45° around it; a diamond,
 * triangle or star puts them on its edges (a triangle's N port is its apex, a
 * diamond's N/E/S/W its four tips). Rotation is applied last, about the box
 * center, the same as `portPoint`.
 */
export function outlinePoint(
  box: PortBox,
  rotation: number,
  port: Port,
  kind = 0,
  starPoints?: number,
): Pt {
  const b = norm(box);
  const toward = { x: (port.ax - 0.5) * b.w, y: (port.ay - 0.5) * b.h };
  let local: Pt = toward;
  if (kind === CIRCLE) {
    // Unit direction in the box's normalized space, scaled back out to the
    // ellipse's half-axes — so the corner ports sit at 45° on any oval.
    const ux = port.ax - 0.5;
    const uy = port.ay - 0.5;
    const len = Math.hypot(ux, uy) || 1;
    local = { x: (ux / len) * (b.w / 2), y: (uy / len) * (b.h / 2) };
  } else {
    const poly = outlinePolygon(box, kind, starPoints);
    const hit = poly && rayHit({ x: b.cx, y: b.cy }, toward, poly);
    if (hit) local = { x: hit.x - b.cx, y: hit.y - b.cy };
  }
  const r = rotateVec(local, rotation);
  return { x: b.cx + r.x, y: b.cy + r.y };
}

/** `outlinePoint` for a `PortTarget`. */
export function targetPoint(t: PortTarget, port: Port): Pt {
  return outlinePoint(t.box, t.rotation, port, t.kind ?? 0, t.starPoints);
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
      const q = targetPoint(t, port);
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

/** An arrow's two ends, IMAGE px — `x0,y0` is where it was drawn FROM. */
export interface ArrowEnds {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How near an arrow end must sit to a port to count as attached, IMAGE px.
 *  Connectors are written exactly on the port, so this only absorbs float
 *  round-trips through the engine's JSON. */
const ATTACH_TOL = 0.75;

/** One arrow end sitting on one of `shape`'s ports. `end` 0 is the arrow's
 *  tail (`x0,y0`), 1 its head (`x1,y1`). */
export interface AttachedEnd {
  arrowId: number;
  end: 0 | 1;
  port: PortId;
  at: Pt;
  /** The arrow's OTHER end — where a moving box's connector is anchored. */
  other: Pt;
}

/** Every arrow end attached to `shape`, by geometry (see the file header). */
export function attachedEnds(
  shape: PortTarget,
  arrows: readonly ArrowEnds[],
  tol = ATTACH_TOL,
): AttachedEnd[] {
  const ports = PORTS.map((p) => ({ id: p.id, at: targetPoint(shape, p) }));
  const out: AttachedEnd[] = [];
  for (const a of arrows) {
    if (a.id === shape.id) continue;
    for (const end of [0, 1] as const) {
      const x = end === 0 ? a.x0 : a.x1;
      const y = end === 0 ? a.y0 : a.y1;
      const hit = ports.find((p) => Math.hypot(p.at.x - x, p.at.y - y) <= tol);
      const other = end === 0 ? { x: a.x1, y: a.y1 } : { x: a.x0, y: a.y0 };
      if (hit) out.push({ arrowId: a.id, end, port: hit.id, at: hit.at, other });
    }
  }
  return out;
}

/**
 * The arrows attached to `before` with their attached ends moved onto the
 * same ports of `after` — the shape after a move, resize or turn. Arrows not
 * attached, and arrows whose ends would not move, are left out, so an empty
 * list means "nothing to re-route".
 */
function reroutedConnectors(
  before: PortTarget,
  after: PortTarget,
  arrows: readonly ArrowEnds[],
): ArrowEnds[] {
  const ends = attachedEnds(before, arrows);
  const moved = new Map<number, ArrowEnds>();
  for (const e of ends) {
    const src = moved.get(e.arrowId) ?? arrows.find((a) => a.id === e.arrowId)!;
    const port = PORTS.find((p) => p.id === e.port)!;
    const to = targetPoint(after, port);
    moved.set(
      e.arrowId,
      e.end === 0 ? { ...src, x0: to.x, y0: to.y } : { ...src, x1: to.x, y1: to.y },
    );
  }
  return [...moved.values()].filter((m) => {
    const a = arrows.find((x) => x.id === m.id)!;
    return a.x0 !== m.x0 || a.y0 !== m.y0 || a.x1 !== m.x1 || a.y1 !== m.y1;
  });
}

/** The slice of the engine's shape JSON (`ShapeMeta`) the connector rules
 *  read. */
export interface PlacedShape {
  id: number;
  kind: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  rotation?: number;
  starPoints?: number;
}

const ARROW = 4;

export function asTarget(s: PlacedShape): PortTarget {
  return {
    id: s.id,
    box: { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 },
    rotation: s.rotation ?? 0,
    kind: s.kind,
    starPoints: s.starPoints,
  };
}

function sameArrow(a: ArrowEnds, b: ArrowEnds): boolean {
  return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
}

function samePlace(a: PlacedShape, b: PlacedShape): boolean {
  return (
    sameArrow(a, b) &&
    a.kind === b.kind &&
    (a.rotation ?? 0) === (b.rotation ?? 0) &&
    (a.starPoints ?? 0) === (b.starPoints ?? 0)
  );
}

/**
 * The connectors to re-route after the shape list changed from `before` to
 * `now`: for every box that MOVED (or was resized / turned / re-pointed), each
 * arrow end that sat on one of its ports in `before` goes to the same port of
 * the box in `now`.
 *
 * Only arrows that did NOT change between the two lists are followed. That
 * one rule is what keeps this safe to run after anything at all:
 *  - a box move leaves its arrows where they were → they follow;
 *  - undo / redo restores the arrows WITH the box → they changed, skip;
 *  - a layer move or crop shifts everything together → they changed, skip;
 *  - another photo's list reusing the same ids → its arrows differ, skip.
 */
export function connectorsToFollow(
  before: readonly PlacedShape[],
  now: readonly PlacedShape[],
): ArrowEnds[] {
  const was = new Map(before.map((s) => [s.id, s]));
  const arrows = now.filter((s) => {
    const w = was.get(s.id);
    return s.kind === ARROW && w?.kind === ARROW && sameArrow(s, w);
  });
  if (!arrows.length) return [];
  let routed: ArrowEnds[] = arrows.map(({ id, x0, y0, x1, y1 }) => ({ id, x0, y0, x1, y1 }));
  const start = new Map(routed.map((a) => [a.id, a]));
  for (const s of now) {
    const w = was.get(s.id);
    if (!w || !BOX_KINDS.has(s.kind) || !BOX_KINDS.has(w.kind) || samePlace(s, w)) continue;
    // Attachment is read against the UNMOVED arrows, so two boxes moving at
    // once each find their own end, whatever order they are visited in.
    const moved = reroutedConnectors(asTarget(w), asTarget(s), [...start.values()]);
    routed = routed.map((a) => {
      const m = moved.find((x) => x.id === a.id);
      if (!m) return a;
      const orig = start.get(a.id)!;
      return {
        ...a,
        ...(m.x0 !== orig.x0 || m.y0 !== orig.y0 ? { x0: m.x0, y0: m.y0 } : {}),
        ...(m.x1 !== orig.x1 || m.y1 !== orig.y1 ? { x1: m.x1, y1: m.y1 } : {}),
      };
    });
  }
  return routed.filter((a) => !sameArrow(a, start.get(a.id)!));
}
