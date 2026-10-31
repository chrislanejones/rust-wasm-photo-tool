// Downscale uploads to a working resolution and produce a small gallery thumbnail.

import { thumbnailViaWorker } from "@/lib/codecWorkerClient";

const WORKING_MAX_EDGE = 2048;
const THUMB_MAX_EDGE = 256;

/**
 * Hard ceiling on source resolution. A decompression bomb or a genuinely huge
 * image can OOM the tab during the full-res `createImageBitmap` decode below,
 * before any downscale applies. We can't size-limit the decode without parsing
 * headers, so we reject just after the probe -- turning a silent crash into a
 * catchable error the caller can surface as a toast.
 *
 * 100 MP (~12000x8333) clears every consumer camera (<=50 MP today) with
 * headroom while still blocking pathological inputs.
 */
const MAX_SOURCE_MEGAPIXELS = 100;

export class ImageTooLargeError extends Error {
  constructor(width: number, height: number) {
    super(
      `Image is too large to open (${width}x${height}, ` +
        `${Math.round((width * height) / 1_000_000)} MP). ` +
        `The limit is ${MAX_SOURCE_MEGAPIXELS} MP.`,
    );
    this.name = "ImageTooLargeError";
  }
}

/** Throw if `bitmap` exceeds the source-pixel ceiling. Closes it on rejection. */
function assertWithinPixelBudget(bitmap: ImageBitmap): void {
  if (bitmap.width * bitmap.height > MAX_SOURCE_MEGAPIXELS * 1_000_000) {
    const { width, height } = bitmap;
    bitmap.close();
    throw new ImageTooLargeError(width, height);
  }
}

export interface WorkingCopy {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Original dimensions before downscale, for edit-log replay later. */
  origWidth: number;
  origHeight: number;
}

/** The size `makeWorkingCopy` gives a `w × h` image: unchanged when it fits,
 *  else scaled so the long edge is `maxEdge`. */
export function workingSize(
  w: number,
  h: number,
  maxEdge = WORKING_MAX_EDGE,
): { width: number; height: number } {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longEdge;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** A region decoded at the source's FULL resolution — see `decodeRegion`. */
export interface DecodedRegion {
  pixels: Uint8ClampedArray;
  rect: { x: number; y: number; width: number; height: number };
  /** The whole source's size, as decoded (EXIF orientation applied). */
  srcWidth: number;
  srcHeight: number;
}

/**
 * Decode `file` at full resolution and keep only the part `pick` chooses from
 * its size. Only that region is ever read out as RGBA: a 24 MP photo cropped
 * 1:1 costs one 16 MP buffer here, not a 24 MP one plus the 16 MP crop. The
 * decoded bitmap is closed before this returns, so a caller looping over a
 * batch holds one photo at a time (Batch › Crop, PARKING_LOT 09-29-2026).
 *
 * `pick` must return a rect inside `w × h`.
 */
export async function decodeRegion(
  file: File,
  pick: (w: number, h: number) => { x: number; y: number; width: number; height: number },
): Promise<DecodedRegion> {
  const bitmap = await createImageBitmap(file);
  assertWithinPixelBudget(bitmap);
  const srcWidth = bitmap.width;
  const srcHeight = bitmap.height;
  try {
    const rect = pick(srcWidth, srcHeight);
    const oc = new OffscreenCanvas(rect.width, rect.height);
    const ctx = oc.getContext("2d", { willReadFrequently: true })!;
    // A straight copy of source pixels (same size in and out), so no
    // resampling happens here — the scale, if any, is the engine's.
    ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    const { data } = ctx.getImageData(0, 0, rect.width, rect.height);
    return { pixels: data, rect, srcWidth, srcHeight };
  } finally {
    bitmap.close();
  }
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
  assertWithinPixelBudget(probe);
  const origWidth = probe.width;
  const origHeight = probe.height;
  const { width: targetW, height: targetH } = workingSize(origWidth, origHeight, maxEdge);

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
  assertWithinPixelBudget(probe);
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

/** The engine's `resize_pixels`. */
type ResizePixels = (
  pixels: Uint8Array,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
) => Uint8Array;

/**
 * Build a small WebP thumbnail directly from raw RGBA pixels using the
 * Rust bilinear resizer. Use this when the caller already has the composited
 * pixel buffer in memory (e.g. after a WASM `composite_pixels` call) so we
 * can skip a redundant PNG decode round-trip.
 *
 * WebP encoding still happens via `OffscreenCanvas.convertToBlob` because the
 * WASM binary deliberately omits the `image` crate's WebP encoder per the
 * project's size-budget architecture docs.
 *
 * `resizePixels` may be `{ load }` instead of the function itself: the Rust
 * resize is only the FALLBACK for a missing worker, so a caller that has not
 * loaded the engine (the phone) hands over a loader and pays for the engine
 * only if the fallback is actually taken.
 */
export async function makeThumbnailFromPixels(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  resizePixels: ResizePixels | { load: () => Promise<ResizePixels> },
  maxEdge = THUMB_MAX_EDGE,
): Promise<Blob> {
  // Off-thread path: the worker resizes (OffscreenCanvas) + encodes WebP.
  // Returns null when the worker is unavailable → fall through to the Rust
  // resize path below. NOTE: on success this DETACHES `pixels` (transferred);
  // callers that reuse `pixels` after this call must pass a copy.
  const viaWorker = await thumbnailViaWorker(pixels, width, height, maxEdge);
  if (viaWorker) return viaWorker;

  const longEdge = Math.max(width, height);
  let tw = width;
  let th = height;
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    tw = Math.max(1, Math.round(width * scale));
    th = Math.max(1, Math.round(height * scale));
  }

  // Rust expects a Uint8Array view; reuse the underlying buffer either way.
  const srcBytes =
    pixels instanceof Uint8Array
      ? pixels
      : new Uint8Array(pixels.buffer as ArrayBuffer, pixels.byteOffset, pixels.byteLength);

  // Skip the resize if we're already at thumbnail size.
  const scaledBytes =
    tw === width && th === height
      ? srcBytes
      : (typeof resizePixels === "function" ? resizePixels : await resizePixels.load())(
          srcBytes,
          width,
          height,
          tw,
          th,
        );

  // Wrap as ImageData → OffscreenCanvas → WebP blob.
  const clamped = new Uint8ClampedArray(
    scaledBytes.buffer as ArrayBuffer,
    scaledBytes.byteOffset,
    scaledBytes.byteLength,
  );

  const oc = new OffscreenCanvas(tw, th);
  const ctx = oc.getContext("2d")!;
  ctx.putImageData(new ImageData(clamped, tw, th), 0, 0);
  return oc.convertToBlob({ type: "image/webp", quality: 0.78 });
}
