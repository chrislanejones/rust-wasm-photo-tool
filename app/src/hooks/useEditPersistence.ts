import { useCallback, useRef } from "react";
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
  stripLiveAnnotations,
} from "@/lib/editPersistence";
import type {
  SavedEdit,
  SnapEntry,
  PersistedAnnotation,
  PersistedShape,
  PersistedLayer,
} from "@/lib/editPersistence";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { mayUpload, recordUpload } from "@/lib/uploadBudget";

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

/** The 8-byte PNG signature. The ONLY thing that makes a non-archive blob a
 *  legitimate legacy single-PNG edit rather than corruption. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function looksLikePng(data: Uint8Array): boolean {
  return data.byteLength >= 8 && PNG_MAGIC.every((b, i) => data[i] === b);
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

/** Ceiling on any single cloud round-trip during a save. Generous enough for a
 *  large archive on a slow line, short enough that a wedged deployment costs a
 *  pause rather than a dead gallery. */
const CLOUD_STEP_TIMEOUT_MS = 8000;

/** Bound a promise that might never settle.
 *
 *  A rejection reaches a `catch`; a HANG does not, and that is the failure this
 *  guards. `generateUploadUrl()` is a Convex mutation that neither resolves nor
 *  rejects when the deployment is unreachable, and every caller of
 *  `savePhotoEdit` awaits it — so one hung mutation stopped the user changing
 *  photos at all until they deleted the offending one. Racing does not cancel
 *  the underlying request; it frees the caller, which is the part that matters.
 *  The local IndexedDB copy is already on disk by the time any of this runs, so
 *  giving up on the cloud leg loses nothing but freshness. */
/** Content hash of an already-encoded archive.
 *
 *  Deliberately hashing the ARCHIVE BYTES rather than tracking undo depth.
 *  Undo depth is the obvious signal and it is lossy: paint A (depth 1) → sync →
 *  undo (depth 0) → paint B (depth 1, redo cleared) puts the counters back
 *  exactly where they were with entirely different pixels underneath, so a
 *  depth-keyed skip drops stroke B. Engine mutators that snapshot are not the
 *  problem — `set_artboard_border` and `update_text_annotation` both call
 *  `snap()` — the collision is undo followed by a fresh edit, which is an
 *  ordinary thing to do.
 *
 *  Identical bytes, by contrast, mean the upload is redundant as a matter of
 *  fact rather than inference. A few ms of SHA-256 against a 13-second upload
 *  is not a trade worth agonising over. */
async function archiveHash(archive: Uint8Array): Promise<string | null> {
  // `crypto.subtle` only exists in a secure context. A dev server reached over
  // a LAN IP is not one, and there this would throw — into the catch that
  // reports "cloud save failed", silently disabling sync altogether. Null means
  // "cannot tell", and the caller uploads, which is the shipped behaviour.
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const buf = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${what} did not settle within ${CLOUD_STEP_TIMEOUT_MS}ms`)),
        CLOUD_STEP_TIMEOUT_MS,
      ),
    ),
  ]);
}

export function useEditPersistence() {
  // isAuthenticated stays false until the JWT handshake with Convex succeeds,
  // so mismatched keys keep the app on the local IDB path rather than crashing.
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.photoEdits.generateUploadUrl);
  const saveEdit = useMutation(api.photoEdits.save);
  const removeEdit = useMutation(api.photoEdits.remove);
  const clearAllConvex = useMutation(api.photoEdits.clearAll);

  // photoId → hash of the archive last successfully synced to Convex. Session
  // -lived on purpose: a reload re-uploads once per photo, which is the cheap
  // direction to be wrong in. Entries are dropped on delete/clear below, or a
  // photo whose cloud record was removed would look synced and never come back.
  const lastUploadedRef = useRef(new Map<string, string>());

  const savePhotoEdit = useCallback(
    async (
      photoId: string,
      toolRef: RefObject<ImageHorseTool | null>,
      opts?: { detachCloudUpload?: boolean },
    ) => {
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
      //
      // The return value is the OWNERSHIP GUARD's verdict, and the cloud leg
      // below has to respect it. This block does not re-use anything the local
      // save computed — it re-reads the engine and builds its own archive — so
      // without this gate a refused local write would still upload the wrong
      // photo's pixels, and the cloud copy would be the corrupt one. Same bug,
      // one layer further out, and harder to see because it only reproduces
      // signed in.
      const written = await idbSave(photoId, toolRef);
      if (!written) return false;

      if (isAuthenticated) {
        try {
          const tool = toolRef.current;
          // Unreachable in practice — idbSave returns false without a tool, so
          // the gate above already returned. Kept as a type narrower, and it
          // reports the local write that did happen.
          if (!tool) return true;

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

          // Live text annotations (re-editable overlay). Strip tile_* so we
          // don't bake a stale pre-rotated tile cache into the archive — tiles
          // are re-rendered on load.
          //
          // This used to be its own inline copy of the map, and it had drifted:
          // it stopped at `bg_tail` and silently dropped all nine `shadow_*`
          // fields, so a cross-device restore lost drop shadows while a local
          // restore kept them (#22). It shares `stripLiveAnnotations` with the
          // local path now, so the two cannot disagree again.
          const annotationsJson = JSON.stringify(
            stripLiveAnnotations(tool.get_text_annotations()),
          );

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

          // ── END OF THE SYNCHRONOUS CAPTURE ──────────────────────────────
          // Everything above reads the engine, and there is not a single
          // `await` in it. That is load-bearing, not incidental.
          //
          // `detachCloudUpload` lets a photo switch return the moment the
          // local write is done instead of waiting ~13s on the network. The
          // ONLY reason that is safe is that the bytes are already captured
          // here: an upload that re-read `toolRef` after the switch had
          // continued would read the INCOMING photo's document and upload it
          // under the outgoing photo's key — the exact corruption this branch
          // exists to fix, recreated in the cloud copy where the local guard
          // cannot see it.
          //
          // If anyone ever adds an `await` above this line, detaching stops
          // being safe and this comment is the reason why.
          const cloudSync = (async () => {
            try {
              // ── THE RATE LIMIT ───────────────────────────────────────────
              // Checked BEFORE the hash below, deliberately: an upload that is
              // not allowed to happen should not pay for a SHA-256 first.
              //
              // This is the backstop, not the fix. The specific causes of the
              // 28-uploads-per-stroke incident are fixed upstream; this exists
              // for the causes that are not, and the ones nobody has thought
              // of. It bounds the blast radius of any future runaway to a log
              // line — 3.45 GB of orphaned storage disabled every deployment
              // on the account and took down an unrelated production site.
              //
              // The local IndexedDB write above already happened and is never
              // subject to this. Losing cloud freshness is recoverable; losing
              // the user's edits is not.
              const verdict = mayUpload(photoId);
              if (!verdict.ok) {
                logDiagnostic(
                  "CONVEX_DB",
                  `Cloud upload rate-limited for ${photoId} (${verdict.reason}); ` +
                    `saved locally, retry in ~${Math.ceil(verdict.retryInMs / 1000)}s`,
                );
                return;
              }

              // ── THE REDUNDANT-UPLOAD SKIP ────────────────────────────────
              // 28 uploads happened where 4 were needed, because nothing in
              // the app knew a photo was already in sync: `dirtyRef` derives
              // from `undoCount > 0 || hasBeenModified`, and NEITHER of those
              // is changed by a successful upload, so a photo stayed "dirty"
              // forever once touched.
              //
              // The skip is on the UPLOAD ONLY. The local IndexedDB write
              // above always happens, unconditionally. That asymmetry is the
              // whole safety argument: IndexedDB is the restore path and has
              // no backup, so a wrongly-skipped local write would lose the
              // user's work, whereas a wrongly-skipped upload costs cloud
              // freshness until the next real edit. Same one-directional bias
              // as the ownership guard — degrade to staleness, never to loss.
              const hash = await archiveHash(archive);
              if (hash !== null && lastUploadedRef.current.get(photoId) === hash) {
                logDiagnostic(
                  "CONVEX_DB",
                  `Cloud upload skipped for ${photoId}: archive unchanged since last sync`,
                );
                return;
              }

              const uploadUrl = await withTimeout(generateUploadUrl(), "generateUploadUrl");
              const resp = await withTimeout(
                fetch(uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/octet-stream" },
                  body: archive.buffer as ArrayBuffer,
                }),
                "archive upload",
              );
              // A non-2xx upload still parses as JSON — an error body, with no
              // `storageId` in it. Unchecked, that handed `undefined` to saveEdit
              // as an Id<"_storage">, persisting a pointer to nothing while the
              // catch below logged a misleading "cloud save failed" for a request
              // that had, as far as this code knew, succeeded.
              if (!resp.ok) {
                throw new Error(
                  `archive upload failed: HTTP ${resp.status} ${resp.statusText}`,
                );
              }
              const body = (await resp.json()) as { storageId?: string };
              if (!body.storageId) {
                throw new Error("archive upload returned no storageId");
              }
              const { storageId } = body as { storageId: string };
              await withTimeout(
                saveEdit({ photoKey: photoId, storageId: storageId as Id<"_storage">, canvasW, canvasH }),
                "saveEdit",
              );
              // Recorded only after saveEdit resolves. A hash stored on upload
              // success but before the pointer is committed would mark a photo
              // synced whose cloud record still points at the previous archive.
              if (hash !== null) lastUploadedRef.current.set(photoId, hash);
              // Budget is spent on SUCCESS only. Charging for an upload that
              // failed would let a broken network burn the hour's allowance
              // without a single byte reaching Convex.
              recordUpload(photoId);
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
          })();

          // The switch path passes detachCloudUpload and returns here, without
          // waiting on the network. `cloudSync` swallows its own failures, so
          // this can never become an unhandled rejection; v7.57's 8s
          // withTimeout stays the backstop that stops a hung Convex mutation
          // wedging anything.
          if (opts?.detachCloudUpload) return true;
          await cloudSync;
          return true;
        } catch (err) {
          // The SYNCHRONOUS CAPTURE failed — a dead engine handle, an encode
          // error. Distinct from an upload failure, which the inner catch owns.
          // The local copy is already on disk either way, so this costs
          // freshness, not data.
          logDiagnostic(
            "CONVEX_DB",
            `Cloud edit capture failed for ${photoId}; saved locally only: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      // No trailing local save: it already happened at the top, unconditionally.
      // True either way: the local archive is written, which is what restores
      // the user's work. A failed cloud leg costs freshness, not data.
      return true;
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
            } catch (err) {
              // A decode failure used to fall through to "it must be a legacy
              // single-PNG blob", which is true for exactly one kind of failure
              // and a lie for every other. Corrupt or truncated archive bytes
              // were handed back AS pixels, so the real error surfaced later as
              // an unrelated image-decode failure with the cause long gone.
              //
              // Only bytes that actually start with the PNG signature are a
              // legacy blob. Anything else is corruption, and it says so.
              if (looksLikePng(data)) {
                return {
                  canvasW: edit.canvasW,
                  canvasH: edit.canvasH,
                  canvasPng: data,
                  undoStack: [],
                  redoStack: [],
                  annotations: [],
                };
              }
              const detail = err instanceof Error ? err.message : String(err);
              console.error(
                `[edit-persist] cloud archive for ${photoId} is not decodable and is not a legacy PNG (${data.byteLength} bytes): ${detail}`,
              );
              logDiagnostic(
                "CONVEX_DB",
                `Cloud archive for this photo could not be read (${data.byteLength} bytes, ${detail}). Falling back to the copy stored in this browser.`,
              );
              // Returning null rather than the bad bytes: the caller falls
              // through to the local IndexedDB copy, which is a real document.
              return null;
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
      // Drop the sync record first. Leaving it would mark a photo whose cloud
      // record has just been removed as already-synced, so an identical archive
      // saved later would be skipped and never make it back to the cloud.
      lastUploadedRef.current.delete(photoId);
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
    lastUploadedRef.current.clear(); // same reason as the single delete above
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
