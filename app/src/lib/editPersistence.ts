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
  /** Live text annotations active at this history step. Optional for
   *  backwards-compat with older persisted entries; omitted ≡ empty. */
  annotations?: PersistedAnnotation[];
}

/** One live (non-destructive) text annotation. Mirrors the JSON shape
 *  emitted by Rust's `get_text_annotations` — except `tile_*` fields are
 *  intentionally dropped since the tile is re-rendered on restore. */
export interface PersistedAnnotation {
  id: number;
  text: string;
  x: number;
  y: number;
  font_size: number;
  r: number;
  g: number;
  b: number;
  bold: boolean;
  rotation_deg: number;
  // Background fields (optional for backwards-compat with old persisted entries).
  background_kind?: number;
  bg_r?: number;
  bg_g?: number;
  bg_b?: number;
  bg_a?: number;
  bg_padding?: number;
  bg_corner_radius?: number;
  bg_tail?: number;
}

/** One live (non-destructive) shape/arrow annotation, as emitted by Rust's
 *  `get_shape_annotations`. The `id` is regenerated on restore. */
export interface PersistedShape {
  id?: number;
  kind: number; // 0=rect,1=circle,2=line,3=handCircle,4=arrow
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  g: number;
  b: number;
  stroke_width: number;
  arrow_style: number;
}

/** Parse the JSON emitted by `get_shape_annotations`. */
export function parseShapes(raw: string): PersistedShape[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PersistedShape[];
  } catch {
    return [];
  }
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
  /** Live text annotations (re-editable overlay layer). Optional for
   *  backwards-compat with older persisted entries. */
  annotations?: PersistedAnnotation[];
  /** Live shape/arrow annotations (re-editable overlay layer). Optional for
   *  backwards-compat with older persisted entries. */
  shapes?: PersistedShape[];
}

/** Parse the JSON emitted by `get_*_snapshot_annotations`. Drops tile_*
 *  fields since the tile is re-rendered on injection. */
export function parseSnapshotAnnotations(raw: string): PersistedAnnotation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<
      PersistedAnnotation & {
        tile_w?: number; tile_h?: number;
        tile_offset_x?: number; tile_offset_y?: number;
      }
    >;
    return parsed.map((a) => ({
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
  } catch {
    return [];
  }
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
      annotations: parseSnapshotAnnotations(t.get_undo_snapshot_annotations(i)),
    });
  }

  const redoCount = t.redo_snapshot_count();
  const redoStack: SnapEntry[] = [];
  for (let i = 0; i < redoCount; i++) {
    redoStack.push({
      png: new Uint8Array(t.get_redo_snapshot_png(i)),
      label: t.get_redo_snapshot_label(i),
      annotations: parseSnapshotAnnotations(t.get_redo_snapshot_annotations(i)),
    });
  }

  // Live (non-destructive) text annotations.
  let annotations: PersistedAnnotation[] = [];
  try {
    const raw = t.get_text_annotations();
    const parsed = JSON.parse(raw) as Array<
      PersistedAnnotation & { tile_w: number; tile_h: number; tile_offset_x: number; tile_offset_y: number }
    >;
    annotations = parsed.map((a) => ({
      id: a.id,
      text: a.text,
      x: a.x,
      y: a.y,
      font_size: a.font_size,
      r: a.r,
      g: a.g,
      b: a.b,
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
  } catch {
    annotations = [];
  }

  // Live (non-destructive) shape annotations.
  const shapes = parseShapes(t.get_shape_annotations());

  await idbSet<SavedEdit>(`edit-${photoId}`, {
    canvasW,
    canvasH,
    canvasPng,
    undoStack,
    redoStack,
    annotations,
    shapes,
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
