// ===== FILE: app/src/hooks/usePaintTool.ts =====
// Freehand paint via WASM — each dab is rendered in Rust for performance.
// Calls syncState after mouseup so history panel updates.

import { useCallback, useRef } from "react";
import type { CloneStampTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

interface UsePaintToolOptions {
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
}: UsePaintToolOptions) {
  const isPainting = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * canvas.width) / rect.width,
        y: ((e.clientY - rect.top) * canvas.height) / rect.height,
      };
    },
    [canvasRef],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tool = toolRef.current;
      if (!tool || e.button !== 0) return;

      isPainting.current = true;
      const { x, y } = getCoords(e);
      lastPos.current = { x, y };

      const { r, g, b } = parseHexColor(settings.brushColor);
      const radius = settings.brushSize / 2;
      const opacity = settings.brushOpacity / 100;

      tool.paint_begin();
      tool.paint_dab(x, y, radius, r, g, b, opacity);
      flushToCanvas();
    },
    [
      toolRef,
      getCoords,
      settings.brushColor,
      settings.brushSize,
      settings.brushOpacity,
      flushToCanvas,
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPainting.current || !lastPos.current) return;
      const tool = toolRef.current;
      if (!tool) return;

      const { x, y } = getCoords(e);
      const prev = lastPos.current;
      const { r, g, b } = parseHexColor(settings.brushColor);
      const radius = settings.brushSize / 2;
      const opacity = settings.brushOpacity / 100;

      tool.paint_stroke_to(prev.x, prev.y, x, y, radius, r, g, b, opacity);
      flushToCanvas();
      lastPos.current = { x, y };
    },
    [
      toolRef,
      getCoords,
      settings.brushColor,
      settings.brushSize,
      settings.brushOpacity,
      flushToCanvas,
    ],
  );

  const onMouseUp = useCallback(() => {
    if (!isPainting.current) return;
    isPainting.current = false;
    lastPos.current = null;
    // Update history panel
    syncState();
  }, [syncState]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
