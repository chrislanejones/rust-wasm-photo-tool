// app/src/lib/sizeDelta.ts
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

/** Signed size change vs. the upload: positive = smaller, negative = larger.
 *  Derived from the entry itself — `byteSize` and `originalByteSize` are both
 *  persisted in the manifest and updated by every path that rewrites the
 *  stored bytes — so it can never drift from the file it describes. */
export function sizeDeltaPercent(
  entry: Pick<PhotoEntry, "byteSize" | "originalByteSize">,
): number | null {
  if (!(entry.originalByteSize > 0) || !(entry.byteSize > 0)) return null;
  return Math.round((1 - entry.byteSize / entry.originalByteSize) * 100);
}

/**
 * The PhotoEntry fields Auto Compress rewrites. Every one of these used to be
 * left at its pre-compress value except byteSize, so the Resize & Compress
 * panel scored a 200 KB WebP as if it were the 4000px JPEG it replaced, and
 * "Apply Resize" re-encoded it in the old format at the old dimensions.
 */
export function autoCompressedPatch(
  photo: PhotoEntry,
  file: File,
  originalKey: string,
  thumbBlob: Blob,
  encoded: { width: number; height: number; quality: number },
): Partial<PhotoEntry> {
  const lossless = file.type === "image/png";
  return {
    originalKey,
    thumbBlob,
    byteSize: file.size,
    mimeType: file.type || photo.mimeType,
    origWidth: encoded.width,
    origHeight: encoded.height,
    workingWidth: encoded.width,
    workingHeight: encoded.height,
    encodeQuality: lossless ? undefined : encoded.quality,
  };
}
