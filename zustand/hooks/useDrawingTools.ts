import { useState, useCallback } from 'react';

export function useDrawingTools(props) {
  const {
    toolRef,
    canvasRef,
    activeTool,
    settings,
    flushToCanvas,
    syncState,
  } = props;

  const [editState, setEditState] = useState(null);

  const onMouseDown = useCallback((e) => {
    // Implement shape start logic here
    console.log('Drawing down', activeTool);
  }, [activeTool]);

  const onMouseMove = useCallback((e] => {
    // Implement drawing move logic
  }, []);

  const onMouseUp = useCallback(() => {
    flushToCanvas();
    syncState();
  }, [flushToCanvas, syncState]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    editState,
    updateEditGeometry: setEditState,
  };
}
