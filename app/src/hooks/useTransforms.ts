// Transforms — everything that rewrites the pixel plane wholesale: geometric
// transforms (flip/rotate/crop/resize/canvas-size/artboard), the global
// adjustments (brightness/contrast/blur/saturation/shadows/highlights/
// sharpen), and cross-photo copy/paste (a pixel-plane op with an undo
// snapshot, which is why it lives here rather than in export).
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// The flips remap the clone-source mirror (sourcePosRef) instead of dropping
// it; every other transform invalidates it — a stale source after a rotate
// would point at the wrong pixels.
import { useCallback, useMemo } from "react";
import type { EngineCore } from "./useEngineCore";

export function useTransforms(engine: EngineCore) {
  const {
    toolRef,
    sourcePosRef,
    syncState,
    flushToCanvas,
    broadcastAnnotationsChanged,
  } = engine;

  /**
   * Geometry transforms move live text/shape overlays in Rust (crop and
   * resize_canvas translate them; resize_with_filter scales them), but
   * `syncState` does NOT bump the annotation revision — it reports canvas
   * dimensions and history, not overlay geometry. Without this the engine
   * holds the corrected coordinates while React keeps drawing the overlay from
   * the list it cached before the transform, so the fix is invisible until an
   * undo or a tool switch happens to refresh it.
   *
   * Applied to every transform that moves annotations, not just resize: crop
   * had exactly the same staleness and would show the same "annotations in the
   * wrong place" symptom by a different route.
   */
  const commitGeometryChange = useCallback(() => {
    flushToCanvas();
    syncState();
    broadcastAnnotationsChanged();
  }, [flushToCanvas, syncState, broadcastAnnotationsChanged]);

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
      commitGeometryChange();
    },
    [toolRef, sourcePosRef, commitGeometryChange],
  );

  const resize = useCallback(
    (newW: number, newH: number) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize(newW, newH);
      sourcePosRef.current = null;
      commitGeometryChange();
    },
    [toolRef, sourcePosRef, commitGeometryChange],
  );

  /** Resize with a selectable resampling filter (0=nearest, 1=bilinear, 2=catmull-rom, 3=lanczos3). */
  const resizeWithFilter = useCallback(
    (newW: number, newH: number, filter: number) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize_with_filter(newW, newH, filter);
      sourcePosRef.current = null;
      commitGeometryChange();
    },
    [toolRef, sourcePosRef, commitGeometryChange],
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
      commitGeometryChange();
    },
    [toolRef, sourcePosRef, commitGeometryChange],
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
      commitGeometryChange();
    },
    [toolRef, sourcePosRef, commitGeometryChange],
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

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
