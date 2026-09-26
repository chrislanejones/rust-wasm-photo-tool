// Pure geometry for the shape / arrow edit overlay's SVG preview. Moved out of
// CanvasArea.tsx unchanged: functions of points and a shape name, no React.
import type { Point } from "@/lib/shapeSloppiness";
import type { ShapeName } from "@/lib/types";
import {
  diamondVertices,
  shapeWobbleSeed,
  sloppyCirclePoints,
  sloppyPolylinePoints,
  starVertices,
} from "@/lib/shapeSloppiness";

/**
 * Arrow geometry in canvas coords — shaft endpoints plus head triangle(s).
 * Mirrors the math in `drawArrowPreview` (useDrawingTools) and Rust's
 * `drawing::draw_arrow`, so the SVG overlay matches the committed pixels.
 */
export function arrowGeometry(
  from: Point,
  to: Point,
  strokeWidth: number,
  double: boolean,
): { shaftStart: Point; shaftEnd: Point; heads: Point[][] } {
  const headLength = Math.max(20, strokeWidth * 3);
  const headWidth = Math.PI / 5;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const shaftEnd = {
    x: to.x - headLength * 0.5 * Math.cos(angle),
    y: to.y - headLength * 0.5 * Math.sin(angle),
  };
  const shaftStart = double
    ? {
        x: from.x + headLength * 0.5 * Math.cos(angle),
        y: from.y + headLength * 0.5 * Math.sin(angle),
      }
    : { x: from.x, y: from.y };
  const head = (tip: Point, a: number): Point[] => [
    tip,
    {
      x: tip.x - headLength * Math.cos(a - headWidth),
      y: tip.y - headLength * Math.sin(a - headWidth),
    },
    {
      x: tip.x - headLength * Math.cos(a + headWidth),
      y: tip.y - headLength * Math.sin(a + headWidth),
    },
  ];
  return {
    shaftStart,
    shaftEnd,
    heads: double ? [head(to, angle), head(from, angle + Math.PI)] : [head(to, angle)],
  };
}

/**
 * SVG path for the sketchy shape preview (sloppiness > 0). Built from the
 * same `shapeSloppiness` helpers `drawShapePreview` and the Rust engine use,
 * so the overlay preview and the committed pixels are the same path
 * (mirrors `sloppy_polyline_points` / `draw_sloppy_circle`, drawing.rs).
 * `toSX`/`toSY` map canvas coords to screen so the path tracks zoom/pan.
 * `strokeWidth` is in IMAGE pixels (it floors the wobble, so the preview and
 * the engine must be handed the same units).
 */
export function sloppyShapePath(
  from: Point,
  to: Point,
  shape: ShapeName,
  sloppiness: number,
  strokeWidth: number,
  toSX: (x: number) => number,
  toSY: (y: number) => number,
): string {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  const seed = shapeWobbleSeed(from.x, from.y, to.x, to.y);
  let pts;
  switch (shape) {
    case "rect":
      pts = sloppyPolylinePoints(
        [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ],
        seed,
        sloppiness,
        strokeWidth,
        true,
      );
      break;
    case "diamond":
      pts = sloppyPolylinePoints(
        diamondVertices(from.x, from.y, to.x, to.y),
        seed,
        sloppiness,
        strokeWidth,
        true,
      );
      break;
    case "star":
      pts = sloppyPolylinePoints(
        starVertices(from.x, from.y, to.x, to.y),
        seed,
        sloppiness,
        strokeWidth,
        true,
      );
      break;
    case "line":
      pts = sloppyPolylinePoints(
        [
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        ],
        seed,
        sloppiness,
        strokeWidth,
        false,
      );
      break;
    case "circle":
      pts = sloppyCirclePoints(from, to, sloppiness, strokeWidth);
      break;
  }
  if (!pts || pts.length === 0) return "";
  return pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${toSX(p.x).toFixed(2)} ${toSY(p.y).toFixed(2)}`,
    )
    .join(" ");
}
