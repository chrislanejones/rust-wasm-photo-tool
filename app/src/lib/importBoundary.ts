// The import boundary: which picked/dropped files count as images, and how the
// ones the browser cannot decode get converted into ones it can.
//
// Two formats are converted at the door, and nothing downstream ever sees
// either one: an SVG is rasterized to PNG (lib/rasterizeSvg), and — with the
// HEIC import Beta on — a HEIC is re-encoded to WebP (lib/heicImport). With
// the Beta off, every function here is exactly the SVG-only check it replaced.

import { isSvgFile, rasterizeSvgToPng } from "@/lib/rasterizeSvg";
import { convertHeicImport, isHeicImport } from "@/lib/heicImport";

export { HeicDecodeError } from "@/lib/heicImport";

/** The image filter every funnel shares: the mime check, plus the formats
 *  whose source often hands over an EMPTY mime (an SVG from some sources, a
 *  HEIC from Chrome and Firefox nearly always). */
export function isImportableFile(file: File): boolean {
  return file.type.startsWith("image/") || isSvgFile(file) || isHeicImport(file);
}

/** True when the file has to be converted before `createImageBitmap` can read it. */
export function needsConversion(file: File): boolean {
  return isSvgFile(file) || isHeicImport(file);
}

/** Convert at the door: SVG → PNG, HEIC → WebP (Beta), anything else as is.
 *  Throws what the converter throws — `HeicDecodeError` for an unreadable HEIC. */
export async function toDecodableFile(file: File): Promise<File> {
  if (isSvgFile(file)) return rasterizeSvgToPng(file);
  if (isHeicImport(file)) return convertHeicImport(file);
  return file;
}
