// Build a .ora archive from the live WASM tool. See
// docs/OpenRaster-Export-Import.md for the format.
import type { ImageHorseTool } from "stamp_tool";
import type { LayerInfo } from "@/hooks/useCloneStamp";
import { buildStackXml } from "./stackXml";
import type { OraLayerMeta } from "./types";

const THUMBNAIL_MAX_PX = 256;

/**
 * `flatten_text_annotations()` only bakes the ACTIVE layer's overlays (see
 * src/annotations.rs) — exporting every layer correctly means visiting each
 * one that actually has live text/shapes and flattening it in place, then
 * restoring whichever layer was active before we started. This does mutate
 * the live document (each flatten pushes one "Flatten" undo snapshot and
 * clears the redo stack) — a real, visible side effect only when the
 * document has live annotations at all; a plain multi-layer photo edit is
 * untouched. Returns true if anything was actually flattened, so the caller
 * can surface a notice.
 */
function flattenAllLayersInPlace(tool: ImageHorseTool): boolean {
  const originalActiveId = tool.active_layer_id();
  const n = tool.layer_count();
  const layers: LayerInfo[] = JSON.parse(tool.get_layers());
  let flattenedAny = false;

  for (let i = 0; i < n; i++) {
    const hasText = tool.get_layer_text_annotations(i) !== "[]";
    const hasShapes = tool.get_layer_shape_annotations(i) !== "[]";
    if (!hasText && !hasShapes) continue;
    const id = layers[i]?.id;
    if (id === undefined) continue;
    tool.set_active_layer(id);
    tool.flatten_text_annotations();
    flattenedAny = true;
  }

  tool.set_active_layer(originalActiveId);
  return flattenedAny;
}

export interface ExportOraResult {
  blob: Blob;
  /** True if live text/shape annotations were baked into pixels to export
   *  them (see flattenAllLayersInPlace) — worth surfacing to the user since
   *  it also clears the document's redo history. */
  flattenedAnnotations: boolean;
}

export async function exportOra(tool: ImageHorseTool): Promise<ExportOraResult> {
  const flattenedAnnotations = flattenAllLayersInPlace(tool);

  const n = tool.layer_count();
  const width = tool.width();
  const height = tool.height();
  const layers: LayerInfo[] = JSON.parse(tool.get_layers());

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  // Must be the very first entry in the archive, uncompressed — OpenRaster
  // readers sniff it before parsing anything else.
  zip.file("mimetype", "image/openraster", { compression: "STORE" });

  // Engine order is bottom-first (index 0 = bottom); stack.xml lists
  // top-first. File names use the engine's own bottom-first index — the
  // XML's `src` attribute is what actually associates a <layer> with its
  // PNG, so the two orderings don't need to match.
  const layerMetas: OraLayerMeta[] = [];
  let activeIndexTopFirst: number | null = null;
  for (let i = n - 1; i >= 0; i--) {
    const info = layers[i];
    const src = `data/layer${i}.png`;
    zip.file(src, tool.get_layer_png(i));
    if (info?.active) activeIndexTopFirst = layerMetas.length;
    layerMetas.push({
      name: info?.name || `Layer ${i}`,
      opacity: info?.opacity ?? 1,
      visible: info?.visible ?? true,
      src,
    });
  }

  zip.file(
    "stack.xml",
    buildStackXml({
      width,
      height,
      layers: layerMetas,
      activeIndex: activeIndexTopFirst,
    }),
  );

  zip.file("mergedimage.png", tool.export_png());

  // Thumbnail — Rust-side resize + encode (no OffscreenCanvas round trip).
  const mod = await import("stamp_tool");
  await mod.default(); // idempotent: returns the already-initialized wasm
  const tw = tool.thumbnail_width(THUMBNAIL_MAX_PX);
  const th = tool.thumbnail_height(THUMBNAIL_MAX_PX);
  const tdata = tool.thumbnail_data(THUMBNAIL_MAX_PX);
  zip.file("Thumbnails/thumbnail.png", mod.encode_png_pixels(tdata, tw, th));

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, flattenedAnnotations };
}
