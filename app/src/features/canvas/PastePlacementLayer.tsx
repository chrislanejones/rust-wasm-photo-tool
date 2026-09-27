// The paste-placement box (a pasted image, or "Resize Layer") — moved out of CanvasArea verbatim (B4,
// docs/AppShell-Refactor-Plan.md), the way PerspectiveLayer.tsx did before it:
// the drag state, the window pointer listeners, and the overlay they drive.
//
// The state it edits is not local: `usePastePlacementTool` (`rect`) owns it and this
// reads it through the session context, so CanvasArea mounts this with no
// props. The overlay maps image px through `getBoundingClientRect()` at render,
// so it relies on re-rendering whenever CanvasArea does (pan, zoom, resize) —
// which holds because neither component is memoized (see the note at the top
// of CanvasArea's body).
import { useCallback, useEffect, useRef } from "react";
import { useSession } from "@/app/session/SessionContext";
import type { PastePlacementRect } from "@/hooks/usePastePlacementTool";
import { cornerDelta, lockAxisDelta } from "@/lib/aspectLock";

export function PastePlacementLayer() {
  const { canvasRef, pastePlacement } = useSession();
  const { rect: pastePlacementRect, update: onPastePlacementChange } = pastePlacement;

  // ── Paste-placement drag (move body + resize handles) ──────────────
  // Same window-listener pattern as the crop handles, extended with a
  // "move" mode since — unlike crop, where the selection rect overlays the
  // photo itself — a placed paste needs to be draggable by its body too.
  const pasteDragRef = useRef<{
    mode: "move" | "resize";
    handle: string; // resize: nw|n|ne|e|se|s|sw|w · move: "body"
    startX: number;
    startY: number;
    startRect: PastePlacementRect;
    scaleX: number;
    scaleY: number;
  } | null>(null);

  const onPastePlacementChangeRef = useRef(onPastePlacementChange);
  useEffect(() => {
    onPastePlacementChangeRef.current = onPastePlacementChange;
  });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = pasteDragRef.current;
      if (!drag || !onPastePlacementChangeRef.current) return;
      const { mode, handle, startX, startY, startRect, scaleX, scaleY } = drag;
      const dx = (e.clientX - startX) / scaleX;
      const dy = (e.clientY - startY) / scaleY;
      if (mode === "move") {
        const { dx: mdx, dy: mdy } = e.shiftKey
          ? lockAxisDelta(dx, dy)
          : { dx, dy };
        onPastePlacementChangeRef.current({
          ...startRect,
          x: Math.round(startRect.x + mdx),
          y: Math.round(startRect.y + mdy),
        });
        return;
      }
      let { x, y, width: w, height: h } = startRect;
      // Both the paste box and "Resize Layer" are this overlay, and both scale
      // PIXELS: plain drag keeps the ratio, Shift frees it for a skew.
      const { dx: cdx, dy: cdy } = cornerDelta("raster", e, handle, { dx, dy }, startRect);
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
      onPastePlacementChangeRef.current({
        x: Math.round(x), y: Math.round(y),
        width: Math.round(w), height: Math.round(h),
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
      mode: "move" | "resize",
      handle: string,
    ) => {
      if (!pastePlacementRect || !canvasRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      pasteDragRef.current = {
        mode,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...pastePlacementRect },
        scaleX: rect.width / canvas.width,
        scaleY: rect.height / canvas.height,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pastePlacementRect, canvasRef],
  );

  return (
    <>
      {/* ── Paste-placement overlay: movable/resizable bounding box ──────
          Floats independent of `activeTool` (same pattern as the shape/arrow
          edit overlay below) — a pasted image can be adjusted no matter what
          tool is selected. No dimming mask: the pasted content itself is the
          visible thing, nothing needs to be dimmed around it. */}
      {pastePlacementRect && canvasRef.current && (() => {
        const canvas = canvasRef.current!;
        const r = canvas.getBoundingClientRect();
        const sx = r.width / canvas.width;
        const sy = r.height / canvas.height;
        const { x, y, width: pw, height: ph } = pastePlacementRect;
        const vx = r.left + x * sx;
        const vy = r.top + y * sy;
        const vw = pw * sx;
        const vh = ph * sy;
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
              // "above canvas chrome") matches the shape/arrow overlay below.
              zIndex: 45,
              overflow: "hidden",
            }}
          >
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
                style={{ cursor: h.cursor, pointerEvents: "all" }}
                onPointerDown={(e) => handlePastePointerDown(e, "resize", h.id)}
              />
            ))}
          </svg>
        );
      })()}
    </>
  );
}
