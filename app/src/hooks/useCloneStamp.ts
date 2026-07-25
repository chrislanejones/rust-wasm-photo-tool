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

  // ── Cross-photo copy / paste ──────────────────────────────────────────────
  /**
   * Extracts a rectangular region as a plain Uint8ClampedArray (RGBA).
   * Pass the result to `pasteRegion` on a different tool instance to
   * composite content between photos.
   */
  const copyRegion = useCallback(
    (x: number, y: number, w: number, h: number): Uint8ClampedArray | null => {
      const t = toolRef.current;
      if (!t) return null;
      return new Uint8ClampedArray(t.copy_region(x, y, w, h));
    },
    [toolRef],
  );

  /**
   * Alpha-composites `pixels` (srcW × srcH RGBA) onto the current image at
   * (destX, destY).  Automatically pushes an undo snapshot.
   */
  const pasteRegion = useCallback(
    (
      pixels: Uint8ClampedArray,
      srcW: number,
      srcH: number,
      destX: number,
      destY: number,
    ) => {
      const t = toolRef.current;
      if (!t) return;
      t.paste_region(new Uint8Array(pixels.buffer), srcW, srcH, destX, destY);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  // ── Geometric transforms ──────────────────────────────────────────────────
  const flipHorizontal = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.flip_horizontal();
    // Mirror the tracked source position in React state too
    if (sourcePosRef.current) {
      sourcePosRef.current = {
        x: t.width() - 1 - sourcePosRef.current.x,
        y: sourcePosRef.current.y,
      };
    }
    flushToCanvas();
    syncState();
  }, [toolRef, sourcePosRef, flushToCanvas, syncState]);

  const flipVertical = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.flip_vertical();
    if (sourcePosRef.current) {
      sourcePosRef.current = {
        x: sourcePosRef.current.x,
        y: t.height() - 1 - sourcePosRef.current.y,
      };
    }
    flushToCanvas();
    syncState();
  }, [toolRef, sourcePosRef, flushToCanvas, syncState]);

  const rotate90Cw = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.rotate_90_cw();
    sourcePosRef.current = null;
    flushToCanvas();
    syncState();
  }, [toolRef, sourcePosRef, flushToCanvas, syncState]);

  const rotate90Ccw = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.rotate_90_ccw();
    sourcePosRef.current = null;
    flushToCanvas();
    syncState();
  }, [toolRef, sourcePosRef, flushToCanvas, syncState]);

  const crop = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const t = toolRef.current;
      if (!t || w < 1 || h < 1) return;
      t.crop(x, y, w, h);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [toolRef, sourcePosRef, flushToCanvas, syncState],
  );

  const resize = useCallback(
    (newW: number, newH: number) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize(newW, newH);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [toolRef, sourcePosRef, flushToCanvas, syncState],
  );

  /** Resize with a selectable resampling filter (0=nearest, 1=bilinear, 2=catmull-rom, 3=lanczos3). */
  const resizeWithFilter = useCallback(
    (newW: number, newH: number, filter: number) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize_with_filter(newW, newH, filter);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [toolRef, sourcePosRef, flushToCanvas, syncState],
  );

  /**
   * Photoshop-style **Canvas Size**: resize the document WITHOUT resampling any
   * layer. Re-blits each layer's native pixels at the anchor (4 = centre) and
   * refills the backing layer with the given color (a = 0 ⇒ transparent ⇒
   * checkerboard). Undoable; mirrors `resize`/`resizeWithFilter` bookkeeping.
   */
  const resizeCanvas = useCallback(
    (
      newW: number,
      newH: number,
      anchor: number,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize_canvas(newW, newH, anchor, r, g, b, a);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [toolRef, sourcePosRef, flushToCanvas, syncState],
  );

  /**
   * Normalize the CURRENT document to an artboard: the photo at native size,
   * centred, with a `pad`-px border filled with (r,g,b,a) (a = 0 ⇒ transparent
   * ⇒ checkerboard). ABSOLUTE + IDEMPOTENT — the doc becomes exactly
   * photo + 2×pad no matter its current size, so it both shrinks a "jumbo"
   * canvas back to size and re-applies cleanly without accumulating. Backs the
   * live "Canvas border" / "Backing color" re-apply.
   */
  const setArtboardBorder = useCallback(
    (pad: number, r: number, g: number, b: number, a: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.set_artboard_border(pad, r, g, b, a);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [toolRef, sourcePosRef, flushToCanvas, syncState],
  );

  // ── Pixel adjustments ─────────────────────────────────────────────────────
  /**
   * Adjusts brightness by `delta` (−1.0 to +1.0).
   * Each call is individually undo-able.
   */
  const adjustBrightness = useCallback(
    (delta: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_brightness(delta);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  /**
   * Adjusts contrast by `factor` (0 = grey, 1 = original, 2 = doubled).
   * Each call is individually undo-able.
   */
  const adjustContrast = useCallback(
    (factor: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_contrast(factor);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  /**
   * Blurs the whole image. `intensity` is the Effects panel's Blur slider as
   * a 0..1 fraction. Rust's `blur_region` takes an *integer* Gaussian kernel
   * radius (u32, clamped 1..30) — passing the raw fraction got truncated to 0
   * by the wasm-bindgen ABI and clamped up to a radius-1 kernel, i.e. a
   * visually imperceptible blur. Map the fraction onto the 1..30 radius range
   * before crossing into WASM. One "Blur" history snapshot per call.
   */
  const applyGlobalBlur = useCallback(
    (intensity: number) => {
      const t = toolRef.current;
      if (!t) return;
      const kernelRadius = Math.max(1, Math.round(intensity * 30));
      const cx = t.width() / 2;
      const cy = t.height() / 2;
      const r = Math.max(t.width(), t.height());
      t.begin_blur_stroke();
      t.blur_region(cx, cy, r, kernelRadius);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  /**
   * Adjusts saturation by `factor` (0 = grayscale, 1 = unchanged, >1 = more
   * saturated) — grayscale-lerp against the pixel's own luminance, same
   * technique as CSS `filter: saturate()`. Each call is individually undo-able.
   */
  const adjustSaturation = useCallback(
    (factor: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_saturation(factor);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  /**
   * Lifts (brightens) shadows by `amount`, masked to peak in dark tones and
   * taper to ~0 in bright tones. Each call is individually undo-able.
   */
  const adjustShadows = useCallback(
    (amount: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_shadows(amount);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  /**
   * Recovers (darkens) blown highlights by `amount`, masked to peak in bright
   * tones and taper to ~0 in dark tones. Each call is individually undo-able.
   */
  const adjustHighlights = useCallback(
    (amount: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_highlights(amount);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  /**
   * Unsharp-mask sharpen over the whole image. `amount` 0 = no sharpening.
   * Each call is individually undo-able.
   */
  const adjustSharpen = useCallback(
    (amount: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_sharpen(amount);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

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
