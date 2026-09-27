// The drag / paste image-import flow — moved out of AppShell verbatim (B3,
// docs/AppShell-Refactor-Plan.md). One domain: how an image that arrives
// mid-session (Ctrl+V, a file dropped on the window) becomes a layer, a paste
// placement, or a gallery entry. AppShell mounts <ShellDialogs>, which renders
// the drop affordance and the choice dialog from what this returns.
import { useCallback, useEffect, useState } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { usePastePlacementTool } from "@/hooks/usePastePlacementTool";
import { isSvgFile, rasterizeSvgToPng } from "@/lib/rasterizeSvg";
import { namePastedImage } from "@/lib/pastedImageName";
import { toast } from "@/components/ui/sonner";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";

/** Decode an image Blob to RGBA pixels (off the main canvas). Used by the
 *  drag/paste import flow before the user picks where the image should land. */
async function decodeImageSource(
  source: Blob,
): Promise<{ pixels: Uint8ClampedArray; w: number; h: number }> {
  const bitmap = await createImageBitmap(source);
  const w = bitmap.width;
  const h = bitmap.height;
  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  return { pixels: new Uint8ClampedArray(rgba.buffer as ArrayBuffer), w, h };
}

export function useImageImport({
  stamp,
  pastePlacement,
  handleAddPhotos,
}: {
  stamp: ReturnType<typeof useCloneStamp>;
  pastePlacement: ReturnType<typeof usePastePlacementTool>;
  /** Gallery add — trims to the tier cap and toasts when it had to. */
  handleAddPhotos: (files: File[]) => Promise<void>;
}) {
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const resumeManifest = useGalleryStore((s) => s.resumeManifest);
  const showUpload = useUIStore((s) => s.showUpload);
  const booting = useUIStore((s) => s.booting);
  const firstRun = useUIStore((s) => s.firstRun);
  /**
   * Paste a bitmap from the clipboard into the **active layer**, centered on the
   * canvas. Accepts either the `clipboardData.items` from a native paste event
   * or, when called without them, falls back to the async Clipboard API (for an
   * explicit button/menu invocation). Decodes the image to RGBA and composites
   * it via the active-layer `paste_region` (one "Paste" history entry in Rust).
   */
  // ── Drag / paste image import ────────────────────────────────────────────
  // A dropped or pasted image doesn't act immediately — it opens a choice
  // dialog (New layer / Onto image / To gallery). `isDraggingImage` drives the
  // full-window drop affordance; `importImage` holds the decoded image + a File
  // (for the gallery path) + a preview URL while the dialog is open.
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [importImage, setImportImage] = useState<{
    pixels: Uint8ClampedArray;
    w: number;
    h: number;
    file: File;
    previewUrl: string;
  } | null>(null);

  const closeImportDialog = useCallback(() => {
    setImportImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const openImportDialog = useCallback(async (source: Blob, file: File) => {
    try {
      // SVGs are rasterized to PNG at the boundary (createImageBitmap can't
      // decode them, and raw SVG never enters the pipeline — lib/rasterizeSvg).
      if (isSvgFile(file)) {
        file = await rasterizeSvgToPng(file);
        source = file;
      }

      // AN EMPTY WORKSPACE NEVER ASKS — the same rule a multi-image paste
      // already follows above ("a stack never asks"). Two of this dialog's
      // three choices stack or merge onto a layer, and with no image open
      // there is no layer to stack onto: both tiles render disabled and the
      // only live choice is the gallery. Asking a question with one possible
      // answer is not a choice, it is a click in the way (Chris, 2026-09-10).
      //
      // Gated on the ACTIVE PHOTO, not on gallery length: the layer tiles are
      // disabled by `hasActivePhoto` at the render site, so this matches
      // exactly what the dialog would have offered.
      if (activePhotoId === null) {
        await handleAddPhotos([file]);
        return;
      }

      const { pixels, w, h } = await decodeImageSource(source);
      const previewUrl = URL.createObjectURL(source);
      setImportImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { pixels, w, h, file, previewUrl };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't read image: ${msg}`);
    }
  }, [activePhotoId, handleAddPhotos]);

  const handlePasteFromClipboard = useCallback(
    async (items?: DataTransferItemList | null) => {
      let source: Blob | null = null;
      if (items) {
        // Collect EVERY image on the clipboard, not just the first. Pasting a
        // multi-file selection out of a file manager hands over one item per
        // file, and the "Add this image" choice dialog is single-image by
        // construction — it used to keep item 0 and silently drop the rest.
        // `getAsFile()` must run before any await (the item list is only valid
        // during the event turn), which is why this maps eagerly.
        const pasted = Array.from(items)
          .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
          .map((it) => it.getAsFile())
          .filter((f): f is File => f !== null)
          .map(namePastedImage);
        if (pasted.length >= 2) {
          // A stack never asks — straight to the gallery. handleAddPhotos
          // trims to the tier cap and toasts when it had to.
          await handleAddPhotos(pasted);
          return;
        }
        if (pasted[0]) source = pasted[0];
      }
      if (!source) {
        try {
          const read = await navigator.clipboard.read();
          for (const clip of read) {
            const t = clip.types.find((x) => x.startsWith("image/"));
            if (t) {
              source = await clip.getType(t);
              break;
            }
          }
        } catch {
          /* Clipboard API unavailable / denied — nothing to paste.
           *
           * DELIBERATELY SILENT, unlike the start-screen Paste BUTTON
           * (`NewActions.handlePasteClick`), which toasts all three of its
           * failure modes. The difference is what triggers each one. That
           * button is an explicit "paste an image now", so a failure is worth
           * reporting. This runs on EVERY Ctrl+V over the canvas, including
           * pasting plain text — which reaches here with no image on the
           * clipboard and would fire an error toast on an ordinary text paste.
           * A toast here is noise, not feedback. Leave it quiet. */
        }
      }
      if (!source) return;
      await openImportDialog(source, namePastedImage(source));
    },
    [openImportDialog, handleAddPhotos],
  );

  // A "New"/start surface is up: the upload dialog, the boot splash, or the
  // first-run start screen (New actions / Welcome-back). Drag-drop & paste
  // image-import stay dormant under any of these — the surface owns the image
  // (or there's no workspace yet). "Add this image" is only for dropping/pasting
  // onto the live editor when no dialog/start screen is open.
  const newSurfaceOpen =
    showUpload || booting || (firstRun && !!resumeManifest);


  // Native Ctrl/Cmd+V paste of an image → open the import choice dialog.
  // Skipped while a New/start surface is up, or focus is in a text field.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (newSurfaceOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const hasImage = Array.from(items).some(
        (it) => it.kind === "file" && it.type.startsWith("image/"),
      );
      if (!hasImage) return;
      e.preventDefault();
      void handlePasteFromClipboard(items);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [newSurfaceOpen, handlePasteFromClipboard]);

  // Drag an image anywhere over the app → show the full-window drop affordance;
  // on drop, open the import choice dialog (NOT the New/upload dialog). A depth
  // counter keeps the overlay steady as the drag crosses child elements.
  useEffect(() => {
    if (newSurfaceOpen) return; // a New/start surface owns drops while it's up
    const isFileDrag = (e: DragEvent) =>
      !!e.dataTransfer &&
      Array.from(e.dataTransfer.types || []).includes("Files");
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth += 1;
      setIsDraggingImage(true);
    };
    const onOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // required so the browser fires `drop`
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDraggingImage(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // stop the browser from navigating to the image
      depth = 0;
      setIsDraggingImage(false);
      // isSvgFile catches .svg drops whose source hands over an empty mime.
      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) => f.type.startsWith("image/") || isSvgFile(f),
      );
      if (files.length === 0) {
        toast.error("That doesn't look like an image");
        return;
      }
      // A STACK OF IMAGES NEVER ASKS. "Add this image" offers a single-image
      // choice (stack as layer / merge into layer / new gallery image) and can
      // only carry one file, so a multi-file drop used to keep files[0] and
      // silently discard the rest. Two or more now go straight to the gallery
      // regardless of whether the gallery is empty or already has photos —
      // handleAddPhotos accepts as many as fit under the tier cap and toasts
      // when the batch had to be trimmed.
      if (files.length >= 2) {
        void handleAddPhotos(files);
        return;
      }
      void openImportDialog(files[0], files[0]);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      setIsDraggingImage(false);
    };
  }, [newSurfaceOpen, openImportDialog, handleAddPhotos]);

  // ── Import choice actions ──
  /** Center the imported image over the canvas. */
  const importDest = useCallback(
    (w: number, h: number) => {
      const cw = stamp.state.width || w;
      const ch = stamp.state.height || h;
      return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2) };
    },
    [stamp.state.width, stamp.state.height],
  );
  const importToNewLayer = useCallback(async () => {
    const img = importImage;
    if (!img) return;
    const { x, y } = importDest(img.w, img.h);
    // Awaited: ADR-024 Stage 3.5 made the layer ops async. Nothing between here
    // and `begin` reads the engine, so there is no capture to tear — the id is
    // simply needed before the placement box can be told what to remove on Esc.
    const layerId = await stamp.addLayer("Pasted Image"); // creates + activates a fresh layer
    // Same movable/resizable placement as "Merge into layer" — `begin` scales
    // the box down to fit when the image is bigger than the canvas, so an
    // oversized paste stays fully visible and resizable instead of baking in
    // at 1:1 and permanently clipping at the layer edges. Escape aborts the
    // paste and removes the layer it would have landed on.
    pastePlacement.begin(img.pixels, img.w, img.h, x, y, () =>
      void stamp.removeLayer(layerId),
    );
    toast.success("Pasted on a new layer — Enter places it, Esc cancels");
    closeImportDialog();
  }, [importImage, importDest, stamp, pastePlacement, closeImportDialog]);
  const importOntoLayer = useCallback(() => {
    const img = importImage;
    if (!img) return;
    const { x, y } = importDest(img.w, img.h);
    // Seed a movable/resizable placement instead of baking the pixels in
    // immediately — the bounding-box overlay takes over the canvas; Enter,
    // clicking away, or switching tools commits it (Escape cancels).
    pastePlacement.begin(img.pixels, img.w, img.h, x, y);
    closeImportDialog();
  }, [importImage, importDest, pastePlacement, closeImportDialog]);
  const importToGallery = useCallback(() => {
    const img = importImage;
    if (!img) return;
    void handleAddPhotos([img.file]);
    closeImportDialog();
  }, [importImage, handleAddPhotos, closeImportDialog]);

  return {
    isDraggingImage,
    importImage,
    closeImportDialog,
    importToNewLayer,
    importOntoLayer,
    importToGallery,
  };
}
