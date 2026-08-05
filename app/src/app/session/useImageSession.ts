// Image-session domain hook, extracted verbatim from AppShell (stage 2). Owns
// the per-photo lifecycle callbacks: pixel loads, AI-result apply, gallery
// add/select/cycle/remove, and the Resume / Start-fresh actions — plus the two
// selection refs (selectSeqRef/activeIdRef) they share. Everything routes
// through the WASM `stamp` handle; gallery/UI state is read straight from the
// stores. The lifecycle EFFECTS (boot sequence, manifest persist, auto-select,
// finish-image-load) and the gallery multi-select cluster (handleDeleteSelected/
// handleDuplicateSelected + selectedIds/clearSelection) intentionally stay in
// AppShell — see PARKING_LOT.md. `loadPhotoFromEntry` + `activeIdRef` are
// returned because the AppShell-resident handleDeleteSelected still uses them.
import { useCallback, useEffect, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { usePreferences, canvasBgToRgba } from "@/lib/preferences";
import { useEditPersistence } from "@/hooks/useEditPersistence";
import type { UserMode } from "@/components/StatusBar";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { collectDeletedPhotoOriginals } from "@/lib/originalRefs";
import { collectExtraRoots } from "@/lib/extraRoots";
import { useUIStore } from "@/stores/useUIStore";
import { toast } from "@/components/ui/sonner";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { putOriginal, getOriginal } from "@/lib/dexie/originalsAdapter";
import { makeWorkingCopy, makeThumbnailFromPixels, ImageTooLargeError } from "@/lib/workingCopy";
import { getWorkingCopy, putWorkingCopy } from "@/lib/workingCopyCache";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { clearGalleryManifest } from "@/lib/galleryManifest";
import { isSvgFile, rasterizeSvgToPng } from "@/lib/rasterizeSvg";
import { flushPendingOplogSave, setActiveOplogPhoto } from "@/lib/oplogPersistence";
import { setEngineDocument } from "@/lib/engineDocument";

type Preferences = ReturnType<typeof usePreferences>[0];
type EditPersistence = ReturnType<typeof useEditPersistence>;

/** User-facing message when the gallery cap is reached, nudging toward the next tier. */
function capMessage(mode: UserMode, max: number): string {
  if (mode === "demo")
    return `Demo galleries hold ${max} photos. Sign in to load up to 24.`;
  if (mode === "loggedIn")
    return `Free accounts hold ${max} photos. Pro (100) is coming soon.`;
  return `Gallery is limited to ${max} photos.`;
}

export function useImageSession({
  stamp,
  prefs,
  effectiveUserMode,
  savePhotoEdit,
  loadPhotoEdit,
  deletePhotoEdit,
}: {
  stamp: ReturnType<typeof useCloneStamp>;
  prefs: Preferences;
  effectiveUserMode: UserMode;
  savePhotoEdit: EditPersistence["savePhotoEdit"];
  loadPhotoEdit: EditPersistence["loadPhotoEdit"];
  deletePhotoEdit: EditPersistence["deletePhotoEdit"];
}) {
  const photos = useGalleryStore((s) => s.photos);
  const setPhotos = useGalleryStore((s) => s.setPhotos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const setActivePhotoId = useGalleryStore((s) => s.setActivePhotoId);
  const resumeManifest = useGalleryStore((s) => s.resumeManifest);
  const setResumeManifest = useGalleryStore((s) => s.setResumeManifest);
  const setImageSavings = useGalleryStore((s) => s.setImageSavings);
  const setModifiedPhotos = useGalleryStore((s) => s.setModifiedPhotos);
  const hasBeenModified = useGalleryStore((s) => s.hasBeenModified);
  const setHasBeenModified = useGalleryStore((s) => s.setHasBeenModified);
  const maxPhotos = useGalleryStore((s) => s.maxPhotos);
  const setCompareActive = useUIStore((s) => s.setCompareActive);
  const startImageLoad = useUIStore((s) => s.startImageLoad);
  const setIsImageLoading = useUIStore((s) => s.setIsImageLoading);
  const setLoadProgress = useUIStore((s) => s.setLoadProgress);
  const setShowUpload = useUIStore((s) => s.setShowUpload);

  // ── Pixel-based loading (downscaled working copy) ──────────────────────────
  const loadImageFromPixels = useCallback(
    (
      pixels: Uint8ClampedArray,
      width: number,
      height: number,
      artboard?: { pad: number; r: number; g: number; b: number; a: number },
    ) => {
      startImageLoad();
      void stamp.loadImageFromPixels(pixels, width, height, artboard);
    },
    [stamp, startImageLoad],
  );

  /** Apply a finished AI image result (decoded RGBA) back to the canvas as the
   *  new working image, and mark the photo modified so it persists. */
  const handleAIResult = useCallback(
    (r: { pixels: Uint8ClampedArray; width: number; height: number }) => {
      // AI result replaces the doc — re-normalize to the artboard (border +
      // backing) when "Canvas on import" is on, exactly like every other load.
      loadImageFromPixels(
        r.pixels,
        r.width,
        r.height,
        prefs.canvasArtboard
          ? { pad: prefs.canvasPadding, ...canvasBgToRgba(prefs.canvasBgColor) }
          : undefined,
      );
      setHasBeenModified(true);
    },
    [loadImageFromPixels, prefs.canvasArtboard, prefs.canvasPadding, prefs.canvasBgColor],
  );

  /** Load a photo entry from IndexedDB → downscale → hand to the tool. */
  // Monotonic token for photo selection. Each handleSelectPhoto call claims the
  // next value; any async load whose token is no longer current aborts before
  // blitting, so rapid gallery clicks / PgUp-PgDn can't leave the canvas showing
  // one photo while the gallery highlights another (latest selection wins).
  const selectSeqRef = useRef(0);
  // The current photo id tracked synchronously — React state `activePhotoId`
  // lags behind the async image load, so gallery cycling reads this instead and
  // repeated PgUp/PgDn advance correctly rather than recomputing "next" from a
  // stale id. Kept in sync at every place activePhotoId is set.
  const activeIdRef = useRef<string | null>(null);

  // ── Autosave ───────────────────────────────────────────────────────────────
  // The edit archive used to be written in exactly two places: on a photo SWITCH
  // and on a new IMPORT. There was no beforeunload, no visibilitychange, no
  // timer. So "edit a photo, reload the tab" silently restored the ORIGINAL —
  // strokes, layers, everything. Verified logged-out with every flag off: the
  // canvas came back byte-identical to the untouched original. That is live
  // data loss in the shipped app, and it is what a dogfooder hit first.
  //
  // (The op log fixes this for single-content-layer documents, but it correctly
  // retires itself the moment a second content layer appears and hands off to
  // "the working copy" — a fallback nobody was saving.)
  //
  // Two triggers, and both are needed:
  //   • IDLE DEBOUNCE — save 2.5s after the last edit. Not per stroke-move: the
  //     archive re-encodes the whole working copy as PNG, so writing it on every
  //     mutation would thrash a big image. Idle is when it's free.
  //   • visibilitychange → hidden (+ pagehide) — fires on tab close, reload and
  //     navigation. Unlike `beforeunload` this still runs when the page is
  //     bfcached, and it doesn't cost a "leave site?" prompt. Best-effort: an
  //     async IDB write can be cut short on unload, which is exactly why the
  //     debounce above exists as well. Belt and braces, on purpose — this is
  //     user data with no backup.
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  dirtyRef.current = stamp.state.undoCount > 0 || hasBeenModified;

  const flushEditArchive = useCallback(
    async (photoId?: string, opts?: { detachCloudUpload?: boolean }) => {
      // A caller with a specific photo in mind MUST pass it. `activeIdRef` has
      // already been advanced to the INCOMING photo by the time a switch reaches
      // its saveOutgoing block — it is set synchronously so gallery cycling
      // reads the right thing — so defaulting to it there would ask for the
      // outgoing photo's document to be written under the incoming photo's id.
      // The ownership guard refuses exactly that, which would turn a routing
      // change into a silently dropped save.
      const id = photoId ?? activeIdRef.current;
      if (!id || !dirtyRef.current || !stamp.toolRef.current) return;
      if (savingRef.current) return; // never overlap two archive writes
      savingRef.current = true;
      try {
        await savePhotoEdit(id, stamp.toolRef, opts);
      } catch (err) {
        // Never let an autosave failure surface as an unhandled rejection — but
        // never swallow it either: the Diagnostics window is where it belongs.
        logDiagnostic(
          "CONSOLE",
          `Autosave failed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        savingRef.current = false;
      }
    },
    [stamp, savePhotoEdit],
  );

  // Always the newest flushEditArchive, without being a dependency of anything.
  //
  // THE BUG THIS FIXES. `flushEditArchive` is a useCallback over [stamp,
  // savePhotoEdit], and `stamp` is a fresh object on every engine state sync —
  // which is most renders. So its identity churned constantly, and the two
  // effects below listed it as a dependency. The debounce effect therefore tore
  // down and re-armed its 2.5s timer on render churn rather than on edits:
  // photo jzfnrd saved at 0s, 7s, 15.4s and 25s at an IDENTICAL undo count,
  // because each burst of churn restarted the clock and each lull let it fire.
  // Not an idle loop — 15s of sitting still produced no saves at all — but
  // nothing about that timing had anything to do with the user editing.
  //
  // A ref instead of a dependency. The effects read the current function
  // through it and depend only on signals that actually mean "the document
  // changed", so the debounce measures idleness rather than render quiet.
  const flushRef = useRef(flushEditArchive);
  flushRef.current = flushEditArchive;

  // Idle debounce. Keyed on the engine's undo count + the modified flag, so it
  // re-arms on every recordable edit and fires once the user pauses.
  useEffect(() => {
    if (!activePhotoId || !dirtyRef.current) return;
    const t = window.setTimeout(() => void flushRef.current(), 2500);
    return () => window.clearTimeout(t);
  }, [activePhotoId, stamp.state.undoCount, hasBeenModified]);

  // Leaving the page: last chance to write. Same treatment, for a smaller
  // reason: this used to remove and re-add both listeners on every render that
  // changed `stamp`, which is pointless work on a path that must not be flaky.
  // Registered once now, for the life of the hook.
  useEffect(() => {
    const onLeave = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onPageHide = () => void flushRef.current();
    document.addEventListener("visibilitychange", onLeave);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onLeave);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Op-log persistence follows the active photo through EVERY path that sets
  // it (select, add, remove, boot auto-select) — the write path keys its
  // saves off this. Inert unless USE_OPLOG_PERSISTENCE / ih_oplog_persist is
  // on AND the wasm build has the op-log surface.
  useEffect(() => {
    setActiveOplogPhoto(activePhotoId);
  }, [activePhotoId]);

  const loadPhotoFromEntry = useCallback(
    async (entry: PhotoEntry, isCurrent?: () => boolean) => {
      // Fast path: a previously-decoded working copy. Keyed by the original's
      // content hash (immutable → always valid), so revisiting a photo skips the
      // IndexedDB read AND both createImageBitmap decodes — the slow part of a
      // photo switch. See lib/workingCopyCache.ts.
      let working = getWorkingCopy(entry.originalKey);
      if (!working) {
        const original = await getOriginal(entry.originalKey);
        if (!original) return;
        if (isCurrent && !isCurrent()) return;
        const file = new File([original.bytes], original.name, { type: original.mimeType });
        working = await makeWorkingCopy(file);
        putWorkingCopy(entry.originalKey, working);
      }
      if (isCurrent && !isCurrent()) return;
      // Every load is normalized: when "Canvas on import" is on, a gallery
      // switch lands the photo on the same padded artboard as a fresh import
      // (border + backing), not just at native size.
      loadImageFromPixels(
        working.pixels,
        working.width,
        working.height,
        prefs.canvasArtboard
          ? { pad: prefs.canvasPadding, ...canvasBgToRgba(prefs.canvasBgColor) }
          : undefined,
      );
      // The engine has been handed THIS photo's pixels. `loadImageFromPixels`
      // is fire-and-forget (it voids the engine promise), so this is "committed
      // to", not "finished". If that load were to fail the marker would name a
      // photo the engine never got — which is exactly the unguarded behaviour
      // shipping today, so it degrades to the status quo rather than to a
      // refusal. Parked as OPEN: making the engine load awaitable would let
      // ownership follow the document instead of the intent.
      setEngineDocument(entry.id);
    },
    [loadImageFromPixels, prefs.canvasArtboard, prefs.canvasPadding, prefs.canvasBgColor],
  );

  // ── Add photos ─────────────────────────────────────────────────────────────
  const handleAddPhotos = useCallback(
    async (files: File[], opts?: { skipArtboard?: boolean }) => {
      // ── Tier cap ─────────────────────────────────────────────────────────
      // Enforce the per-tier gallery limit (from Rust `photo_limit`). Accept
      // as many as fit, then notify if the batch was trimmed or already full.
      const remaining = Math.max(0, maxPhotos - photos.length);
      if (remaining <= 0) {
        toast.error(capMessage(effectiveUserMode, maxPhotos));
        return;
      }
      const accepted = files.length > remaining ? files.slice(0, remaining) : files;
      if (files.length > remaining) {
        toast.error(capMessage(effectiveUserMode, maxPhotos));
      }

      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }
      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }

      let firstLoaded = false;
      for (const raw of accepted) {
        try {
          // SVGs never enter the pipeline as vectors — rasterize to a PNG File
          // at the boundary (lib/rasterizeSvg), so the stored gallery original
          // is pixels too. Everything below sees the PNG.
          const f = isSvgFile(raw) ? await rasterizeSvgToPng(raw) : raw;
          const t0 = performance.now();
          const working = await makeWorkingCopy(f);
          logDiagnostic(
            "UI_THREAD",
            `decode ${f.name} → ${working.width}×${working.height}`,
            performance.now() - t0,
          );
          // Build the gallery thumbnail from the already-decoded working pixels
          // (downscaled in Rust via resize_pixels) instead of decoding the
          // source file a second time.
          const mod = await import("stamp_tool");
          await mod.default();
          const [originalKey, thumbBlob] = await Promise.all([
            putOriginal(f, working.origWidth, working.origHeight),
            // Copy: the codec worker transfers (detaches) the buffer it's given,
            // but `working.pixels` is cached below via putWorkingCopy and must
            // stay intact.
            makeThumbnailFromPixels(
              working.pixels.slice(),
              working.width,
              working.height,
              mod.resize_pixels,
            ),
          ]);
          // Seed the decode cache so re-selecting this photo later is instant
          // (no IndexedDB read + re-decode). Keyed by content hash.
          putWorkingCopy(originalKey, working);
          const entry: PhotoEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: f.name.replace(/\.[^.]+$/, ""),
            mimeType: f.type || "application/octet-stream",
            byteSize: f.size,
            originalByteSize: f.size,
            origWidth: working.origWidth,
            origHeight: working.origHeight,
            workingWidth: working.width,
            workingHeight: working.height,
            thumbBlob,
            originalKey,
            uploadKey: originalKey,
          };

          setPhotos((prev) => [...prev, entry]);

          if (!firstLoaded) {
            firstLoaded = true;
            // Honor the "Canvas on import" setting and land the photo on a
            // two-layer padded artboard. The backing color comes from the
            // "Backing canvas" pref (transparent ⇒ a:0 ⇒ checkerboard); the
            // border is applied in Rust by the idempotent `set_artboard_border`.
            // Gallery-switch / AI-result paths run the SAME normalization, so
            // every load with artboard on ends up at photo + 2×pad.
            loadImageFromPixels(
              working.pixels,
              working.width,
              working.height,
              prefs.canvasArtboard && !opts?.skipArtboard
                ? { pad: prefs.canvasPadding, ...canvasBgToRgba(prefs.canvasBgColor) }
                : undefined,
            );
            setHasBeenModified(false);
            activeIdRef.current = entry.id;
            setActivePhotoId(entry.id);
            setEngineDocument(entry.id); // fresh import — the engine holds it now
            setCompareActive(false);
          }
        } catch (err) {
          console.error("Failed to add photo:", raw.name, err);
          toast.error(
            err instanceof ImageTooLargeError
              ? `${raw.name}: ${err.message}`
              : `Couldn't open ${raw.name}.`,
          );
        }
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadImageFromPixels, savePhotoEdit, photos.length, maxPhotos, effectiveUserMode, prefs.canvasArtboard, prefs.canvasPadding, prefs.canvasBgColor],
  );

  // ── Select photo ───────────────────────────────────────────────────────────
  const handleSelectPhoto = useCallback(
    async (entry: PhotoEntry) => {
      if (entry.id === activePhotoId) return;

      // Claim the latest selection. Any await below that resolves after a newer
      // click bails before touching the canvas, so highlight and pixels stay in sync.
      const seq = ++selectSeqRef.current;
      const isCurrent = () => seq === selectSeqRef.current;
      activeIdRef.current = entry.id; // advance synchronously so cycling sees it

      // Acknowledge the click NOW, before the save below. Saving a modified
      // outgoing photo uploads its whole edit archive when signed in, which
      // measured 2-4s on a 12-photo gallery — and for that entire window the
      // thumbnail highlight didn't move, no spinner ran, and nothing else
      // happened. Clicking a photo and watching the app ignore you for four
      // seconds reads as "the gallery is broken", which is exactly how it was
      // reported. The flag is idempotent and a superseded selection clears it
      // on the way out, so setting it this early costs nothing.
      //
      // Both lines are needed. The bar's WIDTH is loadProgress, so raising the
      // flag alone renders a zero-width bar — in the DOM, invisible on screen,
      // which is indistinguishable from the bug. Seed a few percent so there is
      // something to see while the save runs; the real steps (20 → 100) follow.
      setIsImageLoading(true);
      setLoadProgress(8);

      // Persist the OUTGOING photo only if it was actually modified. This used
      // to save on EVERY switch — and when signed in, savePhotoEdit uploads the
      // full edit archive to Convex, so just browsing the gallery re-uploaded
      // each photo and made switching slow ("only when logged in").
      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        const outgoing = activePhotoId;
        setModifiedPhotos((prev) => {
          if (prev.has(outgoing)) return prev;
          const next = new Set(prev);
          next.add(outgoing);
          return next;
        });
        if (stamp.toolRef.current) {
          // The outgoing photo's still-debouncing op-log save would be
          // dropped by the photo switch — land it while the engine still
          // holds the outgoing document. No-op when persistence is off.
          await flushPendingOplogSave(stamp.toolRef.current);
          // Through flushEditArchive rather than calling savePhotoEdit
          // directly, so the switch finally inherits `savingRef`. Bypassing
          // that overlap guard is how one brush stroke became ten concurrent
          // uploads of identical bytes and 238s of network: every click
          // started its own save, and none of them knew about the others.
          //
          // detachCloudUpload — the local archive is written and awaited, the
          // UPLOAD is not. A 13-second cloud round trip inside the switch is
          // what made switches die in saveOutgoing in the first place, and a
          // switch that dies there is precisely what leaves the engine holding
          // the outgoing document while the UI has moved on. The archive bytes
          // are captured synchronously before the upload detaches, so the
          // upload cannot read a document that has since been replaced.
          await flushEditArchive(outgoing, { detachCloudUpload: true });
        }
      }
      if (!isCurrent()) return; // a newer selection superseded this one

      setHasBeenModified(false);
      setActivePhotoId(entry.id);
      setCompareActive(false);
      // Loading is already flagged above, ahead of the save's awaits — it has to
      // be, or the flag lands after the slow part it exists to cover. It still
      // matters here for the reason this comment always gave: switching briefly
      // leaves the *outgoing* photo's undo count > 0 while activePhotoId already
      // points at the incoming one, and the modified-dot effect gates on this so
      // it doesn't falsely dot the newly-selected photo mid-transition.

      // ── Op-log resume (ADR-006) ─────────────────────────────────────────
      // Preferred path when USE_OPLOG_PERSISTENCE / ih_oplog_persist is on:
      // rebuild the exact document + replayable undo history from the
      // persisted log (restoreFromOplog owns the engine lifecycle, so this
      // works on page boot before any tool exists). A false return — flag
      // off, nothing persisted, or invalid data — falls through to the
      // existing archive/original paths unchanged; the working copy remains
      // the safety net for one release.
      setActiveOplogPhoto(entry.id);
      const restored = await stamp.restoreFromOplog(entry.id);
      // Ownership tracks the ENGINE, not the UI, so it is recorded BEFORE the
      // supersession check: a switch that gets superseded still replaced the
      // document. Recording it after the `isCurrent` bail would leave the
      // marker naming the PREVIOUS photo while the engine holds this one, and
      // the next entirely legitimate save would be refused. False refusals lose
      // real work — the one outcome this guard must never produce.
      if (restored) setEngineDocument(entry.id);
      if (!isCurrent()) return;
      if (restored) {
        setLoadProgress(100);
        setTimeout(() => {
          if (!isCurrent()) return;
          setIsImageLoading(false);
          setLoadProgress(0);
        }, 400);
        return;
      }

      const saved = await loadPhotoEdit(entry.id);
      if (!isCurrent()) return;
      if (saved) {
        setLoadProgress(20);
        await stamp.loadFromSaved(saved);
        setEngineDocument(entry.id); // before the bail — see the op-log note above
        if (!isCurrent()) return;
        setLoadProgress(100);
        setTimeout(() => {
          if (!isCurrent()) return;
          setIsImageLoading(false);
          setLoadProgress(0);
        }, 400);
      } else {
        void loadPhotoFromEntry(entry, isCurrent);
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadPhotoFromEntry, flushEditArchive, loadPhotoEdit],
  );

  // Item 4: PgUp/PgDn gallery cycling
  const handleNextPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const curId = activeIdRef.current ?? activePhotoId;
    const idx = photos.findIndex((p) => p.id === curId);
    const next = photos[(idx + 1) % photos.length];
    if (next) void handleSelectPhoto(next);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handlePrevPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const curId = activeIdRef.current ?? activePhotoId;
    const idx = photos.findIndex((p) => p.id === curId);
    const prev = photos[(idx - 1 + photos.length) % photos.length];
    if (prev) void handleSelectPhoto(prev);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handleRemovePhoto = useCallback(
    (id: string) => {
      deletePhotoEdit(id).catch(() => {});

      // Collect the originals this photo pointed at — audit finding #2. The
      // entry has to be read BEFORE setPhotos drops it, and the collection has
      // to run AFTER, so the deleted photo no longer roots its own keys.
      //
      // Routed through the same reachability guard a repoint uses rather than
      // deleting the two keys directly: duplicates share an originalKey, so a
      // direct delete would take a surviving photo's bytes with it. Inventing a
      // second delete path is exactly how the shared-blob data loss happened in
      // the compress paths (see lib/originalRefs.ts).
      //
      // Fire-and-forget with a swallowed rejection, deliberately: a failed
      // collect leaves garbage the audit can measure, whereas awaiting it would
      // make a storage hiccup look like a failed delete and leave the gallery
      // showing a photo the user already removed.
      const doomed = useGalleryStore.getState().photos.find((p) => p.id === id);
      setImageSavings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setModifiedPhotos((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPhotos((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        const next = prev.filter((p) => p.id !== id);
        if (id === activePhotoId && next.length > 0) {
          const na = next[Math.min(idx, next.length - 1)]!;
          void loadPhotoFromEntry(na);
          activeIdRef.current = na.id;
          setActivePhotoId(na.id);
          setHasBeenModified(false);
          setCompareActive(false);
        } else if (next.length === 0) {
          activeIdRef.current = null;
          setActivePhotoId(null);
          setEngineDocument(null); // nothing left to hold
          setHasBeenModified(false);
          setCompareActive(false);
          // The user removed the LAST photo — clear the resume manifest
          // here, explicitly (AppShell's persist effect never clears on
          // its own; see the 2026-07-11 incident note there).
          void clearGalleryManifest();
        }
        return next;
      });

      if (doomed) {
        void collectDeletedPhotoOriginals({
          entry: doomed,
          // Read fresh: setPhotos above has already removed the entry, so this
          // is the post-removal gallery. collectDeletedPhotoOriginals filters
          // the entry out again anyway, so a stale array cannot cause a wrong
          // delete — only a missed one.
          photos: useGalleryStore.getState().photos,
          // BatchSettings' pre-logo / pre-text baselines live in refs and are in
          // no manifest. Without these, deleting any photo could collect another
          // photo's baseline and break re-apply.
          extraRoots: collectExtraRoots(),
        }).catch(() => {});
      }
    },
    [activePhotoId, loadPhotoFromEntry, deletePhotoEdit],
  );

  const handleResumeSession = useCallback(() => {
    const m = resumeManifest;
    setResumeManifest(null);
    if (m) setPhotos(m.photos); // 0 → N reveals the chrome + auto-selects photo 0
  }, [resumeManifest]);

  const handleStartFresh = useCallback(() => {
    setResumeManifest(null);
    void clearGalleryManifest();
    setShowUpload(true);
  }, []);

  return {
    loadPhotoFromEntry,
    handleAIResult,
    handleAddPhotos,
    handleSelectPhoto,
    handleNextPhoto,
    handlePrevPhoto,
    handleRemovePhoto,
    handleResumeSession,
    handleStartFresh,
    activeIdRef,
  };
}
