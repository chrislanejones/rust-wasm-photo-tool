import { useCallback, useEffect, useMemo, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { pendingShapeType, type useDrawingTools } from "@/hooks/useDrawingTools";
import {
  BOX_KINDS,
  PORTS,
  duplicateOffset,
  type PortBox,
  type PortId,
  type PortTarget,
  type Pt,
} from "@/lib/shapePorts";
import { SHAPE_NAME_KIND } from "@/lib/drawEditState";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useToolStore } from "@/stores/useToolStore";

/** Arrow kind byte — a connector is an ordinary arrow annotation. */
const ARROW_KIND = 4;

/**
 * The shape action bar's engine work: Duplicate (copies out of any of the
 * eight ports) and Connect (an arrow from a port of this shape to a port of
 * another). Apply and Cancel are the edit's own `commitEdit` / `cancelEdit`.
 *
 * Replaces useDuplicatePad, whose four-way pad was opened from Review ›
 * Reselect. The counting rule is the pad's: copies are counted PER PORT and
 * measured from the ORIGINAL, so → → gives two copies marching right and a
 * following ↓ goes below the source. The counters reset when the bar moves
 * to a different shape.
 *
 * COMMIT, ACT, REOPEN. Both actions start with `commitEdit`, because the
 * thing on screen may not be in the engine yet (a freshly drawn shape) or may
 * be ahead of it (a dragged one) — duplicating the engine's copy would clone
 * the stale geometry. Then the engine call, then `selectShape` reopens the
 * original so the bar stays where the user is working. `busy` keeps the
 * brief null edit state between the two from closing the ring.
 *
 * Both engine calls are AWAITED: under the ADR-024 worker proxy the -1
 * sentinel arrives as a Promise, and `Promise < 0` is false.
 */
export function useShapeActions(
  stamp: ReturnType<typeof useCloneStamp>,
  drawingTools: ReturnType<typeof useDrawingTools>,
) {
  const mode = useToolStore((s) => s.shapeActionMode);
  const setMode = useToolStore((s) => s.setShapeActionMode);
  const gap = useToolStore((s) => s.duplicateGap);
  const setGap = useToolStore((s) => s.setDuplicateGap);
  const panelShape = useToolStore((s) => s.toolSettings.shape);

  const es = drawingTools.editState;
  const busy = useRef(false);
  const counts = useRef<{ id: number | null; n: Partial<Record<PortId, number>> }>({
    id: null,
    n: {},
  });

  // Duplicate and Connect only make sense for a box: not an arrow, a line,
  // a pin (numbered), or the legacy hand circle.
  const kind =
    es && es.kind !== "arrow"
      ? (es.style?.kindByte ?? SHAPE_NAME_KIND[pendingShapeType(es, panelShape)] ?? 0)
      : null;
  const boxy = kind !== null && BOX_KINDS.has(kind);

  // The ring closes with the edit: Apply, Cancel, Enter, Esc, or a click
  // away. Not while one of our own commit-and-reopen round trips is running.
  useEffect(() => {
    if (!es && !busy.current) setMode("none");
  }, [es, setMode]);

  const afterEngineChange = useCallback(async () => {
    stamp.flushToCanvas();
    stamp.syncState();
    await drawingTools.refreshShapes();
  }, [stamp, drawingTools]);

  /** Commit, run `act` with the committed id, reopen that id. */
  const roundTrip = useCallback(
    async (act: (id: number) => Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      try {
        // The committed id: a reselected shape keeps its own; a new one is
        // the selection `commitEdit` hands it — but only if the selection
        // actually CHANGED, or a refused add would act on the previous object.
        const editId = drawingTools.editState?.editId ?? null;
        const before = useAnnotationStore.getState().selectedObject;
        await drawingTools.commitEdit();
        const after = useAnnotationStore.getState().selectedObject;
        const id =
          editId ?? (after && after !== before && after.type === "shape" ? after.id : null);
        if (id === null) return;
        await act(id);
        await drawingTools.selectShape(id);
      } finally {
        busy.current = false;
      }
    },
    [drawingTools],
  );

  const duplicateToward = useCallback(
    (portId: PortId) => {
      const cur = drawingTools.editState;
      const port = PORTS.find((p) => p.id === portId);
      if (!cur || !port || !boxy) return;
      const box: PortBox = { x0: cur.start.x, y0: cur.start.y, x1: cur.end.x, y1: cur.end.y };
      const rotation = cur.rotation ?? 0;
      void roundTrip(async (id) => {
        const tool = stamp.toolRef.current;
        if (!tool) return;
        if (counts.current.id !== id) counts.current = { id, n: {} };
        const n = (counts.current.n[portId] ?? 0) + 1;
        const d = duplicateOffset(box, rotation, port, n, gap);
        const newId = await tool.duplicate_shape_annotation(id, d.x, d.y);
        if (newId < 0) return; // -1: nothing carried that id
        counts.current.n[portId] = n;
        await afterEngineChange();
      });
    },
    [drawingTools.editState, boxy, roundTrip, stamp, gap, afterEngineChange],
  );

  /** One connector: an arrow from `from` to `to`, IMAGE px, in this shape's
   *  stroke color and width so the diagram reads as one drawing. */
  const connect = useCallback(
    (from: Pt, to: Pt) => {
      const cur = drawingTools.editState;
      if (!cur || !boxy) return;
      const panel = useToolStore.getState().toolSettings;
      const color = cur.style?.strokeColor ?? panel.strokeColor;
      const width = cur.style?.strokeWidth ?? panel.strokeWidth;
      void roundTrip(async () => {
        const tool = stamp.toolRef.current;
        if (!tool) return;
        const newId = await tool.add_shape_annotation(
          ARROW_KIND,
          from.x,
          from.y,
          to.x,
          to.y,
          color,
          width,
          0, // single head, pointing at the shape connected TO
          0, // arrows take no fill
          "#000000",
          "#000000",
          0,
          16,
          0, // a connector is drawn firm, whatever the shape's sloppiness
          0,
          0,
          new Uint16Array(4),
        );
        if (newId < 0) return;
        await afterEngineChange();
      });
    },
    [drawingTools.editState, boxy, roundTrip, stamp, afterEngineChange],
  );

  // Every OTHER box shape is somewhere a pigtail can land.
  const editId = es?.editId ?? null;
  const connectTargets: PortTarget[] = useMemo(
    () =>
      drawingTools.shapes
        .filter((s) => BOX_KINDS.has(s.kind) && s.id !== editId)
        .map((s) => ({
          id: s.id,
          box: { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 },
          rotation: s.rotation ?? 0,
        })),
    [drawingTools.shapes, editId],
  );

  const toggleDuplicate = useCallback(
    () => setMode((m) => (m === "duplicate" ? "none" : "duplicate")),
    [setMode],
  );
  // Connect is refused while Duplicate is on — the bar disables it too.
  const toggleConnect = useCallback(
    () => setMode((m) => (m === "connect" ? "none" : m === "duplicate" ? m : "connect")),
    [setMode],
  );
  const apply = useCallback(() => void drawingTools.commitEdit(), [drawingTools]);

  /** Everything ShapeActionsOverlay takes but the canvas, or null when no
   *  shape is being edited. */
  const overlay = useMemo(
    () =>
      es
        ? {
            editState: es,
            mode,
            gap,
            boxy,
            connectTargets,
            onApply: apply,
            onCancel: drawingTools.cancelEdit,
            onToggleDuplicate: toggleDuplicate,
            onToggleConnect: toggleConnect,
            onGap: setGap,
            onDuplicate: duplicateToward,
            onConnect: connect,
          }
        : null,
    [es, mode, gap, boxy, connectTargets, apply, drawingTools.cancelEdit, toggleDuplicate, toggleConnect, setGap, duplicateToward, connect],
  );

  return { overlay, duplicateToward, connect };
}
