// The paste-placement bounding box: move by the body, resize by the eight
// handles, rotate by the knob off the east edge. Shared by "Merge into layer",
// "Stack as layer" and "Resize Layer" (all `usePastePlacementTool`).
//
// Floats independent of `activeTool` (same pattern as the shape/arrow edit
// overlay) — a pasted image can be adjusted no matter what tool is selected.
// No dimming mask: the pasted content itself is the visible thing, nothing
// needs to be dimmed around it. Geometry only; Rust renders the pixels
// (`set_paste_preview_rect` / `set_paste_preview_rotation`).

import { useCallback, useEffect, useRef } from "react";
import type { PastePlacementRect } from "@/hooks/usePastePlacementTool";
import { cornerDelta, lockAxisDelta } from "@/lib/aspectLock";

interface Props {
  rect: PastePlacementRect;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onChange: (rect: PastePlacementRect) => void;
}

export function PastePlacementOverlay({ rect, canvasRef, onChange }: Props) {
  // ── Paste-placement drag (move body + resize + rotate handles) ─────
  // Same window-listener pattern as the crop handles, extended with a
  // "move" mode since — unlike crop, where the selection rect overlays the
  // photo itself — a placed paste needs to be draggable by its body too,
  // and a "rotate" mode for the knob off the box's east edge.
  const pasteDragRef = useRef<{
    mode: "move" | "resize" | "rotate";
    handle: string; // resize: nw|n|ne|e|se|s|sw|w · move: "body" · rotate: "rotate"
    startX: number;
    startY: number;
    startRect: PastePlacementRect;
    scaleX: number;
    scaleY: number;
    /** rotate: the box center in SCREEN px, and the pointer's start angle. */
    centerX: number;
    centerY: number;
    startAngle: number;
  } | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = pasteDragRef.current;
      if (!drag || !onChangeRef.current) return;
      const { mode, handle, startX, startY, startRect, scaleX, scaleY } = drag;
      if (mode === "rotate") {
        const a = Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX);
        let deg = startRect.rotation + ((a - drag.startAngle) * 180) / Math.PI;
        // Shift snaps to 15° steps, like the shape rotate knobs elsewhere.
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        deg = ((deg % 360) + 360) % 360;
        onChangeRef.current({ ...startRect, rotation: deg });
        return;
      }
      const dx = (e.clientX - startX) / scaleX;
      const dy = (e.clientY - startY) / scaleY;
      if (mode === "move") {
        const { dx: mdx, dy: mdy } = e.shiftKey
          ? lockAxisDelta(dx, dy)
          : { dx, dy };
        onChangeRef.current({
          ...startRect,
          x: Math.round(startRect.x + mdx),
          y: Math.round(startRect.y + mdy),
        });
        return;
      }
      let { x, y, width: w, height: h } = startRect;
      // A rotated box resizes in its OWN frame: un-rotate the pointer delta
      // so dragging the (visually tilted) east edge still grows the width.
      const rad = (startRect.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const local = { dx: dx * cos + dy * sin, dy: -dx * sin + dy * cos };
      // Both the paste box and "Resize Layer" are this overlay, and both scale
      // PIXELS: plain drag keeps the ratio, Shift frees it for a skew.
      const { dx: cdx, dy: cdy } = cornerDelta("raster", e, handle, local, startRect);
      switch (handle) {
        case "nw": x += cdx; y += cdy; w -= cdx; h -= cdy; break;
        case "n":  y += cdy; h -= cdy; break;
        case "ne": y += cdy; w += cdx; h -= cdy; break;
        case "e":  w += cdx; break;
        case "se": w += cdx; h += cdy; break;
        case "s":  h += cdy; break;
        case "sw": x += cdx; w -= cdx; h += cdy; break;
        case "w":  x += cdx; w -= cdx; break;
      }
      const min = 10;
      w = Math.max(min, w);
      h = Math.max(min, h);
      if (rad !== 0) {
        // The edits above moved the center in the box's local frame; rotate
        // that offset back to canvas space so the opposite edge stays put.
        const ox = x + w / 2 - (startRect.x + startRect.width / 2);
        const oy = y + h / 2 - (startRect.y + startRect.height / 2);
        const cx = startRect.x + startRect.width / 2 + ox * cos - oy * sin;
        const cy = startRect.y + startRect.height / 2 + ox * sin + oy * cos;
        x = cx - w / 2;
        y = cy - h / 2;
      }
      onChangeRef.current({
        x: Math.round(x), y: Math.round(y),
        width: Math.round(w), height: Math.round(h),
        rotation: startRect.rotation,
      });
    };
    const onUp = () => { pasteDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const handlePastePointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      mode: "move" | "resize" | "rotate",
      handle: string,
    ) => {
      if (!canvasRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      const box = canvas.getBoundingClientRect();
      const scaleX = box.width / canvas.width;
      const scaleY = box.height / canvas.height;
      const centerX = box.left + (rect.x + rect.width / 2) * scaleX;
      const centerY = box.top + (rect.y + rect.height / 2) * scaleY;
      pasteDragRef.current = {
        mode,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...rect },
        scaleX,
        scaleY,
        centerX,
        centerY,
        startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [rect, canvasRef],
  );

  const canvas = canvasRef.current;
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width;
  const sy = r.height / canvas.height;
  const { x, y, width: pw, height: ph, rotation } = rect;
  const vx = r.left + x * sx;
  const vy = r.top + y * sy;
  const vw = pw * sx;
  const vh = ph * sy;
  const HS = 9; // handle size in screen px
  const ROT_GAP = 22; // rotate knob's distance off the east edge
  const ROT_R = 6;

  // Resize cursors follow the box's tilt: shift the compass by the
  // nearest 45° step so a tilted "e" handle shows a matching arrow.
  const COMPASS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const step = Math.round(rotation / 45);
  const cursorFor = (id: string) =>
    `${COMPASS[(COMPASS.indexOf(id) + step + 800) % 8]}-resize`;

  const handles = [
    { id: "nw", hx: vx,        hy: vy       },
    { id: "n",  hx: vx+vw/2,   hy: vy       },
    { id: "ne", hx: vx+vw,     hy: vy       },
    { id: "e",  hx: vx+vw,     hy: vy+vh/2  },
    { id: "se", hx: vx+vw,     hy: vy+vh    },
    { id: "s",  hx: vx+vw/2,   hy: vy+vh    },
    { id: "sw", hx: vx,        hy: vy+vh    },
    { id: "w",  hx: vx,        hy: vy+vh/2  },
  ];

  return (
    <svg
      data-paste-overlay="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        // Was 40 (--z-panel), tied with the Gallery filmstrip — DOM
        // order let the filmstrip win the tie and swallow pointerdowns
        // on handles near the bottom edge, which the "click outside
        // commits" listener then read as a commit. 45 (--z-cursor,
        // "above canvas chrome") matches CanvasArea's shape/arrow overlay.
        zIndex: 45,
        overflow: "hidden",
      }}
    >
      {/* Everything tilts with the box: rotating the group keeps each
          handle on its edge without per-handle trig. */}
      <g transform={`rotate(${rotation} ${vx + vw / 2} ${vy + vh / 2})`}>
        {/* Draggable body (move) — under the handles in z-order. */}
        <rect
          x={vx} y={vy} width={vw} height={vh}
          fill="transparent"
          stroke="white"
          strokeWidth={1.5}
          style={{ cursor: "move", pointerEvents: "all" }}
          onPointerDown={(e) => handlePastePointerDown(e, "move", "body")}
        />

        {/* Resize handles */}
        {handles.map(h => (
          <rect
            key={h.id}
            x={h.hx - HS/2} y={h.hy - HS/2}
            width={HS} height={HS}
            fill="white"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={1}
            rx={1}
            style={{ cursor: cursorFor(h.id), pointerEvents: "all" }}
            onPointerDown={(e) => handlePastePointerDown(e, "resize", h.id)}
          />
        ))}

        {/* Rotate knob — off the east edge, joined by a stem. Shift
            snaps to 15°. */}
        <line
          x1={vx + vw} y1={vy + vh / 2}
          x2={vx + vw + ROT_GAP - ROT_R} y2={vy + vh / 2}
          stroke="white"
          strokeWidth={1.5}
          style={{ pointerEvents: "none" }}
        />
        <circle
          data-testid="paste-rotate-handle"
          cx={vx + vw + ROT_GAP} cy={vy + vh / 2}
          r={ROT_R}
          fill="white"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
          style={{ cursor: "grab", pointerEvents: "all" }}
          onPointerDown={(e) => handlePastePointerDown(e, "rotate", "rotate")}
        >
          <title>Rotate (Shift snaps to 15°)</title>
        </circle>
      </g>
    </svg>
  );
}
