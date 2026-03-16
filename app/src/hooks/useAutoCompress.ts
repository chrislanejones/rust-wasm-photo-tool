import { useCallback, useRef, useState } from "react";

export interface CompressionProgress {
  /** Map of photo id → progress 0-100 */
  items: Record<string, number>;
  /** Is the batch running? */
  running: boolean;
  /** Total images */
  total: number;
  /** Completed images */
  completed: number;
}

/**
 * Auto-compress all images in the gallery using WASM resize.
 *
 * For each photo:
 * 1. Load image into a temporary canvas to get pixels
 * 2. Create a temp WASM tool, load pixels, resize to target
 * 3. Export as blob at target quality
 * 4. Replace the photo entry's url + file with compressed version
 *
 * Returns progress state and a trigger function.
 */
export function useAutoCompress() {
  const [progress, setProgress] = useState<CompressionProgress>({
    items: {},
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
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.75,
        format = "image/webp",
      } = options;

      abortRef.current = false;

      const items: Record<string, number> = {};
      photos.forEach((p) => (items[p.id] = 0));

      setProgress({
        items: { ...items },
        running: true,
        total: photos.length,
        completed: 0,
      });

      let completed = 0;

      for (const photo of photos) {
        if (abortRef.current) break;

        // Update: starting this image
        items[photo.id] = 10;
        setProgress((prev) => ({
          ...prev,
          items: { ...items },
        }));

        try {
          // 1. Load the original file into an offscreen canvas
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

          // 2. Calculate target dimensions
          let tw = bitmap.width;
          let th = bitmap.height;
          if (tw > maxWidth || th > maxHeight) {
            const scale = Math.min(maxWidth / tw, maxHeight / th);
            tw = Math.round(tw * scale);
            th = Math.round(th * scale);
          }

          items[photo.id] = 50;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          // 3. Resize using an offscreen canvas (simple browser resize)
          // We use the browser's canvas scaling which is fast
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

          // 4. Export as compressed blob
          const blob = await resized.convertToBlob({
            type: format,
            quality,
          });

          items[photo.id] = 90;
          setProgress((prev) => ({ ...prev, items: { ...items } }));

          // 5. Create new File and URL
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

          // 6. Report back
          onPhotoCompressed(photo.id, newFile, newUrl);

          items[photo.id] = 100;
          completed++;
          setProgress((prev) => ({
            ...prev,
            items: { ...items },
            completed,
          }));
        } catch (err) {
          console.error(`Failed to compress ${photo.file.name}:`, err);
          items[photo.id] = -1; // error
          completed++;
          setProgress((prev) => ({
            ...prev,
            items: { ...items },
            completed,
          }));
        }

        // Small delay so the UI can breathe
        await new Promise((r) => setTimeout(r, 50));
      }

      // Mark done after a brief moment so the 100% state is visible
      setTimeout(() => {
        setProgress({
          items: {},
          running: false,
          total: 0,
          completed: 0,
        });
      }, 1500);
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, compressAll, cancel };
}
