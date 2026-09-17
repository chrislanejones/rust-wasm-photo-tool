// Geometry + rasterization for the AI Object Removal mask.
//
// A mask is a list of STROKES in IMAGE space (the same coordinate space every
// canvas tool hands the engine — `useCanvasCoords`'s output), never in screen
// or CSS-scaled space. That is the whole reason this file exists separately
// from the overlay that draws it: the on-canvas overlay renders the strokes at
// the displayed scale, and `buildObjectRemovalMaskPng` renders the very same
// strokes at the image's NATIVE resolution for upload. One list of points, two
// rasterizations, so the mask the model receives cannot drift from the paint
// the user saw.
//
// The rasterization below is byte-for-byte the one the old ObjectRemovalModal
// did on its own private canvas (round cap/join, `lineWidth = size`, a lone
// press rendering as a circle of radius `size / 2`, then a hard binarize at
// alpha > 10). It was moved here rather than rewritten so the bytes handed to
// Replicate keep the same meaning they had when the popup built them.

export interface MaskPoint {
  x: number;
  y: number;
}

/** One press-drag-release, in image-space pixels. `size` is the brush diameter
 *  in IMAGE pixels — as with every other brush in the app, not screen pixels,
 *  so zooming in does not change what a stroke covers. */
export interface MaskStroke {
  size: number;
  points: MaskPoint[];
}

/** The painted-region color. Matches the popup's `rgba(239,68,68,1)`
 *  (Tailwind red-500) so the on-canvas overlay reads the same as the modal
 *  did. Opaque — the translucency is applied by the overlay element's CSS
 *  opacity, exactly as the modal's `opacity-50` class did, which keeps the
 *  binarize threshold below looking at fully-opaque paint. */
const MASK_PAINT_COLOR = "rgba(239,68,68,1)";

/** Below this alpha a pixel is NOT part of the mask. Only antialiased stroke
 *  edges land between 0 and 255, so this is an edge-feathering decision and
 *  nothing else. */
const ALPHA_THRESHOLD = 10;

/**
 * Paint strokes onto a 2D context whose coordinate system is image space.
 *
 * The caller decides the resolution: the overlay scales its backing store to
 * the image and lets CSS fit it to the display box, so this function is always
 * given image-space coordinates and never has to know about zoom or pan.
 */
export function paintMaskStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly MaskStroke[],
): void {
  ctx.save();
  ctx.fillStyle = MASK_PAINT_COLOR;
  ctx.strokeStyle = MASK_PAINT_COLOR;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.lineWidth = stroke.size;
    const [first, ...rest] = stroke.points;
    if (rest.length === 0) {
      // A press with no drag — a dab, same as the popup's `arc(...)` branch.
      ctx.beginPath();
      ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const p of rest) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** True when there is at least one stroke that would mark a pixel. */
export function hasMaskPaint(strokes: readonly MaskStroke[]): boolean {
  return strokes.some((s) => s.points.length > 0);
}

/**
 * The NATIVE pixel size of an encoded image.
 *
 * Read off the source PNG itself rather than off the canvas element or the
 * engine's reported state: the mask has to match the bytes actually being
 * uploaded, and anything else is a second source for a number that must agree
 * exactly. `.main-canvas` is CSS-fit-scaled, so the displayed size is not it.
 */
export async function pngDimensions(
  png: Uint8Array,
): Promise<{ width: number; height: number }> {
  const blob = new Blob([png.buffer as ArrayBuffer], { type: "image/png" });
  const bmp = await createImageBitmap(blob);
  // Captured BEFORE close() — a closed ImageBitmap reports 0x0, the same trap
  // `useAIJob.urlToPixels` documents.
  const width = bmp.width;
  const height = bmp.height;
  bmp.close?.();
  return { width, height };
}

/**
 * Rasterize strokes into the black/white PNG the inpainting model expects:
 * WHITE = remove, BLACK = keep, at the image's NATIVE resolution.
 *
 * `width`/`height` MUST be the dimensions of the source PNG being uploaded
 * alongside it — the caller reads them off that PNG rather than off the
 * display, because a mask at the fit-scaled size would be silently offset.
 */
export async function buildObjectRemovalMaskPng(
  strokes: readonly MaskStroke[],
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  paintMaskStrokes(ctx, strokes);

  const src = ctx.getImageData(0, 0, width, height);
  const out = new ImageData(width, height);
  for (let i = 0; i < src.data.length; i += 4) {
    const v = src.data[i + 3] > ALPHA_THRESHOLD ? 255 : 0;
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);

  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  if (!blob) throw new Error("Could not encode the mask");
  return new Uint8Array(await blob.arrayBuffer());
}
