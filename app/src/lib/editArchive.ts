import { parseSnapshotAnnotations, parseShapes, type SavedEdit, type SnapEntry, type PersistedAnnotation, type PersistedShape, type PersistedLayer } from "./editPersistence";

// ── Archive encoding ───────────────────────────────────────────────────────
// Packs canvas + full undo/redo history into a single binary blob so one
// Convex storage upload preserves everything, matching IDB behavior.
//
// Format (all little-endian u32; the full layout is in ADR-112):
//   magic(4) version(4) [compat(4), v7+] canvas_w(4) canvas_h(4)
//   canvas_png_len(4) canvas_png(...)
//   undo_count(4)  { label png annotations_json } × N
//   redo_count(4)  { label png annotations_json } × N
//   annotations_json shapes_json  layer stack  active_id  qualities
//   [v7+] section_count(4) { tag(4) len(4) bytes } × N   -- "STEP": step layers

const MAGIC = 0x49485354; // "IHST"
/** v3 appends a per-snapshot annotations JSON blob after each PNG so
 *  per-step text overlays survive cross-session reload. v4 appends a
 *  trailing current-state shapes JSON blob (live shape/arrow overlay).
 *  v5 appends the full layer stack (per layer: id, name, visible, opacity,
 *  pixel PNG, text+shape overlay JSON) plus the active layer id, so layers
 *  survive reload. Older archives are still loadable; missing data (shapes,
 *  layers) comes back empty / collapses to a single layer. */
// ADR-031: v6 appends current and per-snapshot quality; v1–v5 remain readable.
//
// ADR-112: v7 puts a `compat` word after the version (the oldest reader that
// can read this archive), keeps the v6 body byte for byte, and ends with a
// SECTION TABLE: `count { tag len bytes }`. Its one section, STEP, gives each
// undo/redo step its own layer stack (pixels, texts with their ids, shapes),
// in the live layer stack's encoding, with the pixels pooled so a PNG that
// several steps share is stored once. A reader skips a section it doesn't
// know; a reader older than `compat` refuses the archive ("newer version").
const VERSION = 7;
/** The oldest reader that can read what this writer writes. */
const COMPAT = 7;
/** "STEP": per-step layer stacks. */
const TAG_STEP = 0x50455453;
/** `png_ref` meaning "this step's own composite PNG" (one layer, no overlays:
 *  the same pixels, so they are not stored twice). */
const SAME_AS_COMPOSITE = 0xffffffff;
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

  let size = 4 + 4 + 4 + 4 + 4 + 4 + canvasPng.length + 4 + 4;
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
  const stepSection = encodeStepSection([...undoStack, ...redoStack]);
  size += 4; // v7 section count
  if (stepSection) size += 4 + 4 + stepSection.length;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  const w32 = (v: number) => { view.setUint32(pos, v, true); pos += 4; };
  const wf64 = (v: number) => { view.setFloat64(pos, v, true); pos += 8; };
  const wb  = (b: Uint8Array) => { u8.set(b, pos); pos += b.length; };
  const wstr = (s: string) => { const b = labelBytes(s); w32(b.length); wb(b); };
  const wbytes = (b: Uint8Array) => { w32(b.length); wb(b); };

  w32(MAGIC); w32(VERSION); w32(COMPAT); w32(canvasW); w32(canvasH);
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

  // v7 section table.
  w32(stepSection ? 1 : 0);
  if (stepSection) {
    w32(TAG_STEP);
    wbytes(stepSection);
  }

  return u8;
}

/** The STEP section, or null when no step carries layers (then the archive
 *  has no sections, and every step reads back as today's flattened step). */
function encodeStepSection(steps: SnapEntry[]): Uint8Array | null {
  if (!steps.some((s) => s.layers && s.layers.length > 0)) return null;
  // Pool by identity: the capture and the reader both hand the SAME object to
  // every step whose pixels are the same, so identity is the dedup.
  const pool: Uint8Array[] = [];
  const at = new Map<Uint8Array, number>();
  const ref = (step: SnapEntry, p: Uint8Array) => {
    if (p === step.png) return SAME_AS_COMPOSITE;
    let i = at.get(p);
    if (i === undefined) {
      i = pool.length;
      pool.push(p);
      at.set(p, i);
    }
    return i;
  };
  const parts: Uint8Array[] = [];
  const u32 = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    parts.push(b);
  };
  const f64 = (v: number) => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, true);
    parts.push(b);
  };
  const bytes = (b: Uint8Array) => {
    u32(b.length);
    parts.push(b);
  };
  const str = (v: string) => bytes(enc.encode(v));

  const body: Array<() => void> = [];
  for (const step of steps) {
    const layers = step.layers ?? [];
    const refs = layers.map((l) => ref(step, l.png));
    body.push(() => {
      u32(layers.length);
      layers.forEach((l, i) => {
        u32(l.id);
        str(l.name);
        u32(l.visible ? 1 : 0);
        f64(l.opacity);
        u32(refs[i]);
        str(JSON.stringify(l.annotations ?? []));
        str(JSON.stringify(l.shapes ?? []));
      });
      u32(step.activeLayerId ?? layers[layers.length - 1]?.id ?? 0);
    });
  }
  u32(pool.length);
  for (const p of pool) bytes(p);
  for (const write of body) write();

  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let o = 0;
  for (const b of parts) {
    out.set(b, o);
    o += b.length;
  }
  return out;
}

/** Read a STEP section into the steps, in place. Throws on a malformed
 *  section; the caller then leaves every step flattened. */
function decodeStepSection(data: Uint8Array, steps: SnapEntry[]): void {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;
  const r32 = () => { const v = view.getUint32(pos, true); pos += 4; return v; };
  const rf64 = () => { const v = view.getFloat64(pos, true); pos += 8; return v; };
  const rb = (n: number) => {
    if (pos + n > data.length) throw new Error("STEP section truncated");
    const v = data.slice(pos, pos + n); pos += n; return v;
  };
  const rstr = () => dec.decode(rb(r32()));

  const pool: Uint8Array[] = [];
  const poolCount = r32();
  for (let i = 0; i < poolCount; i++) pool.push(rb(r32()));
  const out: Array<{ layers: PersistedLayer[]; active: number }> = [];
  for (const step of steps) {
    const n = r32();
    const layers: PersistedLayer[] = [];
    for (let i = 0; i < n; i++) {
      const id = r32();
      const name = rstr();
      const visible = r32() !== 0;
      const opacity = rf64();
      const ref = r32();
      const png = ref === SAME_AS_COMPOSITE ? step.png : pool[ref];
      if (!png) throw new Error(`STEP section: no pooled PNG ${ref}`);
      const annotations = parseSnapshotAnnotations(rstr());
      const shapes = parseShapes(rstr());
      layers.push({ id, name, visible, opacity, png, annotations, shapes });
    }
    out.push({ layers, active: r32() });
  }
  // Only now, with the whole section read, do the steps change.
  steps.forEach((step, i) => {
    if (out[i].layers.length === 0) return;
    step.layers = out[i].layers;
    step.activeLayerId = out[i].active;
  });
}

/** The 8-byte PNG signature. The ONLY thing that makes a non-archive blob a
 *  legitimate legacy single-PNG edit rather than corruption. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function looksLikePng(data: Uint8Array): boolean {
  return data.byteLength >= 8 && PNG_MAGIC.every((b, i) => data[i] === b);
}

/** What `readArchive` found. `newer` means the archive was written by a
 *  newer version of Image Horse that this one can't read: nothing was read,
 *  and the bytes are untouched. `sectionsAt` is the byte offset of the v7
 *  section table (for tooling and tests; absent before v7). */
export type ArchiveRead =
  | { kind: "ok"; edit: SavedEdit; sectionsAt?: number }
  | { kind: "newer"; version: number };

/** The error `decodeArchive` throws for a `newer` archive. */
class ArchiveTooNewError extends Error {
  constructor(readonly version: number) {
    super(`This edit was made by a newer version of Image Horse (archive v${version}); this version reads up to v${VERSION}.`);
    this.name = "ArchiveTooNewError";
  }
}

/** Decode an archive, throwing on anything it can't read — a newer archive
 *  throws `ArchiveTooNewError`. Prefer `readArchive` where "newer" needs its
 *  own answer. */
export function decodeArchive(data: Uint8Array): SavedEdit {
  const r = readArchive(data);
  if (r.kind === "newer") throw new ArchiveTooNewError(r.version);
  return r.edit;
}

/** Decode an archive. Throws on corrupt bytes; a newer archive this build
 *  can't read is `{ kind: "newer" }`, not a throw. */
export function readArchive(data: Uint8Array): ArchiveRead {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;

  const r32  = () => { const v = view.getUint32(pos, true); pos += 4; return v; };
  const rf64 = () => { const v = view.getFloat64(pos, true); pos += 8; return v; };
  const rb   = (n: number) => { const v = data.slice(pos, pos + n); pos += n; return v; };
  const rstr = () => dec.decode(rb(r32()));

  if (r32() !== MAGIC) throw new Error("Invalid archive");
  const version = r32();
  if (version < 1) {
    throw new Error("Unknown archive version");
  }
  // v7+: the oldest reader that can read it. Newer than this build → refuse.
  const compat = version >= 7 ? r32() : version;
  if (version > VERSION && compat > VERSION) {
    return { kind: "newer", version };
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

  const edit: SavedEdit = {
    exportQuality,
    canvasW, canvasH, canvasPng, undoStack, redoStack, annotations, shapes,
    layers, activeLayerId,
  };
  if (version < 7) return { kind: "ok", edit };

  // v7 section table. A section this reader doesn't know is skipped; a STEP
  // section that won't read leaves the steps flattened (today's steps) rather
  // than failing the whole archive, the same choice v5 made for layers.
  edit.archiveVersion = 7;
  const sectionsAt = pos;
  try {
    const count = r32();
    for (let i = 0; i < count; i++) {
      const tag = r32();
      const len = r32();
      if (pos + len > data.length) throw new Error("archive section truncated");
      const body = data.subarray(pos, pos + len);
      pos += len;
      if (tag === TAG_STEP) decodeStepSection(body, [...undoStack, ...redoStack]);
    }
  } catch {
    for (const s of [...undoStack, ...redoStack]) {
      delete s.layers;
      delete s.activeLayerId;
    }
  }
  return { kind: "ok", edit, sectionsAt };
}
