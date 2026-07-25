// History — undo/redo/jump/delete/clear against the engine's snapshot +
// op-log stacks, plus the Ctrl+Z / Ctrl+Shift+Z window binding.
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// Every history move repaints (flush), re-mirrors state (sync), bumps the
// annotation revision, and re-pulls the selection overlay — the four-step
// ritual is the invariant, not an accident: undo can restore a different
// overlay set AND a different selection mask than what was showing.
import { useCallback, useEffect, useMemo } from "react";
import type { EngineCore } from "./useEngineCore";
import { useToolStore } from "@/stores/useToolStore";

export function useHistory(engine: EngineCore) {
  const { toolRef, syncState, flushToCanvas, broadcastAnnotationsChanged } =
    engine;

  /** Selection changes are undo steps now (each select / add / subtract /
   *  deselect), and pixel-step undo restores the mask that was live at that
   *  moment — so every history move re-pulls the overlay from the engine.
   *  Store action, read straight off the store (no new prop threading). */
  const refreshSelectionMask = useCallback(() => {
    const ov = toolRef.current?.selection_overlay();
    useToolStore.getState().setSelectionMask(ov && ov.length ? ov : null);
  }, [toolRef]);

  const undo = useCallback(() => {
    if (toolRef.current?.undo()) {
      flushToCanvas();
      syncState();
      broadcastAnnotationsChanged();
      refreshSelectionMask();
    }
  }, [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, refreshSelectionMask]);

  const redo = useCallback(() => {
    if (toolRef.current?.redo()) {
      flushToCanvas();
      syncState();
      broadcastAnnotationsChanged();
      refreshSelectionMask();
    }
  }, [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, refreshSelectionMask]);

  const jumpToHistory = useCallback(
    (index: number) => {
      if (toolRef.current?.jump_to_history(index)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
        refreshSelectionMask();
      }
    },
    [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, refreshSelectionMask],
  );

  const deleteHistoryEntry = useCallback(
    (index: number) => {
      if (toolRef.current?.delete_history_entry(index)) {
        flushToCanvas();
        syncState();
      }
    },
    [toolRef, flushToCanvas, syncState],
  );

  const clearHistory = useCallback(() => {
    toolRef.current?.clear_history();
    syncState();
  }, [toolRef, syncState]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return useMemo(
    () => ({
      undo,
      redo,
      jumpToHistory,
      deleteHistoryEntry,
      clearHistory,
      refreshSelectionMask,
    }),
    [undo, redo, jumpToHistory, deleteHistoryEntry, clearHistory, refreshSelectionMask],
  );
}
