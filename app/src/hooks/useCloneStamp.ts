// The engine facade — and, residually, the actual clone stamp.
//
// This hook dates to when the app WAS a clone stamp tool; everything since
// accreted here because this was the hook holding the engine ref. The
// clonestamp-split refactor moves each domain out to where its name says it
// lives (useEngineCore, then history/layers/export/transforms), while THIS
// file keeps returning the same 62-key surface it always has — so none of the
// importers change during the split. What genuinely belongs to the clone
// stamp (mouse handlers, source arming/disarming) stays here at the bottom.
import { useCallback } from "react";
import type { RefObject, MouseEvent } from "react";
import { useEngineCore } from "./useEngineCore";
import { useHistory } from "./useHistory";
import { useLayers } from "./useLayers";
import { useExport } from "./useExport";
import { useTransforms } from "./useTransforms";

export type {
  HistoryEntry,
  LayerInfo,
  CloneStampState,
} from "./useEngineCore";

export function useCloneStamp(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const engine = useEngineCore(canvasRef);
  const {
    state,
    toolRef,
    sourcePosRef,
    sourceDisarmedRef,
    isDrawingRef,
    syncState,
    flushToCanvas,
    getCanvasCoords,
    reset,
    loadImage,
    loadImageFromPixels,
    loadFromSaved,
    restoreFromOplog,
    setBrushSize,
    setHardness,
    setOpacity,
    setSpacing,
    setMaxHistory,
  } = engine;

  const {
    undo,
    redo,
    jumpToHistory,
    deleteHistoryEntry,
    clearHistory,
  } = useHistory(engine);

  const {
    addLayer,
    removeLayer,
    duplicateLayer,
    setActiveLayer,
    setLayerVisible,
    setLayerOpacity,
    renameLayer,
    moveLayer,
    mergeDown,
    flattenAll,
    addLayerMask,
    removeLayerMask,
    applyLayerMask,
    invertLayerMask,
  } = useLayers(engine);

  const {
    exportPng,
    exportAs,
    exportBlob,
    generateThumbnail,
    generateThumbnailUrl,
  } = useExport(engine);

  const {
    copyRegion,
    pasteRegion,
    flipHorizontal,
    flipVertical,
    rotate90Cw,
    rotate90Ccw,
    crop,
    resize,
    resizeWithFilter,
    resizeCanvas,
    setArtboardBorder,
    adjustBrightness,
    adjustContrast,
    applyGlobalBlur,
    adjustSaturation,
    adjustShadows,
    adjustHighlights,
    adjustSharpen,
  } = useTransforms(engine);

  // ── Mouse / stroke handlers ───────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = getCanvasCoords(e);
      if (e.altKey) {
        t.set_source(x, y);
        sourcePosRef.current = { x, y };
        sourceDisarmedRef.current = false; // fresh source re-arms the stamp
        syncState();
        return;
      }
      if (!t.has_source() || sourceDisarmedRef.current) return;
      isDrawingRef.current = true;
      t.begin_stroke(x, y);
      flushToCanvas();
    },
    [toolRef, sourcePosRef, sourceDisarmedRef, isDrawingRef, getCanvasCoords, flushToCanvas, syncState],
  );

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = getCanvasCoords(e);
      t.continue_stroke(x, y);
      flushToCanvas();
    },
    [toolRef, isDrawingRef, getCanvasCoords, flushToCanvas],
  );

  const onMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    toolRef.current?.end_stroke();
    syncState();
  }, [toolRef, isDrawingRef, syncState]);

  /**
   * Clone-stamp teardown — called when the Stamp tool is deactivated or its
   * sub-mode changes (useStampTeardown). Aborts any in-flight stroke so no
   * pointer state leaks past the exit, then disarms the source: the engine
   * keeps its (now stale) source point because there's no clear_source API,
   * but the JS gate makes it inert until the user Alt+Clicks a new one, and
   * the "Source set" badge flips back to "Alt+Click to set source".
   */
  const clearCloneSource = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      toolRef.current?.end_stroke();
    }
    if (!sourceDisarmedRef.current || sourcePosRef.current) {
      sourceDisarmedRef.current = true;
      sourcePosRef.current = null;
      syncState(); // no-op until an image/engine exists
    }
  }, [toolRef, isDrawingRef, sourceDisarmedRef, sourcePosRef, syncState]);

  return {
    state,
    toolRef,
    // Core
    syncState,
    loadImage,
    loadImageFromPixels,
    loadFromSaved,
    restoreFromOplog,
    flushToCanvas,
    reset,
    setBrushSize,
    setHardness,
    setOpacity,
    setSpacing,
    setMaxHistory,
    // History
    undo,
    redo,
    jumpToHistory,
    deleteHistoryEntry,
    clearHistory,
    // Export
    exportPng,
    exportAs,
    exportBlob,
    // Mouse
    onMouseDown,
    onMouseMove,
    onMouseUp,
    clearCloneSource,
    // NEW ↓
    generateThumbnail,
    generateThumbnailUrl,
    copyRegion,
    pasteRegion,
    flipHorizontal,
    flipVertical,
    rotate90Cw,
    rotate90Ccw,
    crop,
    resize,
    resizeWithFilter,
    resizeCanvas,
    setArtboardBorder,
    adjustBrightness,
    adjustContrast,
    applyGlobalBlur,
    adjustSaturation,
    adjustShadows,
    adjustHighlights,
    adjustSharpen,
    // Layers
    addLayer,
    removeLayer,
    duplicateLayer,
    setActiveLayer,
    setLayerVisible,
    setLayerOpacity,
    renameLayer,
    moveLayer,
    mergeDown,
    flattenAll,
    addLayerMask,
    removeLayerMask,
    applyLayerMask,
    invertLayerMask,
  };
}
