// The Resize & Compress panel's two Apply handlers. Moved out of AppShell
// (being dismantled — CLAUDE.md) on 10-07, when both had to change:
//
// 1. The panel shows the PHOTO's size (`photo_bounds`), but the handlers
//    compared it with the DOCUMENT's (`stamp.state.width`), which includes the
//    artboard border. On a bordered photo every Apply therefore looked like a
//    resize — a quality-only Apply on 256×256 resized the 276 document to 256
//    and left a 238 px photo. And a real resize passed the typed size to the
//    document, so 128 came out 118. Both now go through `documentSizeForPhoto`.
//
// 2. The save can decline: a re-encode bigger than the stored file is not
//    written (`usePersistActiveCanvas`). That used to be a console line while
//    the panel called the Apply done. It is a toast now, and the handlers
//    return whether the stored file changed so the panel only clears what was
//    actually applied.
import { useCallback, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { PhotoBounds } from "@/hooks/usePhotoBounds";
import type { PersistOutcome } from "./usePersistActiveCanvas";
import { documentSizeForPhoto, keptOriginalMessage } from "@/lib/resizeTarget";
import { encodeForApply } from "@/lib/applyEncode";
import { formatFromMime, type ExportFormat } from "@/lib/exportImage";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { toast } from "@/components/ui/sonner";

interface Deps {
  stamp: ReturnType<typeof useCloneStamp>;
  photoBounds: PhotoBounds | null;
  quality: number;
  activePhotoId: string | null;
  persistActiveCanvas: (opts?: { keepSourceEncoding?: boolean; allowGrow?: boolean; format?: ExportFormat }) => Promise<PersistOutcome>;
  setHasBeenModified: (v: boolean) => void;
  setModifiedPhotos: (fn: (prev: Set<string>) => Set<string>) => void;
}

export function useResizeCompress({
  stamp,
  photoBounds,
  quality,
  activePhotoId,
  persistActiveCanvas,
  setHasBeenModified,
  setModifiedPhotos,
}: Deps) {
  const photoW = photoBounds?.width ?? stamp.state.width;
  const photoH = photoBounds?.height ?? stamp.state.height;

  const markModified = useCallback(() => {
    setHasBeenModified(true);
    if (activePhotoId) {
      setModifiedPhotos((prev) => (prev.has(activePhotoId) ? prev : new Set(prev).add(activePhotoId)));
    }
  }, [activePhotoId, setHasBeenModified, setModifiedPhotos]);

  const resizePhotoTo = useCallback(
    (w: number, h: number, filter: number) => {
      const doc = documentSizeForPhoto({ w: stamp.state.width, h: stamp.state.height }, photoBounds, { w, h });
      stamp.resizeWithFilter(doc.w, doc.h, filter);
    },
    [stamp, photoBounds],
  );

  const report = (out: PersistOutcome) => {
    if (out.status === "kept") toast.info(keptOriginalMessage(out.newBytes, out.oldBytes));
  };

  /** Commit size (if it moved) and QUALITY. The photo keeps its own format:
   *  the panel's format row is a preview of what each format would weigh,
   *  and the format is chosen at export (10-07). A PNG has no quality to
   *  re-encode at, so a quality-only Apply on one just records the setting —
   *  it is what a lossy export will use. Resolves `true` when it applied. */
  const applyCompression = useCallback(
    async (w: number, h: number, filter: number): Promise<boolean> => {
      const entry = useGalleryStore.getState().photos.find((p) => p.id === activePhotoId);
      const own = formatFromMime(entry?.mimeType ?? "");
      const lossy = own !== null && own !== "png";
      const resized = w !== photoW || h !== photoH;
      if (resized) resizePhotoTo(w, h, filter);
      const recordQuality = () => {
        stamp.toolRef.current?.push_compress_marker(quality);
        stamp.syncState();
      };
      if (!lossy && !resized) {
        recordQuality();
        return true;
      }
      // A resize always writes (see `allowGrow`), so the canvas and the
      // stored file can never disagree about the size.
      const out = await persistActiveCanvas(
        lossy ? { allowGrow: resized, format: own } : { allowGrow: true, keepSourceEncoding: true },
      );
      report(out);
      if (out.status === "saved") {
        // The Compress step is recorded only for a compression that landed —
        // an undo step for a file that never changed undoes nothing.
        if (!resized) recordQuality();
        markModified();
        return true;
      }
      return false;
    },
    [activePhotoId, photoW, photoH, resizePhotoTo, persistActiveCanvas, stamp, quality, markModified],
  );

  /** Dimensions only, re-saved in the photo's own format and quality. */
  const applyResizeOnly = useCallback(
    async (w: number, h: number, filter: number): Promise<boolean> => {
      if (w < 1 || h < 1 || (w === photoW && h === photoH)) return false;
      resizePhotoTo(w, h, filter);
      markModified();
      const out = await persistActiveCanvas({ keepSourceEncoding: true, allowGrow: true });
      report(out);
      return out.status === "saved";
    },
    [photoW, photoH, resizePhotoTo, persistActiveCanvas, markModified],
  );

  // ── Measuring what Apply would write ─────────────────────────────────────
  // The panel's Image weight is the byte count of the real pending encode:
  // the composite (cached per document state), resampled with the chosen
  // kernel by the engine's own stateless resample, then `encodeForApply` —
  // the function Apply itself calls. Null when it cannot be measured.
  const capRef = useRef<{ key: string; pixels: Uint8Array; w: number; h: number } | null>(null);
  const docKey = `${activePhotoId}:${stamp.state.undoCount}:${stamp.state.width}x${stamp.state.height}`;
  const measureApply = useCallback(
    async (req: {
      w: number;
      h: number;
      filter: number;
      exportFormat: ExportFormat;
      quality: number;
      keepSourceEncoding: boolean;
      format?: ExportFormat;
    }): Promise<{ bytes: number; kept: boolean } | null> => {
      const tool = stamp.toolRef.current;
      const entry = useGalleryStore.getState().photos.find((p) => p.id === activePhotoId);
      if (!tool || !entry || req.w < 1 || req.h < 1) return null;
      // Past ~24 MP the resample + encode is long enough to feel; the
      // formula estimate stays on screen instead.
      if (req.w * req.h > 24_000_000) return null;
      let cap = capRef.current;
      if (!cap || cap.key !== docKey) {
        const c = await tool.capture_composite_excluding_background();
        cap = { key: docKey, pixels: c.rgba, w: c.width, h: c.height };
        c.free();
        capRef.current = cap;
      }
      let pixels = cap.pixels;
      if (req.w !== cap.w || req.h !== cap.h) {
        const mod = await import("stamp_tool");
        await mod.default();
        pixels = mod.resize_pixels_filter(cap.pixels, cap.w, cap.h, req.w, req.h, req.filter);
        if (pixels.length !== req.w * req.h * 4) return null;
      }
      const r = await encodeForApply(pixels, req.w, req.h, {
        entry,
        exportFormat: req.exportFormat,
        quality: req.quality,
        keepSourceEncoding: req.keepSourceEncoding,
        format: req.format,
      });
      // Mirrors `allowGrow`: only a same-size re-encode can be declined.
      return { bytes: r.blob.size, kept: r.kept && req.w === photoW && req.h === photoH };
    },
    [stamp, activePhotoId, docKey, photoW, photoH],
  );

  return { applyCompression, applyResizeOnly, measureApply };
}
