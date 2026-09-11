import { useCallback, useEffect } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { canvasBgToRgba, type Preferences } from "@/lib/preferences";

/**
 * The artboard's own operations: resize the canvas, remove it, and keep it in
 * step with the Canvas-border preferences.
 *
 * Extracted from AppShell (#45). One domain — the MOUNT the photo sits on,
 * never the photo — and one shared shape: every one of them marks the photo
 * modified and persists, because all three change the document.
 *
 * ⚠️ THE CANVAS IS SELECTED BY `kind`, NEVER BY NAME (ADR-016). Matching
 * `name === "Background"` was a live bug: with the artboard OFF, `load_image`
 * names the PHOTO "Background", so Remove Canvas would have deleted the user's
 * image. On a document with no Canvas this is correctly `undefined` and the
 * action no-ops.
 *
 * ⚠️ The border effect is keyed ONLY on the prefs, not on `hasImage` or
 * `stamp.state`. The initial load applies the border through
 * `loadImageFromPixels`, so this handles only later pref changes and cannot
 * loop — `set_artboard_border` moves `stamp.state`, not the prefs it watches.
 */
export function useCanvasOps({
  stamp,
  prefs,
  hasImage,
  activePhotoId,
  setHasBeenModified,
  setModifiedPhotos,
  persistActiveCanvas,
}: {
  stamp: ReturnType<typeof useCloneStamp>;
  prefs: Preferences;
  hasImage: boolean;
  activePhotoId: string | null;
  setHasBeenModified: (v: boolean) => void;
  setModifiedPhotos: (fn: (prev: Set<string>) => Set<string>) => void;
  persistActiveCanvas: () => Promise<void>;
}) {
  const handleResizeCanvas = useCallback(
    async (w: number, h: number) => {
      if (w < 1 || h < 1) return;
      const bg = canvasBgToRgba(prefs.canvasBgColor);
      stamp.resizeCanvas(w, h, 4 /* centre */, bg.r, bg.g, bg.b, bg.a);
      setHasBeenModified(true);
      if (activePhotoId) {
        setModifiedPhotos((prev) =>
          prev.has(activePhotoId) ? prev : new Set(prev).add(activePhotoId),
        );
      }
      await persistActiveCanvas();
    },
    // Both setters are stable — `setModifiedPhotos` is a useState setter and
    // `setHasBeenModified` is a Zustand action — so listing them costs nothing
    // and stops the dep array lying about what this reads.
    [
      stamp,
      prefs.canvasBgColor,
      activePhotoId,
      persistActiveCanvas,
      setHasBeenModified,
      setModifiedPhotos,
    ],
  );

  // The "Remove Canvas" companion to Resize Canvas — deletes the artboard's
  // Canvas layer outright (not a resize-to-zero-padding; the user chose
  // "delete the layer" over "shrink to native size" when this was scoped).
  // Only ever meaningful on an artboard doc (Canvas + Photo, or more);
  // `remove_layer` itself already refuses to drop the last remaining layer.
  //
  // Selected by `kind`, not name (ADR-016). The old `name === "Background"`
  // match was a live bug: with the artboard OFF, `load_image` names the PHOTO
  // "Background" — so Remove Canvas would have deleted the user's image. On a
  // document with no Canvas, this is now correctly undefined and the action
  // no-ops.
  const backgroundLayerId = stamp.state.layers.find(
    (l) => l.kind === "canvas",
  )?.id;
  const handleRemoveCanvas = useCallback(async () => {
    if (backgroundLayerId === undefined) return;
    stamp.removeLayer(backgroundLayerId);
    setHasBeenModified(true);
    if (activePhotoId) {
      setModifiedPhotos((prev) =>
        prev.has(activePhotoId) ? prev : new Set(prev).add(activePhotoId),
      );
    }
    await persistActiveCanvas();
  }, [
    stamp,
    backgroundLayerId,
    activePhotoId,
    persistActiveCanvas,
    setHasBeenModified,
    setModifiedPhotos,
  ]);

  // ── Live "Canvas border" / "Backing color" re-apply ────────────────────────
  // Changing the border (canvasPadding) or backing color (canvasBgColor), or
  // toggling "Canvas on import" (canvasArtboard) on, while a photo is loaded
  // re-normalizes the CURRENT document to the artboard via the IDEMPOTENT,
  // ABSOLUTE Rust `set_artboard_border`: the doc becomes exactly photo + 2×pad,
  // photo centred, backing refilled — regardless of the doc's current size. This
  // is what kills the "jumbo" canvas: hitting 10px always yields a 10px border
  // (never a delta), and it applies to EVERY loaded doc (fresh, gallery, AI),
  // not just a fresh artboard import.
  //
  // Keyed only on the prefs (not hasImage / stamp.state): the initial load
  // applies the border through `loadImageFromPixels`, so this effect handles
  // only subsequent pref changes — it never fires on a load and so can't loop
  // (set_artboard_border changes stamp.state, not the prefs it depends on).
  // Border prefs commit on the Settings "Apply" (draft model), so persisting
  // per change doesn't thrash IndexedDB.
  useEffect(() => {
    if (!prefs.canvasArtboard || !hasImage) return;
    const bg = canvasBgToRgba(prefs.canvasBgColor);
    stamp.setArtboardBorder(prefs.canvasPadding, bg.r, bg.g, bg.b, bg.a);
    setHasBeenModified(true);
    if (activePhotoId) {
      setModifiedPhotos((prev) =>
        prev.has(activePhotoId) ? prev : new Set(prev).add(activePhotoId),
      );
    }
    void persistActiveCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.canvasPadding, prefs.canvasBgColor, prefs.canvasArtboard]);

  return { handleResizeCanvas, handleRemoveCanvas, backgroundLayerId };
}
