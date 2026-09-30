// A PLACED OBJECT IS ANOTHER SELECTION PRODUCER — the geometry half.
//
// Combine used to be a Select-panel control, so it only ever met the things a
// canvas gesture makes: a wand click, a lasso loop, a marquee drag. Moving it
// into the Review panel (Review → Combine) puts it beside the Reselect list,
// where the other kind of thing you can point at lives — a placed text box or
// shape. So the standing mode has to mean something for those too, and the
// cheapest true answer is that an object is one more producer: it hands the
// engine a region, and New / Add / Subtract / Intersect do to it exactly what
// they do to a marquee.
//
// WHICH REGION. The object's FOOTPRINT — its bounding box, as an axis-aligned
// rect, or the ellipse inscribed in it for the two round kinds. Not its ink.
// That is the same decision `useCopyRegionAction` already states for the same
// objects ("Still bounding-rect, NOT mask-shaped"), and keeping the two the
// same means Ctrl+C over a shape and Combine on that shape's row agree about
// what the shape covers.
//
// WHY IT REACHES THE ENGINE AS `rect_select` / `ellipse_select` AND NOT AS A
// NEW EXPORT. Those two producers already exist, already snap and clamp the
// rect, and already route their mask through `set_selection_combine` — which
// is the whole of what Combine needs. A dedicated `object_select` in Rust
// would be tidier by one history label (see below) and would move the wasm
// byte count, which costs the release its `netlify.toml` hash assertion
// (ADR-046) for a cosmetic gain. So this module is deliberately TS-only, and
// it adds NO new geometry rule: every number below is read straight off the
// engine's own `get_shape_annotations` / text-annotation JSON.
//
// KNOWN, ACCEPTED: in New-selection mode the History step reads "Marquee",
// because that is the label `rect_select` passes. In the other three modes the
// engine names the step after the MODE ("Add Selection", …) so they read
// correctly already. The fix is a producer of its own in Rust, on the next
// session that rebuilds the wasm for another reason.

/** Which placed object — the (kind-space, id) pair the Reselect list and the
 *  engine both speak. Text and shape ids are separate id-spaces, so the type
 *  is half the identity. */
export interface ObjectRef {
  type: "text" | "shape";
  id: number;
}

/** Which of the engine's two marquee producers rasterizes a footprint.
 *  `rect_select` and `ellipse_select` take the same four corners. */
export type MarqueeProducer = "rect" | "ellipse";

/** An object's footprint, in IMAGE pixels — the corners a marquee producer
 *  takes, plus which producer it is. Any corner order is fine (the engine
 *  normalizes), but these come out already ordered. */
export interface ObjectFootprint {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  producer: MarqueeProducer;
}

/** The fields of a shape annotation a footprint needs. A subset of
 *  `get_shape_annotations()`'s JSON, so nothing here is re-derived. */
export interface ShapeFootprintGeometry {
  kind: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stroke_width: number;
}

/** The fields of a text annotation a footprint needs — the same ones the
 *  canvas hover highlight reads (`AppShell`'s `annotationBoxes`), so the box
 *  Combine selects is the box the hover outlined. */
export interface TextFootprintGeometry {
  x: number;
  y: number;
  tile_w: number;
  tile_h: number;
  tile_offset_x: number;
  tile_offset_y: number;
}

/** The two round kinds: 1 = circle, 3 = the legacy hand-drawn circle
 *  (drawing.rs:742). Both are drawn as the ellipse inscribed in the bbox, so
 *  both take `ellipse_select` and a circle's selection is round rather than
 *  the square that contains it. Everything else — rect, line, arrow,
 *  polyline, pin, bézier, diamond, star — takes its box. A diamond and a star
 *  are polygons the engine has no producer for; their box is honest about
 *  being a box rather than pretending to trace them. */
const ELLIPSE_KINDS = new Set([1, 3]);

/**
 * Half the ink a stroke puts OUTSIDE the path, in px.
 *
 * A stroke straddles its path, so a shape's ink reaches half a stroke width
 * past the bbox on every side — the same reason Rust pads a shape's tile
 * (`shape_ink_pad`). The floor of ½ px matters for a different reason: a
 * horizontal line has y0 === y1, and `rect_select` snaps outward from a
 * zero-height rect to a zero-height mask, which in New mode is Photoshop's
 * empty-marquee DESELECT. Combining a line would have cleared the selection.
 */
function inkPad(strokeWidth: number): number {
  return Math.max(strokeWidth / 2, 0.5);
}

/** The footprint of a placed shape. Never null: every shape has a bbox, and
 *  the stroke pad keeps a line or a zero-area shape from collapsing. */
export function shapeFootprint(s: ShapeFootprintGeometry): ObjectFootprint {
  const pad = inkPad(s.stroke_width);
  return {
    x0: Math.min(s.x0, s.x1) - pad,
    y0: Math.min(s.y0, s.y1) - pad,
    x1: Math.max(s.x0, s.x1) + pad,
    y1: Math.max(s.y0, s.y1) + pad,
    producer: ELLIPSE_KINDS.has(s.kind) ? "ellipse" : "rect",
  };
}

/** The footprint of a placed text box — its baked tile, unpadded: the tile IS
 *  the ink bounds, and growing it would select background the glyphs never
 *  touched. `null` for a tile with no area (a box that has not rendered yet),
 *  because selecting nothing is not what a click on that row asks for. */
export function textFootprint(a: TextFootprintGeometry): ObjectFootprint | null {
  if (!(a.tile_w > 0) || !(a.tile_h > 0)) return null;
  const x = a.x + a.tile_offset_x;
  const y = a.y + a.tile_offset_y;
  return { x0: x, y0: y, x1: x + a.tile_w, y1: y + a.tile_h, producer: "rect" };
}

/**
 * The engine surface a footprint lookup needs. Narrow on purpose, the way
 * `annotationHitTest`'s `LayerAnnotationSource` is: it keeps this module
 * unit-testable with a plain object, and it documents exactly what a click on
 * a Combine row costs — one JSON read of the active layer's annotations.
 */
export interface AnnotationSource {
  get_shape_annotations(): string | Promise<string>;
  get_text_annotations(): string | Promise<string>;
}

const parse = <T,>(raw: string): T[] => {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * The footprint of the object `ref` names, read from the engine at click time.
 *
 * WHY IT ASKS THE ENGINE rather than taking the geometry off the Reselect row:
 * the row is a label and an id, and the panel's copy of the annotation list is
 * refreshed on history changes — so a row that has not re-rendered since a
 * nudge, an undo or a placement would combine the box the shape USED to have.
 * The engine is the only copy that cannot be stale, and one JSON read per
 * click is not a cost worth trading correctness for.
 *
 * `null` when the id matches nothing (deleted between render and click, or on
 * another layer — both getters are active-layer scoped) or when the object has
 * no area yet. Combining nothing is never what a click asked for, so the
 * caller does nothing rather than clearing the selection.
 */
export async function objectFootprint(
  src: AnnotationSource,
  ref: ObjectRef,
): Promise<ObjectFootprint | null> {
  if (ref.type === "shape") {
    const shapes = parse<ShapeFootprintGeometry & { id: number }>(
      await src.get_shape_annotations(),
    );
    const s = shapes.find((x) => x.id === ref.id);
    return s ? shapeFootprint(s) : null;
  }
  const texts = parse<TextFootprintGeometry & { id: number }>(
    await src.get_text_annotations(),
  );
  const a = texts.find((x) => x.id === ref.id);
  return a ? textFootprint(a) : null;
}
