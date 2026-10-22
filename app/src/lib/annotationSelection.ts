// Multi-select (Night 10-22): which annotations are picked, what else a pick
// pulls in, and the boxes the selection is drawn and aligned by. Pure — the
// engine work and the pointer handling live in app/session/useAnnotationSelection.
//
// WHAT A PICK PULLS IN.
//   • A Smart Callout moves as a unit: picking its pin, leader or label picks
//     all three (lib/callouts `findCallouts`, the geometric join).
//   • A connector with BOTH ends on picked boxes is picked too, so a group
//     move carries it along unchanged. One with an end on an unpicked box is
//     left out and re-routes after the move (lib/shapePorts, as for one box).
//
// ALIGN AND DISTRIBUTE take a group key per object (`alignGroups`): a
// callout's three parts share one, so the engine moves them as one box. The
// connectors a pick pulled in are NOT aligned — their boxes move by different
// amounts, so they re-route instead, both ends.
import { findCallouts, type CalloutShape, type CalloutText } from "./callouts";
import { BOX_KINDS, asTarget, attachedEnds, type PlacedShape } from "./shapePorts";

export interface Picked {
  shapes: number[];
  texts: number[];
}

export const NONE: Picked = { shapes: [], texts: [] };

export type SelShape = PlacedShape;
export type SelText = CalloutText;

/** (left, top, right, bottom), IMAGE px. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const ARROW = 4;

export const pickedCount = (p: Picked) => p.shapes.length + p.texts.length;

export function has(p: Picked, type: "shape" | "text", id: number): boolean {
  return (type === "shape" ? p.shapes : p.texts).includes(id);
}

/** `p` with `id` added, or taken out if it was there. */
export function toggle(p: Picked, type: "shape" | "text", id: number): Picked {
  const list = type === "shape" ? p.shapes : p.texts;
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  return type === "shape" ? { ...p, shapes: next } : { ...p, texts: next };
}

/** The kinds the engine turns with `rotation` (annotations.rs
 *  `rotation_applies`): rect, circle, line, diamond, star, triangle, oval and
 *  the diagram shapes. Arrows, pins and paths keep their stored geometry. */
function rotates(kind: number): boolean {
  return [0, 1, 2, 8, 9, 10, 41].includes(kind) || (kind >= 11 && kind <= 40);
}

/** A shape's box as drawn: a turned shape is measured by its turned corners,
 *  the same box the engine aligns by. */
export function shapeBox(s: SelShape): Box {
  const deg = rotates(s.kind) ? (s.rotation ?? 0) : 0;
  if (!deg) {
    return { x0: Math.min(s.x0, s.x1), y0: Math.min(s.y0, s.y1), x1: Math.max(s.x0, s.x1), y1: Math.max(s.y0, s.y1) };
  }
  const t = (deg * Math.PI) / 180;
  const [c, sn] = [Math.cos(t), Math.sin(t)];
  const cx = (s.x0 + s.x1) / 2;
  const cy = (s.y0 + s.y1) / 2;
  const pts = [[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1]].map(([x, y]) => [
    cx + (x - cx) * c - (y - cy) * sn,
    cy + (x - cx) * sn + (y - cy) * c,
  ]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** A text's box is its drawn tile. */
export function textBox(t: SelText): Box {
  const x = t.x + t.tile_offset_x;
  const y = t.y + t.tile_offset_y;
  return { x0: x, y0: y, x1: x + t.tile_w, y1: y + t.tile_h };
}

export function union(a: Box | null, b: Box): Box {
  return a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b;
}

/** The selection's bounds, or null when nothing picked is on the layer. */
export function pickedBounds(p: Picked, shapes: readonly SelShape[], texts: readonly SelText[]): Box | null {
  let b: Box | null = null;
  for (const s of shapes) if (p.shapes.includes(s.id)) b = union(b, shapeBox(s));
  for (const t of texts) if (p.texts.includes(t.id)) b = union(b, textBox(t));
  return b;
}

/** Arrows with both ends on boxes in `boxIds`. */
function connectorsBetween(boxIds: readonly number[], shapes: readonly SelShape[]): number[] {
  const arrows = shapes.filter((s) => s.kind === ARROW);
  const ends = new Map<number, Set<0 | 1>>();
  for (const s of shapes) {
    if (!boxIds.includes(s.id) || !BOX_KINDS.has(s.kind)) continue;
    for (const e of attachedEnds(asTarget(s), arrows)) {
      ends.set(e.arrowId, (ends.get(e.arrowId) ?? new Set()).add(e.end));
    }
  }
  return [...ends].filter(([, set]) => set.size === 2).map(([id]) => id);
}

/** `p` with every callout part and both-ends connector it implies. */
export function expand(p: Picked, shapes: readonly SelShape[], texts: readonly SelText[]): Picked {
  const s = new Set(p.shapes);
  const t = new Set(p.texts);
  for (const c of findCallouts(shapes as CalloutShape[], texts)) {
    if (s.has(c.pin) || s.has(c.leader) || t.has(c.label)) {
      s.add(c.pin);
      s.add(c.leader);
      t.add(c.label);
    }
  }
  for (const id of connectorsBetween([...s], shapes)) s.add(id);
  // Only what is still on the layer, in a stable order.
  return {
    shapes: shapes.filter((x) => s.has(x.id)).map((x) => x.id),
    texts: texts.filter((x) => t.has(x.id)).map((x) => x.id),
  };
}

const inside = (b: Box, r: Box) => b.x0 >= r.x0 && b.y0 >= r.y0 && b.x1 <= r.x1 && b.y1 <= r.y1;

/** Everything whose box is FULLY inside `rect`, expanded. */
export function marqueePick(rect: Box, shapes: readonly SelShape[], texts: readonly SelText[]): Picked {
  const r = { x0: Math.min(rect.x0, rect.x1), y0: Math.min(rect.y0, rect.y1), x1: Math.max(rect.x0, rect.x1), y1: Math.max(rect.y0, rect.y1) };
  return expand(
    {
      shapes: shapes.filter((s) => inside(shapeBox(s), r)).map((s) => s.id),
      texts: texts.filter((t) => inside(textBox(t), r)).map((t) => t.id),
    },
    shapes,
    texts,
  );
}

/** Every annotation on the layer. */
export const pickAll = (shapes: readonly SelShape[], texts: readonly SelText[]): Picked => ({
  shapes: shapes.map((s) => s.id),
  texts: texts.map((t) => t.id),
});

/** The ids and group keys `align_annotations` / `distribute_annotations`
 *  take: a callout's parts share a key, the connectors between picked boxes
 *  are left out (they re-route), everything else is a group of one. */
export function alignGroups(p: Picked, shapes: readonly SelShape[], texts: readonly SelText[]) {
  const keyOf = new Map<string, number>();
  let next = 0;
  for (const c of findCallouts(shapes as CalloutShape[], texts)) {
    if (!p.shapes.includes(c.pin)) continue;
    const k = next++;
    keyOf.set(`s${c.pin}`, k);
    keyOf.set(`s${c.leader}`, k);
    keyOf.set(`t${c.label}`, k);
  }
  const boxes = p.shapes.filter((id) => BOX_KINDS.has(shapes.find((s) => s.id === id)?.kind ?? -1));
  const follow = new Set(connectorsBetween(boxes, shapes));
  const shapeIds = p.shapes.filter((id) => !follow.has(id));
  const key = (k: string) => keyOf.get(k) ?? (keyOf.set(k, next++), keyOf.get(k)!);
  return {
    shapeIds,
    shapeGroups: shapeIds.map((id) => key(`s${id}`)),
    textIds: [...p.texts],
    textGroups: p.texts.map((id) => key(`t${id}`)),
    groups: next,
  };
}
