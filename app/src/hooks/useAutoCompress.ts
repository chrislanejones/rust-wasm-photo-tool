// ===== FILE: app/src/hooks/useAutoCompress.ts =====
import { useCallback, useRef, useState } from "react";
import { encodeViaWorker } from "@/lib/codecWorkerClient";
import { autoCompressTarget } from "@/lib/webPerf";

export interface CompressionProgress {
  /** Progress per photo ID: 0..100 for progress, -1 for error. Matches existing GalleryBar type. */
  items: Record<string, number>;
  /** Savings info per photo (drives the gallery thumb Zap badge). */
  savings: Record<
    string,
    { originalSize: number; compressedSize: number; savingsPercent: number }
  >;
  running: boolean;
  total: number;
  completed: number;
  /** True once any target image exceeded the resize threshold — drives the
   *  "Compressing & resizing…" toast wording. */
  resizing: boolean;
}

export function useAutoCompress() {
  const [progress, setProgress] = useState<CompressionProgress>({
    items: {},
    savings: {},
    running: false,
    total: 0,
    completed: 0,
    resizing: false,
  });
  const abortRef = useRef(false);

  const compressAll = useCallback(
    async (
      photos: { id: string; file: File }[],
      options: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        format?: string;
        /** ⚠️ IGNORED. This was a flat byte target, which is not what the web
         *  cares about — Lighthouse measures bytes PER PIXEL (pixels / 6), so
         *  one constant is wrong for every image size at once. The budget is
         *  now `webTargetBytes(w, h)`, recomputed as the loop shrinks the
         *  canvas. Kept in the type so an existing caller still compiles, and
         *  silently not read. */
        targetBytes?: number;
        /** Long-edge floor for budget-driven downscaling (default 1280). */
        minLongEdge?: number;
      },
      onPhotoCompressed: (
        id: string,
        newFile: File,
        newUrl: string,
        /** What was actually written — the budget loop may have shrunk the
         *  dimensions and lowered the quality below what was asked for, and the
         *  never-bigger guard may have kept the ORIGINAL bytes instead of the
         *  re-encode entirely. Either way this describes the file on disk, not
         *  the attempt: the caller stores it on the PhotoEntry so later panel
         *  math starts from the real file rather than the one before it. */
        encoded: { width: number; height: number; quality: number },
      ) => void,
    ) => {
      const {
        // Resize threshold: anything over 2500px on either side gets scaled
        // down as part of Compress Image(s) — dimensions that large are
        // wasted bytes for a page image (the old 2200-cap single-pass encode
        // routinely produced 300-400 KB files that tank PageSpeed). The toast
        // switches to "Compressing & resizing…" when this kicks in.
        maxWidth = 2500,
        maxHeight = 2500,
        quality = 0.75,
        format = "image/webp",
        // Destructured to a throwaway: `targetBytes` no longer decides anything
        // (see the option's doc comment). Naming it `_targetBytes` makes the
        // "passed but ignored" state visible at the destructuring site rather
        // than only in the type.
        targetBytes: _targetBytes = 200 * 1024,
        // Don't shrink below this long edge chasing the budget — past here
        // the image stops being useful and we accept the best effort.
        minLongEdge = 1280,
      } = options;

      abortRef.current = false;

      const items: Record<string, number> = {};
      const savings: Record<
        string,
        { originalSize: number; compressedSize: number; savingsPercent: number }
      > = {};
      photos.forEach((p) => (items[p.id] = 0));

      setProgress({
        items: { ...items },
        savings: {},
        running: true,
        total: photos.length,
        completed: 0,
        resizing: false,
      });

      let completed = 0;

      for (const photo of photos) {
        if (abortRef.current) break;

        const originalSize = photo.file.size;
        items[photo.id] = 10;
        setProgress((prev) => ({
          ...prev,
          items: { ...items },
        }));

        try {
          const bitmap = await createImageBitmap(photo.file);
          const oc = new OffscreenCanvas(bitmap.width, bitmap.height);
          const octx = oc.getContext("2d")!;
          octx.drawImage(bitmap, 0, 0);
          const imageData = octx.getImageData(
            0,
            0,
            bitmap.width,
            bitmap.height,
          );
          bitmap.close();

          items[photo.id] = 30;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          let tw = imageData.width;
          let th = imageData.height;
          if (tw > maxWidth || th > maxHeight) {
            const scale = Math.min(maxWidth / tw, maxHeight / th);
            tw = Math.round(tw * scale);
            th = Math.round(th * scale);
            // Over the resize threshold — flip the toast to
            // "Compressing & resizing…" for the rest of the batch.
            setProgress((prev) =>
              prev.resizing ? prev : { ...prev, resizing: true },
            );
          }

          // LIGHTHOUSE'S ACTUAL RULE, not a flat byte target. The old 200 KB
          // was right for a mid-sized photo and wrong for everything else: a
          // 400×300 thumbnail needs ~20 KB (200 KB is flagged) while a 24 MP
          // photo is allowed 4 MB (200 KB over-compresses it). Lighthouse
          // measures BYTES PER PIXEL — `TARGET_BYTES_PER_PIXEL_AVIF = 2 * 1/12`,
          // i.e. pixels / 6. See lib/webPerf.ts for the derivation.
          //
          // Recomputed whenever the budget loop shrinks the canvas, because the
          // budget is a function of the pixel count and fewer pixels means a
          // proportionally smaller target.
          let budget = autoCompressTarget(tw, th);

          items[photo.id] = 50;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          const resized = new OffscreenCanvas(tw, th);
          const rctx = resized.getContext("2d")!;
          const tempCanvas = new OffscreenCanvas(
            imageData.width,
            imageData.height,
          );
          const tctx = tempCanvas.getContext("2d")!;
          tctx.putImageData(imageData, 0, 0);
          rctx.drawImage(tempCanvas, 0, 0, tw, th);

          items[photo.id] = 70;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          // Offload the (expensive) encode to the codec worker. It transfers
          // the pixels; if the worker is unavailable, fall back to the
          // main-thread convertToBlob on the same canvas (pixels untouched).
          const encodeCanvas = async (
            cv: OffscreenCanvas,
            w: number,
            h: number,
            q: number,
          ) => {
            const px = cv.getContext("2d")!.getImageData(0, 0, w, h).data;
            return (
              (await encodeViaWorker(px, w, h, format, q)) ??
              (await cv.convertToBlob({ type: format, quality: q }))
            );
          };

          // Budget loop: step quality down to a 0.5 floor first; if still over
          // the byte target, step dimensions down 15% at a time until the file
          // fits or the long edge hits `minLongEdge`. Bounded so a pathological
          // image can't spin — worst case we ship the smallest attempt.
          //
          // The dimension step used to reset quality to a FLAT 0.7, which meant
          // a photo that tripped this loop came back encoded at a HIGHER quality
          // than the panel asked for (and than the slider was sitting at). That
          // also made the never-bigger comparison below unpredictable, since the
          // quality of the result no longer followed the setting. Now it resets
          // to the CALLER's quality, which is what the setting said.
          let q = quality;
          let cw = tw;
          let ch = th;
          let canvas = resized;
          let blob = await encodeCanvas(canvas, cw, ch, q);
          for (let pass = 0; blob.size > budget && pass < 8; pass++) {
            if (q > 0.52) {
              q = Math.max(0.5, q - 0.12);
            } else if (Math.max(cw, ch) > minLongEdge) {
              const s = 0.85;
              cw = Math.max(1, Math.round(cw * s));
              ch = Math.max(1, Math.round(ch * s));
              const next = new OffscreenCanvas(cw, ch);
              next.getContext("2d")!.drawImage(canvas, 0, 0, cw, ch);
              canvas = next;
              q = quality;
              // Fewer pixels means a proportionally smaller budget.
              budget = autoCompressTarget(cw, ch);
            } else {
              break;
            }
            blob = await encodeCanvas(canvas, cw, ch, q);
          }

          items[photo.id] = 90;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          // NEVER HAND BACK A BIGGER FILE.
          //
          // The budget loop only ever stepped DOWN, so it had no branch for the
          // case that matters most: an already-small file. A q60 JPEG of 32,950
          // bytes encodes once at the panel's q75, lands at 36,621 — still under
          // budget, so the loop never ran a pass — and was written back over the
          // original. Auto Compress reported success and made the file 11%
          // bigger. Apply Resize already had this guard from #259
          // (`usePersistActiveCanvas`); this is the same rule in the file that
          // lacked it. Both numbers are already in scope, which is why it is cheap.
          //
          // When it grows, keep the ORIGINAL bytes — and report the ORIGINAL's
          // dimensions, not the discarded encode's. `autoCompressedPatch` writes
          // these onto the PhotoEntry, so reporting the encode's dims would leave
          // the gallery describing a file it is no longer holding. Quality is
          // null because nothing was re-encoded, which `autoCompressedPatch`
          // already reads as "lossless / unknown".
          const grew = blob.size > photo.file.size;
          const outBlob: Blob = grew ? photo.file : blob;
          const outW = grew ? imageData.width : cw;
          const outH = grew ? imageData.height : ch;
          const outQuality: number | null = grew ? null : Math.round(q * 100);
          if (grew) {
            console.info(
              `[autocompress] ${photo.file.name}: re-encode would be ${blob.size} B ` +
                `against an original ${photo.file.size} B — keeping the original`,
            );
          }

          // A kept original is still in the original format, so its extension is
          // kept too rather than rewritten to the requested one.
          const keptOriginal = grew;
          const ext = keptOriginal
            ? (photo.file.name.match(/\.[^.]+$/)?.[0] ?? "")
            : format === "image/webp"
              ? ".webp"
              : format === "image/jpeg"
                ? ".jpg"
                : ".avif";

          const newFile = new File(
            [outBlob],
            photo.file.name.replace(/\.[^.]+$/, ext) || photo.file.name,
            // The blob's own type: an encoder that can't do AVIF answers with
            // PNG, and the stored MIME has to say what the bytes really are.
            // A kept original carries the original's own type.
            { type: outBlob.type || format },
          );

          const newUrl = URL.createObjectURL(outBlob);
          const compressedSize = outBlob.size;
          // Signed, matching AppShell's badge convention: positive = smaller
          // than the upload, negative = larger. Not clamped at 0 — a photo that
          // grows should say so rather than show an empty badge.
          const savingsPercent =
            originalSize > 0
              ? Math.round((1 - compressedSize / originalSize) * 100)
              : 0;

          // The DIMENSIONS AND QUALITY OF WHAT WAS ACTUALLY WRITTEN, which is not the
          // discarded encode's when the guard above kept the original. The caller
          // stores these on the PhotoEntry, and every later panel reads them as
          // "the file on disk" — so reporting the encode's numbers here is how a
          // gallery ends up describing a file it is not holding.
          onPhotoCompressed(photo.id, newFile, newUrl, {
            width: outW,
            height: outH,
            quality: outQuality ?? 100,
          });

          items[photo.id] = 100;
          savings[photo.id] = { originalSize, compressedSize, savingsPercent };
          completed++;
          setProgress((prev) => ({
            ...prev,
            items: { ...items },
            savings: { ...savings },
            completed,
          }));
        } catch (err) {
          console.error(`Failed to compress ${photo.file.name}:`, err);
          items[photo.id] = -1;
          completed++;
          setProgress((prev) => ({
            ...prev,
            items: { ...items },
            completed,
          }));
        }

        await new Promise((r) => setTimeout(r, 50));
      }

      // Keep results visible for 3s then clear
      setTimeout(() => {
        setProgress({
          items: {},
          savings: {},
          running: false,
          total: 0,
          completed: 0,
          resizing: false,
        });
      }, 3000);
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, compressAll, cancel };
}
