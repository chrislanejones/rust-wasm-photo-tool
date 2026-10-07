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
import { extFromMime } from "@/lib/exportImage";
import { encodeForApply } from "@/lib/applyEncode";
import type { ExportFormat } from "@/lib/exportImage";

/** What an Apply's re-encode actually did to the stored file. */
export type PersistOutcome =
  | { status: "saved"; bytes: number }
  | { status: "kept"; newBytes: number; oldBytes: number }
  | { status: "skipped" }
  | { status: "failed" };

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

  // `allowGrow`: a RESIZE always writes. The size the user typed is the
  // point; refusing it because the bytes grew (a flat-color PNG downscaled
  // with Lanczos3 gains soft edges, an upscale has more pixels) answered
  // "128" with an unchanged 256. The never-grows guard stays for what it was
  // built for: a same-size re-encode, where a bigger file is pure loss.
  return useCallback(async (opts?: { keepSourceEncoding?: boolean; allowGrow?: boolean }): Promise<PersistOutcome> => {
    const entry = photos.find((p) => p.id === activePhotoId);
    const tool = stamp.toolRef.current;
    if (!entry || !tool) return { status: "skipped" };
    try {
      const cap = await tool.capture_composite_excluding_background();
      const { rgba: pixels, width: tw, height: th } = cap;
      cap.free();
      // The encode is shared with the panel's measurement (lib/applyEncode),
      // so what the panel shows is what this writes.
      const { blob, storedQuality, format: encodeFormat, kept } = await encodeForApply(pixels, tw, th, {
        entry,
        exportFormat,
        quality,
        keepSourceEncoding: opts?.keepSourceEncoding,
      });
      const lossy = encodeFormat !== "png";
      if (kept && !opts?.allowGrow) {
        console.info(
          `[persist] ${entry.name}: re-encode would be ${blob.size} B against ` +
            `${entry.byteSize} B — keeping the stored original`,
        );
        // REPORTED, not just logged (10-07): the panel used to clear its
        // pending change and call the Apply done, while the stored file sat
        // at its old quality. Raising q50 → q90 hit this every time.
        return { status: "kept", newBytes: blob.size, oldBytes: entry.byteSize };
      }
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
                // PNG (requested, or an AVIF fallback) is lossless — no
                // quality to remember.
                encodeQuality: lossy && mime !== "image/png" ? storedQuality : undefined,
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
      return { status: "saved", bytes: blob.size };
    } catch (err) {
      console.error("Persist canvas failed:", err);
      toast.error("Couldn't save canvas changes");
      // The toast is the moment; this is what stays true after it has gone —
      // the status bar holds it until a later save succeeds.
      setSaveFailed(true);
      return { status: "failed" };
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
