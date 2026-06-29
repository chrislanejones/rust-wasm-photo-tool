import { useCallback } from 'react';

// Simplified version for refactor
 export function usePaintTool(props) {
  const { toolRef, canvasRef, settings, flushToCanvas, syncState, erase = false, maskMode = false, maskValue = 0 } = props;

  const onMouseDown = useCallback((e) => {
    const tool = toolRef.current;
    if (!tool || e.button !== 0) return;

    const { x, y } = getCanvasCoords(e, canvasRef);

    if (maskMode) {
      tool.mask_paint_down(x, y, settings.brushSize, maskValue, settings.opacity, settings.hardness, "med");
    } else if (erase) {
      tool.erase_down(x, y, settings.eraserSize, settings.eraserOpacity, settings.eraserHardness, "med");
    } else {
      tool.paint_down(x, y, settings.brushSize, settings.brushColor, settings.opacity, settings.hardness, "med");
    }

    flushToCanvas();
  }, [settings, flushToCanvas]);

  const onMouseMove = useCallback((e] => {
    const tool = toolRef.current;
    if (!tool) return;

    const { x, y } = getCanvasCoords(e, canvasRef);
    tool.paint_move(x, y);
    flushToCanvas();
  }, [flushToCanvas]);

  const onMouseUp = useCallback(() => {
    const tool = toolRef.current;
    if (!tool) return;

    tool.paint_up();
    syncState();
  }, [syncState]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}

// Helper function (add this if not already defined)
function getCanvasCoords(e: React.MouseEvent, canvasRef) {
  const c = canvasRef.current;
  if (!c) return { x: 0, y: 0 };
  const r = c.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * c.width) / r.width,
    y: ((e.clientY - r.top) * c.height) / r.height,
  };
}
