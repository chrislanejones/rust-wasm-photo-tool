// Op-log persistence — the night-project write/restore path (ADR-006:
// truth = original + op log; the working copy becomes a disposable cache).
//
// WRITE: `onOplogFlush(tool)` is called from flushToCanvas (same spot as the
// diagnostics probes). It debounces ~2s after the last change (or saves
// immediately once ≥25 unpersisted ops pile up), then commits ONE readwrite
// transaction covering opLogs + keyframes + the photos-row manifest. All
// encoding (op frames out of the engine, keyframe RGBA → PNG blob) happens
// BEFORE the transaction opens — IndexedDB auto-commit rule.
//
// Append vs rewrite: the engine's `oplog_generation()` bumps whenever an
// append drops a redo tail (history branched). Same generation ⇒ the
// persisted prefix is still valid and only the delta ops append as a new
// chunk; changed generation (or a shrunk log) ⇒ the photo's chunks +
// keyframes are rewritten from scratch inside the same transaction.
//
// RESTORE: `restoreOplog(tool, photoId)` loads manifest + chunks + the base
// keyframe, validates counts/versions, and hands everything to the engine's
// `oplog_restore` (which replays, rebuilds interior keyframes, seeks the
// persisted cursor, and swaps the document in). Returns "none" when there is
// nothing to restore (flag off / no manifest) and "failed" on any validation
// or decode problem — callers keep the existing working-copy path as the
// fallback for BOTH (this module never throws into the load path).
//
// Kill switch: build-time USE_OPLOG_PERSISTENCE (flags.ts, default OFF for
// dogfooding) OR the localStorage verification switch `ih_oplog_persist` —
// same pattern as ih_tiles_flush / ih_oplog_undo. Off = this module is
// completely inert and the existing persistence carries everything.

import {
  db,
  getOpLogChunks,
  latestKeyframeAtOrBefore,
  type KeyframeRecord,
  type OpLogChunkRecord,
  type PhotoOplogManifest,
} from "@/lib/dexie/db";
import { USE_OPLOG_PERSISTENCE } from "@/lib/dexie/flags";

const BRANCH = "main";
const DEBOUNCE_MS = 2000;
const OPS_PER_FORCED_SAVE = 25;

// ── Engine surface (feature-detected; absent on the default wasm build) ─────

export interface OplogPersistWasm {
  oplog_active(): boolean;
  oplog_is_broken(): boolean;
  oplog_op_count(): number;
  oplog_cursor(): number;
  oplog_generation(): number;
  oplog_encoded_ops(from: number, to: number): Uint8Array;
  oplog_mem_keyframe_ops(): Uint32Array;
  oplog_keyframe_pixels_rgba(atOp: number): Uint8Array;
  oplog_keyframe_annotations(atOp: number): Uint8Array;
  oplog_keyframe_width(atOp: number): number;
  oplog_keyframe_height(atOp: number): number;
  oplog_restore(
    baseRgba: Uint8Array,
    baseW: number,
    baseH: number,
    baseAnnotations: Uint8Array,
    frames: Uint8Array,
    cursor: number,
  ): boolean;
}

function hasPersistExports(t: object): t is OplogPersistWasm {
  return typeof (t as Partial<OplogPersistWasm>).oplog_encoded_ops === "function";
}

/** Build-time flag OR the DevTools verification switch. */
export function isOplogPersistenceEnabled(): boolean {
  if (USE_OPLOG_PERSISTENCE) return true;
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("ih_oplog_persist") === "1"
    );
  } catch {
    return false;
  }
}

// ── Injectable image codecs (OffscreenCanvas by default; tests inject) ──────

export type RgbaToBlob = (rgba: Uint8Array, w: number, h: number) => Promise<Blob>;
export type BlobToRgba = (blob: Blob, w: number, h: number) => Promise<Uint8Array>;

async function defaultRgbaToBlob(rgba: Uint8Array, w: number, h: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  // PNG only: keyframes must round-trip LOSSLESSLY (hash parity).
  return canvas.convertToBlob({ type: "image/png" });
}

async function defaultBlobToRgba(blob: Blob, w: number, h: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.drawImage(bitmap, 0, 0);
    return new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
  } finally {
    bitmap.close();
  }
}

let rgbaToBlob: RgbaToBlob = defaultRgbaToBlob;
let blobToRgba: BlobToRgba = defaultBlobToRgba;

/** Test seam: swap the image codecs (vitest has no OffscreenCanvas). */
export function setOplogCodecs(codecs: { rgbaToBlob?: RgbaToBlob; blobToRgba?: BlobToRgba }): void {
  if (codecs.rgbaToBlob) rgbaToBlob = codecs.rgbaToBlob;
  if (codecs.blobToRgba) blobToRgba = codecs.blobToRgba;
}

// ── Write path ───────────────────────────────────────────────────────────────

interface PersistedState {
  opCount: number;
  chunkCount: number;
  generation: number;
  cursor: number;
}

let activePhotoId: string | null = null;
const persistedCache = new Map<string, PersistedState>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saving = false;

/** The photo the current engine document belongs to. `null` disables the
 *  write path (e.g. a scratch canvas that isn't in the gallery yet). */
export function setActiveOplogPhoto(photoId: string | null): void {
  if (photoId !== activePhotoId && debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  activePhotoId = photoId;
}

/** Flush a still-debouncing save for the CURRENT photo right now — call
 *  before switching photos, while the engine still holds the outgoing
 *  document (a photo switch would otherwise drop the pending save). */
export async function flushPendingOplogSave(tool: object): Promise<void> {
  if (debounceTimer == null || !activePhotoId || !hasPersistExports(tool)) return;
  clearTimeout(debounceTimer);
  debounceTimer = null;
  const photoId = activePhotoId;
  try {
    await saveOplogNow(tool, photoId);
  } catch (e) {
    console.warn("[oplog-persist] flush-on-switch failed", e);
    persistedCache.delete(photoId);
  }
}

/** Debounced change detector — call after every engine flush (cheap: three
 *  number reads + a map lookup when inactive). */
export function onOplogFlush(tool: object): void {
  if (!isOplogPersistenceEnabled() || !hasPersistExports(tool)) return;
  const photoId = activePhotoId;
  if (!photoId || !tool.oplog_active()) return;
  const len = tool.oplog_op_count();
  const gen = tool.oplog_generation();
  const cursor = tool.oplog_cursor();
  const seen = persistedCache.get(photoId);
  if (seen && seen.opCount === len && seen.generation === gen && seen.cursor === cursor) {
    return; // nothing new
  }
  const backlog = seen && gen === seen.generation ? len - seen.opCount : len;
  if (debounceTimer != null) clearTimeout(debounceTimer);
  const delay = backlog >= OPS_PER_FORCED_SAVE ? 0 : DEBOUNCE_MS;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void saveOplogNow(tool, photoId).catch((e) => {
      console.warn("[oplog-persist] save failed; will retry on next change", e);
      persistedCache.delete(photoId); // force re-evaluation next flush
    });
  }, delay);
}

/** Persist the photo's log now (also the test entry point). One readwrite
 *  transaction; all encoding happens before it opens. */
export async function saveOplogNow(tool: object, photoId: string): Promise<void> {
  if (!hasPersistExports(tool) || saving) return;
  saving = true;
  try {
    const len = tool.oplog_op_count();
    const gen = tool.oplog_generation();
    const cursor = tool.oplog_cursor();

    // Resolve what's already on disk (cache → manifest table).
    let prior: PersistedState | undefined = persistedCache.get(photoId);
    if (!prior) {
      const m = await db.oplogManifests.get(photoId);
      if (m && m.branch === BRANCH) {
        prior = {
          opCount: m.opCount,
          chunkCount: m.chunkCount,
          generation: m.generation ?? -1,
          cursor: m.cursor ?? m.opCount,
        };
      }
    }
    const rewrite = !prior || prior.generation !== gen || len < prior.opCount;
    const fromOp = rewrite ? 0 : prior!.opCount;

    // ── Encode OUTSIDE the transaction ────────────────────────────────────
    const frames = fromOp < len ? tool.oplog_encoded_ops(fromOp, len) : new Uint8Array(0);
    const chunk: OpLogChunkRecord | null =
      fromOp < len
        ? {
            photoId,
            branch: BRANCH,
            chunkSeq: rewrite ? 0 : prior!.chunkCount,
            bytes: frames,
            opCount: len - fromOp,
            formatVersion: 1,
            createdAt: Date.now(),
          }
        : null;

    // Keyframes due: every log-resident keyframe not yet on disk (all of
    // them on a rewrite). The base (atOp 0) is what restore replays from;
    // interior ones are future partial-replay accelerators.
    const residentOps = Array.from(tool.oplog_mem_keyframe_ops());
    const existing = rewrite
      ? new Set<number>()
      : new Set(
          (
            await db.keyframes
              .where("[photoId+branch+atOp]")
              .between([photoId, BRANCH, 0], [photoId, BRANCH, Infinity], true, true)
              .toArray()
          ).map((k) => k.atOp),
        );
    const dueKeyframes: KeyframeRecord[] = [];
    for (const atOp of residentOps) {
      if (existing.has(atOp)) continue;
      const w = tool.oplog_keyframe_width(atOp);
      const h = tool.oplog_keyframe_height(atOp);
      const rgba = tool.oplog_keyframe_pixels_rgba(atOp);
      if (!w || !h || rgba.length !== w * h * 4) continue;
      dueKeyframes.push({
        photoId,
        branch: BRANCH,
        atOp,
        blob: await rgbaToBlob(rgba, w, h),
        annotations: tool.oplog_keyframe_annotations(atOp),
        width: w,
        height: h,
        createdAt: Date.now(),
      });
    }

    const manifest: PhotoOplogManifest = {
      photoId,
      branch: BRANCH,
      opCount: len,
      chunkCount: rewrite ? (chunk ? 1 : 0) : prior!.chunkCount + (chunk ? 1 : 0),
      formatVersion: 1,
      generation: gen,
      cursor,
      updatedAt: Date.now(),
    };

    // ── ONE transaction: chunks + keyframes + manifest ────────────────────
    await db.transaction("rw", db.opLogs, db.keyframes, db.oplogManifests, async () => {
      if (rewrite) {
        await db.opLogs.where("photoId").equals(photoId).delete();
        await db.keyframes.where("photoId").equals(photoId).delete();
      }
      if (chunk) await db.opLogs.put(chunk);
      if (dueKeyframes.length) await db.keyframes.bulkPut(dueKeyframes);
      await db.oplogManifests.put(manifest);
    });

    persistedCache.set(photoId, {
      opCount: len,
      chunkCount: manifest.chunkCount,
      generation: gen,
      cursor,
    });
  } finally {
    saving = false;
  }
}

// ── Restore path ─────────────────────────────────────────────────────────────

export type OplogRestoreResult = "restored" | "none" | "failed";

let warnedRestoreFailure = false;

/** Try to rebuild the engine's document + undo history from the persisted
 *  op log. "none" = nothing persisted (or flag off) — use the working-copy
 *  path as always. "failed" = data present but invalid — ALSO fall back
 *  (the op log is new truth, the old path is the safety net; ADR-006). */
export async function restoreOplog(tool: object, photoId: string): Promise<OplogRestoreResult> {
  if (!isOplogPersistenceEnabled() || !hasPersistExports(tool)) return "none";
  try {
    const m = await db.oplogManifests.get(photoId);
    if (!m || m.branch !== BRANCH) return "none";
    if (m.formatVersion !== 1) return "failed";

    const chunks = await getOpLogChunks(photoId, BRANCH);
    const covered = chunks.slice(0, m.chunkCount);
    if (covered.length !== m.chunkCount) return "failed";
    const totalOps = covered.reduce((n, c) => n + c.opCount, 0);
    if (totalOps !== m.opCount || covered.some((c) => c.formatVersion !== 1)) return "failed";

    const base = await latestKeyframeAtOrBefore(photoId, BRANCH, 0);
    if (!base || base.atOp !== 0) return "failed";
    const baseRgba = await blobToRgba(base.blob, base.width, base.height);

    const framesLen = covered.reduce((n, c) => n + c.bytes.length, 0);
    const frames = new Uint8Array(framesLen);
    let at = 0;
    for (const c of covered) {
      frames.set(c.bytes, at);
      at += c.bytes.length;
    }

    const cursor = Math.min(m.cursor ?? m.opCount, m.opCount);
    const ok = tool.oplog_restore(
      baseRgba,
      base.width,
      base.height,
      base.annotations ?? new Uint8Array(0),
      frames,
      cursor,
    );
    if (!ok) throw new Error("engine rejected the persisted log");
    persistedCache.set(photoId, {
      opCount: m.opCount,
      chunkCount: m.chunkCount,
      generation: m.generation ?? 0,
      cursor,
    });
    return "restored";
  } catch (e) {
    if (!warnedRestoreFailure) {
      warnedRestoreFailure = true;
      console.warn(
        "[oplog-persist] restore failed — falling back to the working-copy path",
        e,
      );
    }
    return "failed";
  }
}

/** Test seam: reset module state between tests. */
export function __resetOplogPersistenceForTests(): void {
  activePhotoId = null;
  persistedCache.clear();
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = null;
  saving = false;
  warnedRestoreFailure = false;
}
