import { useCallback, useEffect, useRef } from "react";
import type { CloneStampTool } from "stamp_tool";

interface PendingStamp {
  label: string;
  color: string;
}

interface UseRedStampToolOptions {
  toolRef: React.RefObject<CloneStampTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  active: boolean;
  brushSize?: number;
}

export function useRedStampTool({
  toolRef,
  canvasRef,
  flushToCanvas,
  syncState,
  active,
  brushSize = 120,
}: UseRedStampToolOptions) {
  const pendingStamp = useRef<PendingStamp | null>(null);

  useEffect(() => {
    if (!active) return;
    const handler = (e: CustomEvent<PendingStamp>) => {
      pendingStamp.current = { label: e.detail.label, color: e.detail.color };
    };
    window.addEventListener("red-stamp-select", handler as EventListener);
    return () =>
      window.removeEventListener("red-stamp-select", handler as EventListener);
  }, [active]);

  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || !pendingStamp.current) return;
      const tool = toolRef.current;
      const canvas = canvasRef.current;
      if (!tool || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) * canvas.width) / rect.width;
      const cy = ((e.clientY - rect.top) * canvas.height) / rect.height;

      const { label, color } = pendingStamp.current;

      // Parse CSS hex color → r, g, b
      const hex = color.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);

      // Rust renders the label (bordered, -5° rotated), scales to brush size,
      // composites centred on the click point, and pushes "Red Stamp" history.
      const targetSize = Math.max(40, brushSizeRef.current * 4);
      tool.commit_red_stamp(label, r, g, b, Math.round(cx), Math.round(cy), targetSize);
      flushToCanvas();
      syncState();
    },
    [toolRef, canvasRef, flushToCanvas, syncState],
  );

  const onMouseMove = useCallback(() => {}, []);
  const onMouseUp = useCallback(() => {}, []);

  const hasPendingStamp = useCallback(() => !!pendingStamp.current, []);

  return { onMouseDown, onMouseMove, onMouseUp, hasPendingStamp };
}
