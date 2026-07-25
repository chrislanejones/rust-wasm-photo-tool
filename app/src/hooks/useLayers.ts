// Layers — the layer-stack surface: add/remove/duplicate/reorder, active
// layer, visibility/opacity/rename, merge/flatten, and non-destructive masks.
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// Each op mutates the Rust layer stack, then repaints the composite and
// re-syncs the mirrored layer list into React state; the ops that can swap
// which overlays are live (active-layer switch, merge, flatten) also bump the
// annotation revision.
import { useCallback, useMemo } from "react";
import type { EngineCore } from "./useEngineCore";

export function useLayers(engine: EngineCore) {
  const { toolRef, syncState, flushToCanvas, broadcastAnnotationsChanged } =
    engine;

  // ── Layers ────────────────────────────────────────────────────────────────
  // Each mutates the Rust layer stack, then repaints the composite and re-syncs
  // the mirrored layer list into React state.
  const addLayer = useCallback(
    (name = ""): number => {
      const t = toolRef.current;
      if (!t) return 0;
      const id = t.add_layer(name);
      flushToCanvas();
      syncState();
      return id;
    },
    [toolRef, flushToCanvas, syncState],
  );

  const removeLayer = useCallback(
    (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.remove_layer(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const duplicateLayer = useCallback(
    (id: number): number => {
      const t = toolRef.current;
      if (!t) return 0;
      const newId = t.duplicate_layer(id);
      flushToCanvas();
      syncState();
      return newId;
    },
    [toolRef, flushToCanvas, syncState],
  );

  const setActiveLayer = useCallback(
    (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.set_active_layer(id)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
      }
    },
    [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged],
  );

  const setLayerVisible = useCallback(
    (id: number, visible: boolean) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.set_layer_visible(id, visible)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const setLayerOpacity = useCallback(
    (id: number, opacity: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.set_layer_opacity(id, opacity)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const renameLayer = useCallback(
    (id: number, name: string) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.rename_layer(id, name)) {
        syncState();
      }
    },
    [toolRef, syncState],
  );

  const moveLayer = useCallback(
    (id: number, newIndex: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.move_layer(id, newIndex)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const mergeDown = useCallback(
    (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.merge_down(id)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
      }
    },
    [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged],
  );

  const flattenAll = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.flatten_all();
    flushToCanvas();
    syncState();
    broadcastAnnotationsChanged();
  }, [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged]);

  // ── Layer masks (non-destructive) ──
  const addLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.add_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );
  const removeLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.remove_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );
  const applyLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.apply_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );
  const invertLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.invert_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
