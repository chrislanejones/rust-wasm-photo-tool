// The hand-tool drag (Space or H held, then drag the canvas). Out of CanvasArea,
// which sits at its line cap.
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

type Offset = { x: number; y: number };

export function useCanvasPanDrag(
  isPanning: boolean,
  panOffset: Offset,
  setPanOffset: (o: Offset) => void,
) {
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [isDraggingPan, setIsDraggingPan] = useState(false);

  const end = useCallback(() => {
    setIsDraggingPan(false);
    panStartRef.current = null;
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPanning) return;
      e.preventDefault();
      e.stopPropagation();
      panStartRef.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
      setIsDraggingPan(true);
    },
    [isPanning, panOffset],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const start = panStartRef.current;
      if (!isDraggingPan || !start) return;
      setPanOffset({ x: start.ox + e.clientX - start.x, y: start.oy + e.clientY - start.y });
    },
    [isDraggingPan, setPanOffset],
  );

  // The drag must end however the gesture ends. Releasing Space BEFORE the mouse
  // button turned pan mode off first, so the mouseup went to the tool's handler
  // and the grabbing hand stayed on for good (10-14-2026). End it when pan mode
  // ends, and on a mouseup or focus loss anywhere.
  useEffect(() => {
    if (!isDraggingPan) return;
    if (!isPanning) {
      end();
      return;
    }
    window.addEventListener("mouseup", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("blur", end);
    };
  }, [isDraggingPan, isPanning, end]);

  return { isDraggingPan, onMouseDown, onMouseMove, onMouseUp: end };
}
