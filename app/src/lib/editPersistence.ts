/**
 * Per-photo edit persistence via IndexedDB.
 *
 * Stores the current canvas state + full undo/redo history as PNG blobs so
 * switching between photos preserves every edit and every undo step.
 */

import type { RefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";

// ── Minimal IndexedDB wrapper ──────────────────────────────────────────────

const DB_NAME = "image-horse-edits";
const STORE = "edits";
let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db!); };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface SnapEntry {
  /** PNG-encoded snapshot (losslessly compressed RGBA). */
  png: Uint8Array;
  label: string;
}

export interface SavedEdit {
  canvasW: number;
  canvasH: number;
  /** Current canvas state as PNG. */
  canvasPng: Uint8Array;
  /** Undo stack, oldest → newest. */
  undoStack: SnapEntry[];
  /** Redo stack, oldest → newest (same order as internal WASM redo_stack). */
  redoStack: SnapEntry[];
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Snapshot the current WASM canvas + full undo/redo history and persist it
 * under `edit-<photoId>` in IndexedDB. Each history snapshot is PNG-encoded
 * to keep storage compact.
 */
export async function savePhotoEdit(
  photoId: string,
  toolRef: RefObject<ImageHorseTool | null>,
): Promise<void> {
  const t = toolRef.current;
  if (!t) return;

  const canvasPng = new Uint8Array(t.export_png());
  const canvasW = t.width();
  const canvasH = t.height();

  const undoCount = t.undo_snapshot_count();
  const undoStack: SnapEntry[] = [];
  for (let i = 0; i < undoCount; i++) {
    undoStack.push({
      png: new Uint8Array(t.get_undo_snapshot_png(i)),
      label: t.get_undo_snapshot_label(i),
    });
  }

  const redoCount = t.redo_snapshot_count();
  const redoStack: SnapEntry[] = [];
  for (let i = 0; i < redoCount; i++) {
    redoStack.push({
      png: new Uint8Array(t.get_redo_snapshot_png(i)),
      label: t.get_redo_snapshot_label(i),
    });
  }

  await idbSet<SavedEdit>(`edit-${photoId}`, {
    canvasW,
    canvasH,
    canvasPng,
    undoStack,
    redoStack,
  });
}

/** Return the persisted edit for a photo, or null if none exists. */
export async function loadPhotoEdit(photoId: string): Promise<SavedEdit | null> {
  return (await idbGet<SavedEdit>(`edit-${photoId}`)) ?? null;
}

/** Remove the persisted edit for a photo (e.g. when the photo is deleted). */
export async function deletePhotoEdit(photoId: string): Promise<void> {
  await idbDel(`edit-${photoId}`);
}

/** Wipe all persisted edits (e.g. Delete All). */
export async function clearAllEdits(): Promise<void> {
  await idbClear();
}
