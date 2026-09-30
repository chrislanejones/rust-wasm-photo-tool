// The one shape a format plugin speaks: a layered document as plain bytes.
//
// A format plugin (see registry.ts) never sees the engine. It turns a file
// into THIS and this into a file, and `bridge.ts` is the only code that moves
// a LayeredDocument in and out of the wasm engine. So a new format is a pure
// codec — testable in node with a Uint8Array, no wasm, no React — and the
// engine's restore API has exactly one caller per direction whatever the
// number of formats grows to.
//
// Everything is full-canvas RGBA, bottom-first, opacity 0..1 — the engine's
// own conventions (`push_restored_layer`, `get_layers()`), chosen so the
// bridge does no reordering. A format whose layers carry offsets (PSD does)
// resolves them into the canvas on the way IN; on the way OUT every layer is
// written at the canvas size.

/** One layer, as the engine holds it: a full-canvas RGBA plane. */
export interface LayeredLayer {
  name: string;
  visible: boolean;
  /** 0..1. */
  opacity: number;
  /** `width * height * 4` bytes, straight RGBA, un-premultiplied. */
  rgba: Uint8Array;
}

export interface LayeredDocument {
  width: number;
  height: number;
  /** BOTTOM-FIRST, index 0 is the bottom of the stack. */
  layers: LayeredLayer[];
  /** Index into `layers` of the active layer, or null when the format has no
   *  such notion (PSD does not). The bridge falls back to the top layer. */
  activeIndex: number | null;
  /** The file's own flattened image, full-canvas RGBA, when it carried one.
   *  Null means "compose it yourself" (`compositeLayers`). */
  composite: Uint8Array | null;
  /** What did not survive, in words the toast can show: a blend mode the app
   *  lacks, a group flattened, a mask dropped. Empty when nothing was lost. */
  notes: string[];
}

/**
 * Source-over composite of the visible layers, bottom to top, each at its
 * opacity — the fallback when a file has no merged image of its own. Deliberately
 * the plainest possible compositor: Normal blend only, un-premultiplied in and
 * out. It is a preview for the gallery tile and the first flat layer; the
 * engine re-composites the real stack the moment the layers are restored.
 */
export function compositeLayers(doc: LayeredDocument): Uint8Array {
  const n = doc.width * doc.height;
  // Premultiplied float accumulators keep the math exact-enough across many
  // layers; converted back once at the end.
  const pr = new Float32Array(n);
  const pg = new Float32Array(n);
  const pb = new Float32Array(n);
  const pa = new Float32Array(n);
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const src = layer.rgba;
    const op = Math.min(1, layer.opacity);
    for (let i = 0; i < n; i++) {
      const a = (src[i * 4 + 3] / 255) * op;
      if (a === 0) continue;
      const inv = 1 - a;
      pr[i] = src[i * 4] * a + pr[i] * inv;
      pg[i] = src[i * 4 + 1] * a + pg[i] * inv;
      pb[i] = src[i * 4 + 2] * a + pb[i] * inv;
      pa[i] = a + pa[i] * inv;
    }
  }
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = pa[i];
    if (a === 0) continue;
    out[i * 4] = Math.round(pr[i] / a);
    out[i * 4 + 1] = Math.round(pg[i] / a);
    out[i * 4 + 2] = Math.round(pb[i] / a);
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}
