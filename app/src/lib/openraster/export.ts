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
async function flattenAllLayersInPlace(tool: ImageHorseTool): Promise<boolean> {
  // ATOMIC CAPTURE (ADR-024, a7). Was `active_layer_id()` + `layer_count()` +
  // `get_layers()` — three reads describing one layer stack, consumed together:
  // the list and count pick the layers to visit, the id says which layer to put
  // back afterwards. Behind the worker, converted individually, the "original"
  // active layer could be one the list no longer contains, so the restore at
  // the bottom would put the document on the wrong layer, silently.
  //
  // `capture_layer_stack` and NOT `capture_ui_state`: the latter answers
  // `has_transparency` by compositing the whole document and scanning every
  // pixel, which this needs none of.
  const stack = await tool.capture_layer_stack();
  const originalActiveId = stack.active_layer_id;
  const n = stack.layer_count;
  const layers: LayerInfo[] = JSON.parse(stack.layers_json);
  stack.free();
  let flattenedAny = false;

  for (let i = 0; i < n; i++) {
    // ADR-024 Stage 2. This used to read both annotation lists per layer and
    // skip on empty, which is a read-modify-write: the decision to flatten was
    // made from a value fetched a moment earlier. `flatten_text_annotations`
    // now reports whether it did anything, so the verdict comes from the call
    // that does the work — and it is a strictly better test, because it checks
    // the same emptiness the engine checks (active layer, text AND shapes)
    // rather than JSON-comparing two strings to "[]".
    const id = layers[i]?.id;
    if (id === undefined) continue;
    tool.set_active_layer(id);
    // ADR-024 Stage 3.5 — a truthy trap. Un-awaited, a
    // Promise is always truthy, so `flattenedAny` would be true after the first
    // layer regardless. The caller surfaces that as "annotations were baked into
    // pixels, and your redo history was cleared" — a notice the user would get
    // on every .ora export of a document with no live annotations at all.
    //
    // `set_active_layer` above is deliberately NOT awaited: it consumes no
    // return value, so it is fire-and-forget and has never been in the gate.
    //
    // ⚠️ This said "THE LAST TRUTHY TRAP IN THE CODEBASE" when it shipped in
    // v8.15. It was not. v8.16 found another in `AppShell.handlePlace`, where
    // the guard sits one line BELOW the call — a shape the audit classifies
    // from the text at the call site and therefore cannot see, so the bucket
    // was reporting zero while a live trap sat in it. "No traps left" is a
    // statement about the instrument, never about the code.
    if (await tool.flatten_text_annotations()) flattenedAny = true;
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
  const flattenedAnnotations = await flattenAllLayersInPlace(tool);

  // ATOMIC CAPTURE (ADR-024, a7). Was `layer_count()` + `width()` + `height()`
  // + `get_layers()` — four reads that become one `stack.xml`, so they have to
  // describe one document. Converted individually behind the worker, a resize
  // landing between them writes a canvas size from before it beside a layer
  // list from after, into a file the user keeps on disk. Nothing throws.
  //
  // ⚠️ This does NOT make `exportOra` atomic. The `await import("jszip")` below
  // still separates these four from `get_layer_png(i)` and `export_png()`, and
  // `flattenAllLayersInPlace` above mutates the live document mid-export.
  //
  // ⚠️ STAGE 3.5 WIDENS THE FIRST OF THOSE. Today the `get_layer_png` loop below
  // is one uninterrupted synchronous run; behind the worker every iteration is a
  // yield point, so the window grows from the three dynamic imports to three + N.
  // Converting these six does not make `exportOra` atomic and must not be read
  // as having done so.
  //
  // ✅ THE DESIGN CALL WAS MADE — v8.11, and it was NO. A capture carrying the
  // layer PNGs holds 10.84 MB at two layers and +5.38 MB per layer with no
  // ceiling, against a loop peak that is FLAT at 5.39 MB; wasm memory never
  // shrinks and unlimited layers is the paid tier's feature. The adopted answer
  // is detect-don't-prevent: a monotonic document generation read before and
  // after, failing the export rather than writing a torn archive. That counter
  // does not exist yet (`OpLog::generation` is NOT it — it bumps only when an
  // append drops a redo tail). See ADR-024 "b2".
  //
  // The mid-export mutation is a SEPARATE problem: `flattenAllLayersInPlace`
  // completes before any read here, so it cannot tear the archive. What it does
  // is clear the user's redo stack as a side effect of exporting.
  const stack = await tool.capture_layer_stack();
  const n = stack.layer_count;
  const width = stack.width;
  const height = stack.height;
  const layers: LayerInfo[] = JSON.parse(stack.layers_json);
  stack.free();

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
    zip.file(src, await tool.get_layer_png(i));
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

  zip.file("mergedimage.png", await tool.export_png());

  // Thumbnail — Rust-side resize + encode (no OffscreenCanvas round trip).
  const mod = await import("stamp_tool");
  await mod.default(); // idempotent: returns the already-initialized wasm
  // ATOMIC CAPTURE (ADR-024). Was `thumbnail_width` + `_height` + `_data`.
  // `encode_png_pixels` interprets the buffer AT the dimensions it is handed,
  // so those three reads have to describe one state — and unlike the rest of
  // this file, which the ADR triaged as "already interleaves await", this
  // particular sequence sits immediately after two REAL awaits (the dynamic
  // import and the init above). Behind the worker it is the likeliest place in
  // the file for something to land mid-read. One call closes it; the
  // pre-existing interleaving elsewhere here is untouched and still open.
  const thumb = await tool.capture_thumbnail(THUMBNAIL_MAX_PX);
  const { rgba: tdata, width: tw, height: th } = thumb;
  thumb.free();
  zip.file("Thumbnails/thumbnail.png", mod.encode_png_pixels(tdata, tw, th));

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, flattenedAnnotations };
}
