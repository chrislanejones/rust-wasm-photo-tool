import { useState, useCallback, useEffect } from 'react';

// Simplified version
export function useTextTool(props) {
  const { toolRef, canvasRef, containerRef, settings, flushToCanvas, syncState, active } = props;

  const [textInput, setTextInput] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState(null);

  const onTextCommit = useCallback(() => {
    if (!textInput.trim()) return;

    const tool = toolRef.current;
    if (!tool) return;

    tool.commit_text(
      textInput,
      settings.fontSize,
      settings.textColor,
      true,
      textInput.x,
      textInput.y,
      0
    );

    flushToCanvas();
    syncState();
    setTextInput(null);
  }, [textInput, flushToCanvas, syncState, settings]);

  return {
    textInput,
    setTextInput,
    annotations,
    hoveredAnnotationId,
    onTextCommit,
    refreshAnnotations: () => {},
  };
}
