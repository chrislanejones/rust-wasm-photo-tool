// Canvas2D rubber-band previews for the Shapes / Arrows tools. Moved out of
// useDrawingTools.ts unchanged: pure functions of a context and two points.
import type { ShapeName } from "@/lib/types";
import {
  closedOutline,
  hasRadius,
  shapeWobbleSeed,
  sloppyCirclePoints,
  sloppyOutlinePoints,
  sloppyPolylinePoints,
  type CornerRadii,
} from "@/lib/shapeSloppiness";

/* ------------------------------------------------------------------ */
/* JS preview functions (used during the initial rubber-band drag only).*/
/* These run on Canvas2D for real-time feedback. On mouseup the geometry */
/* becomes a DrawEditState (Figma-style overlay); the Rust commit happens */
/* in commitEdit via tool.add_shape_annotation / update_shape_annotation. */
/* ------------------------------------------------------------------ */

export function drawArrowPreview(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  width: number,
  style: "single" | "double",
) {
  const headLength = Math.max(20, width * 3);
  const headWidth = Math.PI / 5;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const endX = to.x - headLength * 0.5 * Math.cos(angle);
  const endY = to.y - headLength * 0.5 * Math.sin(angle);
  const startX =
    style === "double" ? from.x + headLength * 0.5 * Math.cos(angle) : from.x;
  const startY =
    style === "double" ? from.y + headLength * 0.5 * Math.sin(angle) : from.y;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const drawHead = (x: number, y: number, a: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - headLength * Math.cos(a - headWidth),
      y - headLength * Math.sin(a - headWidth),
    );
    ctx.lineTo(
      x - headLength * Math.cos(a + headWidth),
      y - headLength * Math.sin(a + headWidth),
    );
    ctx.closePath();
    ctx.fill();
  };

  drawHead(to.x, to.y, angle);
  if (style === "double") drawHead(from.x, from.y, angle + Math.PI);
}

export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  shape: ShapeName,
  color: string,
  width: number,
  sloppiness: number,
  starPoints: number,
  cornerRadii?: CornerRadii,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  // rect / diamond / star / triangle — the exact vertex list Rust strokes.
  const outline = closedOutline(shape, from, to, starPoints, cornerRadii);
  const rounded = hasRadius(cornerRadii);

  if (sloppiness > 0) {
    // Mirrors Rust: at sloppiness > 0 EVERY shape routes through the
    // sketchy path generator so the preview and the committed pixels match
    // (draw_shape, drawing.rs). Firm shapes (0) take the clean branches below.
    const seed = shapeWobbleSeed(from.x, from.y, to.x, to.y);
    const pts = outline
      ? sloppyOutlinePoints(outline, rounded, seed, sloppiness, width)
      : shape === "circle"
        ? sloppyCirclePoints(from, to, sloppiness, width)
        : sloppyPolylinePoints(
            [
              { x: from.x, y: from.y },
              { x: to.x, y: to.y },
            ],
            seed,
            sloppiness,
            width,
            false,
          );
    if (pts && pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      return;
    }
    // No sketchy path (a circle too small to wobble) — fall through to the
    // clean branches, which is what the engine does.
  }

  ctx.beginPath();
  if (outline) {
    ctx.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i].x, outline[i].y);
    ctx.closePath();
    ctx.stroke();
  } else if (shape === "circle") {
    const r = Math.min(w, h) / 2;
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
}
