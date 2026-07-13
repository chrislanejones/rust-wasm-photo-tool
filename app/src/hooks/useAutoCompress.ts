// ===== FILE: app/src/hooks/useAutoCompress.ts =====
import { useCallback, useRef, useState } from "react";
import { encodeViaWorker } from "@/lib/codecWorkerClient";

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
        /** Byte budget the encode loop iterates toward (default 200 KB). */
        targetBytes?: number;
        /** Long-edge floor for budget-driven downscaling (default 1280). */
        minLongEdge?: number;
      },
      onPhotoCompressed: (id: string, newFile: File, newUrl: string) => void,
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
        // The actual PageSpeed lever: iterate quality (then dimensions) down
        // until the encoded file fits this budget. ~200 KB keeps a hero-sized
        // image comfortably inside "properly size images" territory.
        targetBytes = 200 * 1024,
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
          // the byte target, step dimensions down 15% at a time (quality reset
          // to 0.7 for the smaller canvas) until the file fits or the long
          // edge hits `minLongEdge`. Bounded so a pathological image can't
          // spin — worst case we ship the smallest attempt.
          let q = quality;
          let cw = tw;
          let ch = th;
          let canvas = resized;
          let blob = await encodeCanvas(canvas, cw, ch, q);
          for (let pass = 0; blob.size > targetBytes && pass < 8; pass++) {
            if (q > 0.52) {
              q = Math.max(0.5, q - 0.12);
            } else if (Math.max(cw, ch) > minLongEdge) {
              const s = 0.85;
              cw = Math.max(1, Math.round(cw * s));
              ch = Math.max(1, Math.round(ch * s));
              const next = new OffscreenCanvas(cw, ch);
              next.getContext("2d")!.drawImage(canvas, 0, 0, cw, ch);
              canvas = next;
              q = 0.7;
            } else {
              break;
            }
            blob = await encodeCanvas(canvas, cw, ch, q);
          }

          items[photo.id] = 90;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          const ext =
            format === "image/webp"
              ? ".webp"
              : format === "image/jpeg"
                ? ".jpg"
                : ".avif";

          const newFile = new File(
            [blob],
            photo.file.name.replace(/\.[^.]+$/, ext),
            { type: format },
          );

          const newUrl = URL.createObjectURL(blob);
          const compressedSize = blob.size;
          const savingsPercent =
            originalSize > 0
              ? Math.max(
                  0,
                  Math.round((1 - compressedSize / originalSize) * 100),
                )
              : 0;

          onPhotoCompressed(photo.id, newFile, newUrl);

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
