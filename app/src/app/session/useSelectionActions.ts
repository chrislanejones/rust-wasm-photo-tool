// The Select tool's session handlers (extracted from AppShell in stage 2,
// promoted from sub-mode to tool in the split). All masking math is Rust; JS
// just stores the returned overlay + routes ops. Tool state is read straight
// from useToolStore; the WASM `stamp` handle and the canvas ref are passed in.
//
// Gesture model (v7.47): the active SelectionKind picks the gesture, one mode
// at a time —
//   wand / edge / colorRange  CLICK, resolved immediately;
//   lasso                     a click SESSION (begin → commit* → close);
//   rect / ellipse            DRAG-only, committed on release through
//                             handleMarqueeCommit; clicks are inert.
// Before v7.47 a drag swept a marquee in EVERY non-lasso kind, so wand-click
// and rect-drag were both live at once. There is no arming toggle — picking
// the tool is the arming, and picking the mode is the gesture.
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, MouseEvent as ReactMouseEvent } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useCanvasCoords } from "@/hooks/useCanvasCoords";
import { useToolStore, isMarqueeKind } from "@/stores/useToolStore";
import { tryRemoveObject } from "@/lib/patchmatch";
import {
  selectionCombineMode,
  type SelectionCombineMode,
} from "@/lib/selectionBool";
import { toast } from "@/components/ui/sonner";
import { toCoverage } from "@/lib/selectionCoverage";
import { createLiveRetune } from "@/lib/liveRetune";
import { CLEAN_UP, isNoopRefine, refineArgs, type RefineSettings } from "@/lib/selectionRefine";

/** Quiet time before a Tolerance tick re-runs the selection. Long enough to
 *  skip the ticks of one drag, short enough to read as live. */
const RETUNE_DEBOUNCE_MS = 70;
/** Above its pixel budget a re-run cannot keep up with a drag, and an overlay
 *  that trails the handle by most of a second is worse than one that waits.
 *  So a big document re-runs when the drag PAUSES, not on every tick.
 *
 *  Measured 09-24-2026, production build, engine in the worker: the wand
 *  re-runs a 2068×1385 document (the largest an import produces —
 *  WORKING_MAX_EDGE is 2048) in 31–43 ms, and a 24 MP one in 237–347 ms.
 *  Edge-aware recomputes the Sobel map every run: 822–899 ms at 24 MP. The
 *  budgets put each kind at roughly 100 ms per update, so every import is
 *  fully live and only a document enlarged past that waits. */
const RETUNE_PAUSE_MS = 300;
const LIVE_BUDGET_PX = { edge: 3_200_000, flood: 8_000_000 } as const;

export function useSelectionActions(
  stamp: ReturnType<typeof useCloneStamp>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const selectionTolerance = useToolStore((s) => s.selectionTolerance);
  const selectionKind = useToolStore((s) => s.selectionKind);
  const edgeThreshold = useToolStore((s) => s.edgeThreshold);
  const setSelectionMask = useToolStore((s) => s.setSelectionMask);
  const selectionMask = useToolStore((s) => s.selectionMask);
  const selectionCombine = useToolStore((s) => s.selectionCombine);
  const setSelectionCoverage = useToolStore((s) => s.setSelectionCoverage);
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

  // ── Additive / subtractive selection (ON by default; "0" kill switch) ──────
  // The intent behind the NEXT (or in-flight lasso) selection: 0 replace,
  // 1 union (Shift), 2 subtract (Alt). The engine is the source of truth for
  // the actual op (we push this to `set_selection_combine` before each
  // producer); this mirror only exists so the on-canvas preview can tint the
  // marching-ants add vs. subtract while the gesture is live.
  // TODO(chris): additive/subtractive preview overlay styling — Chris is
  // designing this by eye. `combineHint` is the hook/prop it should read;
  // nothing renders off it yet.
  const [combineHint, setCombineHint] = useState<SelectionCombineMode>(0);

  // ── The readout: "Selected 18.4% · 2.1 MP" ─────────────────────────────────
  // Every path that changes the selection — a click, a marquee, the lasso,
  // Deselect, undo, redo, a live retune — ends by writing `selectionMask`, so
  // this one effect keeps the count current for all of them. The count is the
  // engine's (one pass over its byte plane); the overlay RGBA is never read
  // for it. `seq` drops an answer that a newer selection has overtaken.
  const coverageSeq = useRef(0);
  /** The overlay the Refine preview last put on screen. Any OTHER value of
   *  `selectionMask` means something else changed the selection (a click, an
   *  undo, Deselect), and the preview no longer describes anything. */
  const refinePreviewMask = useRef<Uint8Array | null>(null);
  useEffect(() => {
    const seq = ++coverageSeq.current;
    const tool = stamp.toolRef.current;
    const previewing = useToolStore.getState().refinePreviewing;
    const isPreview = previewing && selectionMask !== null && selectionMask === refinePreviewMask.current;
    if (previewing && !isPreview) {
      // Overtaken: the preview is gone, and the engine's copy with it.
      refinePreviewMask.current = null;
      useToolStore.getState().setRefinePreviewing(false);
      void tool?.selection_refine_cancel();
    }
    if (!selectionMask) {
      setSelectionCoverage(null);
      return;
    }
    if (!tool) return;
    void (async () => {
      try {
        // While a preview is on screen the readout describes IT — the number
        // always matches the ants that are drawn.
        const raw = isPreview
          ? await tool.selection_refine_preview_coverage()
          : await tool.selection_coverage();
        if (seq === coverageSeq.current) setSelectionCoverage(toCoverage(raw));
      } catch {
        // A build without the export shows no readout rather than a guess.
        if (seq === coverageSeq.current) setSelectionCoverage(null);
      }
    })();
  }, [stamp, selectionMask, setSelectionCoverage]);

  // ── Live Tolerance ─────────────────────────────────────────────────────────
  // Moving the slider re-runs the LAST CLICK from the same seed. The engine
  // remembers the seed, the kind and the combine mode, and replaces that
  // click's result in place — no undo step per tick, and in Add/Subtract/
  // Intersect it combines with the selection from before the click, not with
  // the previous tick's. A marquee, the lasso, Select All, an undo or any edit
  // makes the click stale, and the slider goes back to only setting the value
  // for the next click (`selection_can_retune`).
  // The scheduler is built once, so it reads the engine handle and the
  // document size through this ref — a captured `stamp` would be the first
  // render's, with a 0×0 document that would always count as small.
  const stampRef = useRef(stamp);
  useEffect(() => {
    stampRef.current = stamp;
  });
  const liveRetune = useRef(
    createLiveRetune<{ tolerance: number; edge: number }, Uint8Array | null>({
      delayMs: () => {
        const { width, height } = stampRef.current.state;
        const budget =
          useToolStore.getState().selectionKind === "edge"
            ? LIVE_BUDGET_PX.edge
            : LIVE_BUDGET_PX.flood;
        return width * height > budget ? RETUNE_PAUSE_MS : RETUNE_DEBOUNCE_MS;
      },
      run: async ({ tolerance, edge }) => {
        const tool = stampRef.current.toolRef.current;
        // TRUTHY TRAP — un-awaited, a Promise would say "yes" every time.
        if (!tool || !(await tool.selection_can_retune())) return null;
        const mask = await tool.selection_retune(tolerance, edge);
        // Empty is ambiguous (refused, or the result selects nothing); the
        // overlay read settles it — both are empty only if nothing is selected.
        return mask.length ? mask : await tool.selection_overlay();
      },
      onResult: (mask) => {
        if (mask) useToolStore.getState().setSelectionMask(mask.length ? mask : null);
      },
      // The one case where a retune pushes an undo step (the click itself was
      // a no-op) moves the undo count; sync once the slider settles.
      onIdle: () => stampRef.current.syncState(),
    }),
  );
  // ── Refine ───────────────────────────────────────────────────────────────
  // The sliders preview on a COPY (the engine keeps it, the selection and the
  // history are untouched); Apply and Clean Up commit ONE undo step. Same
  // scheduler as live Tolerance: debounced, one run in flight, newest wins.
  const selectionRefine = useToolStore((s) => s.selectionRefine);
  const refineRequest = useToolStore((s) => s.refineRequest);
  const refinePreview = useRef(
    createLiveRetune<RefineSettings, Uint8Array | null>({
      delayMs: RETUNE_DEBOUNCE_MS,
      run: async (r) => {
        const tool = stampRef.current.toolRef.current;
        if (!tool || !(await tool.has_selection())) return null;
        return await tool.selection_refine_preview(...refineArgs(r));
      },
      onResult: (mask) => {
        // Empty = nothing selected to refine. A refine that selects nothing
        // comes back as a full-size transparent overlay, so the ants clear.
        if (!mask || !mask.length) return;
        refinePreviewMask.current = mask;
        useToolStore.getState().setRefinePreviewing(true);
        useToolStore.getState().setSelectionMask(mask);
      },
    }),
  );
  const lastRefine = useRef(selectionRefine);
  useEffect(() => {
    const prev = lastRefine.current;
    lastRefine.current = selectionRefine;
    // Feather only shapes a mask made later; it cannot change the selection.
    const same =
      prev.islands === selectionRefine.islands &&
      prev.holes === selectionRefine.holes &&
      prev.smooth === selectionRefine.smooth &&
      prev.expand === selectionRefine.expand;
    if (same) return;
    refinePreview.current.schedule(selectionRefine);
  }, [selectionRefine]);

  const lastRequest = useRef(refineRequest?.n ?? 0);
  useEffect(() => {
    if (!refineRequest || refineRequest.n === lastRequest.current) return;
    lastRequest.current = refineRequest.n;
    refinePreview.current.cancel();
    const store = useToolStore.getState();
    const r = refineRequest.kind === "cleanUp" ? CLEAN_UP : store.selectionRefine;
    if (refineRequest.kind === "cleanUp") {
      lastRefine.current = CLEAN_UP; // the reset below is not a slider move
      store.setSelectionRefine(CLEAN_UP);
    }
    const tool = stampRef.current.toolRef.current;
    if (!tool) return;
    void (async () => {
      refinePreviewMask.current = null;
      store.setRefinePreviewing(false);
      const mask = isNoopRefine(r)
        ? await tool.selection_overlay()
        : await tool.selection_refine_apply(...refineArgs(r));
      store.setSelectionMask(mask.length ? mask : null);
      // Apply pushes a "Refine Selection" step; the History panel and the
      // Undo NN% readout both read the count.
      stampRef.current.syncState();
    })();
  }, [refineRequest]);

  const lastTuned = useRef({ tolerance: selectionTolerance, edge: edgeThreshold });
  useEffect(() => {
    const prev = lastTuned.current;
    if (prev.tolerance === selectionTolerance && prev.edge === edgeThreshold) return;
    lastTuned.current = { tolerance: selectionTolerance, edge: edgeThreshold };
    liveRetune.current.schedule({ tolerance: selectionTolerance, edge: edgeThreshold });
  }, [selectionTolerance, edgeThreshold]);

  // The same mapping every canvas tool uses; one implementation, stable for a
  // stable ref, so nothing downstream re-memoizes.
  const getCoords = useCanvasCoords(canvasRef);

  // Which engine call a canvas click makes is the ONLY difference between the
  // three click-once selection kinds — all three return the same canvas-sized
  // overlay, so everything downstream (overlay blit, Delete, Deselect) is
  // untouched. The lasso is the exception: a click is an ANCHOR, not a
  // selection, so it forks first and never reaches the ternary.
  // ADR-024 Stage 3.5. NOT an atomic capture, deliberately. The lasso branch
  // reads `lasso_active()`, then MUTATES (`lasso_begin` / `lasso_commit`), then
  // reads `lasso_committed_path()` — so the reads describe a changing engine,
  // not one document state, and the a3/a7 "one capture" fix does not apply.
  // Same test that withdrew `useTextTool` from a7: what sits BETWEEN the reads
  // is part of the pattern. The three-way mask ternary below is one call, not
  // three reads — exactly one branch runs.
  const handleSelectionClick = useCallback(
    async (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;

      // Rectangle / Ellipse are drag-only: their selection comes from
      // `onMarqueeCommit` on release, never from a click. Bail before touching
      // combine mode so a stray click in a marquee mode is inert rather than
      // silently flood-filling from whatever pixel it landed on.
      if (isMarqueeKind(selectionKind)) return;

      const { x, y } = getCoords(e);

      // Shift = add (union), Alt = subtract, for this gesture; otherwise the
      // panel's standing Combine mode.
      const mode = selectionCombineMode(e, selectionCombine);

      if (selectionKind === "lasso") {
        // The lasso is a multi-click SESSION, not click-once — so the add/
        // subtract intent is fixed when the loop OPENS (first anchor) and the
        // engine consumes it at `lasso_close`. Mid-session clicks are anchors,
        // never producers, so re-reading the modifier per anchor would be a
        // lie; we set combine mode once here and leave it.
        // Both guards are TRUTHY TRAPS: un-awaited, `!Promise` is always false,
        // so the first would treat every click as a fresh session (restarting
        // the loop mid-draw) and the second would carry on after a refused
        // `lasso_begin`.
        if (!(await tool.lasso_active())) {
          tool.set_selection_combine(mode);
          setCombineHint(mode);
          if (!(await tool.lasso_begin(x, y))) return;
        } else {
          tool.lasso_commit(x, y);
        }
        setLassoCommitted(await tool.lasso_committed_path());
        setLassoPreview(null);
        return;
      }

      // A new click supersedes any slider tick still waiting to re-run the
      // old one.
      liveRetune.current.cancel();

      // Click-once kinds (wand / edge / color-range) resolve the intent at
      // click time. The engine routes the produced mask through union/subtract
      // when mode != 0; mode 0 is the old replace path, byte-for-byte.
      tool.set_selection_combine(mode);
      setCombineHint(mode);
      // `await` sits on each BRANCH rather than wrapping the ternary. Both are
      // correct at runtime, but the audit decides "awaited" from the text
      // immediately before the receiver, so `await (cond ? a.f() : b.g())`
      // reads as three un-awaited calls and the gate would not move.
      const mask =
        selectionKind === "edge"
          ? await tool.magic_wand_select_edges(x, y, selectionTolerance, edgeThreshold)
          : selectionKind === "colorRange"
            ? await tool.color_range_select(x, y, selectionTolerance)
            : await tool.magic_wand_select(x, y, selectionTolerance);
      setSelectionMask(mask.length ? mask : null);
    },
    [stamp, getCoords, selectionTolerance, selectionKind, edgeThreshold, selectionCombine],
  );

  /** ADR-024 a10 — drops a preview whose mouse-move has been superseded. */
  const lassoMoveSeq = useRef(0);

  // The live wire, recomputed on every mouse-move while a session is open. This
  // is the interactive path: the engine bounds its search to a window around the
  // segment, which is what keeps it inside a frame budget on a big image.
  //
  // ── ADR-024 a10 — WHY THIS AWAITS, AND WHY IT DROPS ──────────────────────
  //
  // Both reads were synchronous until v8.21, and both would have broken
  // SILENTLY behind the worker. `!tool.lasso_active()` is the sharper one: a
  // Promise is truthy, so `!Promise` is `false` and the guard stops refusing —
  // the live wire would keep drawing after the lasso had been committed or
  // canceled. `lasso_path_to`'s result went straight into `setLassoPreview`,
  // so React would have been handed a Promise to render.
  //
  // DROP-STALE, not run-exclusive. Two pointermoves can now be in flight at
  // once and the second can resolve first, which would snap the preview
  // backwards to an older cursor position. A superseded preview is worthless,
  // so the newest wins and the rest are discarded. That is only safe because
  // `lasso_path_to` is a PURE READ — `&self`, and its own doc says "does not
  // mutate the session". Dropping a MUTATION here would lose input; see
  // `usePaintTool`, where the same shape needs the opposite treatment.
  //
  // The coordinates are read BEFORE the first await, while `e` is still the
  // event this call was made for.
  const handleLassoMove = useCallback(
    async (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool || selectionKind !== "lasso") return;
      const { x, y } = getCoords(e);
      const seq = ++lassoMoveSeq.current;
      if (!(await tool.lasso_active())) return;
      const path = await tool.lasso_path_to(x, y);
      if (seq !== lassoMoveSeq.current) return; // a later move owns the preview
      setLassoPreview(path);
    },
    [stamp, getCoords, selectionKind],
  );

  // Double-click closes the loop: the engine wires the last anchor back to the
  // first, fills the enclosed region, and hands back the SAME overlay RGBA the
  // wands produce — so from here on it's just "a selection", like any other.
  const handleLassoClose = useCallback(async () => {
    const tool = stamp.toolRef.current;
    // TRUTHY TRAP — un-awaited this closes a loop that was never open.
    if (!tool || !(await tool.lasso_active())) return;
    const mask = await tool.lasso_close();
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
  const handleSelectAll = useCallback(async () => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    const mask = await tool.select_all();
    // `select_all` pushes a "Select All" step (selection.rs:481) — selections
    // are undoable, Photoshop-style. Without this the engine's undo_count moves
    // and `stamp.state.undoCount` does not, so the History panel is a step
    // short and the photo does not read as dirty. handleDeleteSelection below
    // has always done this; these two were missed, not decided.
    stamp.syncState();
    setSelectionMask(mask.length ? mask : null);
  }, [stamp]);
  const handleDeselect = useCallback(() => {
    // Also tears down an open lasso session — "deselect" that left a half-drawn
    // wire on the canvas would be a lie.
    stamp.toolRef.current?.lasso_cancel();
    stamp.toolRef.current?.clear_selection();
    // `clear_selection` pushes a "Deselect" step (selection.rs:507) — same
    // reason as handleSelectAll above.
    stamp.syncState();
    setLassoCommitted(null);
    setLassoPreview(null);
    setCombineHint(0);
    setSelectionMask(null);
  }, [stamp]);
  const handleDeleteSelection = useCallback(async () => {
    const tool = stamp.toolRef.current;
    // TRUTHY TRAP through an OPTIONAL CHAIN — the `await` has to sit outside it
    // so the no-tool case still short-circuits: `await undefined` is `undefined`,
    // which stays falsy, whereas an un-awaited Promise would flush and sync on
    // a delete that never happened.
    if (await tool?.delete_selection()) {
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
    async (cut: boolean) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      // TRUTHY TRAP — un-awaited this toasts "cut to a new layer" and syncs the
      // Layers panel for a layer the engine declined to make.
      if (await tool.selection_to_new_layer(cut)) {
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
  const handleRemoveObject = useCallback(async () => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    if (await tryRemoveObject(tool)) {
      stamp.flushToCanvas();
      stamp.syncState();
    }
    setSelectionMask(null);
  }, [stamp]);
  // Marquee drag commit: CanvasArea owns the ephemeral drag preview and calls
  // this on release with the drag's canvas-space corners + the live modifiers.
  // Same intent-resolution as a click (Shift/Alt behind `ih_selection_bool`),
  // same publish shape as every producer. The engine treats a degenerate or
  // off-canvas rect as Photoshop's empty-marquee deselect in replace mode —
  // CanvasArea's click-vs-drag threshold keeps accidental sub-pixel drags
  // from reaching here at all.
  const handleMarqueeCommit = useCallback(
    async (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      mods: { shiftKey: boolean; altKey: boolean },
    ) => {
      // NOTE FOR THE WORKER FLIP. CanvasArea's mouse-up calls this WITHOUT
      // awaiting, then immediately clears its ephemeral drag preview. Today the
      // mask lands a microtask later, so nothing is visibly missing; behind the
      // worker there is a real gap in which the preview is gone and the ants
      // have not arrived. Same for the click path, which clears the preview
      // before calling `handleSelectionClick`. If a marquee starts flickering
      // on release, that ordering is the cause — not this call.
      const tool = stamp.toolRef.current;
      if (!tool) return;
      const mode = selectionCombineMode(mods, useToolStore.getState().selectionCombine);
      tool.set_selection_combine(mode);
      setCombineHint(mode);
      // Read at commit time, not subscribed — the mode can't change mid-drag.
      // Only the two marquee modes arm a drag at all, so anything else here
      // would mean the gate upstream leaked; fall back to rect rather than
      // inventing a selection.
      const kind = useToolStore.getState().selectionKind;
      // `await` per branch, not around the ternary — see handleSelectionClick.
      const mask =
        kind === "ellipse"
          ? await tool.ellipse_select(x0, y0, x1, y1)
          : await tool.rect_select(x0, y0, x1, y1);
      setSelectionMask(mask.length ? mask : null);
    },
    [stamp, setSelectionMask],
  );
  // Move-layer toggle (Layer Settings + Ctrl+M). Switches to the Layer
  // Settings tool; Select-vs-Move exclusivity now falls out of them being
  // different tools, so there is no selection flag left to clear.
  const handleToggleMove = useCallback(() => {
    setActiveTool("arrow");
    setMoveActive((m) => !m);
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
    // Marquee drag (rect/ellipse per selectionShape) — commit on release.
    handleMarqueeCommit,
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
