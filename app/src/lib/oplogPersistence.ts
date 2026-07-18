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
// Append vs rewrite: appending a delta onto already-persisted chunks is only
// sound when the engine's LIVE log is provably the same log those chunks
// describe. That proof is the BINDING below — established by a successful
// restore or a completed save, held against the engine object itself, and
// voided the moment the document is reset (every load path builds a fresh
// `ImageHorseTool`). Bound + same `oplog_generation()` (which bumps only when
// an append drops a redo tail) + a log that has not shrunk ⇒ append the delta.
// ANY doubt ⇒ rewrite the photo's chunks + keyframes from scratch inside the
// same transaction. Generation alone is NOT an identity — a fresh log always
// starts at generation 0, so trusting the on-disk manifest would let a new
// log's ops splice onto a previous session's chunks (wrong base, mixed
// histories). Rewriting is the only safe answer when unbound.
//
// RESTORE: `restoreOplog(tool, photoId)` loads manifest + chunks + the base
// keyframe, validates counts/versions, and hands everything to the engine's
// `oplog_restore` (which replays, rebuilds interior keyframes, seeks the
// persisted cursor, and swaps the document in). Returns "none" when there is
// nothing to restore (flag off / no manifest) and "failed" on any validation
// or decode problem — callers keep the existing working-copy path as the
// fallback for BOTH (this module never throws into the load path).
//
// Kill switch: build-time USE_OPLOG_PERSISTENCE (flags.ts, ON since the
// 2026-07-17 flip) with `ih_oplog_persist = "0"` as the per-profile disable —
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
import { registerOplogPersistStats } from "@/lib/resourceMonitor";

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
  /** Engine-codec PNG surface (preferred): byte-exact encode/decode inside
   *  the wasm, no browser canvas involved. Optional so older tiles builds
   *  and test fakes without it fall back to the RGBA + JS-codec path. */
  oplog_keyframe_png?(atOp: number): Uint8Array;
  oplog_restore_png?(
    basePng: Uint8Array,
    baseAnnotations: Uint8Array,
    frames: Uint8Array,
    cursor: number,
  ): boolean;
  /** CONTENT-layer count — the op log models a single-PIXEL-layer document, so
   *  >1 means the persisted log cannot describe what the user is looking at.
   *  The Canvas (the artboard fill) is document metadata and does NOT count
   *  (ADR-016): a default Canvas + Photo document answers 1.
   *
   *  Optional: test fakes and older builds without it fall back to
   *  `layer_count()`, and then to 1. */
  content_layer_count?(): number;
  /** TOTAL layers, Canvas included. Only the fallback for engines built before
   *  `content_layer_count` existed — do NOT gate the log on this: on a default
   *  document it reads 2 (Canvas + Photo), which is what kept op-log undo and
   *  persistence dark for every user on defaults. */
  layer_count?(): number;
}

function hasPersistExports(t: object): t is OplogPersistWasm {
  return typeof (t as Partial<OplogPersistWasm>).oplog_encoded_ops === "function";
}

/** Whether the engine's log still describes the document the user has.
 *
 *  False in exactly the two cases the engine can no longer reconcile:
 *  `oplog_is_broken()` (an unrecorded edit — clone stamp, filter, mask —
 *  desynced the log; snapshot undo has taken over) and a document with more
 *  than one CONTENT layer (out of op-log scope; `oplog_record` drops or breaks
 *  the log). In both, ANY log already on disk for this photo is now a faithful
 *  description of a document that no longer exists — persisting more of it,
 *  or restoring from it, silently hands the user back an older document.
 *  Note this is deliberately NOT `oplog_active()`: that is also false when
 *  there is simply no log yet (a freshly-loaded photo), which is harmless.
 *
 *  The count is CONTENT layers, not total layers (ADR-016). The artboard fill
 *  is metadata the log carries, not content it records, so a default
 *  Canvas + Photo document is ONE pixel layer and is trustworthy. Reading
 *  `layer_count()` here — which answers 2 on that document — is precisely what
 *  made this return false for every user on defaults, leaving op-log
 *  persistence dark no matter how the flags were set. */
function isLogTrustworthy(tool: OplogPersistWasm): boolean {
  if (tool.oplog_is_broken()) return false;
  const layers =
    typeof tool.content_layer_count === "function"
      ? tool.content_layer_count()
      : typeof tool.layer_count === "function"
        ? tool.layer_count()
        : 1;
  return layers <= 1;
}

/** Build-time flag, with the DevTools key as a per-profile KILL switch.
 *  Default ON since the 2026-07-17 flip; `ih_oplog_persist = "0"` disables
 *  for one profile (ADR-017's pre-mortem requires this to stay available
 *  until the codec has real production mileage). `"1"` still force-enables
 *  when the build flag is off — the old dogfood semantics. */
export function isOplogPersistenceEnabled(): boolean {
  try {
    if (typeof window !== "undefined") {
      const v = window.localStorage.getItem("ih_oplog_persist");
      if (v === "0") return false;
      if (v === "1") return true;
    }
  } catch {
    // localStorage unavailable — fall through to the build flag.
  }
  return USE_OPLOG_PERSISTENCE;
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
  // Fallback path only (engine-PNG surface absent). The options matter:
  // without them Chrome may color-convert and premultiply on decode, which
  // is NOT byte-faithful — the exact corruption the 2026-07-11 real-gallery
  // check caught on a restored base keyframe.
  const bitmap = await createImageBitmap(blob, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
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

/** Engine identity, without holding the engine. A discarded `ImageHorseTool`
 *  must stay collectable (wasm-bindgen frees its wasm document on GC), so the
 *  binding stores a token, not the object: the WeakMap tags each tool the
 *  first time it is seen and forgets it with the tool. */
const toolTokens = new WeakMap<object, number>();
let nextToolToken = 1;

function toolToken(tool: object): number {
  let token = toolTokens.get(tool);
  if (token === undefined) {
    token = nextToolToken++;
    toolTokens.set(tool, token);
  }
  return token;
}

/** "The log the engine `tool` is holding RIGHT NOW is the one persisted under
 *  `photoId`, at these counts." The only thing that licenses an append instead
 *  of a rewrite. Every document reset constructs a new `ImageHorseTool`
 *  (useCloneStamp's load paths), so the token comparison voids the binding
 *  automatically — no call site has to remember to invalidate it. */
interface Binding {
  toolToken: number;
  photoId: string;
  opCount: number;
  chunkCount: number;
  generation: number;
  cursor: number;
}

let activePhotoId: string | null = null;
let bound: Binding | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saving = false;
/** Photos whose persisted log this session has already marked stale — keeps
 *  the invalidation to one manifest read + one write per photo, per session. */
const invalidated = new Set<string>();

/** The binding, IFF it still describes this engine + this photo. */
function boundTo(tool: object, photoId: string): Binding | null {
  if (!bound || bound.photoId !== photoId) return null;
  return bound.toolToken === toolToken(tool) ? bound : null;
}

/** The engine's log no longer describes this photo's document (broken, or the
 *  document went multi-layer). Mark the persisted log stale so `restoreOplog`
 *  skips it and the working-copy/archive path — which IS current — carries the
 *  resume. Non-destructive on purpose: the chunks and keyframes are left in
 *  place (reversible, inspectable) and are reclaimed by the next healthy save
 *  or by `deletePhoto`'s cascade. */
async function invalidatePersistedLog(photoId: string, reason: string): Promise<void> {
  if (invalidated.has(photoId)) return;
  invalidated.add(photoId); // claim first: at most one DB round-trip per photo
  if (bound?.photoId === photoId) bound = null;
  try {
    const m = await db.oplogManifests.get(photoId);
    if (!m || m.stale) return;
    await db.oplogManifests.put({ ...m, stale: true, updatedAt: Date.now() });
    registerOplogPersistStats({
      photoId,
      source: "retired",
      ops: m.opCount,
      keyframes: await db.keyframes.where("photoId").equals(photoId).count(),
      chunks: m.chunkCount,
      stale: true,
      at: Date.now(),
    });
    console.warn(
      `[oplog-persist] log no longer describes photo ${photoId} (${reason}) — persisted log marked stale; resume falls back to the working copy`,
    );
  } catch (e) {
    invalidated.delete(photoId); // let a later flush retry the marking
    console.warn("[oplog-persist] could not mark the persisted log stale", e);
  }
}

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
    bound = null; // unknown disk state ⇒ the next save rewrites
  }
}

/** Debounced change detector — call after every engine flush (cheap: three
 *  number reads + a map lookup when inactive). */
export function onOplogFlush(tool: object): void {
  if (!isOplogPersistenceEnabled() || !hasPersistExports(tool)) return;
  const photoId = activePhotoId;
  if (!photoId) return;
  // The log stopped describing the document ⇒ never write it, and retire
  // whatever is already on disk (it describes a document the user no longer
  // has). Checked BEFORE oplog_active(), which is false in this case too.
  if (!isLogTrustworthy(tool)) {
    void invalidatePersistedLog(photoId, "unrecorded edit or multi-layer");
    return;
  }
  if (!tool.oplog_active()) return; // no log yet — nothing to save
  // A live log with ZERO ops is never persisted: it has nothing the working
  // copy doesn't already carry, and its lazily-captured base may predate
  // unlogged setup edits (the 2026-07-14 A/B: a default import's base was the
  // PRE-artboard photo — persisting and then "successfully" restoring it
  // destroyed the Canvas and shrank the document). And if a log for this
  // photo is already on disk, an empty live log means the engine is not
  // holding the document that log describes — retire it (stale flag only,
  // rows kept; reversible) so the working copy carries the resume.
  if (tool.oplog_op_count() === 0) {
    void invalidatePersistedLog(photoId, "empty live log");
    return;
  }
  const len = tool.oplog_op_count();
  const gen = tool.oplog_generation();
  const cursor = tool.oplog_cursor();
  // The no-op check is bound to the ENGINE, not just the photo id: a fresh log
  // on the same photo (AI result, re-load) can carry byte-identical counters,
  // and treating that as "nothing new" would silently leave the previous
  // document persisted as this photo's truth.
  const seen = boundTo(tool, photoId);
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
      bound = null; // unknown disk state ⇒ the next save rewrites
    });
  }, delay);
}

/** Persist the photo's log now (also the test entry point). One readwrite
 *  transaction; all encoding happens before it opens. */
export async function saveOplogNow(tool: object, photoId: string): Promise<void> {
  if (!hasPersistExports(tool) || saving) return;
  saving = true;
  try {
    // Re-checked at fire time, not just when the save was scheduled: a save
    // debounced BEFORE an unrecorded edit (or a new layer) would otherwise
    // land afterwards and persist a log that is missing it.
    if (!isLogTrustworthy(tool)) {
      await invalidatePersistedLog(photoId, "unrecorded edit or multi-layer");
      return;
    }
    // Fire-time zero-op recheck (same reasoning as onOplogFlush): never write
    // an empty log as a restorable document, and retire any on-disk log this
    // engine is no longer holding. Covers the direct entry points too
    // (flushPendingOplogSave, tests) — e.g. `load_image` on a live tool drops
    // the log to None, and writing "opCount 0" for it would delete the
    // photo's chunks and leave a confidently-restorable empty manifest.
    if (tool.oplog_op_count() === 0) {
      await invalidatePersistedLog(photoId, "empty live log");
      return;
    }
    const len = tool.oplog_op_count();
    const gen = tool.oplog_generation();
    const cursor = tool.oplog_cursor();

    // Append ONLY against a live binding — i.e. this engine's log is provably
    // the persisted one. Anything else (fresh engine, reset document, restore
    // that never happened, a save that failed) rewrites from scratch. The
    // on-disk manifest is deliberately NOT consulted here: it cannot prove
    // whose log it describes, and trusting it is how a new log's ops end up
    // spliced onto a previous session's chunks.
    const prior = boundTo(tool, photoId);
    const rewrite = !prior || prior.generation !== gen || len < prior.opCount;
    const fromOp = rewrite ? 0 : prior.opCount;

    // ── Encode OUTSIDE the transaction ────────────────────────────────────
    const frames = fromOp < len ? tool.oplog_encoded_ops(fromOp, len) : new Uint8Array(0);
    const chunk: OpLogChunkRecord | null =
      fromOp < len
        ? {
            photoId,
            branch: BRANCH,
            chunkSeq: rewrite || !prior ? 0 : prior.chunkCount,
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
      if (!w || !h) continue;
      // Preferred: the engine's own PNG codec — byte-exact, no browser
      // canvas transforms. Fallback: raw RGBA through the injectable JS
      // codec (older builds / tests).
      let blob: Blob;
      if (typeof tool.oplog_keyframe_png === "function") {
        const png = tool.oplog_keyframe_png(atOp);
        if (!png.length) continue;
        // Copy: the wasm-returned view may sit on a SharedArrayBuffer-typed
        // buffer TS won't accept as a BlobPart.
        blob = new Blob([new Uint8Array(png)], { type: "image/png" });
      } else {
        const rgba = tool.oplog_keyframe_pixels_rgba(atOp);
        if (rgba.length !== w * h * 4) continue;
        blob = await rgbaToBlob(rgba, w, h);
      }
      dueKeyframes.push({
        photoId,
        branch: BRANCH,
        atOp,
        blob,
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
      chunkCount:
        rewrite || !prior ? (chunk ? 1 : 0) : prior.chunkCount + (chunk ? 1 : 0),
      formatVersion: 1,
      generation: gen,
      cursor,
      // This log is healthy and (on a rewrite) freshly written — clear any
      // stale mark a previous break left behind.
      stale: false,
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

    // The engine's live log IS the persisted log now — bind, so the next save
    // may append its delta instead of rewriting.
    bound = {
      toolToken: toolToken(tool),
      photoId,
      opCount: len,
      chunkCount: manifest.chunkCount,
      generation: gen,
      cursor,
    };
    invalidated.delete(photoId); // healthy again; a later break re-marks it
    registerOplogPersistStats({
      photoId,
      source: "saved",
      ops: len,
      keyframes: await db.keyframes.where("photoId").equals(photoId).count(),
      chunks: manifest.chunkCount,
      stale: false,
      at: Date.now(),
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
    // Retired log: it replays perfectly, but into a document the user no
    // longer has (an unrecorded edit desynced it, or the document went
    // multi-layer). "none", not "failed" — nothing is wrong, this log simply
    // isn't the truth any more; the working copy / archive is.
    if (m.stale) return "none";
    // A zero-op log is not a restorable document. It has nothing to replay
    // that the working copy doesn't already have — and the write path used to
    // persist empty logs whose base predated unlogged setup edits, so
    // "restoring" one could hand back a document the user never saw (the
    // 2026-07-14 A/B: a default 220×170 import came back as the bare 200×150
    // photo, Canvas destroyed, because this path reported success and
    // short-circuited the working-copy fallback). The write path no longer
    // persists them; this guard also covers zero-op manifests ALREADY on
    // disk. "none", not "failed": nothing is corrupt — there is simply
    // nothing here worth restoring.
    if (m.opCount === 0) return "none";
    if (m.formatVersion !== 1) return "failed";

    const chunks = await getOpLogChunks(photoId, BRANCH);
    const covered = chunks.slice(0, m.chunkCount);
    if (covered.length !== m.chunkCount) return "failed";
    const totalOps = covered.reduce((n, c) => n + c.opCount, 0);
    if (totalOps !== m.opCount || covered.some((c) => c.formatVersion !== 1)) return "failed";

    const base = await latestKeyframeAtOrBefore(photoId, BRANCH, 0);
    if (!base || base.atOp !== 0) return "failed";

    const framesLen = covered.reduce((n, c) => n + c.bytes.length, 0);
    const frames = new Uint8Array(framesLen);
    let at = 0;
    for (const c of covered) {
      frames.set(c.bytes, at);
      at += c.bytes.length;
    }

    const cursor = Math.min(m.cursor ?? m.opCount, m.opCount);
    const annotations = base.annotations ?? new Uint8Array(0);
    // Preferred: hand the PNG bytes straight to the engine codec (the blob
    // stores the engine's own encode when the surface exists). Fallback:
    // decode in JS and use the RGBA entry point.
    let ok: boolean;
    if (typeof tool.oplog_restore_png === "function") {
      const png = new Uint8Array(await base.blob.arrayBuffer());
      ok = tool.oplog_restore_png(png, annotations, frames, cursor);
    } else {
      const baseRgba = await blobToRgba(base.blob, base.width, base.height);
      ok = tool.oplog_restore(baseRgba, base.width, base.height, annotations, frames, cursor);
    }
    if (!ok) throw new Error("engine rejected the persisted log");
    // The engine now holds exactly the persisted log ⇒ bind it, so the next
    // save appends its delta. The generation is read back from the ENGINE
    // (a rebuilt log restarts at 0 — see ops.rs `with_base`), not from the
    // manifest: it is the engine's future bumps we compare against.
    bound = {
      toolToken: toolToken(tool),
      photoId,
      opCount: m.opCount,
      chunkCount: m.chunkCount,
      generation: tool.oplog_generation(),
      cursor,
    };
    registerOplogPersistStats({
      photoId,
      source: "restored",
      ops: m.opCount,
      keyframes: await db.keyframes.where("photoId").equals(photoId).count(),
      chunks: m.chunkCount,
      stale: false,
      at: Date.now(),
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
  bound = null;
  invalidated.clear();
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = null;
  saving = false;
  warnedRestoreFailure = false;
}
