// Smart-edge tools (magnetic lasso + Smart Brush) — verification switch, not a
// shipped preference.
//
// Both features stand on the edge cost map that `src/edges.rs` derives from the
// Sobel magnitude the edge-aware wand already ships. The kernels are proven by
// `cargo test`; what nobody has verified yet is the FEEL — does the wire track
// the cursor without lag, does the brush stop where a human expects. That is a
// canvas judgement, so the UI stays behind this switch until a human makes it.
//
// Runtime toggle: `localStorage.setItem("ih_smart_edge", "1")` in DevTools,
// then reload. Same pattern as `ih_tiles_flush` / `ih_oplog_undo` — there is
// deliberately no Settings-panel UI for it.
//
// With the switch OFF, the magnetic lasso stays the disabled "Coming soon" stub
// v7.23 shipped, and the brush never calls `set_smart_brush`, so the engine
// takes its original code path and paints byte-for-byte what it always did.

/** Whether the smart-edge tools are unlocked (see module doc above). */
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
