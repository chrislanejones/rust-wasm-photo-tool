// Smart Brush — verification switch, not a shipped preference.
//
// This switch used to gate BOTH consumers of the shared edge core (the
// magnetic lasso and the Paint Smart Brush). The lasso shipped by default in
// the selection-tool overhaul — it is always available in the Select panel
// now — so the switch gates ONLY the Smart Brush (usePaintTool.ts +
// PaintSettings.tsx). What nobody has verified for the brush is still the
// FEEL — does the stroke stop where a human expects. That is a canvas
// judgement, so its UI stays behind this switch until a human makes it.
//
// Runtime toggle: `localStorage.setItem("ih_smart_edge", "1")` in DevTools,
// then reload. Same pattern as `ih_tiles_flush` / `ih_oplog_undo` — there is
// deliberately no Settings-panel UI for it.
//
// With the switch OFF, the brush never calls `set_smart_brush`, so the engine
// takes its original code path and paints byte-for-byte what it always did.

/** Whether the Smart Brush is unlocked (see module doc above). */
export function isSmartEdgeEnabled(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("ih_smart_edge") === "1"
    );
  } catch {
    return false;
  }
}

/** Default edge strength for the Smart Brush (0..=255). Mid-scale: hard object
 *  outlines wall a stroke in, gentle gradients don't. */
export const SMART_BRUSH_DEFAULT_STRENGTH = 128;
