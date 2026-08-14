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
  const beginLayerResize = useCallback(async () => {
    const t = toolRef.current;
    const canvas = canvasRef.current;
    if (!t || !canvas) return;
    onCancelRef.current = null; // layer-resize cancel leaves the layer as-is
    // v8.37 — the ENGINE decides the seed rect and this overlay draws THAT.
    //
    // The engine seeds the preview at the active layer's CONTENT BOUNDS (the
    // tightest non-transparent rect) and returns it; empty means no active
    // layer or a fully transparent one. This replaced a "cosmetic" 8%-inset
    // rect that was set here without ever telling the engine — measured on a
    // 420×320 doc: overlay box at (26,26,368,268), engine rect at
    // (0,0,420,320), photo content at (10,10,400,300), and a 2 px handle
    // nudge snapped the whole layer 26 px inward per edge, because the first
    // drag's set_paste_preview_rect was the first time the engine heard the
    // overlay's rect ("resize is wonky, the bounding box not in correct
    // place" — Chris, 2026-08-13). One rect, one owner. The old inset's
    // discoverability goal (handles off the image border) now only applies
    // to full-bleed layers, where the border IS the truth.
    const seeded = await t.begin_layer_resize_preview();
    if (!seeded || seeded.length !== 4) return;
    setRect({
      x: seeded[0],
      y: seeded[1],
      width: Math.max(1, seeded[2]),
      height: Math.max(1, seeded[3]),
    });
    flushToCanvas();
  }, [toolRef, canvasRef, flushToCanvas]);

  const commit = useCallback(
    async (filter = 1 /* bilinear, matches resize()'s own default */) => {
      const t = toolRef.current;
      // ADR-024 Stage 3.5 — TRUTHY TRAP, and the worse of this file's two.
      // `commit()` is called on EVERY tool switch (see the effect below) on the
      // understanding that it no-ops when nothing is pending. Un-awaited, this
      // guard stops firing and `commit_paste_preview` reaches the engine on
      // every tool switch instead — a spurious "Paste" history step for a
      // preview that does not exist.
      if (!t || !(await t.has_paste_preview())) return;
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
        // `void` on all three commit() calls below: a DOM listener and an
        // effect cannot await, and since Stage 3.5 this returns a Promise.
        // Marked rather than ignored so the next reader sees it is deliberate.
        void commit();
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
      void commit();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [rect, commit, canvasRef]);

  // Switching tools commits whatever placement is pending.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      prevToolRef.current = activeTool;
      void commit(); // no-op when nothing is pending
    }
  }, [activeTool, commit]);

  return { rect, begin, beginLayerResize, update, commit, cancel };
}
