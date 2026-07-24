import { useCallback } from "react";
import { useConvexAuth, useConvex, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { RefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import {
  savePhotoEdit as idbSave,
  loadPhotoEdit as idbLoad,
  deletePhotoEdit as idbDelete,
  copyPhotoEdit as idbCopy,
  clearAllEdits as idbClear,
  parseSnapshotAnnotations,
  parseShapes,
  collectLayers,
} from "@/lib/editPersistence";
import type {
  SavedEdit,
  SnapEntry,
  PersistedAnnotation,
  PersistedShape,
  PersistedLayer,
} from "@/lib/editPersistence";
import { logDiagnostic } from "@/lib/diagnosticsLog";

// ── Archive encoding ───────────────────────────────────────────────────────
// Packs canvas + full undo/redo history into a single binary blob so one
// Convex storage upload preserves everything, matching IDB behaviour.
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
const VERSION = 5;
const enc = new TextEncoder();
const dec = new TextDecoder();

function encodeArchive(
  canvasW: number,
  canvasH: number,
  canvasPng: Uint8Array,
  undoStack: SnapEntry[],
  redoStack: SnapEntry[],
  annotationsJson: string,
  shapesJson: string,
  layers: PersistedLayer[],
  activeLayerId: number,
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

  return u8;
}

function decodeArchive(data: Uint8Array): SavedEdit {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;

  const r32  = () => { const v = view.getUint32(pos, true); pos += 4; return v; };
  const rf64 = () => { const v = view.getFloat64(pos, true); pos += 8; return v; };
  const rb   = (n: number) => { const v = data.slice(pos, pos + n); pos += n; return v; };
  const rstr = () => dec.decode(rb(r32()));

  if (r32() !== MAGIC) throw new Error("Invalid archive");
  const version = r32();
  if (version < 1 || version > 5) {
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

  return {
    canvasW, canvasH, canvasPng, undoStack, redoStack, annotations, shapes,
    layers, activeLayerId,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useEditPersistence() {
  // isAuthenticated stays false until the JWT handshake with Convex succeeds,
  // so mismatched keys keep the app on the local IDB path rather than crashing.
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.photoEdits.generateUploadUrl);
  const saveEdit = useMutation(api.photoEdits.save);
  const removeEdit = useMutation(api.photoEdits.remove);
  const clearAllConvex = useMutation(api.photoEdits.clearAll);

  const savePhotoEdit = useCallback(
    async (photoId: string, toolRef: RefObject<ImageHorseTool | null>) => {
      // ── LOCAL FIRST, ALWAYS ────────────────────────────────────────────────
      // This used to try the cloud first and keep the local IndexedDB write in
      // the `catch`. That is only safe against a REJECTION. When signed in, the
      // cloud path can HANG — `generateUploadUrl()` is a Convex mutation that
      // neither resolves nor rejects if the deployment is unreachable — and a
      // hang never reaches a catch, so the local save never ran at all. The
      // user's edit was then written NOWHERE, silently. (Observed: the
      // `image-horse-edits` database was never even created.)
      //
      // IndexedDB is the restore path; Convex is a bonus. Write the copy that
      // restores the user's work first, then try to sync it.
      await idbSave(photoId, toolRef);

      if (isAuthenticated) {
        try {
          const tool = toolRef.current;
          if (!tool) return;

          const canvasPng = new Uint8Array(tool.export_png());
          const canvasW = tool.width();
          const canvasH = tool.height();

          const undoStack: SnapEntry[] = [];
          for (let i = 0; i < tool.undo_snapshot_count(); i++) {
            undoStack.push({
              png: new Uint8Array(tool.get_undo_snapshot_png(i)),
              label: tool.get_undo_snapshot_label(i),
              annotations: parseSnapshotAnnotations(
                tool.get_undo_snapshot_annotations(i),
              ),
            });
          }
          const redoStack: SnapEntry[] = [];
          for (let i = 0; i < tool.redo_snapshot_count(); i++) {
            redoStack.push({
              png: new Uint8Array(tool.get_redo_snapshot_png(i)),
              label: tool.get_redo_snapshot_label(i),
              annotations: parseSnapshotAnnotations(
                tool.get_redo_snapshot_annotations(i),
              ),
            });
          }

          // Live text annotations (re-editable overlay). Strip tile_* so
          // we don't bake stale pre-rotated tile cache into the archive —
          // tiles are re-rendered on load.
          let annotationsJson = "[]";
          try {
            const raw = tool.get_text_annotations();
            const parsed = JSON.parse(raw) as Array<
              PersistedAnnotation & {
                tile_w: number; tile_h: number;
                tile_offset_x: number; tile_offset_y: number;
              }
            >;
            const stripped: PersistedAnnotation[] = parsed.map((a) => ({
              id: a.id,
              text: a.text,
              x: a.x,
              y: a.y,
              font_size: a.font_size,
              r: a.r, g: a.g, b: a.b,
              bold: a.bold,
              rotation_deg: a.rotation_deg,
              background_kind: a.background_kind,
              bg_r: a.bg_r,
              bg_g: a.bg_g,
              bg_b: a.bg_b,
              bg_a: a.bg_a,
              bg_padding: a.bg_padding,
              bg_corner_radius: a.bg_corner_radius,
              bg_tail: a.bg_tail,
            }));
            annotationsJson = JSON.stringify(stripped);
          } catch {
            annotationsJson = "[]";
          }

          // Live shape annotations (re-editable overlay) — current state only.
          let shapesJson = "[]";
          try {
            shapesJson = tool.get_shape_annotations() || "[]";
          } catch {
            shapesJson = "[]";
          }

          const layers = collectLayers(tool);
          const activeLayerId = tool.active_layer_id();
          const archive = encodeArchive(canvasW, canvasH, canvasPng, undoStack, redoStack, annotationsJson, shapesJson, layers, activeLayerId);
          const uploadUrl = await generateUploadUrl();
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: archive.buffer as ArrayBuffer,
          });
          const { storageId } = await resp.json() as { storageId: string };
          await saveEdit({ photoKey: photoId, storageId: storageId as Id<"_storage">, canvasW, canvasH });
          // The local copy is already on disk (written before this block).
          return;
        } catch (err) {
          // Cloud save failed (upload / storage / auth). The local IDB copy is
          // ALREADY written, so nothing is lost — just record the failure so it
          // shows up in the Diagnostics Window instead of vanishing silently.
          logDiagnostic(
            "CONVEX_DB",
            `Cloud edit save failed for ${photoId}; saved locally only: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      // No trailing local save: it already happened at the top, unconditionally.
    },
    [isAuthenticated, generateUploadUrl, saveEdit],
  );

  const loadPhotoEdit = useCallback(
    async (photoId: string): Promise<SavedEdit | null> => {
      // IDB first — same machine, no network round-trip
      const local = await idbLoad(photoId);
      if (local) return local;

      if (isAuthenticated) {
        try {
          const edit = await convex.query(api.photoEdits.getEdit, { photoKey: photoId });
          if (edit?.downloadUrl) {
            const resp = await fetch(edit.downloadUrl);
            const data = new Uint8Array(await resp.arrayBuffer());
            try {
              return decodeArchive(data);
            } catch {
              // Legacy single-PNG blob — fall back gracefully
              return { canvasW: edit.canvasW, canvasH: edit.canvasH, canvasPng: data, undoStack: [], redoStack: [], annotations: [] };
            }
          }
        } catch {
          // Cloud read failed entirely — fall through to the IDB copy below.
        }
      }
      return null;
    },
    [isAuthenticated, convex],
  );

  const deletePhotoEdit = useCallback(
    async (photoId: string) => {
      if (isAuthenticated) {
        try {
          await removeEdit({ photoKey: photoId });
        } catch {
          // Best-effort cloud delete; the local IDB delete below is the one
          // that must happen, and it is not conditional on this succeeding.
        }
      }
      await idbDelete(photoId);
    },
    [isAuthenticated, removeEdit],
  );

  const clearAllEdits = useCallback(async () => {
    if (isAuthenticated) {
      try {
        await clearAllConvex();
      } catch {
        // Best-effort cloud clear; the local IDB clear below always runs.
      }
    }
    await idbClear();
  }, [isAuthenticated, clearAllConvex]);

  // Copy a source photo's persisted edit onto a duplicate's id (local IDB).
  // loadPhotoEdit checks IDB first, so the duplicate reloads correctly even for
  // authenticated users; if it's later edited it gets its own Convex record.
  const duplicatePhotoEdit = useCallback(
    async (srcId: string, destId: string) => {
      await idbCopy(srcId, destId);
    },
    [],
  );

  return { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, duplicatePhotoEdit, clearAllEdits };
}
