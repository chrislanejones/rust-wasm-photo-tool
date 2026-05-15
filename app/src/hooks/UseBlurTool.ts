// ===== FILE: app/src/hooks/useBlurTool.ts =====
//
// This hook wires up the blur tool to the Rust/WASM ImageHorseTool.
// On mousedown it saves an undo snapshot via begin_blur_stroke(),
// then on each mousemove it calls blur_region() which runs the
// separable Gaussian blur in WASM — much faster than the JS
// canvas.filter approach for large brush sizes.

import { useCallback, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

interface UseBlurToolOptions {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
}

export function useBlurTool({
  toolRef,
  canvasRef,
  settings,
  flushToCanvas,
  syncState,
}: UseBlurToolOptions) {
  const isBlurring = useRef(false);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
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

  const onBlurMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tool = toolRef.current;
      if (!tool || e.button !== 0) return;

      isBlurring.current = true;

      // Save undo snapshot once at stroke start
      tool.begin_blur_stroke();

      // Apply first dab
      const { x, y } = getCanvasCoords(e);
      const brushRadius = settings.blurSize / 2;
      tool.blur_region(x, y, brushRadius, settings.blurIntensity);
      flushToCanvas();
    },
    [
      toolRef,
      settings.blurSize,
      settings.blurIntensity,
      getCanvasCoords,
      flushToCanvas,
    ],
  );

  const onBlurMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBlurring.current) return;
      const tool = toolRef.current;
      if (!tool) return;

      const { x, y } = getCanvasCoords(e);
      const brushRadius = settings.blurSize / 2;
      tool.blur_region(x, y, brushRadius, settings.blurIntensity);
      flushToCanvas();
    },
    [
      toolRef,
      settings.blurSize,
      settings.blurIntensity,
      getCanvasCoords,
      flushToCanvas,
    ],
  );

  const onBlurMouseUp = useCallback(() => {
    if (!isBlurring.current) return;
    isBlurring.current = false;
    syncState();
  }, [syncState]);

  return {
    onBlurMouseDown,
    onBlurMouseMove,
    onBlurMouseUp,
    isBlurring,
  };
}
