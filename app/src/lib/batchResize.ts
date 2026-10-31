// Batch › Resize & Compress (Night 10-28, 227) — the parts that are numbers,
// kept pure so they are testable without a browser.
//
// The rules the panel follows:
// - Never upscale. "1600" means "no wider than 1600"; a 1200 px photo keeps
//   its size and is only re-encoded.
// - Never grow a file. A result bigger than the stored file is not written
//   (the v9.40 rule); the photo is kept and the report says so.
// - "Under N KB" searches quality per photo, highest quality that fits.
import type { ExportFormat } from "@/lib/exportImage";

export type ResizeFit = "width" | "long";
export type ResizeFormat = "keep" | ExportFormat;

export interface BatchResizeLook {
  fit: ResizeFit;
  /** Target in px on the fit's axis; null keeps the size (re-encode only). */
  size: number | null;
  format: ResizeFormat;
  /** 1..100. For PNG, below 100 reduces colors (v9.40). */
  quality: number;
  /** Search quality per photo to land at or under this many KB. */
  underKB: number | null;
}

export const DEFAULT_RESIZE_LOOK: BatchResizeLook = {
  fit: "width",
  size: 1600,
  format: "keep",
  quality: 80,
  underKB: null,
};

/** The size a `w × h` photo comes out at. Never larger than it went in. */
export function resizeTarget(w: number, h: number, look: Pick<BatchResizeLook, "fit" | "size">): { width: number; height: number } {
  if (look.size === null || w <= 0 || h <= 0) return { width: w, height: h };
  const axis = look.fit === "width" ? w : Math.max(w, h);
  if (axis <= look.size) return { width: w, height: h };
  const scale = look.size / axis;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** The format a photo is written in: its own for "keep" (unknown → JPEG). */
export function resolveFormat(look: Pick<BatchResizeLook, "format">, own: ExportFormat | null): ExportFormat {
  return look.format === "keep" ? (own ?? "jpeg") : look.format;
}

/**
 * Encode at `quality`, or — with a byte target — at the highest quality that
 * fits. Binary search over whole quality steps, at most ~7 encodes. When even
 * the floor does not fit, the floor's encode is returned and `fits` is false.
 */
export async function encodeUnder(
  encode: (quality: number) => Promise<Blob>,
  quality: number,
  targetBytes: number | null,
  floor = 10,
): Promise<{ blob: Blob; quality: number; fits: boolean; encodes: number }> {
  let encodes = 1;
  const first = await encode(quality);
  if (targetBytes === null || first.size <= targetBytes) {
    return { blob: first, quality, fits: targetBytes === null || first.size <= targetBytes, encodes };
  }
  let lo = floor;
  let hi = quality - 1;
  let best: { blob: Blob; quality: number } | null = null;
  let lowest: { blob: Blob; quality: number } | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const blob = await encode(mid);
    encodes++;
    if (!lowest || mid < lowest.quality) lowest = { blob, quality: mid };
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best) return { ...best, fits: true, encodes };
  // Nothing fit: hand back the smallest we tried.
  const fallback = lowest ?? { blob: first, quality };
  return { ...fallback, fits: false, encodes };
}

/** "1,240 KB" — the per-photo report's unit. */
export function kb(bytes: number): string {
  return `${Math.max(0, Math.round(bytes / 1024)).toLocaleString("en-US")} KB`;
}
