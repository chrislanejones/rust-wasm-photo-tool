import { parseSnapshotAnnotations, parseShapes, type SavedEdit, type SnapEntry, type PersistedAnnotation, type PersistedShape, type PersistedLayer } from "./editPersistence";

// ── Archive encoding ───────────────────────────────────────────────────────
// Packs canvas + full undo/redo history into a single binary blob so one
// Convex storage upload preserves everything, matching IDB behavior.
//
// Format (all little-endian u32):
//   magic(4) version(4) canvas_w(4) canvas_h(4)
//   canvas_png_len(4) canvas_png(...)
//   undo_count(4)  { label_len(4) label(...) png_len(4) png(...) } × N
//   redo_count(4)  { label_len(4) label(...) png_len(4) png(...) } × N

const MAGIC = 0x49485354; // "IHST"
/** v3 appends a per-snapshot annotations JSON blob after each PNG so
 *  per-step text overlays survive cross-session reload. v4 appends a
 *  trailing current-state shapes JSON blob (live shape/arrow overlay).
 *  v5 appends the full layer stack (per layer: id, name, visible, opacity,
 *  pixel PNG, text+shape overlay JSON) plus the active layer id, so layers
 *  survive reload. Older archives are still loadable; missing data (shapes,
 *  layers) comes back empty / collapses to a single layer. */
// ADR-031: v6 appends current and per-snapshot quality; v1–v5 remain readable.
const VERSION = 6;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeArchive(
  canvasW: number,
  canvasH: number,
  canvasPng: Uint8Array,
  undoStack: SnapEntry[],
  redoStack: SnapEntry[],
  annotationsJson: string,
  shapesJson: string,
  layers: PersistedLayer[],
  activeLayerId: number,
  exportQuality: number = 75,
): Uint8Array {
  const labelBytes = (s: string) => enc.encode(s);
  const annBytes = enc.encode(annotationsJson);
  const shapesBytes = enc.encode(shapesJson);
  // Pre-encode per-snapshot annotation JSON to avoid double work.
  const undoAnnBytes = undoStack.map((s) =>
    enc.encode(s.annotations ? JSON.stringify(s.annotations) : "[]"),
  );
  const redoAnnBytes = redoStack.map((s) =>
    enc.encode(s.annotations ? JSON.stringify(s.annotations) : "[]"),
  );
  // Pre-encode per-layer name + overlay JSON.
  const layerNameBytes = layers.map((l) => enc.encode(l.name));
  const layerAnnBytes = layers.map((l) => enc.encode(JSON.stringify(l.annotations ?? [])));
  const layerShapeBytes = layers.map((l) => enc.encode(JSON.stringify(l.shapes ?? [])));

  let size = 4 + 4 + 4 + 4 + 4 + canvasPng.length + 4 + 4;
  for (let i = 0; i < undoStack.length; i++) {
    size += 4 + labelBytes(undoStack[i].label).length + 4 + undoStack[i].png.length + 4 + undoAnnBytes[i].length;
  }
  for (let i = 0; i < redoStack.length; i++) {
    size += 4 + labelBytes(redoStack[i].label).length + 4 + redoStack[i].png.length + 4 + redoAnnBytes[i].length;
  }
  size += 4 + annBytes.length; // trailing current-state annotations JSON
  size += 4 + shapesBytes.length; // trailing current-state shapes JSON (v4)
  // v5 layer stack: count(4) + per layer + active id(4).
  size += 4;
  for (let i = 0; i < layers.length; i++) {
    size += 4 // id
      + 4 + layerNameBytes[i].length // name
      + 4 // visible (u32)
      + 8 // opacity (f64)
      + 4 + layers[i].png.length // pixel PNG
      + 4 + layerAnnBytes[i].length // text overlays JSON
      + 4 + layerShapeBytes[i].length; // shape overlays JSON
  }
  size += 4; // active layer id

  size += 4 * (1 + undoStack.length + redoStack.length); // v6 qualities
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  const w32 = (v: number) => { view.setUint32(pos, v, true); pos += 4; };
  const wf64 = (v: number) => { view.setFloat64(pos, v, true); pos += 8; };
  const wb  = (b: Uint8Array) => { u8.set(b, pos); pos += b.length; };
  const wstr = (s: string) => { const b = labelBytes(s); w32(b.length); wb(b); };
  const wbytes = (b: Uint8Array) => { w32(b.length); wb(b); };

  w32(MAGIC); w32(VERSION); w32(canvasW); w32(canvasH);
  w32(canvasPng.length); wb(canvasPng);

  w32(undoStack.length);
  for (let i = 0; i < undoStack.length; i++) {
    wstr(undoStack[i].label);
    w32(undoStack[i].png.length); wb(undoStack[i].png);
    w32(undoAnnBytes[i].length); wb(undoAnnBytes[i]);
  }

  w32(redoStack.length);
  for (let i = 0; i < redoStack.length; i++) {
    wstr(redoStack[i].label);
    w32(redoStack[i].png.length); wb(redoStack[i].png);
    w32(redoAnnBytes[i].length); wb(redoAnnBytes[i]);
  }

  w32(annBytes.length); wb(annBytes);
  w32(shapesBytes.length); wb(shapesBytes);

  // v5 layer stack.
  w32(layers.length);
  for (let i = 0; i < layers.length; i++) {
    w32(layers[i].id);
    wbytes(layerNameBytes[i]);
    w32(layers[i].visible ? 1 : 0);
    wf64(layers[i].opacity);
    w32(layers[i].png.length); wb(layers[i].png);
    wbytes(layerAnnBytes[i]);
    wbytes(layerShapeBytes[i]);
  }
  w32(activeLayerId);
  w32(exportQuality);
  for (const snapshot of undoStack) w32(snapshot.exportQuality ?? 75);
  for (const snapshot of redoStack) w32(snapshot.exportQuality ?? 75);

  return u8;
}

/** The 8-byte PNG signature. The ONLY thing that makes a non-archive blob a
 *  legitimate legacy single-PNG edit rather than corruption. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function looksLikePng(data: Uint8Array): boolean {
  return data.byteLength >= 8 && PNG_MAGIC.every((b, i) => data[i] === b);
}

export function decodeArchive(data: Uint8Array): SavedEdit {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;

  const r32  = () => { const v = view.getUint32(pos, true); pos += 4; return v; };
  const rf64 = () => { const v = view.getFloat64(pos, true); pos += 8; return v; };
  const rb   = (n: number) => { const v = data.slice(pos, pos + n); pos += n; return v; };
  const rstr = () => dec.decode(rb(r32()));

  if (r32() !== MAGIC) throw new Error("Invalid archive");
  const version = r32();
  if (version < 1 || version > VERSION) {
    throw new Error("Unknown archive version");
  }

  const canvasW = r32();
  const canvasH = r32();
  const canvasPng = rb(r32());

  const undoStack: SnapEntry[] = [];
  const undoCount = r32();
  for (let i = 0; i < undoCount; i++) {
    const label = rstr();
    const png = rb(r32());
    let annotations: PersistedAnnotation[] | undefined;
    if (version >= 3) {
      annotations = parseSnapshotAnnotations(rstr());
    }
    undoStack.push({ png, label, annotations });
  }

  const redoStack: SnapEntry[] = [];
  const redoCount = r32();
  for (let i = 0; i < redoCount; i++) {
    const label = rstr();
    const png = rb(r32());
    let annotations: PersistedAnnotation[] | undefined;
    if (version >= 3) {
      annotations = parseSnapshotAnnotations(rstr());
    }
    redoStack.push({ png, label, annotations });
  }

  let annotations: PersistedAnnotation[] = [];
  if (version >= 2 && pos < data.length) {
    try {
      const annJson = rstr();
      if (annJson) annotations = JSON.parse(annJson) as PersistedAnnotation[];
    } catch {
      annotations = [];
    }
  }

  let shapes: PersistedShape[] = [];
  if (version >= 4 && pos < data.length) {
    try {
      shapes = parseShapes(rstr());
    } catch {
      shapes = [];
    }
  }

  let layers: PersistedLayer[] | undefined;
  let activeLayerId: number | undefined;
  if (version >= 5 && pos < data.length) {
    try {
      const layerCount = r32();
      const out: PersistedLayer[] = [];
      for (let i = 0; i < layerCount; i++) {
        const id = r32();
        const name = rstr();
        const visible = r32() !== 0;
        const opacity = rf64();
        const png = rb(r32());
        const lAnn = parseSnapshotAnnotations(rstr());
        const lShapes = parseShapes(rstr());
        out.push({ id, name, visible, opacity, png, annotations: lAnn, shapes: lShapes });
      }
      activeLayerId = r32();
      layers = out;
    } catch {
      layers = undefined;
    }
  }

  let exportQuality: number | undefined;
  if (version >= 6) {
    exportQuality = r32();
    for (const snapshot of undoStack) snapshot.exportQuality = r32();
    for (const snapshot of redoStack) snapshot.exportQuality = r32();
  }

  return {
    exportQuality,
    canvasW, canvasH, canvasPng, undoStack, redoStack, annotations, shapes,
    layers, activeLayerId,
  };
}

