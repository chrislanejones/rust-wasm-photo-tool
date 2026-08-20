// Layers — the layer-stack surface: add/remove/duplicate/reorder, active
// layer, visibility/opacity/rename, merge/flatten, and non-destructive masks.
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// Each op mutates the Rust layer stack, then repaints the composite and
// re-syncs the mirrored layer list into React state; the ops that can swap
// which overlays are live (active-layer switch, merge, flatten) also bump the
// annotation revision.
// ADR-024 Stage 3.5 — every engine call whose RETURN VALUE is consumed here is
// awaited. Today the engine is synchronous and `await` on a plain value is a
// no-op beyond a microtask tick; behind the worker these become real round
// trips and the call sites already read correctly.
//
// The `if (await t.remove_layer(id))` shape is the one that mattered. The
// audit calls these "truthy-trap" sites: convert the method to return a
// Promise and forget the `await`, and the condition is permanently TRUE with
// nothing to catch it — a Promise is a perfectly good `unknown` to tsc, and no
// existing test fails. Nine of this file's guards are that shape, which is why
// they were converted deliberately rather than swept.
//
// These are NOT an atomic capture (see ADR-024's "ATOMIC CAPTURE" note): each
// call is one independent mutation whose result gates its own follow-up, so
// there is no multi-read picture to tear.
import { useCallback, useMemo } from "react";
import type { EngineCore } from "./useEngineCore";
import { useGalleryStore } from "@/stores/useGalleryStore";

export function useLayers(engine: EngineCore) {
  const { toolRef, syncState, flushToCanvas, broadcastAnnotationsChanged } =
    engine;
  // #53 — LAYER-PANEL STATE HAD NO WAY TO REACH DISK.
  //
  // Every op below that calls `snap()` in Rust raises `undoCount`, and the
  // autosave effect watches `undoCount`, so add / remove / duplicate / move /
  // merge / flatten and the mask ops already schedule a save for free.
  //
  // Four do NOT snap — `set_active_layer`, `set_layer_visible`,
  // `set_layer_opacity`, `rename_layer` (verified in layer.rs). They changed
  // the document and nothing downstream could tell, so hide-a-layer-and-reload
  // brought it back visible, and the active layer reverted to whatever
  // `restoreLayerStack`'s `layers.length - 1` fallback picked. Those four bump
  // a counter the autosave effect can actually see.
  const bumpLayerRevision = useGalleryStore((s) => s.bumpLayerRevision);

  // ── Layers ────────────────────────────────────────────────────────────────
  // Each mutates the Rust layer stack, then repaints the composite and re-syncs
  // the mirrored layer list into React state.
  const addLayer = useCallback(
    async (name = ""): Promise<number> => {
      const t = toolRef.current;
      if (!t) return 0;
      const id = await t.add_layer(name);
      flushToCanvas();
      syncState();
      return id;
    },
    [toolRef, flushToCanvas, syncState],
  );

  const removeLayer = useCallback(
    async (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.remove_layer(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const duplicateLayer = useCallback(
    async (id: number): Promise<number> => {
      const t = toolRef.current;
      if (!t) return 0;
      const newId = await t.duplicate_layer(id);
      flushToCanvas();
      syncState();
      return newId;
    },
    [toolRef, flushToCanvas, syncState],
  );

  const setActiveLayer = useCallback(
    async (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.set_active_layer(id)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
        bumpLayerRevision();
      }
    },
    [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, bumpLayerRevision],
  );

  const setLayerVisible = useCallback(
    async (id: number, visible: boolean) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.set_layer_visible(id, visible)) {
        flushToCanvas();
        syncState();
        bumpLayerRevision();
      }
    },
    [toolRef, flushToCanvas, syncState, bumpLayerRevision],
  );

  const setLayerOpacity = useCallback(
    async (id: number, opacity: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.set_layer_opacity(id, opacity)) {
        flushToCanvas();
        syncState();
        bumpLayerRevision();
      }
    },
    [toolRef, flushToCanvas, syncState, bumpLayerRevision],
  );

  const renameLayer = useCallback(
    async (id: number, name: string) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.rename_layer(id, name)) {
        syncState();
        bumpLayerRevision();
      }
    },
    [toolRef, syncState, bumpLayerRevision],
  );

  const moveLayer = useCallback(
    async (id: number, newIndex: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.move_layer(id, newIndex)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const mergeDown = useCallback(
    async (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (await t.merge_down(id)) {
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
    async (id: number) => {
      if (await toolRef.current?.add_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );
  const removeLayerMask = useCallback(
    async (id: number) => {
      if (await toolRef.current?.remove_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );
  const applyLayerMask = useCallback(
    async (id: number) => {
      if (await toolRef.current?.apply_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );
  const invertLayerMask = useCallback(
    async (id: number) => {
      if (await toolRef.current?.invert_layer_mask(id)) {
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
