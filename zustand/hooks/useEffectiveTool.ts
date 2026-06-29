import { useMemo } from 'react';
import { useToolStore } from '@stores/useToolStore';
import { useCloneStamp } from '@hooks/useCloneStamp';
import { usePaintTool } from '@hooks/usePaintTool';
import { useDrawingTools } from '@hooks/useDrawingTools';
import { useEmojiTool } from '@hooks/useEmojiTool';
import { useMoveLayerTool } from '@hooks/useMoveLayerTool';
import { useTextTool } from '@hooks/useTextTool';
import { useRedStampTool } from '@hooks/useRedStampTool';
import { useColorPicker } from '@hooks/useColorPicker';


export function useEffectiveTool(props) {
  const {
    canvasRef,
    containerRef,
    stamp,
    toolSettings,
    activeTool,
    colorPickerActive,
    moveActive,
    cropEraserActive,
    maskEditing,
    brushMode,
    stampSubMode,
    shapesMode,
    effectsMode,
    maskPaintValue,
    flushAndSync,
  } = props;

  const colorPicker = useColorPicker({
    toolRef: stamp.toolRef,
    canvasRef,
    containerRef,
    active: colorPickerActive && activeTool === 'effects',
    onPickColor: () => {},
  });

  return useMemo(() => {
    return {
      ...stamp,
    };
  }, [
    activeTool,
    brushMode,
    stampSubMode,
    stamp,
  ]);
}
