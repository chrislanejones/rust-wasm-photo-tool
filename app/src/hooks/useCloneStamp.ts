// The engine facade — and, residually, the actual clone stamp.
//
// This hook dates to when the app WAS a clone stamp tool; everything since
// accreted here because this was the hook holding the engine ref. The
// clonestamp-split refactor moves each domain out to where its name says it
// lives (useEngineCore, then history/layers/export/transforms), while THIS
// file keeps returning the same 62-key surface it always has — so none of the
// importers change during the split. What genuinely belongs to the clone
// stamp (mouse handlers, source arming/disarming) stays here at the bottom.
import { useCallback, useRef } from "react";
import { useToolStore } from "@/stores/useToolStore";
import type { RefObject, MouseEvent } from "react";
import { createStrokeCoalescer } from "@/lib/strokeCoalescer";
import type { StrokeCoalescer } from "@/lib/strokeCoalescer";
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
  // Read from the store rather than threaded down as an argument: this hook
  // takes only a canvas ref, and every other consumer of the stabilizer
  // (paint, eraser, blur) reads the SAME `paintStabilizer` field. One dial.
  const stabilizer = useToolStore((st) => st.toolSettings.paintStabilizer);
  const stabilizerRef = useRef(stabilizer);
  stabilizerRef.current = stabilizer;
  /** Last RAW cursor of the stroke — `end_stroke` needs it so the leash can
   *  catch up to where the pointer actually was, not to its trailing tip. */
  const lastRawRef = useRef<{ x: number; y: number } | null>(null);
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
    setLayerColorOverlay,
    removeLayerColorOverlay,
    applyLayerColorOverlay,
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
    async (e: MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t) return;
      // Read off the event BEFORE any await — after one, `e` is only safe for
      // the values already destructured out of it. `altKey` is checked here for
      // the same reason.
      const { x, y } = getCanvasCoords(e);
      const alt = e.altKey;
      if (alt) {
        t.set_source(x, y);
        sourcePosRef.current = { x, y };
        sourceDisarmedRef.current = false; // fresh source re-arms the stamp
        syncState();
        return;
      }
      // ADR-024 Stage 3.5 — A TRUTHY TRAP, and the reason this one keyword
      // matters more than the others in its batch. `has_source()` returning a
      // Promise makes `!t.has_source()` permanently FALSE, so the guard stops
      // firing entirely and `begin_stroke` runs with no source set. Nothing
      // throws; the stamp just paints from wherever the engine last was.
      //
      // A NOTE FOR WHOEVER TURNS THE WORKER ON. `isDrawingRef` is now set after
      // an await, and `onMouseMove` returns early until it is true. Today that
      // await is a microtask and resolves before the next mouse event, so no
      // movement is lost. Behind the worker it is a real round trip, and the
      // first few pointermoves of a stroke can arrive while it is still in
      // flight — they would be dropped, which reads as a stroke that starts
      // late rather than as an error. The guard must stay ahead of the flag
      // (drawing without a source is worse), so if that shows up, the fix is to
      // buffer the early moves, not to reorder these two lines.
      if (!(await t.has_source()) || sourceDisarmedRef.current) return;
      isDrawingRef.current = true;
      lastRawRef.current = { x, y };
      t.begin_stroke(x, y, stabilizerRef.current);
      flushToCanvas();
    },
    [toolRef, sourcePosRef, sourceDisarmedRef, isDrawingRef, getCanvasCoords, flushToCanvas, syncState],
  );

  // v8.41 — BOTH halves of the v8.34 fix, via the shared coalescer.
  //
  // v8.34 gave this stroke ONE FLUSH PER FRAME but left the input alone, and
  // that half-fix is why "all of the brushes are still too slow": every
  // pointermove still posted a `continue_stroke` to the worker with no
  // in-flight gate, so at a real mouse's 120–420 Hz the port carried 120–420
  // stroke messages a second and everything else queued behind the backlog.
  // Measured 2026-08-14 on the production build: a ~3 s stroke banked a queue
  // that outlived the port's 30 s call timeout — the stroke-end flush and
  // syncState posted at mouseup were themselves timing out.
  //
  // The coalescer is usePaintTool's v8.34 discipline (one call in flight,
  // newest-position-wins on unsent moves, one flush per rAF), extracted to
  // `lib/strokeCoalescer.ts` so the next brush routes through the same code
  // instead of growing a third copy. Coalescing is safe here for the same
  // reason it was safe for paint: `continue_stroke` strokes the SEGMENT from
  // the last landed point, so skipped coordinates cost curve detail between
  // samples, never continuity.
  //
  // `flushRef` because the coalescer instance lives for the component while
  // `flushToCanvas`'s identity may not; the lazy-ref init (not useMemo) is
  // the guaranteed construct-once pattern.
  const flushRef = useRef(flushToCanvas);
  flushRef.current = flushToCanvas;
  const strokeSchedRef = useRef<StrokeCoalescer | null>(null);
  if (strokeSchedRef.current === null) {
    strokeSchedRef.current = createStrokeCoalescer(() => flushRef.current());
  }
  const strokeSched = strokeSchedRef.current;

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      if (!toolRef.current) return;
      strokeSched.submit(getCanvasCoords(e), async (x, y) => {
        const t = toolRef.current;
        if (!t) return false;
        // Awaited: the resolved reply IS the backpressure — the next move is
        // not sent until the engine has serviced this one. The BOOL is the
        // stabilizer's: false means the cursor never cleared the leash, so
        // nothing was stamped and the coalescer skips the flush entirely.
        lastRawRef.current = { x, y };
        return await t.continue_stroke(x, y);
      });
    },
    [toolRef, isDrawingRef, getCanvasCoords, strokeSched],
  );

  const onMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    // Discard the unsent pending move (its segment would land after
    // `end_stroke` committed) and reset the rAF gate (a tab hidden mid-stroke
    // never fires rAF and would latch it). FIFO does the rest: `end_stroke`
    // posts AFTER any move already in flight, so the last landed segment is
    // inside the committed stroke — then flush directly so the committed
    // stroke is published even if the scheduled frame never came.
    strokeSched.strokeEnd();
    // The RAW cursor, not the stabilized tip: end_stroke flushes the leash
    // against it, and handing it the tip would make that a no-op and drop the
    // last leash-length of the stroke.
    const raw = lastRawRef.current;
    toolRef.current?.end_stroke(raw?.x ?? 0, raw?.y ?? 0);
    lastRawRef.current = null;
    flushToCanvas();
    syncState();
  }, [toolRef, isDrawingRef, strokeSched, flushToCanvas, syncState]);

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
      // Same order as onMouseUp: drop the unsent move before end_stroke, so
      // no stale coordinate leaks past the teardown into the next stroke. The
      // stabilizer flushes to the last raw cursor here too — an abort mid-drag
      // still commits the stroke, so it must not end a leash short — and the
      // tip is cleared either way, so no tip survives a tool switch.
      strokeSched.strokeEnd();
      const raw = lastRawRef.current;
      toolRef.current?.end_stroke(raw?.x ?? 0, raw?.y ?? 0);
      lastRawRef.current = null;
    }
    if (!sourceDisarmedRef.current || sourcePosRef.current) {
      sourceDisarmedRef.current = true;
      sourcePosRef.current = null;
      syncState(); // no-op until an image/engine exists
    }
  }, [toolRef, isDrawingRef, strokeSched, sourceDisarmedRef, sourcePosRef, syncState]);

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
    setLayerColorOverlay,
    removeLayerColorOverlay,
    applyLayerColorOverlay,
  };
}
