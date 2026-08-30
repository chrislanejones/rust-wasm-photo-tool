// History — undo/redo/jump/delete/clear against the engine's snapshot +
// op-log stacks. The Ctrl+Z / Ctrl+Shift+Z binding is NOT here — see the note
// above the return.
//
// Extracted VERBATIM from useCloneStamp.ts in the clonestamp-split refactor.
// Every history move repaints (flush), re-mirrors state (sync), bumps the
// annotation revision, and re-pulls the selection overlay — the four-step
// ritual is the invariant, not an accident: undo can restore a different
// overlay set AND a different selection mask than what was showing.
//
// ADR-024 Stage 3.5 (a8) — every engine call whose RETURN VALUE is consumed
// here is awaited. Today the engine is synchronous and `await` on a plain value
// costs a microtask tick; behind the worker these become real round trips and
// the call sites already read correctly.
//
// FOUR OF THE FIVE ARE TRUTHY TRAPS — `if (toolRef.current?.undo())` — which is
// why this file was converted deliberately as a unit rather than swept. Make
// `undo()` return a Promise and forget the `await`, and the condition is
// permanently TRUE: every keypress repaints, re-syncs and re-broadcasts whether
// or not anything was undone, and NOTHING catches it. A Promise is a fine
// `unknown` to tsc, there is no `no-floating-promises` rule configured here, and
// no test covers this file. Same shape as `useLayers.ts`, which is the
// reference implementation.
//
// NOT an atomic capture (ADR-024's "ATOMIC CAPTURE" note): each call is one
// independent mutation whose own result gates its own follow-up, so there is no
// multi-read picture of the document to tear. The four-step ritual that follows
// reads nothing it has to keep consistent with the guard.
//
// Reentrancy, stated rather than discovered later: `undo`/`redo` are fired from
// useKeyboardShortcuts and from TopBar without being awaited, so behind the
// worker two fast Ctrl+Z presses can overlap. That is safe — the port is FIFO
// so the engine still applies them in order, and the ritual is idempotent
// (flush/sync/broadcast/refresh all just re-read whatever is current). The
// worst case is one briefly stale frame, which the second ritual corrects.
import { useCallback, useMemo } from "react";
import type { EngineCore } from "./useEngineCore";
import { useToolStore } from "@/stores/useToolStore";

export function useHistory(engine: EngineCore) {
  const { toolRef, syncState, flushToCanvas, broadcastAnnotationsChanged } =
    engine;

  /** Selection changes are undo steps now (each select / add / subtract /
   *  deselect), and pixel-step undo restores the mask that was live at that
   *  moment — so every history move re-pulls the overlay from the engine.
   *  Store action, read straight off the store (no new prop threading). */
  const refreshSelectionMask = useCallback(async () => {
    const ov = await toolRef.current?.selection_overlay();
    useToolStore.getState().setSelectionMask(ov && ov.length ? ov : null);
  }, [toolRef]);

  const undo = useCallback(async () => {
    if (await toolRef.current?.undo()) {
      flushToCanvas();
      syncState();
      broadcastAnnotationsChanged();
      await refreshSelectionMask();
    }
  }, [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, refreshSelectionMask]);

  const redo = useCallback(async () => {
    if (await toolRef.current?.redo()) {
      flushToCanvas();
      syncState();
      broadcastAnnotationsChanged();
      await refreshSelectionMask();
    }
  }, [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, refreshSelectionMask]);

  const jumpToHistory = useCallback(
    async (index: number) => {
      if (await toolRef.current?.jump_to_history(index)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
        await refreshSelectionMask();
      }
    },
    [toolRef, flushToCanvas, syncState, broadcastAnnotationsChanged, refreshSelectionMask],
  );

  const deleteHistoryEntry = useCallback(
    async (index: number) => {
      if (await toolRef.current?.delete_history_entry(index)) {
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

  // ── Keyboard shortcuts: NONE here, on purpose ──────────────────────────
  // Ctrl+Z / Ctrl+Shift+Z are bound in ONE place — `app/useKeyboardShortcuts.ts`
  // — which receives `undo`/`redo` from AppShell as `onUndo`/`onRedo`.
  //
  // This hook used to bind them too (carried verbatim out of useCloneStamp in
  // the split), so every Ctrl+Z reached the engine TWICE: two window listeners,
  // two `undo()` calls, two history steps. Measured on the production build
  // 2026-08-28: one keypress took `undo_count` 3 → 1 and removed two shapes.
  // It survived because the one e2e that undoes has a single-entry history
  // (stroke → undo), where the second call finds nothing and returns false.
  //
  // If Ctrl+Z ever needs to be bound again, bind it THERE, where the typing
  // guard and `preventDefault` already live — never add a second listener.

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
