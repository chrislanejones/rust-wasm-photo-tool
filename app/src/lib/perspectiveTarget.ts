// What the Perspective tool can be pointed AT: the vector objects the app
// draws — text annotations and every shape annotation — described in one
// shape so the overlay, the hook and the panel all mean the same thing by
// "target".
//
// WHY A TARGET IS A (KIND, ID) PAIR AND NOT A NUMBER. Text ids and shape ids
// are two independent id spaces in the engine (`next_text_id` /
// `next_shape_id`), so `id 3` is both a text and a square in any document with
// three of each. The tool shipped in v8.42 holding a bare `targetId: number`,
// which was correct exactly as long as text was the only thing it could reach;
// the moment squares and circles arrive, a bare number silently warps the
// wrong object. Pairing the kind with the id makes that unrepresentable.
//
// LAYER SEPARATION comes free and is not an accident: both lists are read from
// `get_text_annotations` / `get_shape_annotations`, which answer for the
// ACTIVE layer only. A target is therefore always something on the layer the
// user is working in, and `usePerspectiveTool` drops it when the active layer
// changes rather than letting a pick survive into a layer where the object is
// not even visible.

/** Which id space a target's id belongs to. */
export type PerspectiveTargetKind = "text" | "shape";

/** The tool's current target — an object, never a rectangle of pixels. */
export interface PerspectiveTarget {
  kind: PerspectiveTargetKind;
  id: number;
}

/** A target plus everything the overlay needs to draw and label it. */
export interface PerspectiveTargetBox extends PerspectiveTarget {
  /** The basis rect in IMAGE px — see `basisOfShape` for the shape rule. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Human-facing name: "Text", "Square", "Circle", … */
  label: string;
}

export function sameTarget(
  a: PerspectiveTarget | null,
  b: PerspectiveTarget | null,
): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.id === b.id;
}

/** Rust shape `kind` byte → the name the panel and the Reselect list show. */
const SHAPE_KIND_LABEL: Record<number, string> = {
  0: "Square",
  1: "Circle",
  2: "Line",
  3: "Hand-drawn",
  4: "Arrow",
  5: "Pin",
  6: "Pen",
  7: "Pen Path",
};

/** The name for a shape's `kind` byte; "Shape" for anything unrecognised. */
export function shapeKindLabel(kind: number): string {
  return SHAPE_KIND_LABEL[kind] ?? "Shape";
}

/**
 * The rectangle a SHAPE's perspective quad is normalised against: its plain
 * bounding box, with no stroke padding.
 *
 * ⚠️ THIS MIRRORS `shape_basis_rect` IN `src/annotations.rs` AND THE TWO MUST
 * AGREE TO THE PIXEL. The overlay denormalises the stored quad onto this rect
 * to place its handles, and `set_shape_perspective` re-normalises against the
 * engine's copy on commit. A basis that differs by even the stroke width would
 * put the committed warp somewhere other than where the user dragged it — and
 * worse, it would drift a little further on every reselect, because each round
 * trip would re-normalise against the disagreement.
 *
 * The bare bbox is chosen precisely because it is the one rectangle both sides
 * can compute from the shape JSON alone, with no shared knowledge of how a
 * stroke, an arrowhead or a pin label rasterises. The engine grows its render
 * TILE past this (see `shape_ink_pad`) so nothing is clipped; that padding
 * deliberately does not move the basis.
 */
export function basisOfShape(s: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.min(s.x0, s.x1),
    y: Math.min(s.y0, s.y1),
    w: Math.abs(s.x1 - s.x0),
    h: Math.abs(s.y1 - s.y0),
  };
}
