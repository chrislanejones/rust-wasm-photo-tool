// The shape/arrow edit box (Figma-style handles over a pending shape) — moved out of CanvasArea verbatim (B4,
// docs/AppShell-Refactor-Plan.md), the way PerspectiveLayer.tsx did before it:
// the drag state, the window pointer listeners, and the overlay they drive.
//
// The state it edits is not local: `useDrawingTools` (`editState`) owns it and this
// reads it through the session context, so CanvasArea mounts this with no
// props. The overlay maps image px through `getBoundingClientRect()` at render,
// so it relies on re-rendering whenever CanvasArea does (pan, zoom, resize) —
// which holds because neither component is memoized (see the note at the top
// of CanvasArea's body).
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSession } from "@/app/session/SessionContext";
import { useToolStore } from "@/stores/useToolStore";
import { pendingShapeType } from "@/hooks/useDrawingTools";
import { lockAxisDelta, lockPointToAxis, lockScaleFactors } from "@/lib/aspectLock";
import type { ShapeName } from "@/lib/types";
import { diamondVertices, starVertices } from "@/lib/shapeSloppiness";
import { arrowGeometry, sloppyShapePath } from "./shapeOverlayPath";
import { EDIT_BOX_STROKE, HANDLE_OUTLINE, HANDLE_SHADOW } from "./canvasInk";

export function ShapeEditLayer() {
  const { canvasRef, drawingTools } = useSession();
  const { editState: drawEditState, updateEditGeometry: onDrawEditChange } = drawingTools;
  const toolSettings = useToolStore((s) => s.toolSettings);
  // Live stroke/shape settings — read at render so panel tweaks update the
  // pending shape immediately (same values commitEdit reads at commit).
  const drawSettings = useMemo(
    () => ({
      strokeColor: toolSettings.strokeColor,
      strokeWidth: toolSettings.strokeWidth,
      arrowStyle: toolSettings.arrowStyle,
      shape: (toolSettings.shape ?? "rect") as ShapeName,
      // Stroke sloppiness 0-100, read live so a panel tweak while the
      // overlay is open immediately rewobbles it.
      sloppiness: toolSettings.sloppiness ?? 0,
      fillMode: toolSettings.fillMode,
      fillColor: toolSettings.fillColor,
      fillColor2: toolSettings.fillColor2,
      gradientAngle: toolSettings.gradientAngle,
    }),
    [toolSettings],
  );

  // ── Shape/arrow edit-overlay drag ──────────────────────────────────
  // Same window-listener pattern as the crop handles. Geometry math is
  // plain JS (trivial); Rust does all pixel rendering at commit.
  const drawDragRef = useRef<{
    mode: "resize" | "move" | "endpoint";
    /** resize: nw|n|ne|e|se|s|sw|w · endpoint: start|end · move: body */
    handle: string;
    startX: number;
    startY: number;
    startGeom: { sx: number; sy: number; ex: number; ey: number };
    scaleX: number;
    scaleY: number;
  } | null>(null);

  const onDrawEditChangeRef = useRef(onDrawEditChange);
  useEffect(() => { onDrawEditChangeRef.current = onDrawEditChange; });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = drawDragRef.current;
      const cb = onDrawEditChangeRef.current;
      if (!drag || !cb) return;
      const dx = (e.clientX - drag.startX) / drag.scaleX;
      const dy = (e.clientY - drag.startY) / drag.scaleY;
      const g = drag.startGeom;
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
      cb(
        { x: ax + (g.sx - ax) * kx, y: ay + (g.sy - ay) * ky },
        { x: ax + (g.ex - ax) * kx, y: ay + (g.ey - ay) * ky },
      );
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
      mode: "resize" | "move" | "endpoint",
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
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [drawEditState, canvasRef],
  );

  return (
    <>
      {/* ── Shape/arrow edit overlay: SVG preview + dashed bbox + handles ──
          Rendered while a drawn shape/arrow is pending (Figma-style edit
          box). All sizes for grab targets are in SCREEN px so handles stay
          grabbable at any zoom; geometry maps through the canvas rect like
          the crop/text overlays. The preview is clipped to the canvas box
          to match Rust's raster clipping at commit. */}
      {drawEditState && drawSettings && canvasRef.current && (() => {
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

        // Bounding box (canvas coords → viewport coords)
        const bx0 = Math.min(start.x, end.x);
        const by0 = Math.min(start.y, end.y);
        const bx1 = Math.max(start.x, end.x);
        const by1 = Math.max(start.y, end.y);
        const vx = toSX(bx0);
        const vy = toSY(by0);
        const vw = (bx1 - bx0) * sx;
        const vh = (by1 - by0) * sy;

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
        } else if (shape === "diamond" || shape === "star") {
          // Outline-only (the engine fills only kinds 0/1). Firm → clean
          // polygon over the exact vertex list Rust rasterises; sketchy →
          // the same vertices pushed through the wobble path generator.
          const verts =
            shape === "diamond"
              ? diamondVertices(start.x, start.y, end.x, end.y)
              : starVertices(start.x, start.y, end.x, end.y);
          const pts = verts.map((p) => `${toSX(p.x)},${toSY(p.y)}`).join(" ");
          const strokeLayer = sloppy ? (
            <path
              d={sloppyShapePath(start, end, shape, sloppyAmt, eff.strokeWidth, toSX, toSY)}
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
            {/* Live preview, clipped to the canvas box */}
            <g clipPath="url(#draw-edit-clip)">{preview}</g>

            {/* Dashed bounding box */}
            <rect
              x={vx} y={vy} width={vw} height={vh}
              fill="none"
              stroke={EDIT_BOX_STROKE}
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
              const filter = HANDLE_SHADOW;
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
                  <circle cx={cx} cy={dotCy} r={DOT_R} fill="white" stroke={HANDLE_OUTLINE} strokeWidth={1} />
                </g>
              );
            })()}

            {/* Resize squares — corners scale both axes, edges one axis */}
            {handles.map((h) => (
              <rect
                key={h.id}
                x={h.hx - HS / 2} y={h.hy - HS / 2}
                width={HS} height={HS}
                fill="white"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
                rx={1}
                style={{ cursor: h.cursor, pointerEvents: "all" }}
                onPointerDown={(e) => handleDrawPointerDown(e, "resize", h.id)}
              />
            ))}

            {/* Endpoint circles — line/arrow only: drag to re-angle the
                segment (the natural "rotate" for segments) */}
            {isSegment && (
              <>
                <circle
                  cx={toSX(start.x)} cy={toSY(start.y)} r={EP_R}
                  fill="white" stroke={HANDLE_OUTLINE} strokeWidth={1.5}
                  style={{ cursor: "crosshair", pointerEvents: "all" }}
                  onPointerDown={(e) => handleDrawPointerDown(e, "endpoint", "start")}
                />
                <circle
                  cx={toSX(end.x)} cy={toSY(end.y)} r={EP_R}
                  fill="white" stroke={HANDLE_OUTLINE} strokeWidth={1.5}
                  style={{ cursor: "crosshair", pointerEvents: "all" }}
                  onPointerDown={(e) => handleDrawPointerDown(e, "endpoint", "end")}
                />
              </>
            )}
          </svg>
        );
      })()}
    </>
  );
}
