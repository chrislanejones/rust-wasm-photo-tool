// The Crop tool's handles and dimming mask — moved out of CanvasArea verbatim (B4,
// docs/AppShell-Refactor-Plan.md), the way PerspectiveLayer.tsx did before it:
// the drag state, the window pointer listeners, and the overlay they drive.
//
// The state it edits is not local: `useDrawingTools` (`cropSelection`) owns it and this
// reads it through the session context, so CanvasArea mounts this with no
// props. The overlay maps image px through `getBoundingClientRect()` at render,
// so it relies on re-rendering whenever CanvasArea does (pan, zoom, resize) —
// which holds because neither component is memoized (see the note at the top
// of CanvasArea's body).
import { useCallback, useEffect, useRef } from "react";
import { useSession } from "@/app/session/SessionContext";
import { useToolStore } from "@/stores/useToolStore";
import type { CropSelection } from "@/hooks/useDrawingTools";
import { cornerDelta } from "@/lib/aspectLock";
import { MARQUEE_SHADE } from "./canvasInk";

export function CropLayer() {
  const { canvasRef, drawingTools } = useSession();
  const { cropSelection, setCropSelection: onCropChange } = drawingTools;
  const activeTool = useToolStore((s) => s.activeTool);

  // ── Crop handle drag ───────────────────────────────────────────────
  const cropDragRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startSel: CropSelection;
    scaleX: number;
    scaleY: number;
  } | null>(null);

  const onCropChangeRef = useRef(onCropChange);
  useEffect(() => { onCropChangeRef.current = onCropChange; });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = cropDragRef.current;
      if (!drag || !onCropChangeRef.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const { handle, startX, startY, startSel, scaleX, scaleY } = drag;
      let dx = (e.clientX - startX) / scaleX;
      let dy = (e.clientY - startY) / scaleY;
      // Crop chooses a REGION: free by default, Shift constrains.
      ({ dx, dy } = cornerDelta("region", e, handle, { dx, dy }, startSel));
      let { x, y, width: w, height: h } = startSel;
      switch (handle) {
        case "nw": x += dx; y += dy; w -= dx; h -= dy; break;
        case "n":  y += dy; h -= dy; break;
        case "ne": y += dy; w += dx; h -= dy; break;
        case "e":  w += dx; break;
        case "se": w += dx; h += dy; break;
        case "s":  h += dy; break;
        case "sw": x += dx; w -= dx; h += dy; break;
        case "w":  x += dx; w -= dx; break;
      }
      const min = 10;
      w = Math.max(min, w);
      h = Math.max(min, h);
      x = Math.max(0, Math.min(x, canvas.width - min));
      y = Math.max(0, Math.min(y, canvas.height - min));
      w = Math.min(w, canvas.width - x);
      h = Math.min(h, canvas.height - y);
      onCropChangeRef.current({
        x: Math.round(x), y: Math.round(y),
        width: Math.round(w), height: Math.round(h),
      });
    };
    const onUp = () => { cropDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const handleCropPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>, handle: string) => {
      if (!cropSelection || !canvasRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      cropDragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startSel: { ...cropSelection },
        scaleX: rect.width / canvas.width,
        scaleY: rect.height / canvas.height,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [cropSelection, canvasRef],
  );

  return (
    <>
      {/* ── Crop overlay: dark mask + rule-of-thirds + draggable handles ── */}
      {activeTool === "crop" && cropSelection && canvasRef.current && (() => {
        const canvas = canvasRef.current!;
        const r = canvas.getBoundingClientRect();
        const sx = r.width / canvas.width;
        const sy = r.height / canvas.height;
        const { x, y, width: sw, height: sh } = cropSelection;
        const vx = r.left + x * sx;
        const vy = r.top + y * sy;
        const vw = sw * sx;
        const vh = sh * sy;
        const HS = 9; // handle size in screen px

        const handles = [
          { id: "nw", hx: vx,        hy: vy,       cursor: "nw-resize" },
          { id: "n",  hx: vx+vw/2,   hy: vy,       cursor: "n-resize"  },
          { id: "ne", hx: vx+vw,     hy: vy,       cursor: "ne-resize" },
          { id: "e",  hx: vx+vw,     hy: vy+vh/2,  cursor: "e-resize"  },
          { id: "se", hx: vx+vw,     hy: vy+vh,    cursor: "se-resize" },
          { id: "s",  hx: vx+vw/2,   hy: vy+vh,    cursor: "s-resize"  },
          { id: "sw", hx: vx,        hy: vy+vh,    cursor: "sw-resize" },
          { id: "w",  hx: vx,        hy: vy+vh/2,  cursor: "w-resize"  },
        ];

        return (
          <svg
            style={{
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100vh",
              pointerEvents: "none",
              zIndex: 40,
              overflow: "hidden",
            }}
          >
            {/* Dark overlay — 4 rects framing the crop selection */}
            <rect x={r.left} y={r.top}   width={r.width}        height={Math.max(0, vy - r.top)}         fill={MARQUEE_SHADE} />
            <rect x={r.left} y={vy + vh} width={r.width}        height={Math.max(0, r.bottom - (vy+vh))} fill={MARQUEE_SHADE} />
            <rect x={r.left} y={vy}      width={Math.max(0, vx - r.left)}        height={vh} fill={MARQUEE_SHADE} />
            <rect x={vx+vw}  y={vy}      width={Math.max(0, r.right - (vx+vw))}  height={vh} fill={MARQUEE_SHADE} />

            {/* Dashed selection border */}
            <rect x={vx} y={vy} width={vw} height={vh}
              fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />

            {/* Rule-of-thirds guides */}
            <line x1={vx + vw/3}   y1={vy} x2={vx + vw/3}   y2={vy+vh} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
            <line x1={vx + 2*vw/3} y1={vy} x2={vx + 2*vw/3} y2={vy+vh} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
            <line x1={vx} y1={vy + vh/3}   x2={vx+vw} y2={vy + vh/3}   stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
            <line x1={vx} y1={vy + 2*vh/3} x2={vx+vw} y2={vy + 2*vh/3} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />

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
                style={{ cursor: h.cursor, pointerEvents: "all" }}
                onPointerDown={(e) => handleCropPointerDown(e, h.id)}
              />
            ))}
          </svg>
        );
      })()}
    </>
  );
}
