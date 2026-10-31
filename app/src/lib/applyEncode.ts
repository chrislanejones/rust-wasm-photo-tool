// The encode an Apply performs, in ONE place (10-07).
//
// `usePersistActiveCanvas` writes it; the Resize & Compress panel MEASURES it
// — runs it on the pending pixels and shows the real byte count — so the
// number on screen is the number Apply would write, not a projection. The
// projection (area × quality × format weight) was off by 7× on a detailed
// photo: 4 KB predicted, 29 KB written. Sharing this function is what keeps
// the two from drifting apart again.
import { encodeRgba, formatFromMime, type ExportFormat } from "@/lib/exportImage";

export interface ApplyEncodeEntry {
  mimeType?: string;
  encodeQuality?: number;
  byteSize: number;
  origWidth: number;
  origHeight: number;
}

export interface ApplyEncodeResult {
  blob: Blob;
  /** The quality the file would be stored at (for `entry.encodeQuality`). */
  storedQuality: number;
  /** The format actually encoded. */
  format: ExportFormat;
  /** True when the save guard would decline it: bigger than the stored file. */
  kept: boolean;
}

/**
 * Encode `pixels` exactly as Apply would.
 *
 * `keepSourceEncoding` is "Apply Resize": the photo's own format at its own
 * stored quality, stepping quality down until a downscale is no bigger than
 * the file it replaces. Otherwise the panel's `exportFormat` and `quality`.
 */
export async function encodeForApply(
  pixels: Uint8Array,
  w: number,
  h: number,
  opts: {
    entry: ApplyEncodeEntry;
    exportFormat: ExportFormat;
    quality: number;
    keepSourceEncoding?: boolean;
    /** Encode in this format at `quality` (Apply Compression keeps the
     *  photo's own format; the panel's format row is a preview). */
    format?: ExportFormat;
  },
): Promise<ApplyEncodeResult> {
  const { entry, exportFormat, quality } = opts;
  const sourceFormat = opts.keepSourceEncoding ? formatFromMime(entry.mimeType ?? "") : null;
  const format = opts.format ?? sourceFormat ?? exportFormat;
  const lossy = format !== "png";
  if (!lossy) {
    // A PNG's "quality" is how far Compress reduced its colors (10-27). Its
    // own quality is the one it was last reduced at; unset is lossless, so
    // Apply Resize on an untouched PNG stays lossless.
    const pngQuality = sourceFormat ? (entry.encodeQuality ?? 100) : quality;
    const blob = await encodePngAtQuality(pixels, w, h, pngQuality);
    return { blob, storedQuality: pngQuality, format, kept: entry.byteSize > 0 && blob.size > entry.byteSize };
  }
  const resizeQuality = entry.encodeQuality ?? 92;
  let storedQuality = sourceFormat ? resizeQuality : quality;
  let blob = await encodeRgba(pixels.slice(), w, h, format, storedQuality / 100);
  const prevArea = entry.origWidth * entry.origHeight;
  if (sourceFormat && lossy && prevArea > 0 && w * h <= prevArea) {
    for (const q of [85, 78, 70, 62, 55]) {
      if (blob.size <= entry.byteSize || q >= storedQuality) break;
      blob = await encodeRgba(pixels.slice(), w, h, format, q / 100);
      storedQuality = q;
    }
  }
  return { blob, storedQuality, format, kept: entry.byteSize > 0 && blob.size > entry.byteSize };
}

/** PNG at `quality`: 100 is lossless, below it the engine reduces the colors
 *  (at most 256) and keeps whichever of the two encodes is smaller. */
async function encodePngAtQuality(pixels: Uint8Array, w: number, h: number, quality: number): Promise<Blob> {
  const mod = await import("stamp_tool");
  await mod.default();
  const png = mod.encode_png_pixels_quality(pixels, w, h, Math.max(0, Math.min(100, Math.round(quality))));
  return new Blob([new Uint8Array(png)], { type: "image/png" });
}
