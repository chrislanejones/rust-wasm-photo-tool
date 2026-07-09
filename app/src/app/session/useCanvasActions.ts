// Canvas viewport + single-image export/clipboard/histogram actions, extracted
// verbatim from AppShell (stage 2). Everything routes through the WASM `stamp`
// handle; the export path also needs the active format/quality/EXIF-keep choice
// (passed in) and reads the gallery photos/active id from useGalleryStore.
import { useCallback } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { toast } from "@/components/ui/sonner";
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import { readExifTiff, applyExifToReencoded } from "@/lib/exif";
import { EXT, encodeRgba } from "@/lib/exportImage";
import type { ExportFormat } from "@/lib/exportImage";

export function useCanvasActions({
  stamp,
  exportFormat,
  quality,
  exifKeep,
  exportCanvasBackground,
}: {
  stamp: ReturnType<typeof useCloneStamp>;
  exportFormat: ExportFormat;
  quality: number;
  exifKeep: boolean;
  /** Settings → General → "Canvas background on export". Off (default) ⇒
   *  leave the artboard's backing "Background" layer out of the exported/
   *  copied pixels — see `get_image_data_excluding_background` in Rust. */
  exportCanvasBackground: boolean;
}) {
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);

  // Histogram bins straight from Rust (`calculate_histogram` over the composite
  // buffer) — replaces HistogramView's old per-resample canvas sampling loop.
  const getHistogram = useCallback((): Uint32Array | null => {
    const tool = stamp.toolRef.current;
    return tool ? tool.calculate_histogram() : null;
  }, [stamp]);

  const handleZoomIn = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(1);
    stamp.syncState();
  }, [stamp]);

  const handleZoomOut = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(-1);
    stamp.syncState();
  }, [stamp]);

  const handleZoomReset = useCallback(() => {
    stamp.toolRef.current?.set_zoom(1.0);
    stamp.syncState();
  }, [stamp]);

  const handleCopyToClipboard = useCallback(async () => {
    const tool = stamp.toolRef.current;
    if (!tool) {
      toast.error("No image to copy");
      return;
    }
    try {
      // Match the export-path semantics: bake any live text overlays into
      // pixels first so the clipboard image reflects what's on screen.
      if (tool.text_annotation_count() > 0) {
        tool.flatten_text_annotations();
        stamp.flushToCanvas();
        stamp.syncState();
      }
      let blob: Blob;
      if (exportCanvasBackground) {
        // Important: `tool.export_png()` returns a Uint8Array view into wasm
        // memory. Passing `.buffer` to Blob() would include the entire wasm
        // heap, not just the PNG slice — the resulting blob is huge and the
        // clipboard write fails. Copy the slice into a fresh ArrayBuffer
        // (detached from wasm memory) before handing it to Blob.
        const pngView = tool.export_png();
        const pngBytes = new Uint8Array(pngView.length);
        pngBytes.set(pngView);
        blob = new Blob([pngBytes], { type: "image/png" });
      } else {
        const pixels = new Uint8Array(tool.get_image_data_excluding_background());
        blob = await encodeRgba(
          pixels,
          tool.export_width_excluding_background(),
          tool.export_height_excluding_background(),
          "png",
          1,
        );
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't copy to clipboard: ${msg}`);
    }
  }, [stamp, exportCanvasBackground]);

  const handleExport = useCallback(async () => {
    const entry = photos.find((p) => p.id === activePhotoId) ?? null;
    const activeName = entry?.name ?? "image";
    const tool = stamp.toolRef.current;
    // Excluding the canvas background crops the export to the photo's own
    // (smaller) bounding box — track the dimensions that were ACTUALLY
    // encoded so the WebP EXIF transplant below declares the right size.
    let exportW = stamp.state.width;
    let exportH = stamp.state.height;
    let blob: Blob | null;
    if (exportCanvasBackground) {
      blob = await stamp.exportBlob(exportFormat, quality / 100);
    } else if (tool) {
      exportW = tool.export_width_excluding_background();
      exportH = tool.export_height_excluding_background();
      blob = await encodeRgba(
        new Uint8Array(tool.get_image_data_excluding_background()),
        exportW,
        exportH,
        exportFormat,
        quality / 100,
      );
    } else {
      blob = null;
    }
    if (!blob) return;

    let bytes = new Uint8Array(await blob.arrayBuffer());
    // The canvas export is always freshly re-encoded, so it carries no EXIF.
    // Keep → transplant the true original's EXIF (JPEG/WebP); strip → leave clean.
    let sourceTiff: Uint8Array<ArrayBuffer> | null = null;
    if (exifKeep && entry && (exportFormat === "jpeg" || exportFormat === "webp")) {
      const orig = await getOriginal(entry.uploadKey ?? entry.originalKey);
      if (orig) sourceTiff = readExifTiff(new Uint8Array(orig.bytes), orig.mimeType);
    }
    bytes = applyExifToReencoded(
      bytes,
      exportFormat,
      exifKeep ? "keep" : "strip",
      sourceTiff,
      exportW,
      exportH,
    );

    const stem = activeName.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(new Blob([bytes], { type: blob.type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stem}-revised${EXT[exportFormat]}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stamp, exportFormat, quality, photos, activePhotoId, exifKeep]);

  return {
    getHistogram,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleCopyToClipboard,
    handleExport,
  };
}
