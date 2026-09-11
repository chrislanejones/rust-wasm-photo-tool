import { useCallback, useEffect, useMemo, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { useDrawingTools, ShapeMeta } from "@/hooks/useDrawingTools";
import type { useTextTool } from "@/hooks/useTextTool";
import { padOffset, PAD_KINDS, type PadDirection } from "@/lib/duplicatePadGeometry";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { useToolStore } from "@/stores/useToolStore";


/** Down-right nudge for the plain row Duplicate, in image px — big enough to
 *  see the copy is its own object, small enough to read as related. */
const ROW_DUPLICATE_OFFSET = 12;


type Counts = Record<PadDirection, number>;
const zeroCounts = (): Counts => ({ up: 0, down: 0, left: 0, right: 0 });

/**
 * Reselect's two duplicate paths: the row's Duplicate button (one copy,
 * nudged down-right) and the directional pad (⊕ on each side of a rect or
 * circle; each press lays one more same-sized copy further out that way).
 *
 * THE PAD STAYS ON THE ORIGINAL. Pressing ← twice gives two rectangles
 * marching left from the source, and ↑ once then gives one above the SOURCE,
 * not above the second copy. Per-direction counters make each direction
 * independent, which is the Excalidraw-style grid a diagram wants; an anchor
 * that followed the newest copy would staircase instead.
 *
 * Both paths go through the engine's clone (`duplicate_*_annotation`), so no
 * property can be dropped in transit — tests/duplicate_annotation.rs. Both
 * AWAIT it: under the ADR-024 worker proxy the -1 sentinel arrives as a
 * Promise, and `Promise < 0` is false, so an un-awaited guard would flush and
 * sync for an object the engine never made. `engineAsyncMigration.contract`
 * counts these sites.
 *
 * After a shape changes, `drawingTools.refreshShapes()` re-reads the engine's
 * list — that is what feeds the Reselect rows AND the pad's own target
 * lookup, so skipping it leaves both a row behind.
 */
export function useDuplicatePad(
  stamp: ReturnType<typeof useCloneStamp>,
  drawingTools: ReturnType<typeof useDrawingTools>,
  textTool: ReturnType<typeof useTextTool>,
  bumpAnnotations: () => void,
) {
  const padId = useToolStore((s) => s.duplicatePadId);
  const setPadId = useToolStore((s) => s.setDuplicatePadId);
  const counts = useRef<Counts>(zeroCounts());

  // The open pad's shape, re-derived from the live list so a delete, an undo
  // or a kind change is seen the moment the list refreshes.
  const target: ShapeMeta | null = useMemo(() => {
    if (padId === null) return null;
    const s = drawingTools.shapes.find((x) => x.id === padId);
    return s && PAD_KINDS.has(s.kind) ? s : null;
  }, [padId, drawingTools.shapes]);

  // A pad whose shape is gone closes itself rather than pointing at nothing.
  useEffect(() => {
    if (padId !== null && !target) setPadId(null);
  }, [padId, target, setPadId]);

  // Fresh counters for every new target: "twice left" is relative to THIS
  // shape, not to whatever was open before.
  useEffect(() => {
    counts.current = zeroCounts();
  }, [padId]);

  const afterEngineChange = useCallback(
    async (kind: "text" | "shape") => {
      stamp.flushToCanvas();
      stamp.syncState();
      if (kind === "text") void textTool.refreshAnnotations();
      else await drawingTools.refreshShapes();
      bumpAnnotations();
    },
    [stamp, textTool, drawingTools, bumpAnnotations],
  );

  /** The row's Duplicate button: one copy, nudged down-right. Does NOT move
   *  the Align target — you duplicated an object, you did not select the copy. */
  const duplicateObject = useCallback(
    async (o: ReselectObject) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      const newId =
        o.type === "text"
          ? await tool.duplicate_text_annotation(o.id, ROW_DUPLICATE_OFFSET, ROW_DUPLICATE_OFFSET)
          : await tool.duplicate_shape_annotation(o.id, ROW_DUPLICATE_OFFSET, ROW_DUPLICATE_OFFSET);
      if (newId < 0) return; // -1: nothing carried that id
      await afterEngineChange(o.type);
    },
    [stamp, afterEngineChange],
  );

  const togglePad = useCallback(
    (o: ReselectObject) => {
      if (o.type !== "shape") return;
      setPadId((prev) => (prev === o.id ? null : o.id));
    },
    [setPadId],
  );

  const closePad = useCallback(() => setPadId(null), [setPadId]);

  /** One press on a ⊕: the (n+1)th copy in that direction, where n is how
   *  many that side has already produced for this target. */
  const duplicateInDirection = useCallback(
    async (dir: PadDirection) => {
      const tool = stamp.toolRef.current;
      if (!tool || !target) return;
      const n = counts.current[dir] + 1;
      const { dx, dy } = padOffset(target, dir, n);
      const newId = await tool.duplicate_shape_annotation(target.id, dx, dy);
      if (newId < 0) return;
      counts.current[dir] = n;
      await afterEngineChange("shape");
    },
    [stamp, target, afterEngineChange],
  );

  /** What CanvasArea needs to draw the pad, or null when it is closed. */
  const canvasProps = useMemo(
    () =>
      target
        ? {
            target: { x0: target.x0, y0: target.y0, x1: target.x1, y1: target.y1 },
            onDuplicate: (dir: PadDirection) => void duplicateInDirection(dir),
            onClose: closePad,
          }
        : null,
    [target, duplicateInDirection, closePad],
  );

  return { padId, target, togglePad, closePad, duplicateObject, duplicateInDirection, canvasProps };
}
