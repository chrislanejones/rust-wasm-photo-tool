// ===== FILE: app/src/hooks/useAutoCompress.ts =====
import { useCallback, useRef, useState } from "react";

export interface CompressionProgress {
  /** Progress per photo ID: 0..100 for progress, -1 for error. Matches existing GalleryBar type. */
  items: Record<string, number>;
  /** Savings info per photo (for future PhotoThumb Zap badge). */
  savings: Record<
    string,
    { originalSize: number; compressedSize: number; savingsPercent: number }
  >;
  running: boolean;
  total: number;
  completed: number;
}

export function useAutoCompress() {
  const [progress, setProgress] = useState<CompressionProgress>({
    items: {},
    savings: {},
    running: false,
    total: 0,
    completed: 0,
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
      },
      onPhotoCompressed: (id: string, newFile: File, newUrl: string) => void,
    ) => {
      const {
        maxWidth = 2200, // bumped from 1920
        maxHeight = 2200, // bumped from 1080
        quality = 0.75,
        format = "image/webp",
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

          const blob = await resized.convertToBlob({
            type: format,
            quality,
          });

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
