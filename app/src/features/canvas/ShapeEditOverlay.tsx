// The Shapes tool's live edit box — preview, dashed bbox, move/resize/rotate
// handles — for a shape or arrow that is drawn but not yet committed.
//
// Lifted out of CanvasArea when rotation landed (the Perspective precedent:
// a feature that doubles a block inside that file moves the block out and
// lowers the file's max-lines cap in the same change). Behavior is unchanged
// apart from what rotation added; the geometry math lives in
// lib/shapeRotation.ts so it can be tested without a DOM.
//
// ── Shape/arrow edit overlay: SVG preview + dashed bbox + handles ──
// Rendered while a drawn shape/arrow is pending (Figma-style edit
// box). All sizes for grab targets are in SCREEN px so handles stay
// grabbable at any zoom; geometry maps through the canvas rect like
// the crop/text overlays. The preview is clipped to the canvas box
// to match Rust's raster clipping at commit.
import React, { useCallback, useEffect, useRef } from "react";
import { pendingShapeType } from "@/hooks/useDrawingTools";
import type { DrawEditState, Point } from "@/hooks/useDrawingTools";
import { lockAxisDelta, lockPointToAxis, lockScaleFactors } from "@/lib/aspectLock";
import type { ShapeName } from "@/lib/types";
import {
  closedOutline,
  shapeWobbleSeed,
  sloppyCirclePoints,
  sloppyPolylinePoints,
} from "@/lib/shapeSloppiness";
import {
  boxCenter,
  pinAfterResize,
  rotateSegment,
  rotatedResizeCursor,
  rotationAfterDrag,
  toLocalDelta,
} from "@/lib/shapeRotation";
import { useToolStore } from "@/stores/useToolStore";
import { ROTATE_CURSOR } from "./rotateCursor";

/** Live stroke/shape settings — read at render so panel tweaks update the
 *  pending shape immediately (same values commitEdit reads at commit). */
export interface ShapeDrawSettings {
    strokeColor: string;
    strokeWidth: number;
    arrowStyle: "single" | "double";
    shape: ShapeName;
    /** Stroke sloppiness 0-100 (how hand-drawn the outline is), read live so
     *  a panel tweak while the overlay is open immediately rewobbles it. */
    sloppiness: number;
    fillMode: "none" | "solid" | "gradient" | "pixelate";
    fillColor: string;
    fillColor2: string;
    gradientAngle: number;
}

/**
 * Arrow geometry in canvas coords — shaft endpoints plus head triangle(s).
 * Mirrors the math in `drawArrowPreview` (useDrawingTools) and Rust's
 * `drawing::draw_arrow`, so the SVG overlay matches the committed pixels.
 */
function arrowGeometry(
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
function sloppyShapePath(
  from: Point,
  to: Point,
  shape: ShapeName,
  sloppiness: number,
  strokeWidth: number,
  toSX: (x: number) => number,
  toSY: (y: number) => number,
  starPoints?: number,
): string {
  const seed = shapeWobbleSeed(from.x, from.y, to.x, to.y);
  // rect / diamond / star / triangle share one outline source with the
  // canvas rubber band (`closedOutline`), so a new polygon is one case there.
  const outline = closedOutline(shape, from, to, starPoints);
  let pts;
  switch (shape) {
    case "rect":
    case "diamond":
    case "star":
    case "triangle":
      pts = outline ? sloppyPolylinePoints(outline, seed, sloppiness, strokeWidth, true) : [];
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

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawEditState: DrawEditState;
  drawSettings: ShapeDrawSettings;
  /** Handle drags push new geometry (canvas coords) up through this.
   *  `rotation` rides along only from the rotate handle. */
  onDrawEditChange?: (start: Point, end: Point, rotation?: number) => void;
}

export function ShapeEditOverlay({
  canvasRef,
  drawEditState,
  drawSettings,
  onDrawEditChange,
}: Props) {
  // Read here rather than threaded through `drawSettings`, which AppShell
  // builds — and AppShell is being dismantled, not extended.
  const liveStarPoints = useToolStore((s) => s.toolSettings.starPoints);

  // ── Shape/arrow edit-overlay drag ──────────────────────────────────
  // Same window-listener pattern as the crop handles. Geometry math is
  // plain JS (trivial); Rust does all pixel rendering at commit.
  const drawDragRef = useRef<{
    mode: "resize" | "move" | "endpoint" | "rotate";
    /** resize: nw|n|ne|e|se|s|sw|w · endpoint: start|end · move: body ·
     *  rotate: "shape" (turns `rotation`) or "segment" (turns a line's
     *  endpoints — see lib/shapeRotation.ts) */
    handle: string;
    startX: number;
    startY: number;
    startGeom: { sx: number; sy: number; ex: number; ey: number };
    scaleX: number;
    scaleY: number;
    /** The shape's rotation when the drag began (degrees). */
    startRotation: number;
    /** Canvas rect origin at drag start — turns a client point into canvas
     *  px for the rotate handle, which needs a position, not a delta. */
    originX: number;
    originY: number;
  } | null>(null);

  const onDrawEditChangeRef = useRef(onDrawEditChange);
  useEffect(() => { onDrawEditChangeRef.current = onDrawEditChange; });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = drawDragRef.current;
      const cb = onDrawEditChangeRef.current;
      if (!drag || !cb) return;
      let dx = (e.clientX - drag.startX) / drag.scaleX;
      let dy = (e.clientY - drag.startY) / drag.scaleY;
      const g = drag.startGeom;
      if (drag.mode === "rotate") {
        // Angle about the box center, in CANVAS px so a zoomed view turns
        // at the same rate as an unzoomed one.
        const c = boxCenter({ x: g.sx, y: g.sy }, { x: g.ex, y: g.ey });
        const toCanvas = (cx: number, cy: number) => ({
          x: (cx - drag.originX) / drag.scaleX,
          y: (cy - drag.originY) / drag.scaleY,
        });
        const grab = toCanvas(drag.startX, drag.startY);
        const now = toCanvas(e.clientX, e.clientY);
        if (drag.handle === "segment") {
          const turned = rotateSegment(
            { x: g.sx, y: g.sy },
            { x: g.ex, y: g.ey },
            rotationAfterDrag(c, grab, now, 0, e.shiftKey),
          );
          cb(turned.start, turned.end);
        } else {
          cb(
            { x: g.sx, y: g.sy },
            { x: g.ex, y: g.ey },
            rotationAfterDrag(c, grab, now, drag.startRotation, e.shiftKey),
          );
        }
        return;
      }
      if (drag.mode === "move") {
        // Translate the whole geometry. Shift constrains the drag to
        // whichever axis (horizontal/vertical) is moving more.
        const { dx: mdx, dy: mdy } = e.shiftKey
          ? lockAxisDelta(dx, dy)
          : { dx, dy };
        cb({ x: g.sx + mdx, y: g.sy + mdy }, { x: g.ex + mdx, y: g.ey + mdy });
        return;
      }
      if (drag.mode === "endpoint") {
        // Re-angle a line/arrow by dragging one endpoint freely. Shift
        // snaps the resulting angle (relative to the fixed endpoint) to
        // the nearest 90° — lets an arrow go cleanly left/right/up/down.
        if (drag.handle === "start") {
          const free = { x: g.sx + dx, y: g.sy + dy };
          const p = e.shiftKey
            ? lockPointToAxis(g.ex, g.ey, free.x, free.y)
            : free;
          cb(p, { x: g.ex, y: g.ey });
        } else {
          const free = { x: g.ex + dx, y: g.ey + dy };
          const p = e.shiftKey
            ? lockPointToAxis(g.sx, g.sy, free.x, free.y)
            : free;
          cb({ x: g.sx, y: g.sy }, p);
        }
        return;
      }
      // Resize: scale both endpoints about the bbox side(s) opposite the
      // dragged handle. Corner handles scale both axes, edge handles one.
      // Degenerate axes (perfectly horizontal/vertical segments) keep
      // scale 1 — the endpoint circles re-angle those instead.
      //
      // A TURNED box resizes in its own frame: the pointer delta is read
      // along the box's axes, and the result is shifted back so the edge
      // opposite the handle stays put on screen (`pinAfterResize`).
      if (drag.startRotation) {
        ({ dx, dy } = toLocalDelta(dx, dy, drag.startRotation));
      }
      const x0 = Math.min(g.sx, g.ex);
      const y0 = Math.min(g.sy, g.ey);
      const x1 = Math.max(g.sx, g.ex);
      const y1 = Math.max(g.sy, g.ey);
      const MIN = 2; // canvas px — don't let the bbox collapse or flip
      const h = drag.handle;
      let kx = 1;
      let ax = x0;
      if (h.includes("w")) {
        ax = x1;
        if (x1 - x0 > 0.5) kx = Math.max(MIN, x1 - (x0 + dx)) / (x1 - x0);
      } else if (h.includes("e")) {
        ax = x0;
        if (x1 - x0 > 0.5) kx = Math.max(MIN, x1 + dx - x0) / (x1 - x0);
      }
      let ky = 1;
      let ay = y0;
      if (h.includes("n")) {
        ay = y1;
        if (y1 - y0 > 0.5) ky = Math.max(MIN, y1 - (y0 + dy)) / (y1 - y0);
      } else if (h.includes("s")) {
        ay = y0;
        if (y1 - y0 > 0.5) ky = Math.max(MIN, y1 + dy - y0) / (y1 - y0);
      }
      // Shift-lock only makes sense on corner handles — edge handles leave
      // one of kx/ky at exactly 1 by construction above, and forcing it
      // toward the other would pull a single-axis drag off its own axis.
      if (e.shiftKey && h.length === 2) {
        ({ kx, ky } = lockScaleFactors(kx, ky));
      }
      const pinned = pinAfterResize(
        { x: g.sx, y: g.sy },
        { x: g.ex, y: g.ey },
        { x: ax + (g.sx - ax) * kx, y: ay + (g.sy - ay) * ky },
        { x: ax + (g.ex - ax) * kx, y: ay + (g.ey - ay) * ky },
        drag.startRotation,
      );
      cb(pinned.start, pinned.end);
    };
    const onUp = () => { drawDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const handleDrawPointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      mode: "resize" | "move" | "endpoint" | "rotate",
      handle: string,
    ) => {
      if (!drawEditState || !canvasRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      drawDragRef.current = {
        mode,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startGeom: {
          sx: drawEditState.start.x,
          sy: drawEditState.start.y,
          ex: drawEditState.end.x,
          ey: drawEditState.end.y,
        },
        scaleX: rect.width / canvas.width,
        scaleY: rect.height / canvas.height,
        startRotation: drawEditState.rotation ?? 0,
        originX: rect.left,
        originY: rect.top,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [drawEditState, canvasRef],
  );

  if (!canvasRef.current) return null;
  const canvas = canvasRef.current!;
  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width;
  const sy = r.height / canvas.height;
  const toSX = (x: number) => r.left + x * sx;
  const toSY = (y: number) => r.top + y * sy;

  const { start, end, kind } = drawEditState;
  // When re-editing an existing shape, render with its own captured
  // style rather than the live toolbar settings (a new shape has no
  // `style` and reads the toolbar).
  const eff = drawEditState.style ?? drawSettings;
  // Type comes from the shape itself, never from the live panel — same
  // rule the commit uses, so preview and pixels cannot disagree. See
  // `pendingShapeType`; reading `drawSettings.shape` here is what let a
  // Square click retype the circle already on the canvas.
  const shape =
    kind === "arrow"
      ? "line"
      : pendingShapeType(drawEditState, drawSettings.shape);
  const isSegment = kind === "arrow" || shape === "line";
  // Star point count: the reselected star's own, else the live panel.
  const starPoints = drawEditState.style?.starPoints ?? liveStarPoints;
  // Rotation. A line's lives in its endpoints (rotation stays 0), so
  // only the box shapes get a turned group. Pins (kind 5) and the
  // legacy hand circle (3) re-edit as circles but the engine does not
  // turn them, so they get no hook.
  const kindByte = drawEditState.style?.kindByte;
  const rotatable = kind !== "arrow" && kindByte !== 5 && kindByte !== 3;
  const deg = isSegment ? 0 : (drawEditState.rotation ?? 0);

  // Bounding box (canvas coords → viewport coords)
  const bx0 = Math.min(start.x, end.x);
  const by0 = Math.min(start.y, end.y);
  const bx1 = Math.max(start.x, end.x);
  const by1 = Math.max(start.y, end.y);
  const vx = toSX(bx0);
  const vy = toSY(by0);
  const vw = (bx1 - bx0) * sx;
  const vh = (by1 - by0) * sy;
  // Everything but the clip turns about the box center — the same
  // pivot the engine uses, so the preview and the commit agree.
  const turn = deg ? `rotate(${deg} ${vx + vw / 2} ${vy + vh / 2})` : undefined;

  const HS = 9;   // resize-square size — screen px, zoom-independent
  const EP_R = 6; // endpoint-circle radius — screen px
  const strokeW = Math.max(1, eff.strokeWidth * sx);
  const color = eff.strokeColor;
  // Sketchy outline? Read live so a panel tweak while the overlay is
  // open immediately rewobbles the preview. Mirrors the engine rule:
  // 0 → clean strokes, > 0 → the wobbly path generator.
  const sloppyAmt = eff.sloppiness ?? 0;
  const sloppy = sloppyAmt > 0;

  // Live interior-fill preview. `eff` is the shape's captured style on
  // reselect, or the live panel for a new shape — both carry fill, so
  // reselected rect/circles preview their fill too.
  const fillCfg = eff;
  let fillAttr = "none";
  let gradientDef: React.ReactNode = null;
  if (fillCfg && (shape === "rect" || shape === "circle")) {
    if (fillCfg.fillMode === "solid") {
      fillAttr = fillCfg.fillColor;
    } else if (fillCfg.fillMode === "gradient") {
      fillAttr = "url(#draw-fill-grad)";
      const ang = ((fillCfg.gradientAngle ?? 0) * Math.PI) / 180;
      const dx = 0.5 * Math.cos(ang);
      const dy = 0.5 * Math.sin(ang);
      gradientDef = (
        <defs>
          <linearGradient
            id="draw-fill-grad"
            x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}
          >
            <stop offset="0%" stopColor={fillCfg.fillColor} />
            <stop offset="100%" stopColor={fillCfg.fillColor2} />
          </linearGradient>
        </defs>
      );
    } else if (fillCfg.fillMode === "pixelate") {
      // A true live mosaic isn't practical in SVG — preview a checker
      // hint; the real pixelation is applied to the pixels on commit.
      fillAttr = "url(#draw-fill-pixelate)";
      gradientDef = (
        <defs>
          <pattern
            id="draw-fill-pixelate"
            width="8" height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="rgba(120,120,120,0.4)" />
            <rect width="4" height="4" fill="rgba(40,40,40,0.5)" />
            <rect x="4" y="4" width="4" height="4" fill="rgba(40,40,40,0.5)" />
          </pattern>
        </defs>
      );
    }
  }

  // Move handle (line + dot above the box) — same geometry as the
  // text overlay's "balloon string".
  const STEM_GAP = 4;
  const STEM_LEN = 18;
  const DOT_OFFSET = 4;
  const DOT_R = 5;

  const handles = [
    { id: "nw", hx: vx,          hy: vy,          cursor: "nw-resize" },
    { id: "n",  hx: vx + vw / 2, hy: vy,          cursor: "n-resize"  },
    { id: "ne", hx: vx + vw,     hy: vy,          cursor: "ne-resize" },
    { id: "e",  hx: vx + vw,     hy: vy + vh / 2, cursor: "e-resize"  },
    { id: "se", hx: vx + vw,     hy: vy + vh,     cursor: "se-resize" },
    { id: "s",  hx: vx + vw / 2, hy: vy + vh,     cursor: "s-resize"  },
    { id: "sw", hx: vx,          hy: vy + vh,     cursor: "sw-resize" },
    { id: "w",  hx: vx,          hy: vy + vh / 2, cursor: "w-resize"  },
  ];

  // Geometry preview + invisible body hit-area (drag body = move).
  const bodyProps = {
    style: { cursor: "move", pointerEvents: "all" } as React.CSSProperties,
    onPointerDown: (e: React.PointerEvent<SVGElement>) =>
      handleDrawPointerDown(e, "move", "body"),
  };
  let preview: React.ReactNode;
  let bodyHit: React.ReactNode;

  if (kind === "arrow") {
    const g = arrowGeometry(
      start,
      end,
      eff.strokeWidth,
      eff.arrowStyle === "double",
    );
    preview = (
      <>
        <line
          x1={toSX(g.shaftStart.x)} y1={toSY(g.shaftStart.y)}
          x2={toSX(g.shaftEnd.x)}   y2={toSY(g.shaftEnd.y)}
          stroke={color} strokeWidth={strokeW} strokeLinecap="round"
        />
        {g.heads.map((head, i) => (
          <polygon
            key={i}
            points={head.map((p) => `${toSX(p.x)},${toSY(p.y)}`).join(" ")}
            fill={color}
          />
        ))}
      </>
    );
    bodyHit = (
      <line
        x1={toSX(start.x)} y1={toSY(start.y)}
        x2={toSX(end.x)}   y2={toSY(end.y)}
        stroke="transparent" strokeWidth={Math.max(strokeW, 14)}
        {...bodyProps}
      />
    );
  } else if (shape === "line") {
    const strokeLayer = sloppy ? (
      <path
        d={sloppyShapePath(start, end, "line", sloppyAmt, eff.strokeWidth, toSX, toSY)}
        fill="none" stroke={color} strokeWidth={strokeW}
        strokeLinecap="round"
      />
    ) : (
      <line
        x1={toSX(start.x)} y1={toSY(start.y)}
        x2={toSX(end.x)}   y2={toSY(end.y)}
        stroke={color} strokeWidth={strokeW} strokeLinecap="round"
      />
    );
    preview = strokeLayer;
    bodyHit = (
      <line
        x1={toSX(start.x)} y1={toSY(start.y)}
        x2={toSX(end.x)}   y2={toSY(end.y)}
        stroke="transparent" strokeWidth={Math.max(strokeW, 14)}
        {...bodyProps}
      />
    );
  } else if (shape === "circle") {
    // Rust parity: radius = half the SHORTER bbox dimension.
    const cr = (Math.min(bx1 - bx0, by1 - by0) / 2) * sx;
    const ccx = vx + vw / 2;
    const ccy = vy + vh / 2;
    // Fill stays a clean circle of that same radius; only the STROKE
    // roams, and it now roams around the SAME circle (it used to wobble
    // around the bbox ellipse, so fill and outline disagreed).
    const fillLayer = (
      <circle cx={ccx} cy={ccy} r={cr} fill={fillAttr} />
    );
    // An empty sketchy path means the circle is too small to wobble;
    // fall back to the clean arc, which is what the engine does.
    const sloppyD = sloppy
      ? sloppyShapePath(start, end, "circle", sloppyAmt, eff.strokeWidth, toSX, toSY)
      : "";
    const strokeLayer = sloppyD ? (
      <path
        d={sloppyD}
        fill="none" stroke={color} strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round"
      />
    ) : (
      <circle cx={ccx} cy={ccy} r={cr} fill="none" stroke={color} strokeWidth={strokeW} />
    );
    preview = (
      <>
        {gradientDef}
        {fillLayer}
        {strokeLayer}
      </>
    );
    bodyHit = (
      <circle cx={ccx} cy={ccy} r={Math.max(cr, 8)} fill="transparent" {...bodyProps} />
    );
  } else if (shape === "diamond" || shape === "star" || shape === "triangle") {
    // Outline-only (the engine fills only kinds 0/1). Firm → clean
    // polygon over the exact vertex list Rust rasterises; sketchy →
    // the same vertices pushed through the wobble path generator.
    const verts = closedOutline(shape, start, end, starPoints) ?? [];
    const pts = verts.map((p) => `${toSX(p.x)},${toSY(p.y)}`).join(" ");
    const strokeLayer = sloppy ? (
      <path
        d={sloppyShapePath(start, end, shape, sloppyAmt, eff.strokeWidth, toSX, toSY, starPoints)}
        fill="none" stroke={color} strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round"
      />
    ) : (
      <polygon
        points={pts}
        fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round"
      />
    );
    preview = strokeLayer;
    bodyHit = (
      <rect x={vx} y={vy} width={vw} height={vh} fill="transparent" {...bodyProps} />
    );
  } else {
    // rect
    const fillLayer = (
      <rect x={vx} y={vy} width={vw} height={vh} fill={fillAttr} />
    );
    const strokeLayer = sloppy ? (
      <path
        d={sloppyShapePath(start, end, "rect", sloppyAmt, eff.strokeWidth, toSX, toSY)}
        fill="none" stroke={color} strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round"
      />
    ) : (
      <rect
        x={vx} y={vy} width={vw} height={vh}
        fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round"
      />
    );
    preview = (
      <>
        {gradientDef}
        {fillLayer}
        {strokeLayer}
      </>
    );
    bodyHit = (
      <rect x={vx} y={vy} width={vw} height={vh} fill="transparent" {...bodyProps} />
    );
  }

  // A circle's ink does not turn unless a gradient shows it — the
  // engine draws an upright circle for every other fill (a circle is
  // the same at any angle), so the preview must too or a sketchy
  // circle's wobble would jump on commit.
  const inkTurn =
    shape === "circle" && fillCfg?.fillMode !== "gradient" ? undefined : turn;

  // Rotate hook: arc + stem + dot BELOW the box — the move handle's
  // mirror image, and the same glyph the text box uses.
  const HOOK_GAP = 4;
  const HOOK_ARC_R = 6;
  const HOOK_STEM = 16;

  return (
    <svg
      data-draw-overlay
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 45,
        overflow: "hidden",
      }}
    >
      <defs>
        <clipPath id="draw-edit-clip">
          <rect x={r.left} y={r.top} width={r.width} height={r.height} />
        </clipPath>
      </defs>
      {/* Live preview, clipped to the canvas box. The clip sits OUTSIDE
          the turn: a clipPath is read in the user space of whatever
          references it, so inside the rotation it would turn too. */}
      <g clipPath="url(#draw-edit-clip)">
        <g transform={inkTurn}>{preview}</g>
      </g>

      <g transform={turn}>
        {/* Dashed bounding box */}
        <rect
          x={vx} y={vy} width={vw} height={vh}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* Body hit-area — drag anywhere on the shape to move it */}
        {bodyHit}

        {/* Move handle: vertical line + dot above the box (same markup
            as the text overlay's move handle) */}
        {(() => {
          const cx = vx + vw / 2;
          const stemTop = vy - STEM_GAP;
          const stemBot = stemTop - STEM_LEN;
          const dotCy = stemBot - DOT_OFFSET;
          const filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
          return (
            <g
              style={{ cursor: "move", pointerEvents: "all", filter }}
              onPointerDown={(e) => handleDrawPointerDown(e, "move", "body")}
            >
              {/* Invisible fat hit target for easier grabbing */}
              <rect
                x={cx - 8}
                y={dotCy - DOT_R - 2}
                width={16}
                height={vy - (dotCy - DOT_R - 2)}
                fill="transparent"
              />
              <line x1={cx} y1={stemTop} x2={cx} y2={stemBot} stroke="white" strokeWidth={2} />
              <circle cx={cx} cy={dotCy} r={DOT_R} fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
            </g>
          );
        })()}

        {/* Rotate hook — every rotatable shape. Drag to turn about the
            box center; Shift snaps to 15°. A line turns its endpoints. */}
        {rotatable && (() => {
          const cx = vx + vw / 2;
          const bottom = vy + vh;
          const arcTop = bottom + HOOK_GAP;
          const stemTop = arcTop + HOOK_ARC_R;
          const stemBot = stemTop + HOOK_STEM - HOOK_ARC_R;
          const dotCy = stemBot + DOT_OFFSET;
          const filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
          const arcD = `M ${cx - HOOK_ARC_R} ${arcTop} A ${HOOK_ARC_R} ${HOOK_ARC_R} 0 1 0 ${cx + HOOK_ARC_R} ${arcTop}`;
          return (
            <g
              data-shape-rotate-handle
              style={{ cursor: ROTATE_CURSOR, pointerEvents: "all", filter }}
              onPointerDown={(e) =>
                handleDrawPointerDown(e, "rotate", isSegment ? "segment" : "shape")
              }
            >
              {/* Invisible fat hit target */}
              <rect
                x={cx - 10}
                y={bottom}
                width={20}
                height={dotCy + DOT_R + 2 - bottom}
                fill="transparent"
              />
              <path d={arcD} fill="none" stroke="white" strokeWidth={2} />
              <line x1={cx} y1={stemTop} x2={cx} y2={stemBot} stroke="white" strokeWidth={2} />
              <circle cx={cx} cy={dotCy} r={DOT_R} fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
            </g>
          );
        })()}

        {/* Resize squares — corners scale both axes, edges one axis.
            The cursor turns with the box so it points across the edge. */}
        {handles.map((h) => (
          <rect
            key={h.id}
            x={h.hx - HS / 2} y={h.hy - HS / 2}
            width={HS} height={HS}
            fill="white"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={1}
            rx={1}
            style={{ cursor: deg ? rotatedResizeCursor(h.id, deg) : h.cursor, pointerEvents: "all" }}
            onPointerDown={(e) => handleDrawPointerDown(e, "resize", h.id)}
          />
        ))}
      </g>

      {/* Endpoint circles — line/arrow only: drag to re-angle the
          segment. Never inside the turn: a segment's angle IS its
          endpoints, so it has no rotation to be drawn inside. */}
      {isSegment && (
        <>
          <circle
            cx={toSX(start.x)} cy={toSY(start.y)} r={EP_R}
            fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1.5}
            style={{ cursor: "crosshair", pointerEvents: "all" }}
            onPointerDown={(e) => handleDrawPointerDown(e, "endpoint", "start")}
          />
          <circle
            cx={toSX(end.x)} cy={toSY(end.y)} r={EP_R}
            fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1.5}
            style={{ cursor: "crosshair", pointerEvents: "all" }}
            onPointerDown={(e) => handleDrawPointerDown(e, "endpoint", "end")}
          />
        </>
      )}
    </svg>
  );
}
