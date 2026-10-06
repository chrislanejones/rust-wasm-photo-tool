import { useCallback, useEffect, useMemo, useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { pendingShapeType, type useDrawingTools } from "@/hooks/useDrawingTools";
import {
  BOX_KINDS,
  PORTS,
  asTarget,
  attachedEnds,
  connectorsToFollow,
  duplicateOffset,
  type AttachedEnd,
  type PlacedShape,
  type PortBox,
  type PortId,
  type PortTarget,
  type Pt,
} from "@/lib/shapePorts";
import { SHAPE_NAME_KIND, type ShapeMeta } from "@/lib/drawEditState";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useToolStore } from "@/stores/useToolStore";

/** Arrow kind byte — a connector is an ordinary arrow annotation. */
const ARROW_KIND = 4;

/**
 * The shape action bar's engine work: Duplicate (copies out of any of the
 * eight ports), Connect (an arrow from a port of this shape to a port of
 * another) and Disconnect (delete one of the connectors on this shape). Apply
 * and Cancel are the edit's own `commitEdit` / `cancelEdit`.
 *
 * CONNECTORS FOLLOW THEIR SHAPES. Every time the shape list is read back
 * (`drawingTools.shapes` — after a commit, a Placement move, an undo), it is
 * diffed against the last one: a box that moved drags the ends of the arrows
 * that sat on its ports along (lib/shapePorts `connectorsToFollow`), through
 * `reroute_connector`, which takes no history step of its own — the reroute
 * rides the move's, so one undo puts both back. Watching the list instead of
 * hooking `commitEdit` covers every way a shape moves, not just a drag.
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
  const panelStarPoints = useToolStore((s) => s.toolSettings.starPoints);

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
  const starPoints = es?.style?.starPoints ?? panelStarPoints;

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

  // The last shape list `follow` saw, and the run in flight (runs chain, so
  // two reads can never diff against the same baseline twice).
  const seen = useRef<PlacedShape[] | null>(null);
  const following = useRef<Promise<void>>(Promise.resolve());

  /** Re-route the connectors of every box that moved since the last look. */
  const follow = useCallback(() => {
    const run = following.current.then(async () => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      let now: ShapeMeta[];
      try {
        now = JSON.parse(await tool.get_shape_annotations()) as ShapeMeta[];
      } catch {
        return;
      }
      const before = seen.current;
      seen.current = now;
      if (!before) return;
      const moves = connectorsToFollow(before, now);
      if (!moves.length) return;
      for (const m of moves) await tool.reroute_connector(m.id, m.x0, m.y0, m.x1, m.y1);
      seen.current = now.map((s) => moves.find((m) => m.id === s.id) ?? s) as ShapeMeta[];
      stamp.flushToCanvas();
      stamp.syncState();
      await drawingTools.refreshShapes();
    });
    following.current = run.catch(() => {});
    return run;
  }, [stamp, drawingTools]);

  useEffect(() => {
    void follow();
  }, [drawingTools.shapes, follow]);

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
        // A moved box's connectors follow it BEFORE the next engine call
        // snaps, or the reroute would ride that step instead of the move's.
        await follow();
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
    [drawingTools, follow],
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
        .map(asTarget),
    [drawingTools.shapes, editId],
  );

  // The connectors on THIS shape, read against its COMMITTED geometry (the
  // engine's list) — that is where their ends are until the edit commits.
  // A brand-new shape has none.
  const connections: AttachedEnd[] = useMemo(() => {
    const self = drawingTools.shapes.find((s) => s.id === editId);
    if (!self || !BOX_KINDS.has(self.kind)) return [];
    return attachedEnds(
      asTarget(self),
      drawingTools.shapes.filter((s) => s.kind === ARROW_KIND),
    );
  }, [drawingTools.shapes, editId]);

  // Disconnect closes itself when the last connector goes.
  useEffect(() => {
    if (mode === "disconnect" && !connections.length) setMode("none");
  }, [mode, connections.length, setMode]);

  /** Delete one connector (the X on its end). One "Delete Shape" step. */
  const disconnect = useCallback(
    (arrowId: number) => {
      void roundTrip(async () => {
        const tool = stamp.toolRef.current;
        if (!tool) return;
        if (!(await tool.remove_shape_annotation(arrowId))) return;
        await afterEngineChange();
      });
    },
    [roundTrip, stamp, afterEngineChange],
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
  const toggleDisconnect = useCallback(
    () => setMode((m) => (m === "disconnect" ? "none" : "disconnect")),
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
            outline: { kind: kind ?? 0, starPoints },
            connectTargets,
            connections,
            onApply: apply,
            onCancel: drawingTools.cancelEdit,
            onToggleDuplicate: toggleDuplicate,
            onToggleConnect: toggleConnect,
            onGap: setGap,
            onDuplicate: duplicateToward,
            onConnect: connect,
            onToggleDisconnect: toggleDisconnect,
            onDisconnect: disconnect,
          }
        : null,
    [es, mode, gap, boxy, kind, starPoints, connectTargets, connections, apply, drawingTools.cancelEdit, toggleDuplicate, toggleConnect, toggleDisconnect, setGap, duplicateToward, connect, disconnect],
  );

  return { overlay, duplicateToward, connect, disconnect };
}
