// Downscale uploads to a working resolution and produce a small gallery thumbnail.

export const WORKING_MAX_EDGE = 2048;
export const THUMB_MAX_EDGE = 256;

export interface WorkingCopy {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Original dimensions before downscale, for edit-log replay later. */
  origWidth: number;
  origHeight: number;
}

/**
 * Decode a File and downscale to working resolution (≤ maxEdge on the long edge).
 * Returns native size if the image is already within bounds.
 */
export async function makeWorkingCopy(
  file: File,
  maxEdge = WORKING_MAX_EDGE,
): Promise<WorkingCopy> {
  const probe = await createImageBitmap(file);
  const origWidth = probe.width;
  const origHeight = probe.height;
  const longEdge = Math.max(origWidth, origHeight);
  let targetW = origWidth;
  let targetH = origHeight;
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    targetW = Math.round(origWidth * scale);
    targetH = Math.round(origHeight * scale);
  }

  let bitmap: ImageBitmap;
  if (targetW === origWidth) {
    bitmap = probe;
  } else {
    probe.close();
    bitmap = await createImageBitmap(file, {
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: "high",
    });
  }

  const oc = new OffscreenCanvas(targetW, targetH);
  const ctx = oc.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  bitmap.close();

  return {
    pixels: imageData.data,
    width: targetW,
    height: targetH,
    origWidth,
    origHeight,
  };
}

/** Small WebP thumbnail for the gallery strip (~10–40 KB). */
export async function makeThumbnail(
  file: File,
  maxEdge = THUMB_MAX_EDGE,
): Promise<Blob> {
  const probe = await createImageBitmap(file);
  const longEdge = Math.max(probe.width, probe.height);
  let tw = probe.width;
  let th = probe.height;
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    tw = Math.round(probe.width * scale);
    th = Math.round(probe.height * scale);
  }
  probe.close();

  const bitmap = await createImageBitmap(file, {
    resizeWidth: tw,
    resizeHeight: th,
    resizeQuality: "medium",
  });
  const oc = new OffscreenCanvas(bitmap.width, bitmap.height);
  oc.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return oc.convertToBlob({ type: "image/webp", quality: 0.78 });
}
