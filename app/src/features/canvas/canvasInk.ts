// On-canvas ink and gesture thresholds for CanvasArea's overlays. Pure
// constants, no React — moved out of CanvasArea.tsx (2026-09-27, B0) so the
// `"use memo"` opt-in could land under its max-lines cap.

/* Neutral black/white on purpose, not theme tokens: these sit on arbitrary
   photo pixels, so they contrast by pairing a light line with a dark one
   rather than by hue. Named because each was a literal repeated 2–7 times. */
/** The dim outside a marquee, and the dark underlay beneath its dashed edge. */
export const MARQUEE_SHADE = "rgba(0,0,0,0.55)";
/** The dashed box around a shape or text being edited. */
export const EDIT_BOX_STROKE = "rgba(255,255,255,0.85)";
/** The dark rim on every white drag handle. */
export const HANDLE_OUTLINE = "rgba(0,0,0,0.5)";
/** The soft shadow that lifts a handle cluster off the image. */
export const HANDLE_SHADOW = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";

export const EMPTY_SEGMENTS = new Float32Array(0);

/** Screen-px movement below which a Select-tool press is a CLICK (fires the
 *  active kind), at or above which it's a marquee DRAG. Screen px, not canvas
 *  px, so the feel is zoom-independent. Matches the crop tool's 5px spirit. */
export const MARQUEE_THRESHOLD_PX = 4;
