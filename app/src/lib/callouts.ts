// Smart Callout v1: a numbered pin, a text label and the leader joining them.
//
// THREE ORDINARY ANNOTATIONS, JOINED BY GEOMETRY. The pin is kind 5, the
// leader an arrow (kind 4) from the label to the pin, the label a text
// annotation. Nothing links them in storage: a leader whose tail sits on one
// of a label's four edge midpoints and whose head sits on a pin's outline IS
// that callout's leader (`findCallouts`). That is the rule #310's connectors
// use (lib/shapePorts.ts), so the join survives undo, autosave, reload and
// export with no format change. A user cannot make that shape by accident:
// Connect refuses pins, and nothing else ends an arrow on a text's edge.
//
// WHAT MOVES TOGETHER. When the pin or the label moves, the leader is drawn
// again between them (`leaderFor`: the label's edge nearest the pin, the
// pin's outline toward it). Follow rides the move's own undo step:
// `reroute_connector` takes none. Adding and deleting a callout are one step
// through the engine's `continue_step` (tests/smart_callout.rs).
//
// The callout is found against the geometry from BEFORE the move, and only
// leaders that did not themselves change are followed — the connectorsToFollow
// rule, which is what makes this safe after undo, redo and photo switches.

export interface Pt {
  x: number;
  y: number;
}

/** The slice of `get_shape_annotations` the callout rules read. */
export interface CalloutShape {
  id: number;
  kind: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The slice of `get_text_annotations`: the drawn tile, in IMAGE px. */
export interface CalloutText {
  id: number;
  x: number;
  y: number;
  tile_offset_x: number;
  tile_offset_y: number;
  tile_w: number;
  tile_h: number;
}

export interface Leader {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Callout {
  pin: number;
  leader: number;
  label: number;
}

const PIN = 5;
const ARROW = 4;
/** Ends are written exactly; this absorbs float round-trips through JSON. */
const TOL = 0.75;

function pinCircle(p: CalloutShape) {
  return {
    c: { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 },
    r: Math.min(Math.abs(p.x1 - p.x0), Math.abs(p.y1 - p.y0)) / 2,
  };
}

/** A label's four edge midpoints: top, right, bottom, left. */
function labelPorts(t: CalloutText): Pt[] {
  const x = t.x + t.tile_offset_x;
  const y = t.y + t.tile_offset_y;
  return [
    { x: x + t.tile_w / 2, y },
    { x: x + t.tile_w, y: y + t.tile_h / 2 },
    { x: x + t.tile_w / 2, y: y + t.tile_h },
    { x, y: y + t.tile_h / 2 },
  ];
}

/** The leader between `pin` and `label`: its tail on the label edge nearest
 *  the pin, its head on the pin's outline, pointing at the center. */
export function leaderFor(pin: CalloutShape, label: CalloutText): Leader {
  const { c, r } = pinCircle(pin);
  const tail = labelPorts(label).reduce((best, p) =>
    Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(best.x - c.x, best.y - c.y) ? p : best,
  );
  const d = Math.hypot(tail.x - c.x, tail.y - c.y) || 1;
  return { x0: tail.x, y0: tail.y, x1: c.x + ((tail.x - c.x) / d) * r, y1: c.y + ((tail.y - c.y) / d) * r };
}

/** Every callout on the layer: an arrow from a label's edge midpoint to a
 *  pin's outline. */
export function findCallouts(shapes: readonly CalloutShape[], texts: readonly CalloutText[]): Callout[] {
  const pins = shapes.filter((s) => s.kind === PIN);
  const out: Callout[] = [];
  for (const a of shapes) {
    if (a.kind !== ARROW) continue;
    const label = texts.find((t) => labelPorts(t).some((p) => Math.hypot(p.x - a.x0, p.y - a.y0) <= TOL));
    const pin = pins.find((p) => {
      const { c, r } = pinCircle(p);
      return Math.abs(Math.hypot(a.x1 - c.x, a.y1 - c.y) - r) <= TOL;
    });
    if (label && pin) out.push({ pin: pin.id, leader: a.id, label: label.id });
  }
  return out;
}

export interface CalloutLayer {
  shapes: readonly CalloutShape[];
  texts: readonly CalloutText[];
}

/** The leaders to redraw after the layer changed from `before` to `now`:
 *  every callout whose pin or label moved, while its leader did not. */
export function calloutsToFollow(before: CalloutLayer, now: CalloutLayer): (Leader & { id: number })[] {
  const out: (Leader & { id: number })[] = [];
  for (const c of findCallouts(before.shapes, before.texts)) {
    const was = before.shapes.find((s) => s.id === c.leader)!;
    const leader = now.shapes.find((s) => s.id === c.leader);
    const pin = now.shapes.find((s) => s.id === c.pin);
    const label = now.texts.find((t) => t.id === c.label);
    if (!leader || !pin || !label) continue;
    if (leader.x0 !== was.x0 || leader.y0 !== was.y0 || leader.x1 !== was.x1 || leader.y1 !== was.y1) continue;
    const next = leaderFor(pin, label);
    const moved = [next.x0 - was.x0, next.y0 - was.y0, next.x1 - was.x1, next.y1 - was.y1].some(
      (d) => Math.abs(d) > 1e-6,
    );
    if (moved) out.push({ id: c.leader, ...next });
  }
  return out;
}

/** Where a new callout's label goes: up and to the right of the pin, or to
 *  the left when that would leave the image. */
export function defaultLabelAt(p: Pt, pinRadius: number, imageWidth: number): Pt {
  const gap = pinRadius * 3;
  const right = p.x + gap;
  return { x: right + 120 > imageWidth ? Math.max(0, p.x - gap - 120) : right, y: Math.max(0, p.y - gap) };
}
