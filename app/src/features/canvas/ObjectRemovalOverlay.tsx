import { useCallback, useEffect, useRef } from "react";
import { useToolStore } from "@/stores/useToolStore";
import {
  paintMaskStrokes,
  type MaskPoint,
} from "@/lib/objectRemovalMask";

/** Exactly `OverlayFrame` — the one geometry shape CanvasArea hands its
 *  overlays. Declared structurally rather than imported so the doc comments
 *  below can say what each field means for THIS surface. */
interface Props {
  /** The image's NATIVE pixel size — the overlay's backing store, so every
   *  stroke is recorded in image space and needs no rescaling at upload. */
  width: number;
  height: number;
  /** The main canvas's LAYOUT size in CSS px (its fit-scaled box, measured by
   *  CanvasArea's ResizeObserver). `.main-canvas` is max-width/max-height
   *  fit-scaled, so on any photo bigger than the viewport this is SMALLER than
   *  the natural size — the identical note SelectionOverlay carries, and the
   *  identical bug (paint drawn 2-3x too large, mask silently offset) if the
   *  natural size is used instead. Optional only for the first pre-measure
   *  frame. */
  cssWidth?: number;
  cssHeight?: number;
  /** The image canvas's live pan offset (px) and zoom — the SAME CSS transform
   *  the main canvas uses, so the paint tracks it exactly. */
  panOffset: { x: number; y: number };
  zoom: number;
}

/**
 * The AI Object Removal mask brush, painted ON the image instead of inside a
 * popup.
 *
 * This replaced `ObjectRemovalModal`, which mounted a portal, re-drew the
 * frame onto a private canvas and asked the user to paint there. Everything
 * about the mask is the same — image-space strokes, the same rasterizer, the
 * same black/white PNG at native resolution — only the surface changed.
 *
 * Geometry is copied deliberately, attribute for attribute, from
 * `SelectionOverlay`: an image-resolution canvas, CSS-sized to the main
 * canvas's fit-scaled layout box, riding the same `translate(pan) scale(zoom)`
 * transform. That is what keeps the paint in register at any zoom, and
 * re-deriving it instead of copying it is how overlays in this file's history
 * ended up drifting from the pixels.
 *
 * Unlike its siblings this one TAKES the pointer (`pointerEvents: auto`), so
 * it renders NOTHING unless `objectRemovalMasking` is on — the canvas's own
 * tools keep every event at every other moment. The gate lives here rather
 * than at the call site because CanvasArea is line-capped by the max-lines
 * ratchet and the composition root (AppShell, which owns `renderOverlay`) is
 * being dismantled and takes nothing new.
 *
 * ACCESSIBILITY. The surface itself carries no role and no `tabIndex`: it is a
 * freehand paint target, exactly like the main canvas and `PenOverlay`, and it
 * must not be able to take focus or the mode would trap a keyboard user on an
 * element they cannot operate. Every action of the mode is reachable from the
 * real, focusable buttons in the AI panel (brush size, Undo, Clear, Cancel,
 * Remove Object), and Escape leaves the mode from anywhere.
 */
export function ObjectRemovalOverlay({
  width,
  height,
  cssWidth,
  cssHeight,
  panOffset,
  zoom,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const strokes = useToolStore((s) => s.objectRemovalStrokes);
  const beginStroke = useToolStore((s) => s.beginObjectRemovalStroke);
  const extendStroke = useToolStore((s) => s.extendObjectRemovalStroke);
  const clearStrokes = useToolStore((s) => s.clearObjectRemovalStrokes);
  const setMasking = useToolStore((s) => s.setObjectRemovalMasking);
  const maskBusy = useToolStore((s) => s.objectRemovalBusy);
  const masking = useToolStore((s) => s.objectRemovalMasking);
  /** Nothing to mount: no mode, or no image yet. Every hook below still runs —
   *  they are all inert without strokes, and the two effects that are not
   *  check `masking` themselves. */
  const inactive = !masking || width <= 0 || height <= 0;

  const painting = useRef(false);
  // Raw pointermove can fire 100+ times/sec; each one is a store write and a
  // full repaint of an image-resolution canvas. Coalesce to one flush per
  // animation frame — the same cap `useMagicEraserTool` puts on its overlay
  // refresh, and for the same measured reason. No point is dropped: the whole
  // frame's worth is appended in one flush, so the stroke keeps its shape.
  const queued = useRef<MaskPoint[]>([]);
  const rafPending = useRef(false);

  /** Client point -> IMAGE-space point. Reads the overlay's own rect, which is
   *  post-transform, so zoom and pan divide out here and nowhere else. */
  const toImage = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }, []);

  const flush = useCallback(() => {
    rafPending.current = false;
    const pts = queued.current;
    queued.current = [];
    // React 19 batches these into a single render, so a frame with several
    // points still repaints the overlay once.
    for (const p of pts) extendStroke(p);
  }, [extendStroke]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || maskBusy) return;
      painting.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      beginStroke(toImage(e));
    },
    [beginStroke, maskBusy, toImage],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!painting.current) return;
      queued.current.push(toImage(e));
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(flush);
    },
    [flush, toImage],
  );

  const onPointerUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    // Drain whatever the last frame had not flushed yet, or the tail of a fast
    // stroke would be missing from the mask.
    flush();
  }, [flush]);

  // Escape leaves the mode — the keyboard exit, matching PenOverlay and the
  // perspective tool. Bound only while this overlay is mounted, which is only
  // while masking, so it cannot swallow Escape from anything else.
  useEffect(() => {
    if (inactive) return;
    const onKey = (e: KeyboardEvent) => {
      // ALWAYS exits, including mid-job. A dispatched job keeps running and
      // its result still lands — Escape dismisses the overlay, it does not
      // cancel the removal. Gating this on `!maskBusy` is what made an
      // offline/stalled job trap the canvas behind a surface a keyboard user
      // could not dismiss; found in the browser pass, and the reason this
      // comment is longer than the line.
      if (e.key === "Escape") setMasking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inactive, maskBusy, setMasking]);

  // A document resize (undo of a crop, a Canvas Size change) would leave the
  // existing strokes pointing at coordinates that no longer describe the same
  // object, so they go. Skips the first run: the strokes are already empty
  // when the mode opens.
  const paintedAt = useRef<string | null>(null);
  useEffect(() => {
    if (inactive) return;
    const key = `${width}x${height}`;
    if (paintedAt.current !== null && paintedAt.current !== key) clearStrokes();
    paintedAt.current = key;
  }, [inactive, width, height, clearStrokes]);

  // Blit. Full repaint rather than an incremental segment: undo and clear both
  // remove paint, and a surface that can only add would have to be rebuilt on
  // those paths anyway.
  useEffect(() => {
    const c = ref.current;
    if (!c || inactive) return;
    if (c.width !== width) c.width = width;
    if (c.height !== height) c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    paintMaskStrokes(ctx, strokes);
  }, [inactive, strokes, width, height]);

  if (inactive) return null;

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        // The fit-scaled layout box, NOT the natural size — the backing store
        // stays image-resolution (width/height attrs above) and CSS scales it,
        // exactly like the main canvas itself.
        width: cssWidth ?? width,
        height: cssHeight ?? height,
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        // Above the selection marker (24) — while masking, this surface is the
        // one the pointer belongs to.
        zIndex: 25,
        // While the model is running the mask is already uploaded, so the
        // surface shows the paint but refuses more of it.
        pointerEvents: maskBusy ? "none" : "auto",
        cursor: maskBusy ? "progress" : "crosshair",
        // Without this a touch drag scrolls the page instead of painting.
        touchAction: "none",
        // The paint is a hint about where the model will work, not pixels —
        // half-opacity is what the popup showed (`opacity-50`), kept so the
        // object stays visible underneath while it is covered.
        opacity: 0.5,
        imageRendering: "pixelated",
      }}
    />
  );
}
