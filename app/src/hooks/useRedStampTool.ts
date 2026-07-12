import { useCallback, useEffect, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";

/** Default rubber-stamp tilt, in degrees (negative = counter-clockwise).
 *  Threaded through to Rust so it can be made user-configurable later. */
const STAMP_ANGLE_DEG = -5;

interface PendingStamp {
  label: string;
  color: string;
}

interface UseRedStampToolOptions {
  toolRef: React.RefObject<ImageHorseTool | null>;
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
    if (!active) {
      // Tool deactivated → drop the armed stamp. Without this the pending
      // stamp survived leaving the Stamp tool and hijacked the next visit's
      // clicks (useEffectiveTool routes stamp-tool mousedowns to this hook
      // whenever hasPendingStamp() is true, even in Clone sub-mode).
      pendingStamp.current = null;
      return;
    }
    const handler = (e: CustomEvent<PendingStamp>) => {
      pendingStamp.current = { label: e.detail.label, color: e.detail.color };
    };
    window.addEventListener("red-stamp-select", handler as EventListener);
    return () =>
      window.removeEventListener("red-stamp-select", handler as EventListener);
  }, [active]);

  /** Sub-mode teardown (useStampTeardown): disarm without waiting for the
   *  whole tool to deactivate — switching Stamps→Clone must stop stamping. */
  const clearPendingStamp = useCallback(() => {
    pendingStamp.current = null;
  }, []);

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

      // Rust renders the label (bordered, tilted by STAMP_ANGLE_DEG), scales to
      // brush size, composites centred on the click point, and pushes history.
      const targetSize = Math.max(40, brushSizeRef.current * 4);
      tool.commit_red_stamp(
        label, r, g, b,
        Math.round(cx), Math.round(cy),
        targetSize, STAMP_ANGLE_DEG,
      );
      flushToCanvas();
      syncState();
    },
    [toolRef, canvasRef, flushToCanvas, syncState],
  );

  const onMouseMove = useCallback(() => {}, []);
  const onMouseUp = useCallback(() => {}, []);

  const hasPendingStamp = useCallback(() => !!pendingStamp.current, []);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    hasPendingStamp,
    clearPendingStamp,
  };
}
