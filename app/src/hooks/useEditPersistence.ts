import { useCallback } from "react";
import { useConvexAuth, useConvex, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { RefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import {
  savePhotoEdit as idbSave,
  loadPhotoEdit as idbLoad,
  deletePhotoEdit as idbDelete,
  clearAllEdits as idbClear,
} from "@/lib/editPersistence";
import type { SavedEdit, SnapEntry } from "@/lib/editPersistence";

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
const VERSION = 1;
const enc = new TextEncoder();
const dec = new TextDecoder();

function encodeArchive(
  canvasW: number,
  canvasH: number,
  canvasPng: Uint8Array,
  undoStack: SnapEntry[],
  redoStack: SnapEntry[],
): Uint8Array {
  const labelBytes = (s: string) => enc.encode(s);

  let size = 4 + 4 + 4 + 4 + 4 + canvasPng.length + 4 + 4;
  for (const s of undoStack) size += 4 + labelBytes(s.label).length + 4 + s.png.length;
  for (const s of redoStack) size += 4 + labelBytes(s.label).length + 4 + s.png.length;

  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  const w32 = (v: number) => { view.setUint32(pos, v, true); pos += 4; };
  const wb  = (b: Uint8Array) => { u8.set(b, pos); pos += b.length; };
  const wstr = (s: string) => { const b = labelBytes(s); w32(b.length); wb(b); };

  w32(MAGIC); w32(VERSION); w32(canvasW); w32(canvasH);
  w32(canvasPng.length); wb(canvasPng);

  w32(undoStack.length);
  for (const s of undoStack) { wstr(s.label); w32(s.png.length); wb(s.png); }

  w32(redoStack.length);
  for (const s of redoStack) { wstr(s.label); w32(s.png.length); wb(s.png); }

  return u8;
}

function decodeArchive(data: Uint8Array): SavedEdit {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;

  const r32  = () => { const v = view.getUint32(pos, true); pos += 4; return v; };
  const rb   = (n: number) => { const v = data.slice(pos, pos + n); pos += n; return v; };
  const rstr = () => dec.decode(rb(r32()));

  if (r32() !== MAGIC)   throw new Error("Invalid archive");
  if (r32() !== VERSION) throw new Error("Unknown archive version");

  const canvasW = r32();
  const canvasH = r32();
  const canvasPng = rb(r32());

  const undoStack: SnapEntry[] = [];
  const undoCount = r32();
  for (let i = 0; i < undoCount; i++) {
    const label = rstr();
    const png = rb(r32());
    undoStack.push({ png, label });
  }

  const redoStack: SnapEntry[] = [];
  const redoCount = r32();
  for (let i = 0; i < redoCount; i++) {
    const label = rstr();
    const png = rb(r32());
    redoStack.push({ png, label });
  }

  return { canvasW, canvasH, canvasPng, undoStack, redoStack };
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
            });
          }
          const redoStack: SnapEntry[] = [];
          for (let i = 0; i < tool.redo_snapshot_count(); i++) {
            redoStack.push({
              png: new Uint8Array(tool.get_redo_snapshot_png(i)),
              label: tool.get_redo_snapshot_label(i),
            });
          }

          const archive = encodeArchive(canvasW, canvasH, canvasPng, undoStack, redoStack);
          const uploadUrl = await generateUploadUrl();
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: archive.buffer as ArrayBuffer,
          });
          const { storageId } = await resp.json() as { storageId: string };
          await saveEdit({ photoKey: photoId, storageId: storageId as any, canvasW, canvasH });

          // Also write IDB so the local machine can reload without a round-trip
          await idbSave(photoId, toolRef);
          return;
        } catch {
          // fall through to IDB-only
        }
      }
      await idbSave(photoId, toolRef);
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
              return { canvasW: edit.canvasW, canvasH: edit.canvasH, canvasPng: data, undoStack: [], redoStack: [] };
            }
          }
        } catch {}
      }
      return null;
    },
    [isAuthenticated, convex],
  );

  const deletePhotoEdit = useCallback(
    async (photoId: string) => {
      if (isAuthenticated) {
        try { await removeEdit({ photoKey: photoId }); } catch {}
      }
      await idbDelete(photoId);
    },
    [isAuthenticated, removeEdit],
  );

  const clearAllEdits = useCallback(async () => {
    if (isAuthenticated) {
      try { await clearAllConvex(); } catch {}
    }
    await idbClear();
  }, [isAuthenticated, clearAllConvex]);

  return { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, clearAllEdits };
}
