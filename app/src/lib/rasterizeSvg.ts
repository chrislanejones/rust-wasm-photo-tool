// ===== FILE: app/src/lib/rasterizeSvg.ts =====
/**
 * SVG import support: rasterize to PNG at the import boundary.
 *
 * SVGs are never decoded, stored, or rendered live — they can carry
 * `<script>`/`onload`/`foreignObject` payloads. Instead
 * the import funnels (`openImportDialog`, `handleAddPhotos`) convert the
 * vector to PNG pixels through an `<img>` element — scripts do not execute in
 * the `<img>` rendering context — and the original SVG bytes are discarded;
 * only the rasterized PNG enters the pipeline, including the gallery
 * "original" stored in IndexedDB.
 *
 * Also load-bearing for a plainer reason: Chrome's `createImageBitmap()`
 * (both decode paths use it) cannot decode SVG blobs at all, so an
 * un-rasterized SVG dies with "Couldn't read image".
 */

/** True if the file is (or claims to be) an SVG — mime or extension. */
export function isSvgFile(file: File): boolean {
  return /svg/i.test(file.type) || /\.svg$/i.test(file.name);
}

/** Raster size policy: vectors have no fixed resolution, so tiny intrinsic
 *  sizes (a 24px icon) are scaled up to stay editable, huge ones are capped
 *  (the working copy gets downscaled to 2048 later anyway), and an SVG with
 *  no usable intrinsic size lands on the fallback long side. */
const MIN_LONG_SIDE = 1024;
const MAX_LONG_SIDE = 4096;
const FALLBACK_LONG_SIDE = 2048;

/** Pull an aspect ratio (w/h) out of a viewBox when the SVG declares no
 *  width/height. Returns 1 (square) when there is no parsable viewBox. */
function viewBoxAspect(svgText: string): number {
  const m = svgText.match(/viewBox\s*=\s*["']\s*[\d.eE+-]+[\s,]+[\d.eE+-]+[\s,]+([\d.eE+-]+)[\s,]+([\d.eE+-]+)/);
  if (!m) return 1;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return w > 0 && h > 0 ? w / h : 1;
}

/**
 * Rasterize an SVG file to a PNG `File` (same basename, `.png` extension).
 * Rejects when the SVG can't be parsed as an image at all.
 */
export async function rasterizeSvgToPng(file: File): Promise<File> {
  const text = await file.text();
  // Re-wrap with an explicit mime — drop/paste sources sometimes hand over an
  // empty or octet-stream type, and <img> needs image/svg+xml to parse it.
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("SVG could not be parsed as an image"));
      img.src = url;
    });

    // Intrinsic size when declared; otherwise viewBox aspect at the fallback
    // long side (browsers disagree on naturalWidth for size-less SVGs —
    // Firefox reports 0, Chrome a 300×150-ish CSS default).
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) {
      const aspect = viewBoxAspect(text);
      w = aspect >= 1 ? FALLBACK_LONG_SIDE : Math.round(FALLBACK_LONG_SIDE * aspect);
      h = aspect >= 1 ? Math.round(FALLBACK_LONG_SIDE / aspect) : FALLBACK_LONG_SIDE;
    }
    const long = Math.max(w, h);
    const scale = long < MIN_LONG_SIDE ? MIN_LONG_SIDE / long
      : long > MAX_LONG_SIDE ? MAX_LONG_SIDE / long
      : 1;
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    // drawImage re-rasterizes the vector at the target size — crisp, not a
    // bitmap upscale.
    ctx.drawImage(img, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("SVG rasterization produced no image");
    const name = file.name.replace(/\.svg$/i, "") || "image";
    return new File([blob], `${name}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
