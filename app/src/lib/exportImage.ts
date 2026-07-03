// app/src/lib/exportImage.ts
//
// Helpers for producing a photo's *processed* bytes for "Export All".
//
// Rust does the heavy lifting where it can: PNG encoding goes through the
// WASM `encode_png_pixels`, and annotation compositing reuses the same
// `ImageHorseTool` pipeline the editor uses. Lossy formats (JPEG/WebP/AVIF)
// go through the browser codec — matching the single-image export path, since
// the Rust `png` crate only handles PNG.

import type { SavedEdit } from "@/lib/editPersistence";
import { encodeViaWorker } from "@/lib/codecWorkerClient";

export type ExportFormat = "png" | "jpeg" | "webp" | "avif";

const MIME: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};

export const EXT: Record<ExportFormat, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
  avif: ".avif",
};

/** Filename extension for a stored original's MIME type (used for verbatim copies). */
export function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png": return ".png";
    case "image/jpeg": return ".jpg";
    case "image/webp": return ".webp";
    case "image/avif": return ".avif";
    case "image/gif": return ".gif";
    case "image/svg+xml": return ".svg";
    default: {
      const sub = mime.split("/")[1]?.replace(/\+.*$/, "");
      return sub ? `.${sub}` : "";
    }
  }
}

/** Decode encoded image bytes → raw RGBA via an OffscreenCanvas (browser decode). */
async function decodeToRgba(
  bytes: Uint8Array,
  mime: string,
): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
  const bitmap = await createImageBitmap(blob);
  const { width: w, height: h } = bitmap;
  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
}

/**
 * Composite a persisted edit (canvas pixels + live text annotations) into its
 * final RGBA buffer using a throwaway WASM tool. This mirrors the editor's
 * `loadFromSaved` path — load the canvas, re-create live annotations, flatten
 * them into pixels — so the exported result is pixel-identical to what the
 * user sees, including non-destructive text overlays. The active editing
 * session is untouched (separate tool instance).
 */
export async function compositeSavedEdit(
  edit: SavedEdit,
): Promise<{ pixels: Uint8Array; w: number; h: number }> {
  const mod = await import("stamp_tool");
  await mod.default();

  const { rgba } = await decodeToRgba(edit.canvasPng, "image/png");
  const tool = new mod.ImageHorseTool(edit.canvasW, edit.canvasH);
  try {
    tool.load_image(new Uint8Array(rgba.buffer as ArrayBuffer));

    if (edit.annotations && edit.annotations.length > 0) {
      for (const a of edit.annotations) {
        tool.add_text_annotation(
          a.text,
          a.font_size,
          a.r, a.g, a.b,
          a.bold,
          a.x, a.y,
          a.rotation_deg,
          a.background_kind ?? 0,
          a.bg_r ?? 255,
          a.bg_g ?? 255,
          a.bg_b ?? 255,
          a.bg_a ?? 255,
          a.bg_padding ?? 8,
          a.bg_corner_radius ?? 8,
          a.bg_tail ?? 0,
        );
      }
      tool.flatten_text_annotations();
    }

    return {
      pixels: new Uint8Array(tool.get_image_data()),
      w: tool.width(),
      h: tool.height(),
    };
  } finally {
    tool.free();
  }
}

/**
 * Encode an RGBA buffer to the requested format. PNG goes through Rust
 * (`encode_png_pixels`); lossy formats are offloaded to the codec worker
 * (`OffscreenCanvas.convertToBlob` off the main thread) and fall back to the
 * main-thread `convertToBlob` if the worker is unavailable.
 *
 * NOTE: on the worker path this DETACHES `pixels` (transferred, zero-copy).
 * Callers that reuse `pixels` after this call must pass a copy.
 */
export async function encodeRgba(
  pixels: Uint8Array,
  w: number,
  h: number,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  if (format === "png") {
    const mod = await import("stamp_tool");
    await mod.default();
    const png = mod.encode_png_pixels(pixels, w, h);
    return new Blob([new Uint8Array(png)], { type: "image/png" });
  }

  // Off-thread encode (transfers `pixels`); null → worker unavailable.
  const viaWorker = await encodeViaWorker(pixels, w, h, MIME[format], quality);
  if (viaWorker) return viaWorker;

  // Main-thread fallback. If the worker path already ran and detached `pixels`,
  // this read would throw — but encodeViaWorker only returns null before any
  // transfer (probe failed) OR after a post-probe failure at reuse-safe call
  // sites, so `pixels` is valid here.
  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext("2d")!;
  // Copy into a fresh (non-shared) ArrayBuffer so ImageData accepts it.
  const clamped = new Uint8ClampedArray(pixels.length);
  clamped.set(pixels);
  ctx.putImageData(new ImageData(clamped, w, h), 0, 0);
  return oc.convertToBlob({ type: MIME[format], quality });
}
