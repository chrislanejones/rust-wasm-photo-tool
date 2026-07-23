// Selection-marker (magic-wand) + Move/Selection toggle handlers, extracted
// verbatim from AppShell (stage 2). All masking math is Rust; JS just stores the
// returned overlay + routes ops. Tool state is read straight from useToolStore;
// the WASM `stamp` handle and the canvas ref are passed in.
import { useCallback, useEffect, useState } from "react";
import type { RefObject, MouseEvent as ReactMouseEvent } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useToolStore } from "@/stores/useToolStore";
import { tryRemoveObject } from "@/lib/patchmatch";
import {
  selectionCombineMode,
  type SelectionCombineMode,
} from "@/lib/selectionBool";
import { toast } from "@/components/ui/sonner";

export function useSelectionActions(
  stamp: ReturnType<typeof useCloneStamp>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const selectionTolerance = useToolStore((s) => s.selectionTolerance);
  const selectionKind = useToolStore((s) => s.selectionKind);
  const edgeThreshold = useToolStore((s) => s.edgeThreshold);
  const setSelectionMask = useToolStore((s) => s.setSelectionMask);
  const setSelectionMode = useToolStore((s) => s.setSelectionMode);
  const setAdjustMode = useToolStore((s) => s.setAdjustMode);
  const setMoveActive = useToolStore((s) => s.setMoveActive);
  const setActiveTool = useToolStore((s) => s.setActiveTool);

  // ── Magnetic lasso session state (kind === "lasso") ─────────────────────────
  // The lasso is the one selection kind that isn't click-once: it's a session
  // (begin → commit* → close), so it needs two polylines on screen — the frozen
  // path behind the last anchor, and the live wire chasing the cursor. Both are
  // computed in Rust; these just hold the flat [x,y,…] pairs for the overlay.
  // Engine-owned truth, JS-owned display — the tool itself is the source of
  // whether a session is running (`lasso_active()`).
  const [lassoCommitted, setLassoCommitted] = useState<Int32Array | null>(null);
  const [lassoPreview, setLassoPreview] = useState<Int32Array | null>(null);

  // ── Additive / subtractive selection (`ih_selection_bool`, default OFF) ─────
  // The intent behind the NEXT (or in-flight lasso) selection: 0 replace,
  // 1 union (Shift), 2 subtract (Alt). The engine is the source of truth for
  // the actual op (we push this to `set_selection_combine` before each
  // producer); this mirror only exists so the on-canvas preview can tint the
  // marching-ants add vs. subtract while the gesture is live.
  // TODO(chris): additive/subtractive preview overlay styling — Chris is
  // designing this by eye. `combineHint` is the hook/prop it should read;
  // nothing renders off it yet.
  const [combineHint, setCombineHint] = useState<SelectionCombineMode>(0);

  const getCoords = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which engine call a canvas click makes is the ONLY difference between the
  // three click-once selection kinds — all three return the same canvas-sized
  // overlay, so everything downstream (overlay blit, Delete, Deselect) is
  // untouched. The lasso is the exception: a click is an ANCHOR, not a
  // selection, so it forks first and never reaches the ternary.
  const handleSelectionClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      const { x, y } = getCoords(e);

      // Shift = add (union), Alt = subtract; flag-gated, else always 0/replace.
      const mode = selectionCombineMode(e);

      if (selectionKind === "lasso") {
        // The lasso is a multi-click SESSION, not click-once — so the add/
        // subtract intent is fixed when the loop OPENS (first anchor) and the
        // engine consumes it at `lasso_close`. Mid-session clicks are anchors,
        // never producers, so re-reading the modifier per anchor would be a
        // lie; we set combine mode once here and leave it.
        if (!tool.lasso_active()) {
          tool.set_selection_combine(mode);
          setCombineHint(mode);
          if (!tool.lasso_begin(x, y)) return;
        } else {
          tool.lasso_commit(x, y);
        }
        setLassoCommitted(tool.lasso_committed_path());
        setLassoPreview(null);
        return;
      }

      // Click-once kinds (wand / edge / color-range) resolve the intent at
      // click time. The engine routes the produced mask through union/subtract
      // when mode != 0; mode 0 is the old replace path, byte-for-byte.
      tool.set_selection_combine(mode);
      setCombineHint(mode);
      const mask =
        selectionKind === "edge"
          ? tool.magic_wand_select_edges(x, y, selectionTolerance, edgeThreshold)
          : selectionKind === "colorRange"
            ? tool.color_range_select(x, y, selectionTolerance)
            : tool.magic_wand_select(x, y, selectionTolerance);
      setSelectionMask(mask.length ? mask : null);
    },
    [stamp, getCoords, selectionTolerance, selectionKind, edgeThreshold],
  );

  // The live wire, recomputed on every mouse-move while a session is open. This
  // is the interactive path: the engine bounds its search to a window around the
  // segment, which is what keeps it inside a frame budget on a big image.
  const handleLassoMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool || selectionKind !== "lasso" || !tool.lasso_active()) return;
      const { x, y } = getCoords(e);
      setLassoPreview(tool.lasso_path_to(x, y));
    },
    [stamp, getCoords, selectionKind],
  );

  // Double-click closes the loop: the engine wires the last anchor back to the
  // first, fills the enclosed region, and hands back the SAME overlay RGBA the
  // wands produce — so from here on it's just "a selection", like any other.
  const handleLassoClose = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool || !tool.lasso_active()) return;
    const mask = tool.lasso_close();
    setLassoCommitted(null);
    setLassoPreview(null);
    setSelectionMask(mask.length ? mask : null);
  }, [stamp]);

  // Esc abandons the session. Leaves any existing selection alone.
  const handleLassoCancel = useCallback(() => {
    stamp.toolRef.current?.lasso_cancel();
    setLassoCommitted(null);
    setLassoPreview(null);
  }, [stamp]);

  // Bound here rather than in useKeyboardShortcuts: the listener only exists
  // while a lasso session is actually open, so Escape keeps its existing
  // meaning everywhere else in the app and the shared shortcut hook doesn't
  // grow a session-scoped case.
  useEffect(() => {
    if (!lassoCommitted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleLassoCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lassoCommitted, handleLassoCancel]);
  const handleSelectAll = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    const mask = tool.select_all();
    setSelectionMask(mask.length ? mask : null);
  }, [stamp]);
  const handleDeselect = useCallback(() => {
    // Also tears down an open lasso session — "deselect" that left a half-drawn
    // wire on the canvas would be a lie.
    stamp.toolRef.current?.lasso_cancel();
    stamp.toolRef.current?.clear_selection();
    setLassoCommitted(null);
    setLassoPreview(null);
    setCombineHint(0);
    setSelectionMask(null);
  }, [stamp]);
  const handleDeleteSelection = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (tool?.delete_selection()) {
      stamp.flushToCanvas();
      stamp.syncState();
    }
    setSelectionMask(null);
  }, [stamp]);
  // "New Layer" — place the selection on a new layer above the active one
  // (Layer Via Copy / Layer Via Cut; Ctrl+J / Ctrl+Shift+J). Same publish
  // shape as handleDeleteSelection: the engine snaps + deselects + returns
  // 0-on-nothing, JS flushes, syncs (so the Layers panel sees the new layer)
  // and drops the overlay mask.
  const handleNewLayerFromSelection = useCallback(
    (cut: boolean) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      if (tool.selection_to_new_layer(cut)) {
        stamp.flushToCanvas();
        stamp.syncState();
        toast.success(
          cut ? "Selection cut to a new layer" : "Selection copied to a new layer",
        );
      }
      setSelectionMask(null);
    },
    [stamp, setSelectionMask],
  );
  const handleNewLayerCopy = useCallback(
    () => handleNewLayerFromSelection(false),
    [handleNewLayerFromSelection],
  );
  const handleNewLayerCut = useCallback(
    () => handleNewLayerFromSelection(true),
    [handleNewLayerFromSelection],
  );
  // Remove Object (PatchMatch, `ih_patchmatch` flag — see lib/patchmatch.ts).
  // Same shape as handleDeleteSelection above: `tryRemoveObject` is already
  // the flag+export guard, so a flag-off or default (non-`patchmatch`) build
  // just returns false here and nothing on the canvas changes. The panel
  // only renders this action at all when the flag is on (SelectSettings.tsx),
  // so in practice this guard is defense-in-depth, not the only thing
  // standing between a default build and a call it can't make.
  const handleRemoveObject = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    if (tryRemoveObject(tool)) {
      stamp.flushToCanvas();
      stamp.syncState();
    }
    setSelectionMask(null);
  }, [stamp]);
  // Move-layer toggle (Layer Settings + Ctrl+M). Switches to the Layer Settings
  // tool. Still clears selection-click mode: the two interpret a canvas click
  // differently, so they stay mutually exclusive even though they now live on
  // different tools.
  const handleToggleMove = useCallback(() => {
    setActiveTool("arrow");
    setSelectionMode(false);
    setMoveActive((m) => !m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Selection click-to-select toggle. Switches to Adjust & Select (its home
  // since tool-arc 2.6) and puts it in the Select sub-mode — without that the
  // toggle turns on but the canvas still shows the Adjust body, and the click
  // routing (gated on adjustMode === "select") never fires.
  const handleToggleSelectionMode = useCallback(() => {
    setActiveTool("crop");
    setAdjustMode("select");
    setMoveActive(false);
    setSelectionMode((m) => !m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    getCoords,
    handleSelectionClick,
    handleSelectAll,
    handleDeselect,
    handleDeleteSelection,
    // Selection → new layer (Copy = Ctrl+J, Cut = Ctrl+Shift+J).
    handleNewLayerCopy,
    handleNewLayerCut,
    // Remove Object (behind ih_patchmatch; see lib/patchmatch.ts).
    handleRemoveObject,
    handleToggleMove,
    handleToggleSelectionMode,
    // Magnetic lasso — shipped by default since the selection-tool overhaul
    // (`ih_smart_edge` now gates only the Paint Smart Brush).
    handleLassoMove,
    handleLassoClose,
    handleLassoCancel,
    lassoCommitted,
    lassoPreview,
    // Additive/subtractive intent for the live gesture (`ih_selection_bool`):
    // 0 replace, 1 union, 2 subtract. The preview overlay Chris is designing
    // reads this — see the TODO by its useState.
    combineHint,
  };
}
