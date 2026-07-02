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
import { useCallback, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { usePreferences, canvasBgToRgba } from "@/lib/preferences";
import { useEditPersistence } from "@/hooks/useEditPersistence";
import type { UserMode } from "@/components/StatusBar";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { toast } from "@/components/ui/sonner";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { putOriginal, getOriginal } from "@/lib/originalsStore";
import { makeWorkingCopy, makeThumbnailFromPixels, ImageTooLargeError } from "@/lib/workingCopy";
import { getWorkingCopy, putWorkingCopy } from "@/lib/workingCopyCache";
import { logDiagnostic } from "@/lib/diagnosticsLog";
import { clearGalleryManifest } from "@/lib/galleryManifest";

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
    },
    [loadImageFromPixels, prefs.canvasArtboard, prefs.canvasPadding, prefs.canvasBgColor],
  );

  // ── Add photos ─────────────────────────────────────────────────────────────
  const handleAddPhotos = useCallback(
    async (files: File[]) => {
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
      for (const f of accepted) {
        try {
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
            makeThumbnailFromPixels(
              working.pixels,
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
              prefs.canvasArtboard
                ? { pad: prefs.canvasPadding, ...canvasBgToRgba(prefs.canvasBgColor) }
                : undefined,
            );
            setHasBeenModified(false);
            activeIdRef.current = entry.id;
            setActivePhotoId(entry.id);
            setCompareActive(false);
          }
        } catch (err) {
          console.error("Failed to add photo:", f.name, err);
          toast.error(
            err instanceof ImageTooLargeError
              ? `${f.name}: ${err.message}`
              : `Couldn't open ${f.name}.`,
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
          await savePhotoEdit(outgoing, stamp.toolRef);
        }
      }
      if (!isCurrent()) return; // a newer selection superseded this one

      setHasBeenModified(false);
      setActivePhotoId(entry.id);
      setCompareActive(false);
      // Flag loading synchronously, before any await: switching photos briefly
      // leaves the *outgoing* photo's undo count > 0 while activePhotoId already
      // points at the incoming one. The modified-dot effect gates on this so it
      // doesn't falsely dot the newly-selected photo during the transition.
      setIsImageLoading(true);

      const saved = await loadPhotoEdit(entry.id);
      if (!isCurrent()) return;
      if (saved) {
        setLoadProgress(20);
        await stamp.loadFromSaved(saved);
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
    [activePhotoId, hasBeenModified, stamp, loadPhotoFromEntry, savePhotoEdit, loadPhotoEdit],
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
          setHasBeenModified(false);
          setCompareActive(false);
        }
        return next;
      });
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
