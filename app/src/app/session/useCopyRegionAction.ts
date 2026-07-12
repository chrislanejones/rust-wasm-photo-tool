// Region-aware copy (Ctrl/Cmd+C + context menu "Copy Selection"): copies the
// ACTIVE bounding box / selection to the clipboard as a PNG, so it can be
// pasted back through the existing paste-placement flow (window paste event →
// import-choice dialog → usePastePlacementTool). Falls back to the whole-canvas
// copy (useCanvasActions.handleCopyToClipboard) when nothing is boxed/selected.
//
// Region sources, in priority order — each is guarded by its owning tool being
// the active one, so stale state from a previous tool can't hijack the copy:
//   1. Crop box            (crop tool)   — useDrawingTools.cropSelection
//   2. Shape/arrow bbox    (shapes tool) — useDrawingTools.editState
//   3. Magic-wand selection (Layer Settings "arrow" tool) — bounding rect of
//      the Rust selection-overlay mask (alpha > 0 scan; the mask is the
//      canvas-sized RGBA overlay already held in useToolStore).
//
// DECISIONS (see SESSION_LOG.md): copies are ACTIVE-LAYER pixels via the
// engine's `copy_region` — bounding-rect only (no mask-shaped extraction) and
// non-mutating (no auto-commit/flatten), because live text/shape annotations
// are composite-time renders and masked extraction would need a new engine
// API. Text boxes copy as text natively (real <textarea>). The paste-placement
// box is deliberately excluded — its content already IS the clipboard image.
import { useCallback } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { CropSelection, DrawEditState } from "@/hooks/useDrawingTools";
import type { ToolType } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { encodeRgba } from "@/lib/exportImage";

export function useCopyRegionAction({
  stamp,
  activeTool,
  cropSelection,
  editState,
  selectionMask,
  copyFullCanvas,
}: {
  stamp: ReturnType<typeof useCloneStamp>;
  activeTool: ToolType;
  cropSelection: CropSelection | null;
  editState: DrawEditState | null;
  selectionMask: Uint8Array | null;
  /** Whole-canvas copy — the Ctrl+C fallback when no region is active. */
  copyFullCanvas: () => Promise<void> | void;
}) {
  /** True when Ctrl+C would copy a region (drives the menu item's enabled
   *  state). Mask-bounds scanning is deferred to the actual copy. */
  const hasActiveRegion =
    (activeTool === "crop" && cropSelection !== null) ||
    ((activeTool === "shapes" || activeTool === "arrow") &&
      editState !== null) ||
    (activeTool === "arrow" && selectionMask !== null);

  const resolveRegion = useCallback((): CropSelection | null => {
    if (activeTool === "crop" && cropSelection) return cropSelection;

    if ((activeTool === "shapes" || activeTool === "arrow") && editState) {
      const { start, end } = editState;
      return {
        x: Math.round(Math.min(start.x, end.x)),
        y: Math.round(Math.min(start.y, end.y)),
        width: Math.max(1, Math.round(Math.abs(end.x - start.x))),
        height: Math.max(1, Math.round(Math.abs(end.y - start.y))),
      };
    }

    if (activeTool === "arrow" && selectionMask) {
      // Bounding rect of the selection: the mask is the canvas-sized RGBA
      // overlay Rust returned (selected pixels tinted, alpha > 0). One-shot
      // scan of overlay bytes on copy — not per-frame, not image pixels.
      const w = stamp.state.width;
      const h = stamp.state.height;
      if (w > 0 && h > 0 && selectionMask.length >= w * h * 4) {
        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          for (let x = 0; x < w; x++) {
            if (selectionMask[row + x * 4 + 3] > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          };
        }
      }
    }

    return null;
  }, [activeTool, cropSelection, editState, selectionMask, stamp]);

  const handleCopyRegion = useCallback(async () => {
    const tool = stamp.toolRef.current;
    const region = tool ? resolveRegion() : null;
    if (!tool || !region) {
      // No active bbox/selection → same behavior as Ctrl+Shift+C.
      await copyFullCanvas();
      return;
    }
    try {
      // `copy_region` reads the active layer and zero-fills outside image
      // bounds, so the rect needs no clamping. PNG encoding stays in the
      // engine too (encodeRgba → encode_png_pixels).
      const pixels = tool.copy_region(
        region.x,
        region.y,
        region.width,
        region.height,
      );
      const blob = await encodeRgba(
        pixels,
        region.width,
        region.height,
        "png",
        1,
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Selection copied to clipboard");
    } catch (err) {
      console.error("Copy selection failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't copy selection: ${msg}`);
    }
  }, [stamp, resolveRegion, copyFullCanvas]);

  return { hasActiveRegion, handleCopyRegion };
}
