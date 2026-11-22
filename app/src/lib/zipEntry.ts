// One entry of the "Download All" zip for a photo with NO saved edit — the
// half of the batch export that used to ignore the format picker.
//
// Before: the zip copied every untouched photo's stored bytes verbatim, so a
// person who picked WEBP got a zip of PNGs and JPEGs — whatever each photo was
// uploaded as — while only the edited ones came out as WEBP. The format they
// chose was shown for "Selected Image" and silently not honored for "All".
//
// Now the chosen format applies to every photo. A photo ALREADY in that format
// is still copied as-is: re-encoding it would cost quality and buy nothing.
// Only a photo in a different format is decoded and re-encoded.
//
// Decoding goes through createImageBitmap + OffscreenCanvas, the same codec
// step Auto Compress (`useAutoCompress`) uses to read a stored file. It is a
// format conversion, not an edit — no pixel is changed on the way through —
// so it does not route through the engine, which owns EDITS.

import { readExifTiff } from "@/lib/exif";
import { cameraInfoForReencoded, cameraInfoForVerbatim, carriesSourceTiff } from "@/lib/exif/cameraInfo";
import type { CameraInfo } from "@/lib/exif/cameraInfo";
import { encodeRgba, extFromMime, formatFromMime } from "@/lib/exportImage";
import type { ExportFormat } from "@/lib/exportImage";

export interface StoredBytes {
  bytes: ArrayBuffer;
  mimeType: string;
}

export interface ZipEntryBytes {
  bytes: Uint8Array<ArrayBuffer>;
  mime: string;
  ext: string;
}

/** True when the stored file is already in the chosen format, so the zip can
 *  carry it untouched. A mime we cannot place (null) is never "the same". */
export function zipKeepsStoredBytes(storedMime: string, target: ExportFormat): boolean {
  return formatFromMime(storedMime) === target;
}

export type DecodeToRgba = (
  bytes: ArrayBuffer,
  mime: string,
) => Promise<{ pixels: Uint8ClampedArray; width: number; height: number }>;

/** The codec read Auto Compress uses: decode, draw once, read the pixels. */
export const decodeToRgba: DecodeToRgba = async (bytes, mime) => {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const oc = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = oc.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, oc.width, oc.height);
  return { pixels: data, width, height };
};

export async function untouchedZipEntry(
  stored: StoredBytes,
  target: ExportFormat,
  quality01: number,
  cameraInfo: CameraInfo,
  decode: DecodeToRgba = decodeToRgba,
): Promise<ZipEntryBytes> {
  const src = new Uint8Array(stored.bytes);
  if (zipKeepsStoredBytes(stored.mimeType, target)) {
    // Keep all passes the bytes through; Remove location / Remove all scrub
    // on the way out (a turned JPEG keeps its Orientation tag — ADR-108).
    return {
      bytes: cameraInfoForVerbatim(src, stored.mimeType, cameraInfo),
      mime: stored.mimeType,
      ext: extFromMime(stored.mimeType),
    };
  }
  const { pixels, width, height } = await decode(stored.bytes, stored.mimeType);
  const enc = await encodeRgba(new Uint8Array(pixels.buffer), width, height, target, quality01);
  // The blob's own type, not the requested one: an AVIF request falls back to
  // PNG where the browser cannot encode AVIF, and the name must say so.
  const mime = enc.type || `image/${target}`;
  const encodedFormat = formatFromMime(mime) ?? target;
  // Keep all / Remove location → carry the original's metadata onto the
  // re-encode (JPEG/WebP hold it), upright and, for location, without GPS;
  // Remove all → the re-encode is already clean.
  const tiff = carriesSourceTiff(cameraInfo, encodedFormat) ? readExifTiff(src, stored.mimeType) : null;
  const bytes = cameraInfoForReencoded(
    new Uint8Array(await enc.arrayBuffer()),
    encodedFormat,
    cameraInfo,
    tiff,
    width,
    height,
  );
  return { bytes, mime, ext: extFromMime(mime) };
}
