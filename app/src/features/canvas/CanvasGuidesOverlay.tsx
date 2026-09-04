// Non-destructive canvas guides: the configurable grid (geometry computed in
// Rust via `grid_lines`, see lib/gridGeometry.ts) and top/left pixel rulers.
// Rendered as a fixed full-viewport SVG, projecting image-space → screen-space
// the same way the crop overlay does (`rect` + scale from the canvas element),
// so it tracks zoom and pan automatically.
import { niceStep, tickLabel } from "@/lib/rulerTicks";
import type { RulerUnit } from "@/lib/preferences";
import { useMemo, type ReactElement } from "react";

/** The subset of preferences that drives the canvas guides. */
export interface CanvasGuides {
  rulers: boolean;
  /** Tick label unit. Optional so an older caller (or a persisted pref from
   *  before this existed) still renders — it falls back to "px". */
  rulerUnit?: RulerUnit;
  grid: boolean;
  gridColor: string;
  gridOpacity: number; // 0–100
}

interface Props {
  /** Live screen rect of the <canvas> (already reflects zoom + pan). */
  rect: DOMRect;
  /** Screen px per image px on each axis (= zoom). */
  sx: number;
  sy: number;
  imgW: number;
  imgH: number;
  guides: CanvasGuides;
  /** Image-space grid segments [x1,y1,x2,y2,…] from Rust (empty if grid off). */
  gridSegments: Float32Array;
}

const RULER = 20; // ruler strip thickness, screen px

export function CanvasGuidesOverlay({
  rect,
  sx,
  sy,
  imgW,
  imgH,
  guides,
  gridSegments,
}: Props) {
  const { left, top, width, height } = rect;

  // Grid lines, projected to screen space.
  const gridEls = useMemo(() => {
    if (!guides.grid || gridSegments.length < 4) return null;
    const n = gridSegments.length / 4;
    const els = new Array<ReactElement>(n);
    for (let i = 0; i < n; i++) {
      const x1 = left + gridSegments[i * 4] * sx;
      const y1 = top + gridSegments[i * 4 + 1] * sy;
      const x2 = left + gridSegments[i * 4 + 2] * sx;
      const y2 = top + gridSegments[i * 4 + 3] * sy;
      els[i] = (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={guides.gridColor} />
      );
    }
    return (
      <g
        strokeWidth={1}
        strokeOpacity={guides.gridOpacity / 100}
        shapeRendering="crispEdges"
      >
        {els}
      </g>
    );
  }, [guides.grid, guides.gridColor, guides.gridOpacity, gridSegments, left, top, sx, sy]);

  // Ruler ticks + labels.
  const rulerEls = useMemo(() => {
    if (!guides.rulers) return null;
    // Unit is a LENS, not a coordinate change: the steps come back in image
    // px whichever unit is chosen, so the projection below is untouched.
    const unit = guides.rulerUnit ?? "px";
    const stepX = niceStep(sx, 56, unit);
    const stepY = niceStep(sy, 56, unit);
    const ticks: ReactElement[] = [];

    // Top ruler — vertical ticks + value labels.
    for (let ix = 0; ix <= imgW + 0.5; ix += stepX) {
      const x = left + ix * sx;
      ticks.push(
        <line
          key={`tx${ix}`}
          x1={x}
          y1={top - 7}
          x2={x}
          y2={top}
          stroke="var(--text-muted)"
        />,
      );
      ticks.push(
        <text
          key={`tlx${ix}`}
          x={x + 2}
          y={top - 9}
          fontSize={9}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
        >
          {tickLabel(ix, unit, stepX)}
        </text>,
      );
    }
    // Left ruler — horizontal ticks + rotated value labels.
    for (let iy = 0; iy <= imgH + 0.5; iy += stepY) {
      const y = top + iy * sy;
      ticks.push(
        <line
          key={`ty${iy}`}
          x1={left - 7}
          y1={y}
          x2={left}
          y2={y}
          stroke="var(--text-muted)"
        />,
      );
      ticks.push(
        <text
          key={`tly${iy}`}
          x={left - 9}
          y={y - 2}
          fontSize={9}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
          transform={`rotate(-90 ${left - 9} ${y - 2})`}
        >
          {tickLabel(iy, unit, stepY)}
        </text>,
      );
    }

    return (
      <g shapeRendering="crispEdges">
        {/* Strips behind the ticks so labels read over the image. */}
        <rect
          x={left}
          y={top - RULER}
          width={width}
          height={RULER}
          fill="var(--bg-secondary)"
          opacity={0.92}
        />
        <rect
          x={left - RULER}
          y={top}
          width={RULER}
          height={height}
          fill="var(--bg-secondary)"
          opacity={0.92}
        />
        <rect
          x={left - RULER}
          y={top - RULER}
          width={RULER}
          height={RULER}
          fill="var(--bg-secondary)"
          opacity={0.92}
        />
        <g strokeWidth={1}>{ticks}</g>
      </g>
    );
  }, [guides.rulers, guides.rulerUnit, sx, sy, imgW, imgH, left, top, width, height]);

  if (!gridEls && !rulerEls) return null;

  return (
    <svg
      data-testid="canvas-guides-overlay"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: "var(--z-canvas-overlay)",
        overflow: "hidden",
      }}
    >
      {gridEls}
      {rulerEls}
    </svg>
  );
}
