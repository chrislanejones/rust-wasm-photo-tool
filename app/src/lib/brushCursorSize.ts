import type { StampSettings, ToolSettings, ToolType } from "@/lib/types";

/** Which brush the cursor ring is currently sized to. */
export interface BrushCursorInput {
  activeTool: ToolType;
  /** Paint's sub-mode: "blur", "erase", "pen" or the plain brush. */
  brushMode: string;
  /** Stamp's sub-mode; "emojis" sizes the ring to the emoji, not the brush. */
  stampSubMode: string;
  /** Layer Settings is editing a mask, so the mask brush owns the ring. */
  maskEditing: boolean;
  toolSettings: ToolSettings;
  stampSettings: StampSettings;
}

/**
 * The radius of the brush-preview ring, in image pixels.
 *
 * One tool can drive several different brushes and each keeps its own size, so
 * "how big is the cursor" is a real decision rather than a field read. It was
 * an anonymous IIFE at line 950 of AppShell with no test, which is how the
 * `arrow`/`maskEditing` branch came to be the only thing standing between the
 * mask brush and the ring silently showing the Paint brush's size.
 *
 * Every `toolSettings` size is a DIAMETER and the preview wants a radius,
 * hence the halving — except `stampSettings.brushSize`, which the clone stamp
 * already stores as a radius. Mixing those two conventions up is the bug this
 * function exists to make visible, so the division is per-branch on purpose
 * and must not be hoisted out.
 *
 * Returns 0 where there is no brush to preview: the ring is then hidden.
 */
export function brushCursorSize({
  activeTool,
  brushMode,
  stampSubMode,
  maskEditing,
  toolSettings,
  stampSettings,
}: BrushCursorInput): number {
  switch (activeTool) {
    case "brush":
      if (brushMode === "blur") return toolSettings.blurSize / 2;
      if (brushMode === "erase") return toolSettings.eraserSize / 2;
      return toolSettings.brushSize / 2;
    case "arrow":
      // The Layers panel's mask brush — its own size, not the Paint brush's.
      if (maskEditing) return toolSettings.maskBrushSize / 2;
      return 0;
    case "crop":
      return 0;
    case "ai":
      // Eraser tool: the brush eraser and the Magic Eraser share the same
      // eraserSize field (one physical brush, two jobs — see AISettings).
      return toolSettings.eraserSize / 2;
    case "stamp":
      if (stampSubMode === "emojis") return (toolSettings.emojiSize * 1.2) / 2;
      return stampSettings.brushSize;
    default:
      return stampSettings.brushSize;
  }
}
