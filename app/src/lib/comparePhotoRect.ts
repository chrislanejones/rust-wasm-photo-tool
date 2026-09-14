// Where the A/B compare overlay goes: over the PHOTO, not the whole canvas.
//
// A default document is an artboard — the photo mounted on a Canvas fill with a
// `canvasPadding` band around it. Covering the full canvas box stretched the
// original across that band on its half, while the edited half showed the band,
// so the two sides differed in something that is not content. `photo_bounds`
// (src/layer.rs) says where the photo sits in image px; this maps that into the
// canvas's on-screen box.
//
// Pure so it can be tested — this repo cannot test a component (PARKING_LOT).

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** `photo_bounds` in image px — structurally what `usePhotoBounds` returns. */
export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The photo's on-screen rect inside `box`, the canvas's rendered rect.
 * `docW`/`docH` are the canvas's backing size in image px. Unknown bounds, or a
 * canvas with no size yet, return `box` unchanged — what compare covered
 * before, so nothing jumps while `photo_bounds` is still answering.
 */
export function comparePhotoRect(
  box: ScreenRect,
  docW: number,
  docH: number,
  bounds: ImageBounds | null,
): ScreenRect {
  if (!bounds || docW <= 0 || docH <= 0) return box;
  const sx = box.width / docW;
  const sy = box.height / docH;
  return {
    left: box.left + bounds.x * sx,
    top: box.top + bounds.y * sy,
    width: bounds.width * sx,
    height: bounds.height * sy,
  };
}
