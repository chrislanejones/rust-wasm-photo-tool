// The ONLY code that moves a LayeredDocument in and out of the engine.
//
// A format plugin is bytes ⇄ LayeredDocument and nothing more (document.ts).
// Everything that touches `ImageHorseTool` for a plugin format — reading the
// live stack out, rebuilding it from a file — is here, once, so a second
// format adds a codec and not a second copy of the restore dance that
// `openraster/import.ts` already had to get right (canvas size from the first
// pushed layer, bottom-first order, the active-layer fallback).
//
// ATOMIC CAPTURE (ADR-024). `capture_layer_stack` is one call for count,
// size and the layer list, so the document described here is one document.
// The per-layer `get_layer_png` reads that follow are separate awaits and are
// NOT covered by that — the same open window `openraster/export.ts` documents
// at length. A format plugin inherits it and does not widen it.
import type { ImageHorseTool } from "stamp_tool";
import type { LayerInfo } from "@/hooks/useEngineCore";
import { flattenAllLayersInPlace } from "@/lib/openraster/export";
import type { LayeredDocument, LayeredLayer } from "./document";

async function engine() {
  const mod = await import("stamp_tool");
  await mod.default(); // idempotent: returns the already-initialized wasm
  return mod;
}

/** PNG → RGBA through the engine's own decoder, so a plugin's pixels take
 *  the same codec path the engine's `get_layer_png` wrote them with. */
async function decodePng(png: Uint8Array): Promise<{ rgba: Uint8Array; w: number; h: number }> {
  const mod = await engine();
  const decoded = mod.decode_png_to_rgba(png);
  const out = { rgba: decoded.rgba, w: decoded.width, h: decoded.height };
  decoded.free();
  return out;
}

export interface CapturedDocument {
  doc: LayeredDocument;
  /** True when live text/shape annotations were baked into pixels to export
   *  them — which also clears the redo history. Worth a sentence in the toast. */
  flattenedAnnotations: boolean;
}

/**
 * Read the live document out as a LayeredDocument: every layer as full-canvas
 * RGBA, plus the engine's own composite. Flattens live annotations first, the
 * way .ora export does, so text and shapes reach the file as pixels.
 */
export async function captureLayeredDocument(tool: ImageHorseTool): Promise<CapturedDocument> {
  const flattenedAnnotations = await flattenAllLayersInPlace(tool);

  const stack = await tool.capture_layer_stack();
  const n = stack.layer_count;
  const width = stack.width;
  const height = stack.height;
  const infos: LayerInfo[] = JSON.parse(stack.layers_json);
  stack.free();

  const layers: LayeredLayer[] = [];
  let activeIndex: number | null = null;
  for (let i = 0; i < n; i++) {
    const info = infos[i];
    const png = await tool.get_layer_png(i);
    const { rgba, w, h } = await decodePng(png);
    if (w !== width || h !== height) {
      throw new Error(`Layer ${i + 1} is ${w}×${h} but the canvas is ${width}×${height}.`);
    }
    if (info?.active) activeIndex = i;
    layers.push({
      name: info?.name || `Layer ${i + 1}`,
      visible: info?.visible ?? true,
      opacity: info?.opacity ?? 1,
      rgba,
    });
  }

  const { rgba: composite } = await decodePng(await tool.export_png());

  return {
    doc: { width, height, layers, activeIndex, composite, notes: [] },
    flattenedAnnotations,
  };
}

/**
 * Rebuild the engine's layer stack from a LayeredDocument. Replaces the whole
 * stack and clears history, as `begin_layer_restore` documents — callers land
 * this on a NEW photo (importAsNewPhoto.ts), never the one that is open.
 * Returns how many layers were pushed.
 */
export async function restoreLayeredDocument(
  tool: ImageHorseTool,
  doc: LayeredDocument,
): Promise<number> {
  if (doc.layers.length === 0) {
    throw new Error("The file has no layers to restore.");
  }
  tool.begin_layer_restore();
  for (const layer of doc.layers) {
    tool.push_restored_layer(
      layer.rgba,
      doc.width,
      doc.height,
      layer.name,
      layer.visible,
      layer.opacity,
    );
  }
  // The file's active layer, else the top — the same fallback .ora import
  // and the session archive use.
  const active = doc.activeIndex ?? doc.layers.length - 1;
  tool.finish_layer_restore(Math.max(0, Math.min(doc.layers.length - 1, active)));
  return doc.layers.length;
}

/** RGBA → PNG bytes through the engine, for the gallery's first flat photo. */
export async function encodePng(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const mod = await engine();
  return mod.encode_png_pixels(rgba, width, height);
}
