import { useCallback } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { ToolSettings } from "@/lib/types";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

/**
 * The Pen tool's five engine handlers — commit, hit-test, and the three halves
 * of re-editing a committed path.
 *
 * Extracted from AppShell (#45). They are one domain sharing one set of
 * dependencies — the engine and the four Paint→Pen style fields — and nothing
 * else in AppShell reads them, which is what makes this a unit rather than a
 * grouping of convenience.
 *
 * Two contracts travel with them, and are why the comments below are long:
 *
 *  • `handlePenCommit` RETURNS THE NEW ID, and that return value IS the
 *    contract — `PenOverlay.finish()` uses it to keep the path selected. An
 *    un-awaited version hands the overlay a Promise and the path you just drew
 *    silently stops being selected (ADR-024 Stage 3.5).
 *  • `handlePenHitTest` uses `capture_pen_hit` — ONE engine call, not a
 *    hit-test followed by a list read. Two reads describing one document state
 *    is the a7 atomic-capture rule: behind the worker, a shape deleted between
 *    them makes the lookup miss and clicking a pen path do nothing at all,
 *    with no throw and nothing in the console.
 */
export function usePenActions(
  stamp: ReturnType<typeof useCloneStamp>,
  toolSettings: ToolSettings,
) {
  const clearPenEditRequest = useAnnotationStore((s) => s.clearPenEditRequest);

  // ADR-024 Stage 3.5, the PenOverlay redesign (`docs/pen-overlay-async-design.md`).
  // This is the site whose RETURN VALUE is the contract, which is why it outlived
  // every other conversion: `PenOverlay.finish()` uses the new id to keep the
  // path selected, so an un-awaited version hands it a Promise and the path you
  // just drew silently stops being selected.
  const handlePenCommit = useCallback(
    async (flatPoints: number[]) => {
      const tool = stamp.toolRef.current;
      if (!tool || flatPoints.length < 8) return; // need ≥ 2 anchors
      // Any path with a background colour fills its interior — Rust's fill_polygon
      // auto-closes the flattened curve, so an open curve OR a full (closed) loop
      // both fill. (Previously this was gated on an explicit `close`, so a curve
      // or circle finished without closing never filled.)
      const fillKind = toolSettings.fillMode !== "none" ? 1 : 0;
      const id = await tool.add_bezier_annotation(
        new Float64Array(flatPoints),
        toolSettings.strokeColor,
        toolSettings.strokeWidth,
        fillKind,
        toolSettings.fillColor,
      );
      // Liveness, a13's guard, checked AFTER the await: `reset()` nulls
      // `toolRef.current` on a photo switch and nothing here calls `tool.free()`,
      // so a commit issued against the OUTGOING document still resolves. FIFO
      // puts the annotation on the photo that was open when the pen drew it —
      // which is what we want — but the id is meaningless to the NEW document,
      // and returning it would have the overlay call `set_editing_shape` on a
      // photo that never had this path. Drop it and leave the new photo alone.
      if (stamp.toolRef.current !== tool) return;
      stamp.flushToCanvas();
      stamp.syncState();
      // Hand the id back so the overlay can keep the path selected. Without it
      // a finished path was immediately deselected, and the Reselect list was
      // the only way back to its colour and Background.
      return id;
    },
    [
      stamp,
      toolSettings.strokeColor,
      toolSettings.strokeWidth,
      toolSettings.fillMode,
      toolSettings.fillColor,
    ],
  );

  // Pen re-edit (Stage 3b): hit-test → load a committed kind-7 path → reshape →
  // commit. The baked copy is hidden via set_editing_shape while editing.
  const handlePenHitTest = useCallback(
    async (ix: number, iy: number): Promise<{ id: number; points: number[] } | null> => {
      const tool = stamp.toolRef.current;
      if (!tool) return null;
      // ADR-024 Stage 3.5, a7 — ATOMIC CAPTURE. This was
      // `shape_annotation_at()` then `get_shape_annotations()`, with the id
      // from the first used to index into the second. Two reads describing one
      // document state: behind the worker a shape deleted between them makes
      // the lookup miss, this return null, and clicking a pen path do nothing
      // at all — no throw, nothing in the console. `capture_pen_hit` does both
      // under one `&self`, so there is no between.
      const hit = await tool.capture_pen_hit(ix, iy);
      try {
        // Liveness (a13), inside the `try` so the capture is still freed. A hit
        // resolved against the outgoing photo names a shape id that does not
        // exist on the new one; loading it would hide a stranger's annotation.
        if (stamp.toolRef.current !== tool) return null;
        // -1 covers both "nothing there" and "the topmost shape there is not a
        // pen path" — the engine keeps the topmost-then-check rule this call
        // site used to apply itself via `kind === 7`.
        if (hit.id < 0) return null;
        return { id: hit.id, points: Array.from(hit.points) };
      } finally {
        hit.free();
      }
    },
    [stamp],
  );
  const handlePenEditStart = useCallback(
    (id: number) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      tool.set_editing_shape(id); // hide the baked path; the overlay shows it
      stamp.flushToCanvas();
      stamp.syncState();
    },
    [stamp],
  );
  const handlePenEditCommit = useCallback(
    (id: number, flatPoints: number[]) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      // Re-committing a reselected path adopts the current Paint→Pen panel
      // style, so changing the Background (or stroke) restyles a path you
      // already drew — including filling one committed with Background: None.
      const fillKind = toolSettings.fillMode !== "none" ? 1 : 0;
      tool.update_bezier_annotation(
        id,
        new Float64Array(flatPoints),
        toolSettings.strokeColor,
        toolSettings.strokeWidth,
        fillKind,
        toolSettings.fillColor,
      );
      tool.set_editing_shape(-1);
      stamp.flushToCanvas();
      stamp.syncState();
    },
    [
      stamp,
      toolSettings.strokeColor,
      toolSettings.strokeWidth,
      toolSettings.fillMode,
      toolSettings.fillColor,
    ],
  );
  const handlePenEditCancel = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    tool.set_editing_shape(-1);
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);
  // One-shot: the overlay has taken the reselected path, so drop the request.
  // The store action is already stable, so it can be passed straight down — an
  // inline arrow here would re-run the overlay's load effect on every render.
  const handlePenEditRequestHandled = clearPenEditRequest;

  return {
    handlePenCommit,
    handlePenHitTest,
    handlePenEditStart,
    handlePenEditCommit,
    handlePenEditCancel,
    handlePenEditRequestHandled,
  };
}
