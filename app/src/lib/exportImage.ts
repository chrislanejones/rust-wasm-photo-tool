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
import { restoreLayerStack } from "@/lib/restoreLayerStack";

/** Every export format, as a tuple so it can be range-checked at runtime —
 *  the persisted `exportFormat` preference is rehydrated from same-origin-
 *  writable IndexedDB and has to be validated against THIS build's list, the
 *  same way the tool sub-modes are. Type is derived so the two cannot drift. */
export const EXPORT_FORMATS = ["png", "jpeg", "webp", "avif"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

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
  opts?: { excludeBackground?: boolean },
): Promise<{ pixels: Uint8Array; w: number; h: number }> {
  const mod = await import("stamp_tool");
  await mod.default();

  const { rgba } = await decodeToRgba(edit.canvasPng, "image/png");
  const tool = new mod.ImageHorseTool(edit.canvasW, edit.canvasH);
  try {
    tool.load_image(new Uint8Array(rgba.buffer as ArrayBuffer));

    // Rebuild the layer stack (archive v5+) before anything else. Two reasons,
    // and the second is the whole point of `opts.excludeBackground`:
    //
    //  1. Shared with the editor's own restore (lib/restoreLayerStack.ts) so
    //     the two cannot drift apart — see that file.
    //  2. `finish_layer_restore` is what promotes the bottom layer to
    //     LayerKind::Canvas. Without it this throwaway tool holds ONE Content
    //     layer built from the flattened canvasPng, `canvas_idx()` returns
    //     None, and `get_image_data_excluding_background()` has nothing to
    //     exclude — it would hand back the full padded document and quietly
    //     look like it had honoured the setting.
    //
    // Legacy archives with no `layers` return false and keep the flat canvas,
    // which is correct: a pre-v5 document has no Canvas layer to leave out.
    const usedLayers = await restoreLayerStack(
      tool,
      edit.layers,
      edit.activeLayerId,
      (png) => decodeToRgba(png, "image/png"),
    );

    if (!usedLayers && edit.annotations && edit.annotations.length > 0) {
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

    // Layer-restored documents carry their overlays per layer; bake them into
    // pixels so the export matches what the editor shows. (The legacy branch
    // above already flattened its own.)
    // ADR-024 Stage 2: the `text_annotation_count() > 0` guard is gone. It
    // duplicated a check the engine already makes, and duplicating it across
    // the boundary is what makes it a read-modify-write. `usedLayers` stays —
    // it is local state, not an engine read.
    if (usedLayers) {
      tool.flatten_text_annotations();
    }

    // "Photo only" — leave the artboard's backing Canvas layer out and crop to
    // the photo's own bounding box. Same Rust call the single-Download and
    // clipboard paths use, so all three surfaces agree.
    //
    // Guarded on `usedLayers`: without a restored stack there is no Canvas
    // layer, and `composite_excluding_background` would fall through to the
    // full layer list and return the whole document. Returning the same bytes
    // as the include-canvas branch is the honest outcome for a legacy archive,
    // but it must not be reached by accident.
    if (opts?.excludeBackground && usedLayers) {
      return {
        pixels: new Uint8Array(tool.get_image_data_excluding_background()),
        w: tool.export_width_excluding_background(),
        h: tool.export_height_excluding_background(),
      };
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
