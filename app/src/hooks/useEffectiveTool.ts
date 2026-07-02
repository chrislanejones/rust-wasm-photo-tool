// Resolves which tool's mouse handlers the canvas should actually receive for
// the currently active tool + sub-mode. Extracted verbatim from AppShell's
// `effectiveStamp` IIFE — same logic, same "recompute every render" behavior
// (no memoization added, so this stays a drop-in move, not a perf change).
import type { MouseEvent } from "react";
import type { useCloneStamp } from "./useCloneStamp";
import type { useColorPicker } from "./useColorPicker";
import type { useMoveLayerTool } from "./useMoveLayerTool";
import type { useDrawingTools } from "./useDrawingTools";
import type { usePaintTool } from "./usePaintTool";
import type { useEmojiTool } from "./useEmojiTool";
import type { useRedStampTool } from "./useRedStampTool";
import type { ToolType } from "@/lib/types";
import type { BrushMode, StampSubMode } from "@/stores/useToolStore";

type Stamp = ReturnType<typeof useCloneStamp>;

interface UseEffectiveToolParams {
  stamp: Stamp;
  activeTool: ToolType;
  colorPickerActive: boolean;
  colorPicker: ReturnType<typeof useColorPicker>;
  moveActive: boolean;
  moveLayerTool: ReturnType<typeof useMoveLayerTool>;
  eraserTool: ReturnType<typeof usePaintTool>;
  drawingTools: ReturnType<typeof useDrawingTools>;
  maskEditing: boolean;
  maskTool: ReturnType<typeof usePaintTool>;
  brushMode: BrushMode;
  blurDown: Stamp["onMouseDown"];
  blurMove: Stamp["onMouseMove"];
  blurUp: Stamp["onMouseUp"];
  paintTool: ReturnType<typeof usePaintTool>;
  stampSubMode: StampSubMode;
  emojiTool: ReturnType<typeof useEmojiTool>;
  redStampTool: ReturnType<typeof useRedStampTool>;
}

export function useEffectiveTool({
  stamp,
  activeTool,
  colorPickerActive,
  colorPicker,
  moveActive,
  moveLayerTool,
  eraserTool,
  drawingTools,
  maskEditing,
  maskTool,
  brushMode,
  blurDown,
  blurMove,
  blurUp,
  paintTool,
  stampSubMode,
  emojiTool,
  redStampTool,
}: UseEffectiveToolParams): Stamp {
  // Idle handlers for tools that don't paint on the canvas. The clone stamp's
  // own onMouseDown/Move/Up ride along on `...stamp`; without overriding them
  // they "leak" — e.g. on the Effects tool the clone stamp would keep drawing.
  const idle = {
    ...stamp,
    onMouseDown: (() => {}) as typeof stamp.onMouseDown,
    onMouseMove: (() => {}) as typeof stamp.onMouseMove,
    onMouseUp: (() => {}) as typeof stamp.onMouseUp,
  };
  // Effects tool has no canvas interaction of its own — the Color Picker now
  // lives under Edit & Transform (see `activeTool === "crop"` below).
  if (activeTool === "effects") {
    return idle;
  }
  // Layer Settings tool: Move drags the layer (when its toggle is on);
  // otherwise idle so canvas clicks fall through to the Selection marker.
  if (activeTool === "arrow") {
    if (moveActive)
      return {
        ...stamp,
        onMouseDown: moveLayerTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: moveLayerTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: moveLayerTool.onMouseUp as typeof stamp.onMouseUp,
      };
    return idle;
  }
  // Edit & Transform: the Color Picker toggle takes over the canvas while on;
  // otherwise the crop-rectangle drag (drawingTools).
  if (activeTool === "crop") {
    if (colorPickerActive) {
      return {
        ...stamp,
        onMouseDown: colorPicker.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: colorPicker.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: stamp.onMouseUp,
      };
    }
    return {
      ...stamp,
      onMouseDown: drawingTools.onMouseDown as typeof stamp.onMouseDown,
      onMouseMove: drawingTools.onMouseMove as typeof stamp.onMouseMove,
      onMouseUp: drawingTools.onMouseUp as typeof stamp.onMouseUp,
    };
  }
  if (activeTool === "shapes")
    return {
      ...stamp,
      onMouseDown: drawingTools.onMouseDown as typeof stamp.onMouseDown,
      onMouseMove: drawingTools.onMouseMove as typeof stamp.onMouseMove,
      onMouseUp: drawingTools.onMouseUp as typeof stamp.onMouseUp,
    };
  if (activeTool === "brush") {
    if (maskEditing) {
      return {
        ...stamp,
        onMouseDown: maskTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: maskTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: maskTool.onMouseUp as typeof stamp.onMouseUp,
      };
    }
    if (brushMode === "blur") {
      return {
        ...stamp,
        onMouseDown: blurDown,
        onMouseMove: blurMove,
        onMouseUp: blurUp,
      };
    }
    if (brushMode === "erase") {
      return {
        ...stamp,
        onMouseDown: eraserTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: eraserTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: eraserTool.onMouseUp as typeof stamp.onMouseUp,
      };
    }
    // "pen" mode draws via the PenOverlay; the canvas itself uses the paint
    // handlers (harmless when the overlay is capturing).
    return {
      ...stamp,
      onMouseDown: paintTool.onMouseDown as typeof stamp.onMouseDown,
      onMouseMove: paintTool.onMouseMove as typeof stamp.onMouseMove,
      onMouseUp: paintTool.onMouseUp as typeof stamp.onMouseUp,
    };
  }
  if (activeTool === "stamp") {
    if (stampSubMode === "emojis") {
      return {
        ...stamp,
        onMouseDown: emojiTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: emojiTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: emojiTool.onMouseUp as typeof stamp.onMouseUp,
      };
    }
    const combinedDown: typeof stamp.onMouseDown = (e) => {
      if (redStampTool.hasPendingStamp()) {
        redStampTool.onMouseDown(e as MouseEvent<HTMLCanvasElement>);
      } else {
        stamp.onMouseDown(e);
      }
    };
    return {
      ...stamp,
      onMouseDown: combinedDown,
    };
  }
  // No painting tool selected → idle handlers, so the clone stamp only acts
  // when the Stamp tool itself is active (it used to leak onto other tools).
  return idle;
}
