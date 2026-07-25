// Export — encoded output (PNG via the engine, JPEG/WebP/AVIF via the canvas)
// and the Rust-scaled thumbnails the gallery strip runs on.
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// PNG comes straight from `export_png()` (composites every visible layer — no
// destructive flatten); the lossy formats read the <canvas> via toBlob after a
// flush, so what exports is exactly what is on screen.
import { useCallback, useMemo } from "react";
import type { EngineCore } from "./useEngineCore";

export function useExport(engine: EngineCore) {
  const { toolRef, canvasRef, flushToCanvas } = engine;

  // ── Export ────────────────────────────────────────────────────────────────
  // Derive a download filename: strip original extension, append "-revised" + new ext.
  function revisedName(sourceName: string, ext: string): string {
    const stem = sourceName.replace(/\.[^.]+$/, "");
    return `${stem}-revised${ext}`;
  }

  const exportPng = useCallback((sourceName = "image") => {
    const t = toolRef.current;
    if (!t) return;
    // export_png composites every visible layer (pixels + live overlays +
    // opacity) — no destructive flatten needed.
    const png = t.export_png();
    const blob = new Blob([new Uint8Array(png)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = revisedName(sourceName, ".png");
    a.click();
    URL.revokeObjectURL(url);
  }, [toolRef]);

  // Return the encoded export bytes as a Blob (no download). Lets callers
  // post-process — e.g. apply the EXIF keep/strip policy — before saving.
  const exportBlob = useCallback(
    async (
      format: "png" | "jpeg" | "webp" | "avif",
      quality: number = 0.92,
    ): Promise<Blob | null> => {
      const t = toolRef.current;
      if (format === "png") {
        if (!t) return null;
        return new Blob([new Uint8Array(t.export_png())], { type: "image/png" });
      }
      const canvas = canvasRef.current;
      if (!canvas) return null;
      flushToCanvas();
      const mimeMap: Record<string, string> = {
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif",
      };
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), mimeMap[format], quality),
      );
    },
    [toolRef, canvasRef, flushToCanvas],
  );

  const exportAs = useCallback(
    (format: "png" | "jpeg" | "webp" | "avif", quality: number = 0.92, sourceName = "image") => {
      if (format === "png") {
        exportPng(sourceName);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Non-PNG export reads the canvas pixels via toBlob. flushToCanvas paints
      // the full composite (all visible layers + overlays), so just ensure the
      // canvas is current — no destructive flatten needed.
      flushToCanvas();
      const mimeMap: Record<string, string> = {
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif",
      };
      const extMap: Record<string, string> = {
        jpeg: ".jpg",
        webp: ".webp",
        avif: ".avif",
      };
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = revisedName(sourceName, extMap[format]);
          a.click();
          URL.revokeObjectURL(url);
        },
        mimeMap[format],
        quality,
      );
    },
    [canvasRef, exportPng, flushToCanvas],
  );

  // ── Thumbnail generation ──────────────────────────────────────────────────
  /**
   * Generates a bilinearly-scaled thumbnail using the Rust WASM core.
   * Returns an ImageData-compatible object so JS can paint it onto a canvas
   * or convert to a Blob URL for the PhotoStrip without any extra canvas work.
   */
  const generateThumbnail = useCallback(
    (
      maxPx: number,
    ): { data: Uint8ClampedArray; width: number; height: number } | null => {
      const t = toolRef.current;
      if (!t) return null;
      const w = t.thumbnail_width(maxPx);
      const h = t.thumbnail_height(maxPx);
      const raw = t.thumbnail_data(maxPx);
      return { data: new Uint8ClampedArray(raw), width: w, height: h };
    },
    [toolRef],
  );

  /**
   * Convenience: generates a thumbnail and returns an object-URL blob,
   * ready to drop straight into an <img src=...>.
   * Caller is responsible for calling URL.revokeObjectURL when done.
   */
  const generateThumbnailUrl = useCallback(
    (maxPx: number): Promise<string | null> => {
      return new Promise((resolve) => {
        const thumb = generateThumbnail(maxPx);
        if (!thumb) return resolve(null);
        const offscreen = new OffscreenCanvas(thumb.width, thumb.height);
        const ctx = offscreen.getContext("2d")!;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(thumb.data.buffer as ArrayBuffer), thumb.width, thumb.height),
          0,
          0,
        );
        offscreen
          .convertToBlob({ type: "image/jpeg", quality: 0.82 })
          .then((blob) => {
            resolve(URL.createObjectURL(blob));
          });
      });
    },
    [generateThumbnail],
  );

  return useMemo(
    () => ({
      exportPng,
      exportAs,
      exportBlob,
      generateThumbnail,
      generateThumbnailUrl,
    }),
    [exportPng, exportAs, exportBlob, generateThumbnail, generateThumbnailUrl],
  );
}
