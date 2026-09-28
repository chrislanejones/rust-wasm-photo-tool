// Re-encode the active photo's live canvas and write it back over its stored
// original, extracted verbatim from AppShell (stage 2). This is the INTERNAL
// save — not an export — and it is the surface that writes pixels into
// IndexedDB, so it stores the PHOTO only — never the artboard's backing
// Canvas (see the note at the capture below).
//
// Follows `useCanvasActions`: gallery state comes from the store, and only the
// engine handle plus the encode choices are passed in.
import { useCallback } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { toast } from "@/components/ui/sonner";
import { setSaveFailed } from "@/lib/saveStatus";
import { putOriginal } from "@/lib/dexie/originalsAdapter";
import { deleteReplacedOriginal } from "@/lib/originalRefs";
import { makeThumbnailFromPixels } from "@/lib/workingCopy";
import {
  encodeRgba,
  extFromMime,
  formatFromMime,
} from "@/lib/exportImage";
import type { ExportFormat } from "@/lib/exportImage";

export function usePersistActiveCanvas({
  stamp,
  exportFormat,
  quality,
}: {
  stamp: ReturnType<typeof useCloneStamp>;
  exportFormat: ExportFormat;
  quality: number;
}) {
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const setPhotos = useGalleryStore((s) => s.setPhotos);
  const setImageSavings = useGalleryStore((s) => s.setImageSavings);

  return useCallback(async (opts?: { keepSourceEncoding?: boolean }) => {
    const entry = photos.find((p) => p.id === activePhotoId);
    const tool = stamp.toolRef.current;
    if (!entry || !tool) return;
    const sourceFormat = opts?.keepSourceEncoding
      ? formatFromMime(entry.mimeType ?? "")
      : null;
    const encodeFormat = sourceFormat ?? exportFormat;
    const encodeQuality = sourceFormat ? 1 : quality / 100;
    try {
      // ATOMIC CAPTURE (ADR-024). Was `get_image_data()` + `width()` +
      // `height()`. These three are not merely read together, they TRAVEL
      // together: `pixels`, `tw` and `th` cross three awaits below and are then
      // written to IndexedDB as one record (`putOriginal(newFile, tw, th)`) and
      // scaled as one image. A mismatch here is persisted, not transient.
      // ⚠️ THE STORED ORIGINAL IS THE PHOTO, NEVER THE MOUNT IT SITS ON.
      //
      // This used to write the full padded composite — backing Canvas and all
      // — and only dropped it when the format had no alpha (ADR-039's black
      // border). With the defaults (10px border, transparent backing) and any
      // alpha format, that baked a 10px TRANSPARENT margin into `originalKey`.
      // Two surfaces then shipped it as real pixels:
      //
      //  - the batch ZIP, whose "no saved edit" branch copies `originalKey`
      //    verbatim — so a signed-out user with "Photo only" set got every
      //    image framed in a thin white-looking line, whatever the export
      //    setting said;
      //  - the next gallery load, which wraps `originalKey` in a FRESH
      //    artboard (`loadPhotoFromEntry`), nesting border inside border.
      //
      // So the Canvas is always left out here. It is not the user's pixels, it
      // is re-added on every load from the Canvas prefs, and "Include canvas"
      // is an EXPORT choice that the export surfaces apply themselves. This
      // also subsumes the ADR-039 rule: with no backing there is nothing
      // transparent to invent black for. On a document with no Canvas layer
      // nothing is excluded — the composite is only trimmed of fully
      // transparent margin (see `composite_excluding_background` in lib.rs).
      const cap = await tool.capture_composite_excluding_background();
      const { rgba: pixels, width: tw, height: th } = cap;
      cap.free();
      // encodeRgba and makeThumbnailFromPixels each hand their buffer to the
      // codec worker, which transfers (detaches) it. Give encodeRgba its own
      // copy so the original `pixels` survives for the thumbnail below.
      const blob = await encodeRgba(pixels.slice(), tw, th, encodeFormat, encodeQuality);
      // convertToBlob may fall back (e.g. AVIF → PNG on some browsers); trust
      // the blob's actual MIME for the stored metadata.
      const mime = blob.type || `image/${encodeFormat}`;
      const newFile = new File([blob], `${entry.name}${extFromMime(mime)}`, {
        type: mime,
      });

      const mod = await import("stamp_tool");
      await mod.default();
      const oldKey = entry.originalKey;
      const [newKey, newThumb] = await Promise.all([
        putOriginal(newFile, tw, th),
        makeThumbnailFromPixels(pixels, tw, th, mod.resize_pixels),
      ]);
      // Collect the blob this photo just stopped pointing at — but only if
      // NOTHING else points at it. The old test here was
      // `oldKey !== entry.uploadKey`, which knew about this photo's own
      // baseline and nothing else, so it deleted blobs shared with a duplicate.
      // See lib/originalRefs.ts for the four-step repro.
      void deleteReplacedOriginal({
        oldKey,
        newKey,
        photoId: entry.id,
        // Read fresh, not from the render-time `photos`: this runs after two
        // awaits and the gallery may have moved under it.
        photos: useGalleryStore.getState().photos,
      });

      setPhotos((prev) =>
        prev.map((p) =>
          p.id !== entry.id
            ? p
            : {
                ...p,
                originalKey: newKey,
                byteSize: blob.size,
                mimeType: mime,
                origWidth: tw,
                origHeight: th,
                workingWidth: tw,
                workingHeight: th,
                thumbBlob: newThumb,
              },
        ),
      );

      // Real change vs. the immutable upload-size baseline. SIGNED on purpose:
      // positive = smaller than the upload (a saving), negative = LARGER. The
      // old `Math.max(0, …)` clamp meant an upscale — which "Apply Resize" makes
      // a one-click operation — silently reported nothing at all, and the
      // gallery badge just vanished. Growth is unbounded, so this can exceed
      // -100% (a file 2.5x the original reads as +150% bigger).
      const realSavings =
        entry.originalByteSize > 0
          ? Math.round((1 - blob.size / entry.originalByteSize) * 100)
          : 0;
      setImageSavings((prev) => ({
        ...prev,
        [entry.id]: { savingsPercent: realSavings },
      }));
      // A save landed, so any earlier failure is no longer true.
      setSaveFailed(false);
    } catch (err) {
      console.error("Persist canvas failed:", err);
      toast.error("Couldn't save canvas changes");
      // The toast is the moment; this is what stays true after it has gone —
      // the status bar holds it until a later save succeeds.
      setSaveFailed(true);
    }
    // `setPhotos` / `setImageSavings` are listed even though AppShell's array
    // omitted them. Zustand actions are stable references, so naming them
    // changes how often this callback is rebuilt not at all — it just stops the
    // dependency list from lying, without an eslint-disable to hide it.
  }, [
    photos,
    activePhotoId,
    stamp,
    exportFormat,
    quality,
    setPhotos,
    setImageSavings,
  ]);
}
