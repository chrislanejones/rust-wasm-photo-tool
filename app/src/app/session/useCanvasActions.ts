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
import { EXT, encodeRgba, extFromMime } from "@/lib/exportImage";
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
      // NO FLATTEN HERE. This used to call `flatten_text_annotations()` on the
      // LIVE engine before reading the pixels, on the belief that overlays had
      // to be baked in or the clipboard image would miss them.
      //
      // They do not. `export_png()` and `get_image_data_excluding_background()`
      // both go through `composite_layers`, and `render_layer` draws each
      // layer's `shape_annotations` and `text_annotations` as it composites —
      // the single-layer fast path is gated on `layer_has_no_overlays` for
      // exactly that reason (src/layer.rs:200). The overlays were always in the
      // output. The flatten only changed where they lived.
      //
      // Why remove it, stated carefully, because the obvious version of this
      // paragraph is WRONG and was written here before QC checked it.
      //
      // Reading the Rust says this should push a "Flatten" snapshot into the
      // undo history on every Copy and turn live text into pixels
      // (`flatten_text_annotations` calls `snap("Flatten")`, then `mem::take`s
      // both overlay lists). QC measured the shipped app and NEITHER happens:
      // the history reads Add Text / Text Shadow / Current State, and the
      // annotation is still selectable afterwards.
      //
      // WHY it was inert is still unexplained, and an earlier version of this
      // comment guessed wrong, so the guess is recorded as retracted rather
      // than replaced. It said "it reports the ACTIVE layer only, and the text
      // generally is not on it". The first half is true; the second is false —
      // `add_text_annotation` pushes onto `self.layers[self.active]`
      // (src/annotations.rs), so text lands on the active layer by default, and
      // QC confirmed the active layer was Photo with the text on it. Do not
      // reach for that explanation again; it has been checked and it is wrong.
      //
      // ⚠️ THE MID-EDIT CASE IS SAFE BY ACCIDENT, NOT BY DESIGN. The composite
      // deliberately SKIPS the annotation currently being edited
      // (`if editing_text_id == Some(a.id) { continue; }`, src/layer.rs:136,
      // and :129 for shapes), while the deleted flatten baked it in. So a Copy
      // reached with `editing_text_id` set would silently omit that text from
      // the clipboard — the one case where removing the flatten genuinely
      // changes output.
      //
      // It is currently unreachable, verified in a browser 2026-08-08 on both
      // routes: the export dialog COMMITS the text when clicked (canvas ink
      // 0 → 333, editor closes, so `editing_text_id` is already clear), and
      // `Ctrl+Shift+C` returns early while an input/textarea/contentEditable
      // has focus (useKeyboardShortcuts.ts). Neither is a guarantee about this
      // function. **Any new path into Copy must not be able to run while a text
      // or shape annotation is being edited** — if one can, restore a flatten
      // on a throwaway clone rather than on the live engine.
      //
      // So this is not removing a live defect. It is removing a mutation from a
      // READ path that happens to be inert today and is one active-layer change
      // away from not being. A copy must not be able to write to the document,
      // and the only reason it currently doesn't is an accident of which layer
      // is selected.
      //
      // A text-loss bug WAS reported here on 2026-08-08 and does NOT reproduce
      // on v7.75 (three attempts, plus shapes and Export). The build it was
      // found on carried uncommitted mid-refactor `port.ts`, and no commit
      // since touches this path. Treat that report as unexplained, not as the
      // thing this change fixes.
      //
      // `exportImage.ts` still does this and should get the same treatment —
      // it is a separate path with its own callers, so it is a separate change.
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
    // Name the file after the bytes, not the request. `blob.type` is already
    // trusted one line above to type the Blob itself; trusting it here too is
    // what stops an AVIF request — which Chrome silently satisfies with PNG —
    // from landing as a `.avif` file full of PNG. EXT stays as the fallback for
    // the rare blob with no type at all.
    const ext = extFromMime(blob.type) || EXT[exportFormat];
    a.download = `${stem}-revised${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    // `exportCanvasBackground` is read at the top of this callback and was
    // missing here. Without it the memoized closure kept whichever value was
    // current when it was last rebuilt, so flipping Settings → Layers and
    // Canvas → "Photo only" and pressing Download straight away exported the
    // PREVIOUS setting — the padded canvas when you asked for the photo, or
    // the reverse. It corrected itself as soon as any other dependency moved
    // (switching photos, changing format), which is what made it look
    // intermittent rather than broken. `handleCopyToClipboard` above always
    // had it; only this path did not.
  }, [stamp, exportFormat, quality, photos, activePhotoId, exifKeep, exportCanvasBackground]);

  return {
    getHistogram,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleCopyToClipboard,
    handleExport,
  };
}
