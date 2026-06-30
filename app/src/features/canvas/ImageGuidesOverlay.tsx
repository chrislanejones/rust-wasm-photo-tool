// Draggable image guides overlay — non-destructive cyan lines drawn over the
// canvas. Mounted alongside CanvasGuidesOverlay in CanvasArea and projects
// image-space → screen the SAME way (rect + sx/sy from the live <canvas>), so it
// tracks zoom + pan automatically. Independent of the rulers/grid pref: guides
// show whenever any exist.
//
// The <svg> wrapper is pointer-transparent; only the guide line groups capture
// pointers (each with a fat invisible hit-line for easy grabbing). Click selects;
// when unlocked, pointer-drag moves the guide via the inverse projection.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Guide, GuideAxis } from "@/stores/useGuidesStore";

interface Props {
  /** Live screen rect of the <canvas> (already reflects zoom + pan). */
  rect: DOMRect;
  /** Screen px per image px on each axis (= zoom). */
  sx: number;
  sy: number;
  imgW: number;
  imgH: number;
  guides: Guide[];
  locked: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, pos: number) => void;
}

// Cyan is the Photoshop guide convention; bright enough to read on light + dark.
const GUIDE_COLOR = "#22d3ee";

export function ImageGuidesOverlay({
  rect,
  sx,
  sy,
  imgW,
  imgH,
  guides,
  locked,
  selectedId,
  onSelect,
  onMove,
}: Props) {
  const { left, top, width, height } = rect;

  // Keep the latest projection in a ref so the window drag listener reads
  // current values without re-subscribing every render.
  const proj = useRef({ left, top, sx, sy, imgW, imgH });
  proj.current = { left, top, sx, sy, imgW, imgH };

  const dragRef = useRef<{ id: string; axis: GuideAxis } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const onPointerMove = (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = proj.current;
      // Inverse projection: client px → image px, clamped to the canvas.
      const pos =
        d.axis === "h"
          ? Math.max(0, Math.min(p.imgH, (e.clientY - p.top) / p.sy))
          : Math.max(0, Math.min(p.imgW, (e.clientX - p.left) / p.sx));
      onMoveRef.current(d.id, pos);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (guides.length === 0) return null;

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none", // wrapper transparent; only the lines below grab
        zIndex: "var(--z-canvas-overlay)",
        overflow: "hidden",
      }}
    >
      {guides.map((g) => {
        const selected = g.id === selectedId;
        const isH = g.axis === "h";
        const x1 = isH ? left : left + g.pos * sx;
        const y1 = isH ? top + g.pos * sy : top;
        const x2 = isH ? left + width : x1;
        const y2 = isH ? y1 : top + height;
        const cursor = locked ? "default" : isH ? "row-resize" : "col-resize";

        const onPointerDown = (e: ReactPointerEvent<SVGGElement>) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(g.id);
          if (!locked) dragRef.current = { id: g.id, axis: g.axis };
        };

        return (
          <g
            key={g.id}
            style={{ pointerEvents: "auto", cursor }}
            onPointerDown={onPointerDown}
          >
            {/* Fat invisible hit-area so the thin line is easy to grab. */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={11} />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={GUIDE_COLOR}
              strokeWidth={selected ? 2 : 1}
              strokeOpacity={selected ? 1 : 0.85}
              shapeRendering="crispEdges"
            />
          </g>
        );
      })}
    </svg>
  );
}
