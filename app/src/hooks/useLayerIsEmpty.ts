import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { LayerInfo } from "./useEngineCore";

/**
 * Does the ACTIVE layer contain any non-transparent pixel? (#71)
 *
 * Asks the engine's pure `layer_is_empty(index)` for ONE layer — the selected
 * one — and re-asks when the document changes. `undefined` means "not known
 * yet", which callers should treat as "don't disable anything": a control that
 * flickers disabled on every re-render is worse than one that never disables.
 *
 * ⚠️ **Deliberately not a list.** The tempting shape is `emptyByLayerId` for
 * every layer at once, and that is the shape that caused the v7.81 batch-export
 * data loss: a derived "which photos have edits" map went stale and silently
 * dropped edits. One question, about one layer, re-asked — never a cache keyed
 * by id that some other code path can read after it has gone stale.
 *
 * ⚠️ **Not a field on `get_layers()`.** That runs inside `capture_ui_state`,
 * which `syncState` reaches from 199 call sites including per-stroke paths.
 * The scan is ~4 ms on the empty-layer worst case — fine once per document
 * change, ruinous per stroke. The annotation counts (#63) could ride there
 * because `Vec::len()` is O(1); this cannot.
 *
 * The engine call is awaited: behind the worker (ADR-024) it is a real round
 * trip, and an un-awaited Promise is a perfectly good truthy value that no
 * type check catches.
 */
export function useLayerIsEmpty(
  stampToolRef: MutableRefObject<ImageHorseTool | null>,
  layers: LayerInfo[] | undefined,
  /** Bump this when the pixels may have changed — `undoCount` is the one the
   *  rest of the app already uses for "the document moved". */
  revision: number,
): boolean | undefined {
  const [isEmpty, setIsEmpty] = useState<boolean | undefined>(undefined);

  // The stack POSITION of the active layer: `layer_is_empty` takes an index,
  // and `get_layers()` emits bottom → top, so the array index is the index.
  const activeIndex = layers?.findIndex((l) => l.active) ?? -1;
  const activeId = activeIndex >= 0 ? layers?.[activeIndex]?.id : undefined;

  useEffect(() => {
    const tool = stampToolRef.current;
    if (!tool || activeIndex < 0) {
      setIsEmpty(undefined);
      return;
    }
    // Ignore a resolution that lands after the selection has moved on —
    // otherwise a slow answer for the previous layer overwrites a fast one
    // for the current layer, and the swatches disable for the wrong layer.
    let current = true;
    void (async () => {
      try {
        const empty = await tool.layer_is_empty(activeIndex);
        if (current) setIsEmpty(empty);
      } catch {
        // An engine that cannot answer must not disable a control.
        if (current) setIsEmpty(undefined);
      }
    })();
    return () => {
      current = false;
    };
    // `activeId` as well as the index: reordering the stack changes which
    // layer an index refers to without changing the index.
  }, [stampToolRef, activeIndex, activeId, revision]);

  return isEmpty;
}
