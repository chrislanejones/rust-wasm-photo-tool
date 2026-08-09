// Export — encoded output and the Rust-scaled thumbnails the gallery strip
// runs on. EVERY format now reads the engine, never the <canvas>.
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// PNG always came straight from `export_png()` (composites every visible layer
// — no destructive flatten). The lossy formats used to `flushToCanvas()` and
// then `canvas.toBlob()`, i.e. read the pixels back off the main canvas
// element. Three reasons that changed:
//
//  1. It made this hook a reader of the main canvas, which blocks ADR-024
//     Stage 4 — after `transferControlToOffscreen()` the main thread cannot
//     call `toBlob` on that element at all, and the lossy formats would throw.
//  2. `canvas.toBlob` encodes on the main thread. `encodeRgba` hands the
//     pixels to an encode worker where one is available and only falls back to
//     a main-thread OffscreenCanvas if not.
//  3. It coupled the exported bytes to whatever happened to be painted. Both
//     paths agreed in practice — `flushToCanvas` paints the same composite
//     `get_image_data()` returns — but "what is on screen" and "what the
//     document is" are two different sources of truth, and only one of them is
//     the engine's.
//
// The `flushToCanvas` calls went with it: nothing here reads the canvas now,
// so there is nothing to bring up to date first.
import { useCallback, useMemo } from "react";
import { encodeRgba, extFromMime } from "@/lib/exportImage";
import type { EngineCore } from "./useEngineCore";

export function useExport(engine: EngineCore) {
  // No `canvasRef` and no `flushToCanvas`: this hook no longer touches the
  // main canvas at all. Keeping either would re-create the Stage-4 coupling
  // the header describes.
  const { toolRef } = engine;

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
      if (!t) return null;
      if (format === "png") {
        return new Blob([new Uint8Array(t.export_png())], { type: "image/png" });
      }
      // `capture_composite()` is the same composite `flushToCanvas` paints —
      // every visible layer plus live overlays — so the bytes are unchanged
      // from the old toBlob path, they just no longer travel via the canvas
      // element.
      //
      // ATOMIC CAPTURE (ADR-024). This was `get_image_data()` + `width()` +
      // `height()`. Those three reads describe ONE document state, and the
      // encoder is about to interpret the buffer AT those dimensions — so they
      // cannot be converted to three awaits. A resize landing between them
      // behind the worker pairs one state's pixels with another state's size:
      // encodeRgba then either throws on the length mismatch or shears the
      // image, depending which way the size moved. One call, one round trip,
      // atomic because `&self` cannot be mutated while it runs.
      const cap = t.capture_composite();
      // Read each field exactly once — every `.rgba` access clones the whole
      // buffer out of wasm memory — then free the boxed allocation.
      const { rgba, width, height } = cap;
      cap.free();
      return await encodeRgba(rgba, width, height, format, quality);
    },
    [toolRef],
  );

  const exportAs = useCallback(
    async (format: "png" | "jpeg" | "webp" | "avif", quality: number = 0.92, sourceName = "image") => {
      if (format === "png") {
        exportPng(sourceName);
        return;
      }
      const extMap: Record<string, string> = {
        jpeg: ".jpg",
        webp: ".webp",
        avif: ".avif",
      };
      const blob = await exportBlob(format, quality);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Name the file after what the encoder ACTUALLY produced, not what was
      // asked for. An unsupported type falls back to PNG silently (see
      // lib/encodeSupport.ts), and `extMap[format]` would then stamp ".avif"
      // onto PNG bytes. `blob.type` is the ground truth; extMap is only the
      // fallback for the rare blob with no type at all.
      const ext = blob.type ? extFromMime(blob.type) : extMap[format];
      a.download = revisedName(sourceName, ext || extMap[format]);
      a.click();
      URL.revokeObjectURL(url);
    },
    [exportPng, exportBlob],
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
      // ATOMIC CAPTURE (ADR-024) — same reason as `exportBlob` above. This was
      // `thumbnail_width` + `thumbnail_height` + `thumbnail_data`, and the
      // caller builds an `ImageData` from the buffer AT those dimensions, which
      // throws outright if they disagree. `codec::thumbnail_data` returns all
      // three from one computation anyway; only the wasm-bindgen wrappers split
      // them.
      const cap = t.capture_thumbnail(maxPx);
      const { rgba, width, height } = cap;
      cap.free();
      return { data: new Uint8ClampedArray(rgba), width, height };
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
