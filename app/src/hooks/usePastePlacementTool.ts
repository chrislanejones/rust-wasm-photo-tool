import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolType } from "@/lib/types";

export interface PastePlacementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Plain composite blit (no state sync) — cheap, runs every drag frame. */
  flushToCanvas: () => void;
  /** Full re-sync (layer list + history labels) — runs once, on commit. */
  syncState: () => void;
  /** Committing on tool-switch needs to know when the active tool changes. */
  activeTool: ToolType;
}

/**
 * Paste-onto-layer placement: gives a pasted image a movable/resizable
 * bounding box instead of baking it straight into the active layer. The
 * placement is previewed non-destructively in Rust via `begin_paste_preview`/
 * `set_paste_preview_rect` (rendered into the composite without touching the
 * active layer's stored pixels); `commit` bakes it as a single "Paste" history
 * step, `cancel` discards it with no history — same transient-preview split
 * the Move tool uses for `set_move_preview`/`translate_active_layer`.
 *
 * Lifecycle mirrors `useDrawingTools`' pending-edit pattern: Enter commits,
 * Escape cancels, a pointerdown outside the overlay commits, and switching
 * tools commits whatever's pending.
 */
export function usePastePlacementTool({
  toolRef,
  canvasRef,
  flushToCanvas,
  syncState,
  activeTool,
}: Opts) {
  const [rect, setRect] = useState<PastePlacementRect | null>(null);
  // Cleanup for an aborted placement — "Stack as layer" pre-creates the
  // destination layer, and Escape must remove it again, not leave an empty
  // "Pasted Image" layer behind. Cleared on commit.
  const onCancelRef = useRef<(() => void) | null>(null);

  const begin = useCallback(
    (
      pixels: Uint8ClampedArray,
      srcW: number,
      srcH: number,
      destX: number,
      destY: number,
      onCancel?: () => void,
    ) => {
      const t = toolRef.current;
      const canvas = canvasRef.current;
      if (!t || !canvas) return;
      onCancelRef.current = onCancel ?? null;
      // If the pasted image is larger than the canvas, scale the initial box
      // down to fit so the whole image is visible immediately rather than
      // silently clipping off-canvas.
      const fit = Math.min(1, canvas.width / srcW, canvas.height / srcH);
      const width = Math.round(srcW * fit);
      const height = Math.round(srcH * fit);
      const x = Math.round(destX - (width - srcW) / 2);
      const y = Math.round(destY - (height - srcH) / 2);
      t.begin_paste_preview(
        new Uint8Array(pixels.buffer),
        srcW,
        srcH,
        x,
        y,
        width,
        height,
      );
      setRect({ x, y, width, height });
      flushToCanvas();
    },
    [toolRef, canvasRef, flushToCanvas],
  );

  const update = useCallback(
    (next: PastePlacementRect) => {
      const t = toolRef.current;
      if (!t) return;
      const rounded = {
        x: Math.round(next.x),
        y: Math.round(next.y),
        width: Math.round(next.width),
        height: Math.round(next.height),
      };
      t.set_paste_preview_rect(
        rounded.x,
        rounded.y,
        rounded.width,
        rounded.height,
      );
      setRect(rounded);
      flushToCanvas();
    },
    [toolRef, flushToCanvas],
  );

  /**
   * "Resize Layer" — same movable/resizable bounding box, but seeded from the
   * active layer's OWN current pixels (via `begin_layer_resize_preview`)
   * instead of externally pasted bytes. No pixel marshalling needed: Rust
   * snapshots the layer internally and hides it from the live composite
   * (`recomposite`) until commit/cancel — everything else (drag, Enter/
   * Escape, click-away-commits, tool-switch-commits) is identical to a
   * regular paste placement.
   */
  const beginLayerResize = useCallback(() => {
    const t = toolRef.current;
    const canvas = canvasRef.current;
    if (!t || !canvas) return;
    onCancelRef.current = null; // layer-resize cancel leaves the layer as-is
    t.begin_layer_resize_preview();
    if (!t.has_paste_preview()) return; // no active layer — Rust no-op'd
    setRect({ x: 0, y: 0, width: canvas.width, height: canvas.height });
    flushToCanvas();
  }, [toolRef, canvasRef, flushToCanvas]);

  const commit = useCallback(
    (filter = 1 /* bilinear, matches resize()'s own default */) => {
      const t = toolRef.current;
      if (!t || !t.has_paste_preview()) return;
      onCancelRef.current = null;
      t.commit_paste_preview(filter);
      setRect(null);
      flushToCanvas();
      syncState();
    },
    [toolRef, flushToCanvas, syncState],
  );

  const cancel = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.cancel_paste_preview();
    setRect(null);
    flushToCanvas();
    const cleanup = onCancelRef.current;
    onCancelRef.current = null;
    cleanup?.();
  }, [toolRef, flushToCanvas]);

  // Enter commits, Escape cancels — same shape as useDrawingTools' pending-edit
  // commit triggers.
  useEffect(() => {
    if (!rect) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rect, commit, cancel]);

  // Pointerdown outside the overlay commits (matches useDrawingTools' pending
  // shape/text pattern) — exempts the canvas itself (its own mousedown starts
  // a drag on the box, not a commit) and the overlay's own handles/body.
  useEffect(() => {
    if (!rect) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target === canvasRef.current) return;
      if (target.closest("[data-paste-overlay]")) return;
      commit();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [rect, commit, canvasRef]);

  // Switching tools commits whatever placement is pending.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      prevToolRef.current = activeTool;
      commit(); // no-op when nothing is pending
    }
  }, [activeTool, commit]);

  return { rect, begin, beginLayerResize, update, commit, cancel };
}
