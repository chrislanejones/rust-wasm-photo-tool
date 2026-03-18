import { useCallback, useRef } from "react";
import type { CloneStampTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

function parseHex(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

interface Opts {
  toolRef: React.RefObject<CloneStampTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
}

export function usePaintTool({
  toolRef,
  canvasRef,
  settings,
  flushToCanvas,
  syncState,
}: Opts) {
  const painting = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const coords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * c.width) / r.width,
        y: ((e.clientY - r.top) * c.height) / r.height,
      };
    },
    [canvasRef],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t || e.button !== 0) return;
      painting.current = true;
      const { x, y } = coords(e);
      last.current = { x, y };
      const { r, g, b } = parseHex(settings.brushColor);
      t.paint_begin();
      t.paint_dab(
        x,
        y,
        settings.brushSize / 2,
        r,
        g,
        b,
        settings.brushOpacity / 100,
      );
      flushToCanvas();
    },
    [
      toolRef,
      coords,
      settings.brushColor,
      settings.brushSize,
      settings.brushOpacity,
      flushToCanvas,
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!painting.current || !last.current) return;
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = coords(e);
      const p = last.current;
      const { r, g, b } = parseHex(settings.brushColor);
      t.paint_stroke_to(
        p.x,
        p.y,
        x,
        y,
        settings.brushSize / 2,
        r,
        g,
        b,
        settings.brushOpacity / 100,
      );
      flushToCanvas();
      last.current = { x, y };
    },
    [
      toolRef,
      coords,
      settings.brushColor,
      settings.brushSize,
      settings.brushOpacity,
      flushToCanvas,
    ],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    last.current = null;
    syncState();
  }, [syncState]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
