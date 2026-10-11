import { useCallback, useRef } from "react";
import { setBackupFailed } from "@/lib/saveStatus";
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import { useCloudAuth, useCloudClient, useCloudMutation } from "@/lib/cloud";
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
  decodeCapture,
} from "@/lib/editPersistence";
import type {
  SavedEdit,
} from "@/lib/editPersistence";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { useUIStore } from "@/stores/useUIStore";
import { mayUpload, recordUpload, isUploadRetryEnabled } from "@/lib/uploadBudget";

import { encodeArchive, decodeArchive, looksLikePng } from "@/lib/editArchive";

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
  // "cannot tell", and the caller uploads, which is the shipped behavior.
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

/**
 * May the CLOUD half of photo persistence run?
 *
 * Signed in is not enough. Settings › Security promises that with "Everything
 * in your browser" off, "your photos never leave this tab" — and until
 * 09-22-2026 this hook uploaded the flattened archive of every edit on the
 * strength of `isAuthenticated` alone, so a signed-in person with the switch
 * OFF was sending exactly what the pane said they were not. The switch gated
 * the AI tools (they carry `requiresNetwork`, ADR-062 era) and nothing else;
 * this path is not a tool, so it went straight through the net.
 *
 * DELETES ARE DELIBERATELY NOT GATED BY THIS. Removing a copy from the server
 * sends no pixels, and refusing it while the switch is off would strand data
 * on a server the person has just asked to stop using. See `deletePhotoEdit`
 * and `clearAllEdits`, which stay on `isAuthenticated` alone.
 */
export function cloudPhotosAllowed(
  isAuthenticated: boolean,
  onlineFeaturesEnabled: boolean,
): boolean {
  // Through the registry, so the switch and Settings › Security are reading
  // the same answer (shared/networkPaths.ts). Identical to the old
  // `isAuthenticated && onlineFeaturesEnabled` — pinned in networkPaths.test.ts.
  return isAuthenticated && isNetworkPathAllowed("photo_backup", onlineFeaturesEnabled);
}

export function useEditPersistence() {
  // isAuthenticated stays false until the JWT handshake with Convex succeeds,
  // so mismatched keys keep the app on the local IDB path rather than crashing.
  const { isAuthenticated } = useCloudAuth();
  // The consent switch, the same store field Settings › Security and the New
  // dialog share. Read as state (not a ref) so a change re-creates the
  // callbacks below and the next save sees it.
  const onlineFeatures = useUIStore((s) => s.onlineFeaturesEnabled);
  const cloudAllowed = cloudPhotosAllowed(isAuthenticated, onlineFeatures);
  const convex = useCloudClient();
  const generateUploadUrl = useCloudMutation(api.photoEdits.generateUploadUrl);
  const saveEdit = useCloudMutation(api.photoEdits.save);
  const removeEdit = useCloudMutation(api.photoEdits.remove);
  const discardFailedUpload = useCloudMutation(api.photoEdits.discardFailedUpload);
  const clearAllConvex = useCloudMutation(api.photoEdits.clearAll);

  // photoId → hash of the archive last successfully synced to Convex. Session
  // -lived on purpose: a reload re-uploads once per photo, which is the cheap
  // direction to be wrong in. Entries are dropped on delete/clear below, or a
  // photo whose cloud record was removed would look synced and never come back.
  const lastUploadedRef = useRef(new Map<string, string>());

  // photoId → the sequence number of the most recently STARTED save for that
  // photo. A deferred retry compares its own token against this and drops
  // itself if a newer save has begun, so a retry can never write stale bytes
  // over fresher ones.
  const attemptSeqRef = useRef(new Map<string, number>());

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

      if (cloudAllowed) {
        try {
          const tool = toolRef.current;
          // Unreachable in practice — idbSave returns false without a tool, so
          // the gate above already returned. Kept as a type narrower, and it
          // reports the local write that did happen.
          if (!tool) return true;

          // ── THE CAPTURE — ONE CALL ──────────────────────────────────────
          // This was eighteen separate engine reads, and the comment below
          // explained at length why not one of them could become an `await`.
          // ADR-024 Stage 3.5 would have converted them all; doing so would
          // have produced exactly the corruption the note warns about.
          //
          // `capture_state()` reads the whole document while the engine cannot
          // change — `&self` in Rust — so the atomicity is now STRUCTURAL
          // rather than a property of the call sequence that a future edit
          // could quietly break. The note below still applies to everything
          // after this line.
          const cap = decodeCapture(await tool.capture_state());
          const { canvasW, canvasH, canvasPng, undoStack, redoStack, layers, activeLayerId } = cap;

          // Serialized here rather than in the decoder: the archive wants JSON
          // strings, the local IDB path wants parsed objects, and `decodeCapture`
          // returns the parsed form both share. Strip semantics are identical —
          // `decodeCapture` applies `stripLiveAnnotations` for us, which is what
          // fixed the #22 drift where this path silently dropped all nine
          // `shadow_*` fields and cross-device restores lost drop shadows.
          const annotationsJson = JSON.stringify(cap.annotations);
          const shapesJson = JSON.stringify(cap.shapes);

          const archive = encodeArchive(canvasW, canvasH, canvasPng, undoStack, redoStack, annotationsJson, shapesJson, layers, activeLayerId, cap.exportQuality);

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
          // Hoisted OUT of the try on purpose. The upload commits before the
          // pointer does, so the only place that knows about a stranded file is
          // the catch — and a `const` declared beside the upload is not in
          // scope there. This is the whole reason the orphan sweep had nothing
          // to work with.
          let uploadedStorageId: string | null = null;

          // One retry per attempt-chain, and a token so a deferred attempt can
          // tell whether a newer save for this photo has started since.
          let retried = false;
          const mySeq = (attemptSeqRef.current.get(photoId) ?? 0) + 1;
          attemptSeqRef.current.set(photoId, mySeq);

          const runAttempt = async (): Promise<void> => {
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
              // Superseded? A newer save for this same photo started while this
              // one was waiting out its interval, so its bytes are fresher and
              // this attempt would write staleness over them. Checked on every
              // attempt, not just the deferred one, because the immediate path
              // can also lose a race with a switch.
              if (attemptSeqRef.current.get(photoId) !== mySeq) {
                logDiagnostic(
                  "CONVEX_DB",
                  `Cloud upload for ${photoId} superseded by a newer save; dropped`,
                );
                return;
              }

              const verdict = mayUpload(photoId);
              if (!verdict.ok) {
                logDiagnostic(
                  "CONVEX_DB",
                  `Cloud upload rate-limited for ${photoId} (${verdict.reason}); ` +
                    `saved locally, retry in ~${Math.ceil(verdict.retryInMs / 1000)}s`,
                );
                // WHY A RETRY EXISTS AT ALL. Without one, a denied upload is
                // simply dropped — and the debounce fires 2.5s after the last
                // edit while the interval is 10s, so ordinary editing denies
                // roughly half of its own saves. Measured on a real profile:
                // 4 saves, 2 allowed, 2 denied. That is the limiter working as
                // designed, but it means the LAST edit of a session can be the
                // denied one, and nothing ever carries it to the cloud.
                //
                // Local IndexedDB is written regardless, so this was never data
                // loss — only silent cloud staleness, which is worse than it
                // sounds across devices and invisible on one.
                //
                // ONCE, and only for the interval. A ceiling denial means the
                // hour's budget is gone and retrying is exactly the runaway the
                // ceiling exists to stop. `retried` is per attempt-chain, so a
                // retry that is denied again gives up rather than looping.
                if (verdict.reason === "interval" && !retried && isUploadRetryEnabled()) {
                  retried = true;
                  // +250ms so the timer cannot land a hair early and re-deny on
                  // a rounding difference.
                  window.setTimeout(() => void runAttempt(), verdict.retryInMs + 250);
                }
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
              // From here on a file exists in storage that nothing points at.
              // Recorded before the pointer is attempted, because the failure
              // this guards against is the attempt itself.
              uploadedStorageId = storageId;
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
              if (attemptSeqRef.current.get(photoId) === mySeq) setBackupFailed(false, photoId);
              uploadedStorageId = null; // pointer committed — no longer stranded
            } catch (err) {
              // Cloud save failed (upload / storage / auth). The local IDB copy is
              // ALREADY written, so nothing is lost — record it for Diagnostics,
              // and say so in the status bar until a later upload lands.
              if (attemptSeqRef.current.get(photoId) === mySeq) setBackupFailed(true, photoId);
              logDiagnostic(
                "CONVEX_DB",
                `Cloud edit save failed for ${photoId}; saved locally only: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );

              // The archive reached storage but the pointer never committed, so
              // nothing will ever reference this file and nothing sweeps it.
              // Every one of these used to be permanent; 3,535 MB of them
              // disabled the account.
              //
              // Best-effort by construction. The mutation refuses if the file
              // turns out to BE referenced — which is the common case here,
              // because the usual way into this catch is the 8s timeout around
              // `save`, and a timed-out mutation frequently lands anyway.
              // Deleting then would leave a row pointing at nothing, so the
              // server decides, not this catch.
              //
              // Its own failure is swallowed: this is cleanup on an error path,
              // and an error while handling an error must not replace the
              // message above with a less useful one.
              if (uploadedStorageId) {
                const stranded = uploadedStorageId;
                uploadedStorageId = null;
                try {
                  const r = await withTimeout(
                    discardFailedUpload({ storageId: stranded as Id<"_storage"> }),
                    "discardFailedUpload",
                  );
                  logDiagnostic(
                    "CONVEX_DB",
                    r.deleted
                      ? `Collected the stranded archive for ${photoId} (${r.reason})`
                      : `Left the archive for ${photoId} in place — the server says it is ${r.reason}`,
                  );
                } catch {
                  logDiagnostic(
                    "CONVEX_DB",
                    `Could not collect the stranded archive for ${photoId}; it is now an orphan`,
                  );
                }
              }
            }
          };

          // `runAttempt` handles its own failures end to end, including the
          // stranded-archive collect, so a deferred retry re-enters it directly
          // and cannot produce an unhandled rejection either.
          const cloudSync = runAttempt();

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
    [cloudAllowed, generateUploadUrl, saveEdit, discardFailedUpload],
  );

  const loadPhotoEdit = useCallback(
    async (photoId: string): Promise<SavedEdit | null> => {
      // IDB first — same machine, no network round-trip
      const local = await idbLoad(photoId);
      if (local) return local;

      if (cloudAllowed) {
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
    [cloudAllowed, convex],
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
