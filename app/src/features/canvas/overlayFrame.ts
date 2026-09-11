/**
 * The geometry every canvas overlay needs to sit exactly on the image: the
 * WASM image dims, the canvas's fit-scaled CSS box, and its live pan/zoom.
 * `SelectionOverlay`, `DrawPreviewOverlay` and `DuplicatePadOverlay` all take
 * exactly this — it is the one shape CanvasArea hands out via `renderOverlay`,
 * so a new overlay mounts from the composition root instead of growing
 * CanvasArea (which is line-capped by the max-lines ratchet).
 */
export interface OverlayFrame {
  width: number;
  height: number;
  cssWidth?: number;
  cssHeight?: number;
  panOffset: { x: number; y: number };
  zoom: number;
}
