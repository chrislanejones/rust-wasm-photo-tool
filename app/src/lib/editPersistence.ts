/**
 * Per-photo edit persistence via IndexedDB.
 *
 * Stores the current canvas state + full undo/redo history as PNG blobs so
 * switching between photos preserves every edit and every undo step.
 */

import type { RefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";

import { logDiagnostic } from "./diagnosticsLog";
import { engineHolds, getEngineDocument } from "./engineDocument";

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
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      // Browsers close idle IndexedDB connections on their own, and a cached
      // CLOSED connection throws InvalidStateError on every transaction after
      // that — which here is every edit save for the rest of the session.
      // Dropping the cache lets the next call reopen. (This store caches the
      // CONNECTION rather than the promise, so unlike its three siblings a
      // failed open was never cached; only the close case needed fixing.)
      _db.onclose = () => {
        _db = null;
      };
      resolve(_db);
    };
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
  // Drop shadow (optional — old persisted entries lack these).
  shadow_box?: boolean;
  shadow_text?: boolean;
  shadow_r?: number;
  shadow_g?: number;
  shadow_b?: number;
  shadow_a?: number;
  shadow_dx?: number;
  shadow_dy?: number;
  shadow_blur?: number;
}

/** One live (non-destructive) shape/arrow annotation, as emitted by Rust's
 *  `get_shape_annotations`. The `id` is regenerated on restore. */
export interface PersistedShape {
  id?: number;
  kind: number; // 0=rect,1=circle,2=line,3=handCircle,4=arrow,5=pin,6=polyline
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  g: number;
  b: number;
  stroke_width: number;
  arrow_style: number;
  /** Pin sequence index (kind 5). */
  number?: number;
  /** Pin label style (kind 5): 0 = number, 1 = letter. Absent on older saves. */
  label_kind?: number;
  /** Interior fill (rect/circle): 0 none, 1 solid, 2 linear gradient. Older
   *  saves omit these — treat absent as 0/no-fill on restore. */
  fill_kind?: number;
  fill_r?: number; fill_g?: number; fill_b?: number; fill_a?: number;
  fill2_r?: number; fill2_g?: number; fill2_b?: number; fill2_a?: number;
  fill_angle?: number;
  /** Mosaic block size (px) for fill_kind 3 (pixelate). Absent on older saves. */
  fill_block?: number;
  /** Polyline vertices (kind 6) as [[x,y],…]. */
  points?: number[][];
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

/** One persisted layer: pixels (PNG) + metadata + its own overlays. */
export interface PersistedLayer {
  id: number;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  /** Layer pixels, PNG-encoded (raw layer buffer, not composited). */
  png: Uint8Array;
  annotations: PersistedAnnotation[];
  shapes: PersistedShape[];
}

/** Metadata shape of one entry in `get_layers()` JSON. */
interface LayerMeta {
  id: number;
  name: string;
  visible: boolean;
  opacity: number;
  active: boolean;
}

/** Everything one `capture_state()` call hands back, already decoded into the
 *  shapes the two save paths were building by hand. */
export interface CapturedState {
  canvasW: number;
  canvasH: number;
  canvasPng: Uint8Array;
  undoStack: SnapEntry[];
  redoStack: SnapEntry[];
  /** Live text overlays, tile cache stripped — same as `stripLiveAnnotations`. */
  annotations: PersistedAnnotation[];
  shapes: PersistedShape[];
  layers: PersistedLayer[];
  activeLayerId: number;
}

const CAPTURE_MAGIC = 0x49484353; // "IHCS"
const CAPTURE_VERSION = 1;

/**
 * Decode the engine's one-call state capture. ADR-024 Stage 3.5.
 *
 * WHY THIS REPLACES ~18 SEPARATE READS. `useEditPersistence.ts` states the
 * invariant the save path depends on: "Everything above reads the engine, and
 * there is not a single `await` in it. That is load-bearing, not incidental."
 * `detachCloudUpload` lets a photo switch return the moment the local write
 * lands rather than blocking ~13s on the network, and that is only safe
 * because the bytes were already captured. A capture that yields midway can
 * have the switch complete underneath it, so the second half of the archive
 * describes the INCOMING photo while being stored under the OUTGOING photo's
 * key.
 *
 * Converting those reads one-by-one — Stage 3.5's mechanical instruction —
 * creates exactly that. One call cannot be interleaved, so the sequence is
 * removed rather than guarded.
 *
 * The frame is TRANSPORT only, never persisted: `savePhotoEdit` and
 * `encodeArchive` still own what lands on disk. See `src/capture.rs`.
 */
export function decodeCapture(blob: Uint8Array): CapturedState {
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  let p = 0;
  const u32 = () => {
    const v = dv.getUint32(p, true);
    p += 4;
    return v;
  };
  // Copies rather than subarray views: these outlive the frame (they go into
  // IndexedDB and, on the cloud path, into an upload), and a view would pin
  // the whole capture buffer alive behind every snapshot PNG.
  const bytes = () => {
    const n = u32();
    const out = blob.slice(p, p + n);
    p += n;
    return out;
  };
  const dec = new TextDecoder();
  const text = () => dec.decode(bytes());

  const magic = u32();
  const version = u32();
  if (magic !== CAPTURE_MAGIC || version !== CAPTURE_VERSION) {
    // Loud, not silent. A mismatch means the wasm and the JS disagree about
    // the frame — almost always a stale `pkg/` — and a half-decoded archive
    // written to IndexedDB is far worse than a failed save.
    throw new Error(
      `capture_state frame mismatch (magic 0x${magic.toString(16)}, version ${version}). ` +
        "The engine and this decoder disagree — rebuild with `pnpm run build:wasm`.",
    );
  }

  const canvasW = u32();
  const canvasH = u32();
  const canvasPng = bytes();

  const readStack = (): SnapEntry[] => {
    const n = u32();
    const out: SnapEntry[] = [];
    for (let i = 0; i < n; i++) {
      const label = text();
      const png = bytes();
      const annotations = parseSnapshotAnnotations(text());
      out.push({ png, label, annotations });
    }
    return out;
  };
  const undoStack = readStack();
  const redoStack = readStack();

  const annotations = stripLiveAnnotations(text());
  const shapes = parseShapes(text());

  let metas: LayerMeta[];
  try {
    metas = JSON.parse(text()) as LayerMeta[];
  } catch {
    metas = [];
  }
  const layerCount = u32();
  const layers: PersistedLayer[] = [];
  for (let i = 0; i < layerCount; i++) {
    const png = bytes();
    const layerAnnotations = parseSnapshotAnnotations(text());
    const layerShapes = parseShapes(text());
    const m = metas[i];
    // Metadata and pixels are indexed the same way by the engine. If they ever
    // disagree in length, prefer keeping the pixels over dropping a layer.
    layers.push({
      id: m?.id ?? i,
      name: m?.name ?? `Layer ${i + 1}`,
      visible: m?.visible ?? true,
      opacity: m?.opacity ?? 1,
      png,
      annotations: layerAnnotations,
      shapes: layerShapes,
    });
  }

  const activeLayerId = u32();

  if (p !== blob.byteLength) {
    throw new Error(
      `capture_state frame not fully consumed (${p} of ${blob.byteLength} bytes) — ` +
        "the decoder and the engine's writer have drifted.",
    );
  }

  return {
    canvasW,
    canvasH,
    canvasPng,
    undoStack,
    redoStack,
    annotations,
    shapes,
    layers,
    activeLayerId,
  };
}

// `collectLayers(t)` used to live here and read the layer stack out of the
// engine one call at a time. Both of its callers — the IDB path below and the
// Convex path in `useEditPersistence.ts` — now get the stack from
// `decodeCapture(t.capture_state())` instead, so it had no callers left.
//
// Deleted rather than kept: this is supersession, not the zero-reference
// export that turned out to be a MISSING WIRE last time (`useRealTier`, the
// paid-tier gating bug). The difference is that here the reason is known —
// its two call sites were replaced in the same change — and it was checked
// repo-wide before removal, not assumed dead from a grep.

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
  /** Full layer stack, bottom → top (archive v5+). Absent ≡ legacy single
   *  layer (rebuilt from canvasPng + annotations/shapes). */
  layers?: PersistedLayer[];
  /** Id of the active layer within `layers`. */
  activeLayerId?: number;
}

/** THE one place live text annotations are prepared for persistence.
 *
 *  Drops `tile_*` (the pre-rendered, possibly pre-rotated tile cache — it is
 *  re-rendered on restore, so persisting it bakes in something stale) and keeps
 *  every field of `PersistedAnnotation`.
 *
 *  WHY IT IS SHARED (#22). This map existed TWICE — here for the local
 *  IndexedDB save, and again inline in the cloud-archive path in
 *  `hooks/useEditPersistence.ts` — and the copies had drifted: the cloud one
 *  stopped at `bg_tail` and silently dropped all NINE `shadow_*` fields. Local
 *  restore kept your drop shadows; cross-device restore lost them, with no
 *  error either side. Two copies of an allowlist is the bug; one exported
 *  function is the fix, and `editPersistence.stripDrift.test.ts` pins that the
 *  set it emits is exactly the input minus `tile_*`.
 *
 *  Invisible until v7.56, because the cloud path never ran in production. */
export function stripLiveAnnotations(raw: string): PersistedAnnotation[] {
  try {
    const parsed = JSON.parse(raw) as Array<
      PersistedAnnotation & {
        tile_w: number; tile_h: number;
        tile_offset_x: number; tile_offset_y: number;
      }
    >;
    return parsed.map((a) => ({
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
      shadow_box: a.shadow_box,
      shadow_text: a.shadow_text,
      shadow_r: a.shadow_r,
      shadow_g: a.shadow_g,
      shadow_b: a.shadow_b,
      shadow_a: a.shadow_a,
      shadow_dx: a.shadow_dx,
      shadow_dy: a.shadow_dy,
      shadow_blur: a.shadow_blur,
    }));
  } catch {
    return [];
  }
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
      shadow_box: a.shadow_box,
      shadow_text: a.shadow_text,
      shadow_r: a.shadow_r,
      shadow_g: a.shadow_g,
      shadow_b: a.shadow_b,
      shadow_a: a.shadow_a,
      shadow_dx: a.shadow_dx,
      shadow_dy: a.shadow_dy,
      shadow_blur: a.shadow_blur,
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
 *
 * Returns whether the archive was actually written. `false` means either there
 * was no engine to read or the OWNERSHIP GUARD refused — the engine was holding
 * a different photo's document, so writing it under `photoId` would have
 * corrupted that photo's archive (see lib/engineDocument.ts for the measured
 * sequence). Callers with a second persistence leg — the Convex upload in
 * `hooks/useEditPersistence` — must gate it on this, or they will push the
 * wrong pixels to the cloud after the local write was correctly refused.
 *
 * A refusal is deliberately quiet: no toast, no throw. It means the user's work
 * is still safe in the engine and the save will land under the right id once
 * the document catches up, which is not an event worth interrupting anyone for.
 * The Diagnostics line is there so it is never invisible.
 */
export async function savePhotoEdit(
  photoId: string,
  toolRef: RefObject<ImageHorseTool | null>,
): Promise<boolean> {
  const t = toolRef.current;
  if (!t) return false;

  // Ahead of export_png() on purpose: a refused save should cost nothing, and
  // encoding a full canvas we are about to discard is the expensive part.
  if (!engineHolds(photoId)) {
    logDiagnostic(
      "CONSOLE",
      `Save refused: engine holds ${getEngineDocument() ?? "nothing"}, not ${photoId}`,
    );
    return false;
  }

  // ONE call, not eighteen. ADR-024 Stage 3.5 — see `decodeCapture` above for
  // why the sequence was removed rather than converted call-by-call. The whole
  // document is read while the engine cannot change, which is the property the
  // old run of separate reads had only by virtue of being synchronous.
  const {
    canvasW,
    canvasH,
    canvasPng,
    undoStack,
    redoStack,
    annotations,
    shapes,
    layers,
    activeLayerId,
  } = decodeCapture(t.capture_state());

  await idbSet<SavedEdit>(`edit-${photoId}`, {
    canvasW,
    canvasH,
    canvasPng,
    undoStack,
    redoStack,
    annotations,
    shapes,
    layers,
    activeLayerId,
  });
  return true;
}

/** Return the persisted edit for a photo, or null if none exists. */
export async function loadPhotoEdit(photoId: string): Promise<SavedEdit | null> {
  return (await idbGet<SavedEdit>(`edit-${photoId}`)) ?? null;
}

/** Remove the persisted edit for a photo (e.g. when the photo is deleted). */
export async function deletePhotoEdit(photoId: string): Promise<void> {
  await idbDel(`edit-${photoId}`);
}

/** Copy a photo's persisted edit onto a new photo id (gallery Duplicate). The
 *  stored archive — canvas + undo/redo snapshots produced by Rust's
 *  `export_png` — is structure-cloned as-is, so no re-encode is needed. No-op
 *  when the source has no saved edit (a pristine original). */
export async function copyPhotoEdit(srcId: string, destId: string): Promise<void> {
  const edit = await idbGet<SavedEdit>(`edit-${srcId}`);
  if (edit) await idbSet<SavedEdit>(`edit-${destId}`, edit);
}

/** Wipe all persisted edits (e.g. Delete All). */
export async function clearAllEdits(): Promise<void> {
  await idbClear();
}
