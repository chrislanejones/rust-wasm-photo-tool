// Multi-select (Night 10-22): several annotations picked on the active layer,
// moved, aligned, distributed, deleted and duplicated together — each action
// ONE undo step through one engine call (src/annotation_group.rs).
//
// What is picked lives in useAnnotationStore (`picked`); what a pick pulls in
// and the boxes are lib/annotationSelection. This hook owns the engine side:
// a snapshot of the layer's geometry, the five actions, and the keys.
//
// CONNECTORS AND CALLOUTS FOLLOW ON THEIR OWN. Every action ends with
// `bumpAnnotations`, which re-reads the shape list, and useShapeActions /
// usePinSteps already re-route a connector or a leader whose box or pin moved
// — riding the action's step, because `reroute_connector` takes none.
//
// Mounted by AnnotationSelectionLayer (CanvasArea), not AppShell.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageHorseTool } from "stamp_tool";
import {
  NONE,
  alignGroups,
  expand,
  pickAll,
  pickedBounds,
  pickedCount,
  type Picked,
  type SelShape,
  type SelText,
} from "@/lib/annotationSelection";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useToolStore } from "@/stores/useToolStore";

export type AlignEdge = "left" | "centerH" | "right" | "top" | "middleV" | "bottom";

/** How far a Duplicate lands from its originals, IMAGE px. */
const DUPLICATE_OFFSET = 20;

interface Options {
  toolRef: React.RefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  activeLayerId: number;
}

export interface LayerGeometry {
  shapes: SelShape[];
  texts: SelText[];
}

const EMPTY: LayerGeometry = { shapes: [], texts: [] };

/** An annotation tool is open: Create's Shapes / Pins / Arrows / Text /
 *  Select objects. Ctrl+A picks annotations only then. */
export const annotationToolActive = () => {
  const t = useToolStore.getState().activeTool;
  return t === "shapes" || t === "text";
};

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function useAnnotationSelection({ toolRef, flushToCanvas, syncState, activeLayerId }: Options) {
  const picked = useAnnotationStore((s) => s.picked);
  const setPicked = useAnnotationStore((s) => s.setPicked);
  const revision = useAnnotationStore((s) => s.annotationsRevision);
  const subTool = useToolStore((s) => s.activeSubTool);
  const [geometry, setGeometry] = useState<LayerGeometry>(EMPTY);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  /** Read the active layer's annotations back from the engine. */
  const refresh = useCallback(async (): Promise<LayerGeometry> => {
    const tool = toolRef.current;
    if (!tool) return EMPTY;
    try {
      const next = {
        shapes: JSON.parse(await tool.get_shape_annotations()) as SelShape[],
        texts: JSON.parse(await tool.get_text_annotations()) as SelText[],
      };
      geometryRef.current = next;
      setGeometry(next);
      // Drop picks that no longer exist (an undone duplicate, a delete).
      setPicked((p) => {
        const shapes = p.shapes.filter((id) => next.shapes.some((s) => s.id === id));
        const texts = p.texts.filter((id) => next.texts.some((t) => t.id === id));
        return shapes.length === p.shapes.length && texts.length === p.texts.length ? p : { shapes, texts };
      });
      return next;
    } catch {
      return geometryRef.current;
    }
  }, [toolRef, setPicked]);

  // Undo, redo and a history jump all bump `annotationsRevision`.
  useEffect(() => {
    void refresh();
  }, [refresh, revision, subTool, activeLayerId]);

  // Active layer only: a switch lets go.
  useEffect(() => {
    setPicked(NONE);
  }, [activeLayerId, setPicked]);

  /** After an engine call: redraw, publish the step, re-read everything. */
  const after = useCallback(async () => {
    flushToCanvas();
    syncState();
    useAnnotationStore.getState().bumpAnnotations();
    await refresh();
  }, [flushToCanvas, syncState, refresh]);

  const ids = (p: Picked) => [Uint32Array.from(p.shapes), Uint32Array.from(p.texts)] as const;

  const moveBy = useCallback(
    async (dx: number, dy: number) => {
      const tool = toolRef.current;
      const p = useAnnotationStore.getState().picked;
      if (!tool || !pickedCount(p) || (!dx && !dy)) return;
      const [s, t] = ids(p);
      if (await tool.move_annotations(s, t, dx, dy)) await after();
    },
    [toolRef, after],
  );

  const align = useCallback(
    async (edge: AlignEdge) => {
      const tool = toolRef.current;
      const p = useAnnotationStore.getState().picked;
      if (!tool || !pickedCount(p)) return;
      const { shapes, texts } = geometryRef.current;
      const g = alignGroups(p, shapes, texts);
      if (g.groups >= 2) {
        const ok = await tool.align_annotations(
          Uint32Array.from(g.shapeIds),
          Uint32Array.from(g.shapeGroups),
          Uint32Array.from(g.textIds),
          Uint32Array.from(g.textGroups),
          edge,
        );
        if (ok) await after();
        return;
      }
      // One object (or one callout): today's meaning — to the canvas.
      const b = pickedBounds(p, shapes, texts);
      if (!b) return;
      const w = await tool.width();
      const h = await tool.height();
      const d = {
        left: [-b.x0, 0],
        centerH: [(w - (b.x1 - b.x0)) / 2 - b.x0, 0],
        right: [w - b.x1, 0],
        top: [0, -b.y0],
        middleV: [0, (h - (b.y1 - b.y0)) / 2 - b.y0],
        bottom: [0, h - b.y1],
      }[edge];
      await moveBy(Math.round(d[0]), Math.round(d[1]));
    },
    [toolRef, after, moveBy],
  );

  const distribute = useCallback(
    async (axis: "h" | "v") => {
      const tool = toolRef.current;
      const p = useAnnotationStore.getState().picked;
      if (!tool) return;
      const g = alignGroups(p, geometryRef.current.shapes, geometryRef.current.texts);
      if (g.groups < 3) return;
      const ok = await tool.distribute_annotations(
        Uint32Array.from(g.shapeIds),
        Uint32Array.from(g.shapeGroups),
        Uint32Array.from(g.textIds),
        Uint32Array.from(g.textGroups),
        axis,
      );
      if (ok) await after();
    },
    [toolRef, after],
  );

  const remove = useCallback(async () => {
    const tool = toolRef.current;
    const p = useAnnotationStore.getState().picked;
    if (!tool || !pickedCount(p)) return;
    const [s, t] = ids(p);
    setPicked(NONE);
    if ((await tool.remove_annotations(s, t)) > 0) await after();
  }, [toolRef, after, setPicked]);

  const duplicate = useCallback(async () => {
    const tool = toolRef.current;
    const p = useAnnotationStore.getState().picked;
    if (!tool || !pickedCount(p)) return;
    const [s, t] = ids(p);
    const fresh = Array.from(await tool.duplicate_annotations(s, t, DUPLICATE_OFFSET, DUPLICATE_OFFSET));
    if (!fresh.length) return;
    await after();
    // The copies become the selection, so a second Duplicate marches on.
    const nShapes = fresh.length - Math.min(t.length, fresh.length);
    setPicked({ shapes: fresh.slice(0, nShapes), texts: fresh.slice(nShapes) });
  }, [toolRef, after, setPicked]);

  /** Ctrl+A: every annotation on the layer. */
  const selectAll = useCallback(async () => {
    const g = await refresh();
    setPicked(expand(pickAll(g.shapes, g.texts), g.shapes, g.texts));
  }, [refresh, setPicked]);

  // Keys, in the capture phase so they reach us before the editor's own
  // shortcuts (Ctrl+A would otherwise select every PIXEL; Delete would
  // clear the pixel selection).
  const keyActions = useRef({ moveBy, remove, selectAll, setPicked });
  keyActions.current = { moveBy, remove, selectAll, setPicked };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.defaultPrevented) return;
      const a = keyActions.current;
      const has = pickedCount(useAnnotationStore.getState().picked) > 0;
      const mod = e.ctrlKey || e.metaKey;
      let handled = true;
      if (mod && !e.altKey && e.key.toLowerCase() === "a" && annotationToolActive()) void a.selectAll();
      else if (!has || mod || e.altKey) handled = false;
      else if (e.key === "Escape") a.setPicked(NONE);
      else if (e.key === "Delete" || e.key === "Backspace") void a.remove();
      else if (e.key.startsWith("Arrow")) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        void a.moveBy(dx, dy);
      } else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return { picked, setPicked, geometry, refresh, moveBy, align, distribute, remove, duplicate, selectAll };
}

export type AnnotationSelection = ReturnType<typeof useAnnotationSelection>;
