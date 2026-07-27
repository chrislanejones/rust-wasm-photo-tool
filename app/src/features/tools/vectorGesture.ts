// The Vector tool's canvas behaviour, derived from its sub-mode.
//
// WHY THIS FILE EXISTS. v7.51 merged the Shapes rail tool into Text and renamed
// the pair "Vector": one tile, six sub-modes (Text, OCR, Shapes, Pens, Arrow,
// Line). That created two vocabularies for one concept — the RAIL knows
// `activeTool: "text"` plus a `textMode`, while the canvas gesture layer
// (useDrawingTools, useEffectiveTool, useCopyRegionAction) speaks the old
// `ToolType` and wants "shapes" or "arrow". Nothing translated between them.
//
// That is exactly the shape of the paid-tier bug (Convex `free|pro|team` vs UI
// `demo|loggedIn|paid`, no translation layer, no owner, no test — a paying
// customer silently got free-tier caps for months). So the translation gets a
// name, a file and tests, instead of being open-coded into three call sites
// that can drift apart.
//
// `"shapes"` therefore survives in `ToolType` as a GESTURE tool only: the store
// never holds it and the rail never shows it. It is what the canvas is doing,
// not what the user picked.
import type { ToolType } from "@/lib/types";
import type { TextMode } from "@/stores/useToolStore";

/** What the CANVAS should do, given what the rail has selected.
 *
 *  Every non-Vector tool passes straight through, so this is safe to call
 *  unconditionally and thread everywhere the gesture matters. */
export function gestureToolFor(activeTool: ToolType, textMode: TextMode): ToolType {
  if (activeTool !== "text") return activeTool;
  switch (textMode) {
    // Arrows have their own drag-to-draw path (start → end, with the head).
    case "arrow":
      return "arrow";
    // Shapes, Pens and Line are all the shape-drag gesture; which primitive
    // gets committed is `settings.shape`, pinned by the panel.
    case "shapes":
    case "pens":
    case "line":
      return "shapes";
    // Text and OCR: click-to-place / click-to-read, the text tool's own path.
    case "text":
    case "ocr":
      return "text";
  }
}

/** Pens mode routes the shape gesture through the pin/pen path.
 *  `null` for every other mode and every other tool. */
export function penModeFor(activeTool: ToolType, textMode: TextMode): "pins" | null {
  return activeTool === "text" && textMode === "pens" ? "pins" : null;
}

/** The shape primitive a Vector sub-mode forces, or `null` when the mode lets
 *  the user pick (Shapes) or draws no shape at all. Line is a MODE now, not a
 *  choice inside the Shapes kind-picker, so it has to pin its own value. */
export function forcedShapeFor(textMode: TextMode): "line" | null {
  return textMode === "line" ? "line" : null;
}

/** What the CANVAS should look like, which is one step further from the rail
 *  than `gestureToolFor`.
 *
 *  The two differ on exactly one mode. `"arrow"` names two unrelated things in
 *  `ToolType`: the rail tool whose LABEL is "Layer Settings" (known debt — see
 *  CLAUDE.md) and the arrow-drawing gesture. CanvasArea keys its cursor off the
 *  tool id, so feeding it the gesture makes Vector's Arrow mode inherit Layer
 *  Settings' default pointer — where the standalone Shapes tool used to show a
 *  crosshair, correctly telling you this is a drag-to-draw surface.
 *
 *  So the canvas is told "shapes" for arrow-drawing: same crosshair, same
 *  drag-to-draw promise, and Layer Settings' own move cursor is untouched
 *  because that tool never routes through here. */
export function cursorToolFor(activeTool: ToolType, textMode: TextMode): ToolType {
  const gesture = gestureToolFor(activeTool, textMode);
  return activeTool === "text" && gesture === "arrow" ? "shapes" : gesture;
}
