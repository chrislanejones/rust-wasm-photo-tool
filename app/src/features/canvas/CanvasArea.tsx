// ===== FILE: app/src/features/canvas/CanvasArea.tsx =====
// Item 2: Spacebar pan (Photoshop-style hand tool)
// Item 3: Alt+Scroll zoom fix (zoom transform now uses panOffset)
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useSession, useEngineState } from "@/app/session/SessionContext";
import { TEXT_OVERLAY_PAD_X, TEXT_OVERLAY_PAD_Y } from "@/hooks/useTextTool";
import { CompareSlider } from "./CompareSlider";
import { PenOverlay } from "./PenOverlay";
import { CanvasGuidesOverlay } from "./CanvasGuidesOverlay";
import { ImageGuidesOverlay } from "./ImageGuidesOverlay";
import { PerspectiveLayer } from "./PerspectiveLayer";
import { CropLayer } from "./CropLayer";
import { PastePlacementLayer } from "./PastePlacementLayer";
import { ShapeEditLayer } from "./ShapeEditLayer";
import { SelectionOverlay } from "./SelectionOverlay";
import { ObjectRemovalOverlay } from "./ObjectRemovalOverlay";
import { LassoOverlay } from "./LassoOverlay";
import { DrawPreviewOverlay } from "./DrawPreviewOverlay";
import type { OverlayFrame } from "./overlayFrame";
import {
  textInkOffset,
  primeTextMetrics,
} from "@/lib/engine/textMetricsCache";
import { faceCss } from "@/lib/engineFonts";
import { maskCursorHalo, maskCursorInk } from "@/lib/maskCursor";
import { wrapPreviewLines } from "@/lib/previewWrap";
import { useGuidesStore } from "@/stores/useGuidesStore";
import { useTextBoxStore, MIN_WRAP_WIDTH, MIN_BOX_HEIGHT } from "@/stores/useTextBoxStore";
import { useToolStore, isMarqueeKind } from "@/stores/useToolStore";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useActiveSubTool } from "@/features/tools/activateSubTool";
import { useUIStore } from "@/stores/useUIStore";
import { gridLinesSync, ensureGridGeometry } from "@/lib/gridGeometry";
import type { GridKind, RulerUnit } from "@/lib/preferences";
import { selectionCombineMode, type SelectionCombineMode } from "@/lib/selectionBool";
import { canvasSurfaceKey } from "@/lib/engine/port";
import { strokeDown, strokeUp } from "@/lib/strokeGate";
import { getCursorForSubTool, ROTATE_CURSOR } from "./canvasCursor";
import {
  MARQUEE_SHADE,
  EDIT_BOX_STROKE,
  HANDLE_OUTLINE,
  HANDLE_SHADOW,
  EMPTY_SEGMENTS,
  MARQUEE_THRESHOLD_PX,
} from "./canvasInk";

interface AnnotationBox {
  id: number;
  x: number;            // canvas-space top-left of the *rotated* tile bbox
  y: number;
  tile_w: number;
  tile_h: number;
}

interface Props {
  hookResult: ReturnType<typeof useCloneStamp>;
  brushDiameter: number;
  cursorPos: { x: number; y: number };
  cursorVisible: boolean;
  onCanvasEnter: (rect: DOMRect) => void;
  onCanvasLeave: () => void;
  onSelectionClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Commit the marquee: canvas-space corners + the release modifiers
   *  (Shift add / Alt subtract, flag-gated in the handler). */
  onMarqueeCommit?: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    mods: { shiftKey: boolean; altKey: boolean },
  ) => void;
  onLassoMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onLassoClose?: () => void;
  /** Flat [x,y,…] image-space polylines from Rust — the frozen path and the
   *  live wire. Drawn by LassoOverlay; no geometry happens here. */
  lassoCommitted?: Int32Array | null;
  lassoPreview?: Int32Array | null;
  /** Canvas resize-handle drags on an open text input. Stays a prop because
   *  it does two things — the tool's live setter AND the panel slider's
   *  store field — which is a session decision, not a tool one. */
  onTextFontSizeChange?: (size: number) => void;
  /** Mount an extra overlay inside the canvas frame without touching this file (see overlayFrame.ts). */
  renderOverlay?: (frame: OverlayFrame) => React.ReactNode;
  /** Returns the new annotation's id — `PenOverlay.finish()` needs it to keep
   *  the finished path selected.
   *
   *  ⚠️ This return type was `void` until the Stage-3.5 pen redesign, and that
   *  was the one place tsc could NOT have caught the conversion: a function
   *  returning `Promise<number>` is assignable to a slot declared `=> void`, so
   *  making `handlePenCommit` async would have typechecked here while the
   *  overlay's `typeof newId === "number"` quietly went false and stopped
   *  keeping paths selected. The id has always flowed through at runtime; only
   *  the type was lying. Keep it honest. */
  onPenCommit?: (flatPoints: number[], close: boolean) => Promise<number | void>;
  /** Pen edit: hit-test a committed path, then load/commit/cancel a reshape. */
  onPenHitTest?: (
    imgX: number,
    imgY: number,
  ) => Promise<{ id: number; points: number[] } | null>;
  onPenEditStart?: (id: number) => void;
  onPenEditCommit?: (id: number, flatPoints: number[]) => void;
  onPenEditCancel?: (id: number) => void;
  /** Canvas "Rulers & Grids" config (Settings → Rulers & Grids). Renders a
   *  non-destructive grid + pixel rulers overlay when enabled. */
  guides?: {
    rulers: boolean;
    grid: boolean;
    gridKind: GridKind;
    gridSpacing: number;
    gridCols: number;
    gridRows: number;
    gridColor: string;
    gridOpacity: number;
    rulerUnit?: RulerUnit;
  };
}

export const CanvasArea = React.forwardRef<HTMLCanvasElement, Props>(
  (
    {
      hookResult,
      brushDiameter,
      cursorPos,
      cursorVisible,
      onCanvasEnter,
      onCanvasLeave,
      onTextFontSizeChange,
      renderOverlay,
      onSelectionClick,
      onMarqueeCommit,
      onLassoMove,
      onLassoClose,
      lassoCommitted,
      lassoPreview,
      onPenCommit,
      onPenHitTest,
      onPenEditStart,
      onPenEditCommit,
      onPenEditCancel,
      guides,
    },
    ref,
  ) => {
    // Not a React Compiler opt-in: it skips components with hook-lint
    // suppressions (this has several). The overlays read the live canvas rect
    // at render, which is only correct while nothing memoizes this component.
    const { onMouseDown, onMouseMove, onMouseUp, state, flushToCanvas } = hookResult;
    const canvasRef = ref as React.RefObject<HTMLCanvasElement | null>;

    // B1 (docs/AppShell-Refactor-Plan.md): the tool hook instances and the refs
    // AppShell owns arrive through the session context instead of 23 props.
    // The names below are the ones the props had, so nothing under this line
    // changed in that commit.
    const { drawingTools, textTool, containerRef, drawPreviewRef, attachCanvas } =
      useSession();
    const {
      textInput,
      textareaRef,
      onCanvasClick,
      onTextKeyDown,
      onTextChange,
      onTextBlur,
      onCanvasHover,
      hoveredAnnotationId,
      setTextPosition: onTextPositionChange,
      setTextRotation: onTextRotationChange,
    } = textTool;
    // Crop, paste-placement and shape-edit read their own state (B4).
    const { shapes } = drawingTools;
    // The selection overlay is canvas-sized; the engine state says how big.
    const { width: selectionWidth, height: selectionHeight } = useEngineState();
    // Live text-annotation bounding boxes for the text-tool hover highlight
    // and the Perspective tool's pick list. Was computed in AppShell every
    // render; memoized here on the list it derives from.
    const annotations = useMemo<AnnotationBox[]>(
      () =>
        textTool.annotations.map((a) => ({
          id: a.id,
          x: a.x + a.tile_offset_x,
          y: a.y + a.tile_offset_y,
          tile_w: a.tile_w,
          tile_h: a.tile_h,
        })),
      [textTool.annotations],
    );

    // ADR-024 a11.1 — the canvas ref, via AppShell's identity tracker when it
    // supplies one.
    //
    // `attachCanvas` MUST come from above this component. The counter has to
    // outlive the thing it counts, and THIS COMPONENT is the thing it counts:
    // AppShell renders <CanvasArea> in both arms of its `activeTool ===
    // "emoji"` ternary, so crossing the Batch boundary unmounts one instance
    // and mounts the other. A `useRef` in here is destroyed by exactly the
    // event it exists to observe.
    //
    // That was built the wrong way round first and the browser caught it: five
    // distinct canvas elements, generation still reading 1, because each new
    // CanvasArea started a fresh counter from zero. Unit tests were green — the
    // bookkeeping was correct, its OWNER was not.
    //
    // Read from the session context above; there is no standalone fallback
    // any more — mounting CanvasArea outside <SessionProvider> throws.

    // Stroke gate close half (v8.33): the pointer coming up ANYWHERE ends the
    // stroke — tools continue drags outside the canvas via window listeners, so
    // closing on canvas mouseleave would be wrong. `strokeUp` tolerates ups
    // with no matching down (every button click on the page fires this), so
    // one unconditional listener is correct. Both CanvasArea instances mount
    // one each across the Batch boundary; depth is guarded, double-close is a
    // no-op.
    useEffect(() => {
      window.addEventListener("pointerup", strokeUp);
      return () => window.removeEventListener("pointerup", strokeUp);
    }, []);

    // ADR-024 a11.3 — read ONCE per render, used by both the <canvas> key and
    // the re-blit effect's deps. Two separate calls could in principle straddle
    // a flag flip and leave the element on one surface while the effect thinks
    // it is on the other, which is the same one-state-two-reads shape Stage 3.5
    // spent the week removing.
    const surfaceKey = canvasSurfaceKey();

    // Spacebar-pan now comes straight from the UI store — it was prop-drilled
    // from AppShell before stage 1. (Compare state is read inside CompareSlider.)
    const isPanning = useUIStore((s) => s.isPanning);
    // Eraser-tool sub-mode, for the brush-size ring below: the brush eraser
    // and Magic Eraser are canvas brushes (ring shown), rembg/inpaint are
    // click-actions (arrow kept). Read from the store — `activeTool` arrives
    // as a prop but the sub-mode never did, and threading a new prop through
    // both CanvasArea call sites for one gate would be drilling for its own
    // sake.
    const eraserMode = useToolStore((s) => s.eraserMode);
    // Layers-panel mask painting: gates the ring and the cursor exactly like
    // `eraserMode` above, and is read from the store for the same reason.
    const maskEditing = useToolStore((s) => s.maskEditing);
    // 0 = black = hides, 255 = white = reveals. The ring is painted this
    // colour while mask editing, so the cursor itself answers "what will this
    // stroke do" — the third of the three places that read `maskEditing`, and
    // like the other two it computes nothing of its own.
    const maskPaintValue = useToolStore((s) => s.maskPaintValue);
    // B2 (docs/AppShell-Refactor-Plan.md): everything below already lived in
    // a store and arrived as 17 props that AppShell derived from the same
    // stores. Read once here; the derivations are the ones AppShell did.
    const activeTool = useToolStore((s) => s.activeTool);
    const colorPickerActive = useToolStore((s) => s.colorPickerActive);
    const moveActive = useToolStore((s) => s.moveActive);
    const selectionKind = useToolStore((s) => s.selectionKind);
    const storeSelectionMask = useToolStore((s) => s.selectionMask);
    const brushMode = useToolStore((s) => s.brushMode);
    const toolSettings = useToolStore((s) => s.toolSettings);
    const penEditRequest = useAnnotationStore((s) => s.penEditRequest);
    const onPenEditRequestHandled = useAnnotationStore((s) => s.clearPenEditRequest);
    // Select is its own tool: being on it IS the armed state — one gate, no
    // sub-mode, no toggle. Move-layer stays on `arrow`.
    const selectionActive = activeTool === "select";
    const layerMoveActive = activeTool === "arrow" && moveActive;
    // Gated to the tool(s) that can actually populate this mask: the Select
    // tool, or the Magic Eraser sub-mode of the Eraser tool, whose brush paints
    // the same store field (see useMagicEraserTool). Without the second clause
    // the mask is still written during a Magic Eraser stroke, but this zeroes
    // it back out before <SelectionOverlay> ever sees it.
    const selectionMask =
      activeTool === "select" || (activeTool === "ai" && eraserMode === "magic")
        ? storeSelectionMask
        : null;
    // Drag = marquee for the two marquee modes ONLY. The click-once kinds and
    // the lasso no longer sweep one: since v7.47 the mode picks the gesture,
    // so a stray drag in Wand can't quietly produce a rectangle.
    const marqueeActive = activeTool === "select" && isMarqueeKind(selectionKind);
    const marqueeShape = isMarqueeKind(selectionKind) ? selectionKind : "rect";
    // Magnetic lasso: a session-based kind, so it gets the kind-specific gate
    // the click-once kinds don't need.
    const lassoActive = activeTool === "select" && selectionKind === "lasso";
    // Bézier pen (Paint → Pen sub-mode): the PenOverlay captures the canvas.
    const penActive = activeTool === "brush" && brushMode === "pen";
    const penColor = toolSettings.strokeColor;
    const penStrokeWidth = toolSettings.strokeWidth;
    const penFillMode = toolSettings.fillMode;
    const penFillColor = toolSettings.fillColor;
    // The open textarea renders a live preview from these, so the user can
    // configure the BG before committing. `fontFamily` is not read by the
    // overlay — the face comes from `textFontId` — it feeds the recent-text
    // chips only.
    const textSettings = useMemo(
      () => ({
        fontSize: toolSettings.fontSize,
        fontFamily: toolSettings.fontFamily,
        textFontId: toolSettings.textFontId,
        fontWeight: toolSettings.fontWeight,
        textColor: toolSettings.textColor,
        bgKind: toolSettings.bgKind,
        bgColor: toolSettings.bgColor,
        bgOpacity: toolSettings.bgOpacity,
        bgPadding: toolSettings.bgPadding,
        bgCornerRadius: toolSettings.bgCornerRadius,
        bgTail: toolSettings.bgTail,
      }),
      [toolSettings],
    );
    // The lit sub-tool drives the canvas cursor (getCursorForSubTool). Read as
    // a hook rather than threaded as a 16th prop — it changes only when the
    // sub-tool does, which already re-renders this component anyway.
    const activeSubTool = useActiveSubTool();

    // ── Rulers & Grids: grid geometry comes from Rust (gridLinesSync). Warm the
    // WASM fn once the grid is enabled, then recompute segments when the image
    // size or the grid config changes. The overlay projects these to screen. ──
    const [gridReady, setGridReady] = useState(false);
    useEffect(() => {
      if (!guides?.grid) return;
      ensureGridGeometry()
        .then(() => setGridReady(true))
        .catch(() => {});
    }, [guides?.grid]);
    const gridSegments = useMemo(() => {
      const w = state.width;
      const h = state.height;
      if (!guides?.grid || w < 1 || h < 1) return EMPTY_SEGMENTS;
      return gridLinesSync(w, h, {
        kind: guides.gridKind,
        spacing: guides.gridSpacing,
        cols: guides.gridCols,
        rows: guides.gridRows,
      });
      // gridReady forces a recompute once WASM finishes loading.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      guides?.grid,
      guides?.gridKind,
      guides?.gridSpacing,
      guides?.gridCols,
      guides?.gridRows,
      state.width,
      state.height,
      gridReady,
    ]);

    // ── Canvas-rect refresh ────────────────────────────────────────────────
    // The canvas-space overlays below (rulers/grid + draggable H/V guides)
    // project from `canvasRef.current.getBoundingClientRect()`, read inline
    // during render. That's correct as long as SOMETHING re-renders whenever
    // the canvas moves/resizes — zoom and pan do (they're state). But switching
    // to/from the Batch Image Editor re-parents the canvas from the full-size
    // host to a small grid cell (or back) WITHOUT any state change here, so no
    // re-render fires and the overlay keeps drawing against the stale rect:
    //   • entering batch  → a guide flashes across the FULL canvas, then a
    //     later unrelated render finally moves it (looks like flash-then-vanish);
    //   • leaving batch   → the guide takes "a while" to snap back to the right
    //     place (until some other render happens).
    // Fix: force a re-render right after the layout settles so the overlay
    // re-reads a fresh rect. The `useLayoutEffect` runs post-DOM-commit,
    // pre-paint, so the STALE rect is never painted (kills the flash); the
    // ResizeObserver below covers any animated/async settling.
    const [, refreshCanvasRect] = useReducer((n: number) => n + 1, 0);
    useLayoutEffect(() => {
      // state.width/height are the WASM image dims — the same values imgW/imgH
      // derive from further down — so they already cover a dimension change.
      refreshCanvasRect();
    }, [activeTool, state.width, state.height]);

    // ── Redraw bridge ──────────────────────────────────────────────────────
    // The <canvas> DOM element gets re-created whenever the surrounding tool
    // wrapper changes (e.g. switching activeTool between Batch Image Editor's
    // grid host and the full-size host). A fresh canvas has default 300×150
    // dimensions and an empty bitmap — WASM still holds the pixels but they
    // need to be re-blitted. Likewise, if the container resizes and something
    // mutates canvas.width/.height as a side-effect, the bitmap is cleared.
    // This effect re-flushes the WASM buffer to the canvas whenever:
    //   • THIS COMPONENT mounts — which is what a canvas remount actually is,
    //   • the WASM image dimensions change (state.width / state.height),
    //   • the surrounding container resizes (via ResizeObserver).
    //
    // ⚠️ The first line used to read "the canvas element re-mounts (ref
    // changes)". Corrected 2026-08-09: `canvasRef` is a `useRef` created once
    // in AppShell:253, and a ref OBJECT's identity never changes, so listing it
    // in the dep array below cannot fire on a remount. The recovery works for a
    // different reason — AppShell renders <CanvasArea> in both arms of its
    // `activeTool === "emoji"` ternary, so crossing the Batch boundary unmounts
    // this component and mounts a new one, and a fresh effect flushes on mount.
    //
    // Measured against the v7.90 production build: ordinary tool switches
    // (compress → brush → crop → magic-wand) keep the SAME element; entering
    // and leaving Batch produced three distinct elements, none blank.
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      if (!state.ready || state.width === 0 || state.height === 0) return;

      // Initial blit — covers fresh canvas mount and dimension changes.
      flushToCanvas();

      // Re-blit whenever the container resizes. flushToCanvas is a no-op when
      // canvas dimensions already match WASM state, so this is cheap. Also
      // refresh the overlay rect so guides track the canvas as it resizes.
      const ro = new ResizeObserver(() => {
        flushToCanvas();
        refreshCanvasRect();
      });
      ro.observe(container);
      return () => ro.disconnect();
      // ADR-024 a11.3 — `surfaceKey` is in the deps, and it is load-bearing.
      //
      // Keying the <canvas> remounts the ELEMENT but not this COMPONENT, so
      // none of the effects here re-run on their own. Every other dep is
      // unchanged across a flag flip, and `canvasRef` is a stable ref object
      // that cannot signal anything. Without this entry the flip produced a
      // fresh, empty canvas that nothing ever painted — measured: generation
      // advanced 1 -> 2 and the element went blank. That is the exact silent
      // blank the whole of a11 exists to prevent, arriving early by a
      // different route.
    }, [canvasRef, containerRef, flushToCanvas, state.ready, state.width, state.height, surfaceKey]);

    // Item 2: Pan offset state
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const [isDraggingPan, setIsDraggingPan] = useState(false);

    // ── The main canvas's LAYOUT size (CSS px, pre-transform) ────────────────
    // `.main-canvas` is CSS-fit-scaled (max-width/max-height), so its layout
    // box is NOT the image's natural size on any photo bigger than the
    // viewport. Overlays that ride the same pan/zoom transform (Selection
    // marker, lasso wire) must base their CSS size on THIS box — hard-coding
    // the natural size drew the marching ants 2-3× too large on big photos
    // (the "selection is twice the size of the object" bug). A ResizeObserver
    // tracks it through window resizes, sidebar toggles, and image swaps.
    const [canvasCss, setCanvasCss] = useState<{ w: number; h: number } | null>(
      null,
    );
    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const measure = () =>
        setCanvasCss((prev) => {
          const w = c.clientWidth;
          const h = c.clientHeight;
          return prev && prev.w === w && prev.h === h ? prev : { w, h };
        });
      const ro = new ResizeObserver(measure);
      ro.observe(c);
      measure();
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Select tool: marquee drag (rect/ellipse) ─────────────────────────────
    // The drag start in canvas coords (x,y) + screen coords (sx,sy — for the
    // click-vs-drag threshold, which must be zoom-independent). The preview
    // rect is canvas-space; the engine commit happens in useSelectionActions.
    const marqueeStartRef = useRef<{
      x: number;
      y: number;
      sx: number;
      sy: number;
    } | null>(null);
    const [marqueeRect, setMarqueeRect] = useState<{
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    } | null>(null);
    // A drag past the threshold must swallow the click the browser fires
    // after its mouseup, or the marquee would immediately be replaced by a
    // wand selection at the release point.
    const suppressSelectionClickRef = useRef(false);
    // Live Shift/Alt intent while the Select tool hovers — drives the +/−
    // cursor badge. Always 0 when the `ih_selection_bool` kill switch is set
    // (selectionCombineMode reads the switch itself).
    const [combineIntent, setCombineIntent] = useState<SelectionCombineMode>(0);
    // Ref mirror so the rAF preview closure (below) and the keyboard effect
    // read the LIVE intent, not a stale render's. `setIntent` keeps both in
    // step — the state drives the cursor re-render, the ref the async reads.
    const combineIntentRef = useRef<SelectionCombineMode>(0);
    const setIntent = useCallback((next: SelectionCombineMode) => {
      combineIntentRef.current = next;
      setCombineIntent((cur) => (cur === next ? cur : next));
    }, []);

    // ── Hover preview: the "possible future region" a click WOULD grab ────────
    // While the Select tool hovers with a modifier held (Shift=add/green,
    // Alt=subtract/red), the region the current kind would select from the
    // pixel under the cursor is previewed live — computed in the engine
    // (`selection_preview`, non-committing) and blitted through a second
    // overlay. rAF-coalesced so at most one flood runs per frame, and skipped
    // when the cursor hasn't crossed into a new pixel. Perception only; a
    // click commits and the real ants replace it.
    const [previewMask, setPreviewMask] = useState<Uint8Array | null>(null);
    const previewRafRef = useRef<number | null>(null);
    const previewPixelRef = useRef<number>(-1);
    const lastHoverRef = useRef<{ x: number; y: number } | null>(null);
    const selectionTolerance = useToolStore((s) => s.selectionTolerance);
    const edgeThreshold = useToolStore((s) => s.edgeThreshold);
    // Kind → engine code. Only the click-once kinds preview on hover; the
    // lasso is anchor-based and the marquee is a drag (previewed separately).
    const PREVIEW_KIND: Record<string, number> = {
      wand: 0,
      edge: 1,
      colorRange: 2,
    };
    const previewKindCode =
      selectionKind in PREVIEW_KIND ? PREVIEW_KIND[selectionKind] : null;

    const clearPreview = useCallback(() => {
      if (previewRafRef.current != null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
      previewPixelRef.current = -1;
      setPreviewMask((m) => (m === null ? m : null));
    }, []);

    // Compute the preview for the last-hovered pixel, coalesced to one per
    // frame. Reads intent/kind/params at fire time so a mid-flight modifier
    // change is honoured. Bails when there's nothing to show (no modifier, no
    // kind, off-canvas, or mid-drag) — leaving any previous preview cleared.
    const schedulePreview = useCallback(() => {
      if (previewRafRef.current != null) return;
      previewRafRef.current = requestAnimationFrame(async () => {
        previewRafRef.current = null;
        const pt = lastHoverRef.current;
        const tool = hookResult.toolRef.current;
        const canvas = canvasRef.current;
        const intent = combineIntentRef.current;
        if (
          !pt ||
          !tool ||
          !canvas ||
          intent === 0 ||
          previewKindCode == null ||
          marqueeStartRef.current !== null
        ) {
          return;
        }
        const px = Math.round(pt.x);
        const py = Math.round(pt.y);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) {
          clearPreview();
          return;
        }
        const pixel = py * canvas.width + px;
        if (pixel === previewPixelRef.current) return; // same pixel — no rework
        previewPixelRef.current = pixel;
        // ADR-024 a10 — awaited, and drop-stale via the pixel it was issued
        // for. `previewPixelRef` was already the coalescing key; re-reading it
        // AFTER the await turns it into the staleness check for free. Without
        // it, two previews in flight can resolve out of order and paint the
        // older cursor position over the newer one. A pure read, so discarding
        // the loser costs nothing.
        const issuedFor = pixel;
        const ov = await tool.selection_preview(
          pt.x,
          pt.y,
          previewKindCode,
          selectionTolerance,
          edgeThreshold,
          intent,
        );
        if (previewPixelRef.current !== issuedFor) return; // superseded
        setPreviewMask(ov && ov.length ? ov : null);
      });
    }, [hookResult, canvasRef, previewKindCode, selectionTolerance, edgeThreshold, clearPreview]);

    // ADR-024 b1 — PRIME THE TEXT-METRICS CACHE OFF THE RENDER PATH.
    //
    // The text overlay below lays itself out from the canvas 2D context and
    // `textInkOffset`, during render, where nothing can `await`. Those two read
    // the cache and take a documented fallback on a miss (the JS-measured box).
    // This effect is what turns that miss into a one-frame event instead of a
    // permanent state: it fills the cache for the text being laid out, then
    // bumps `metricsTick` so exactly one more render runs and reads the warm
    // entry.
    //
    // THE BUMP IS THE WHOLE POINT. Priming without re-rendering leaves the
    // fallback on screen forever — correct-looking, permanent, and
    // indistinguishable from working software. `primeTextMetrics` returns
    // whether it actually filled anything, so a warm cache costs no render.
    const [metricsTick, setMetricsTick] = useState(0);
    const primeText = textInput?.text || " ";
    const primeFontSize = textInput ? (textInput.fontSize ?? textSettings?.fontSize) : undefined;
    const primeBold =
      textInput ? (textInput.fontWeight ?? textSettings?.fontWeight) === "bold" : false;
    // Part of every key this fills — see `textMetricsCache.fontKey`.
    const primeFontId = textSettings?.textFontId ?? "";
    useEffect(() => {
      if (!textInput || primeFontSize === undefined) return;
      const tool = hookResult.toolRef.current;
      if (!tool) return;
      let cancelled = false;
      void (async () => {
        const filled = await primeTextMetrics(
          tool,
          primeText,
          primeFontSize,
          primeBold,
          primeFontId,
        );
        if (!cancelled && filled) setMetricsTick((t) => t + 1);
      })();
      return () => {
        cancelled = true;
      };
      // `metricsTick` is deliberately NOT a dependency — it is the effect's own
      // output, and depending on it would re-prime forever. (No
      // eslint-disable needed: the rule agrees, because the setter form of
      // `setMetricsTick` reads no state.)
    }, [textInput, primeText, primeFontSize, primeBold, primeFontId, hookResult]);
    // Read once so the layout below re-runs after a prime; the value is unused.
    void metricsTick;

    // Modifier pressed/released WITHOUT moving the mouse: keep the intent,
    // cursor badge and hover preview live off keydown/keyup while the Select
    // tool is active (a hold-Shift over a stationary cursor should light the
    // zone; a release should clear it).
    useEffect(() => {
      if (!selectionActive) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Shift" && e.key !== "Alt") return;
        const intent = selectionCombineMode({
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        });
        setIntent(intent);
        if (intent !== 0 && previewKindCode != null && lastHoverRef.current) {
          schedulePreview();
        } else {
          clearPreview();
        }
      };
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);
      return () => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
      };
    }, [selectionActive, previewKindCode, setIntent, schedulePreview, clearPreview]);

    // Leaving the Select tool, or switching to a kind with no hover preview
    // (the lasso), drops any live zone and resets the intent so a stale
    // green/red highlight can't linger.
    useEffect(() => {
      if (!selectionActive || previewKindCode == null) {
        clearPreview();
        setIntent(0);
      }
    }, [selectionActive, previewKindCode, clearPreview, setIntent]);

    // Drop any pending frame on unmount.
    useEffect(
      () => () => {
        if (previewRafRef.current != null) {
          cancelAnimationFrame(previewRafRef.current);
        }
      },
      [],
    );

    const handlePanMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
          e.preventDefault();
          e.stopPropagation();
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: panOffset.x,
            oy: panOffset.y,
          };
          setIsDraggingPan(true);
          return;
        }
      },
      [isPanning, panOffset],
    );

    const handlePanMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDraggingPan && panStartRef.current) {
          const dx = e.clientX - panStartRef.current.x;
          const dy = e.clientY - panStartRef.current.y;
          setPanOffset({
            x: panStartRef.current.ox + dx,
            y: panStartRef.current.oy + dy,
          });
          return;
        }
      },
      [isDraggingPan],
    );

    const handlePanMouseUp = useCallback(() => {
      if (isDraggingPan) {
        setIsDraggingPan(false);
        panStartRef.current = null;
      }
    }, [isDraggingPan]);




    let markerStyle: React.CSSProperties | null = null;
    if (state.sourcePos && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      markerStyle = {
        left: rect.left + state.sourcePos.x * (rect.width / canvas.width),
        top: rect.top + state.sourcePos.y * (rect.height / canvas.height),
      };
    }

    const zoom = state.zoom;
    const isTextTool = activeTool === "text";
    const cursor = getCursorForSubTool(
      activeSubTool,
      isPanning,
      colorPickerActive,
      layerMoveActive,
      selectionActive ? combineIntent : 0,
      maskEditing,
    );
    const panCursor = isDraggingPan ? "grabbing" : cursor;

    // The one canvas-coords conversion this component does (same math as the
    // session hook's getCoords — a screen point in the element's box mapped
    // through the canvas's intrinsic size, so zoom/fit scaling cancels out).
    const toCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * c.width) / r.width,
        y: ((e.clientY - r.top) * c.height) / r.height,
      };
    };

    // Combined mouse handlers — pan takes priority when spacebar is held
    const baseMouseDown = isPanning ? handlePanMouseDown : onMouseDown;
    // Marquee arm: remember where a Select-tool drag might start. Not yet a
    // drag — the threshold check on mousemove decides — so the click path
    // stays live for sub-threshold presses.
    const wrappedMouseDown =
      marqueeActive && !isPanning
        ? (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (e.button === 0) {
              const p = toCanvasPoint(e);
              if (p)
                marqueeStartRef.current = {
                  ...p,
                  sx: e.clientX,
                  sy: e.clientY,
                };
            }
            baseMouseDown?.(e);
          }
        : baseMouseDown;
    // Stroke gate (v8.33): tell autosave ink may be flowing. Opens here — the
    // one place every tool's press passes through — and closes on WINDOW
    // pointerup (effect above), because tools keep strokes alive outside the
    // canvas. Signed-in autosave's 29.5 MB `capture_state` queueing ahead of
    // `paint_move` behind the worker port is why this exists; `lib/strokeGate`
    // has the measurements.
    const gatedMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      strokeDown();
      wrappedMouseDown?.(e);
    };
    const baseMouseMove = isPanning ? handlePanMouseMove : onMouseMove;
    // Text-tool hover highlight runs alongside the regular mousemove.
    const hoverMouseMove = isTextTool
      ? (e: React.MouseEvent<HTMLCanvasElement>) => {
          baseMouseMove?.(e);
          onCanvasHover?.(e);
        }
      : baseMouseMove;
    // Magnetic lasso: while a session is open the wire chases the cursor, so it
    // rides alongside whatever mousemove is already in play (and never while
    // panning — spacebar still wins).
    const lassoMouseMove =
      lassoActive && !isPanning
        ? (e: React.MouseEvent<HTMLCanvasElement>) => {
            hoverMouseMove?.(e);
            onLassoMove?.(e);
          }
        : hoverMouseMove;
    // Select tool: track the live Shift/Alt intent for the cursor badge, and
    // grow the marquee preview once the drag clears the threshold (screen px,
    // so it means the same thing at every zoom).
    const wrappedMouseMove =
      selectionActive && !isPanning
        ? (e: React.MouseEvent<HTMLCanvasElement>) => {
            lassoMouseMove?.(e);
            const intent = selectionCombineMode(e);
            setIntent(intent);
            const start = marqueeStartRef.current;
            if (start && marqueeActive) {
              const moved = Math.hypot(e.clientX - start.sx, e.clientY - start.sy);
              if (marqueeRect || moved > MARQUEE_THRESHOLD_PX) {
                const p = toCanvasPoint(e);
                if (p)
                  setMarqueeRect({ x0: start.x, y0: start.y, x1: p.x, y1: p.y });
              }
            } else {
              // Not dragging: track the hover point and preview the future
              // region under the cursor (only while a modifier is held and the
              // kind is a click-once one — schedulePreview bails otherwise).
              const p = toCanvasPoint(e);
              lastHoverRef.current = p;
              if (intent !== 0 && previewKindCode != null && p) {
                schedulePreview();
              } else {
                clearPreview();
              }
            }
          }
        : lassoMouseMove;
    const baseMouseUp = isPanning ? handlePanMouseUp : onMouseUp;
    // Marquee commit on release; the click that follows is swallowed (see the
    // suppress ref). A sub-threshold press never set marqueeRect, so it falls
    // through to the click path untouched.
    const wrappedMouseUp =
      marqueeActive && !isPanning
        ? (e: React.MouseEvent<HTMLCanvasElement>) => {
            const started = marqueeStartRef.current !== null;
            marqueeStartRef.current = null;
            if (started && marqueeRect) {
              suppressSelectionClickRef.current = true;
              onMarqueeCommit?.(
                marqueeRect.x0,
                marqueeRect.y0,
                marqueeRect.x1,
                marqueeRect.y1,
                { shiftKey: e.shiftKey, altKey: e.altKey },
              );
              setMarqueeRect(null);
            }
            clearPreview(); // the commit becomes the real ants
            baseMouseUp?.();
          }
        : baseMouseUp;
    // Leaving the canvas mid-drag cancels the marquee (no commit) — matching
    // how a crop drag dies at the edge rather than committing a guess — and
    // drops any hover preview so the zone doesn't hang off-canvas.
    const wrappedMouseLeave = () => {
      marqueeStartRef.current = null;
      if (marqueeRect) setMarqueeRect(null);
      clearPreview();
      baseMouseUp?.();
    };

    const { width: imgW, height: imgH } = hookResult.state;
    const overlayFrame: OverlayFrame = { width: imgW, height: imgH, cssWidth: canvasCss?.w, cssHeight: canvasCss?.h, panOffset, zoom };

    // Draggable image guides (read the store directly — non-destructive overlay,
    // independent of the rulers/grid pref).
    const imageGuides = useGuidesStore((s) => s.guides);
    const guidesLocked = useGuidesStore((s) => s.guidesLocked);
    const selectedGuideId = useGuidesStore((s) => s.selectedGuideId);
    // ── Perspective tool ────────────────────────────────────────────────
    // All three sub-tools (Distort / Perspective / Skew) resolve to the one
    // `perspective` ToolType, so this stays a single check. Everything else
    // about the tool — its hook, its quad, its action bar — lives in
    // PerspectiveLayer; see the note at the top of that file for why it is not
    // forty more lines in here.
    const perspectiveActive = activeTool === "perspective";

    const textWrapWidth = useTextBoxStore((s) => s.wrapWidth);
    const setTextWrapWidth = useTextBoxStore((s) => s.setWrapWidth);
    const textBoxHeight = useTextBoxStore((s) => s.boxHeight);
    const setTextBoxHeight = useTextBoxStore((s) => s.setBoxHeight);
    const guideColor = useGuidesStore((s) => s.guideColor);
    const selectGuide = useGuidesStore((s) => s.selectGuide);
    const moveGuide = useGuidesStore((s) => s.moveGuide);

    return (
      <div
        className="canvas-wrapper"
        ref={containerRef as React.RefObject<HTMLDivElement>}
      >
        {/* Transparency checkerboard — `.checkerboard-canvas` on the canvas
            ELEMENT itself, so transparent pixels (PNG alpha, eraser strokes, a
            "transparent" artboard backing) read as "empty" instead of black.
            This used to be a separate backdrop div sized to `imgW`×`imgH`
            document pixels — but `.main-canvas` is CSS-fit-scaled (max-width/
            max-height) while the div was not, so on any document larger than
            the viewport the two desynced: the checkerboard stuck out past the
            image on one side ("two canvases") and vanished from behind the
            artboard border on the other ("the Canvas is gone" after a reload).
            As the element's own background it shares every scaling mechanism —
            CSS fit, zoom transform, pan — by construction. */}
        <canvas
          // ADR-024 a11.3 — keyed on the engine mode so flipping
          // `ih_engine_worker` mid-session REMOUNTS this element.
          //
          // After `transferControlToOffscreen()` a canvas can never return its
          // 2D context, so a flip that kept the same element would strand the
          // user on a surface nothing can draw to. A remount sidesteps that: the
          // new node was never transferred. Losing the bitmap is already normal
          // — the engine owns the pixels and the effect above re-blits on mount.
          //
          // ⚠️ The remount is the ELEMENT half only. The ENGINE does not follow
          // a mid-session flip — `toolRef.current` still holds what
          // `createLiveEngine` built at load — so `ih_engine_worker` takes
          // effect on the NEXT LOAD, not immediately. `port.ts` has the measured
          // detail; the short version is that believing otherwise took the whole
          // app down until v8.30.
          //
          // The token comes from `port.ts`, not from the flag. A component
          // reading `engineWorkerEnabled()` would be a call site branching on
          // the flag, which `engineAsyncMigration.contract.test.ts` forbids;
          // this is an opaque identity string that says nothing about
          // behavior. Its value is stable for any tab that never touches the
          // flag, so ordinary use sees the same reconciliation as before.
          key={surfaceKey}
          ref={attachCanvas}
          className="main-canvas checkerboard-canvas"
          style={{
            // Item 3: Fixed zoom + pan transform
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            cursor: panCursor,
          }}
          onMouseDown={gatedMouseDown}
          onMouseMove={wrappedMouseMove}
          onMouseUp={wrappedMouseUp}
          onMouseLeave={wrappedMouseLeave}
          onClick={
            isTextTool
              ? onCanvasClick
              : selectionActive
                ? (e) => {
                    // A completed marquee drag fires a click on release —
                    // swallow exactly that one so it can't wand-select over
                    // the fresh marquee.
                    if (suppressSelectionClickRef.current) {
                      suppressSelectionClickRef.current = false;
                      return;
                    }
                    clearPreview(); // the click's result becomes the real ants
                    onSelectionClick?.(e);
                  }
                : undefined
          }
          // Double-click closes the lasso loop. Only bound while a session is
          // actually open, so a stray double-click anywhere else behaves exactly
          // as it always has.
          onDoubleClick={lassoActive ? onLassoClose : undefined}
          onMouseEnter={(e) =>
            onCanvasEnter(e.currentTarget.getBoundingClientRect())
          }
          onMouseOut={onCanvasLeave}
        />
        {/* ── Arrow / shapes / crop rubber band ────────────────────────────
            Transparent sibling at image resolution. The preview used to be
            drawn straight onto the main canvas via getImageData/putImageData,
            which made this hook a second writer to the engine's own output
            surface — see ADR-024 "Stage 4's real scope". Nothing in React
            draws on the main canvas now. */}
        {renderOverlay?.(overlayFrame)}
        {imgW > 0 && imgH > 0 && (
          <DrawPreviewOverlay ref={drawPreviewRef} {...overlayFrame} />
        )}

        <CompareSlider canvasEl={canvasRef.current} toolRef={hookResult.toolRef} revision={hookResult.state.undoCount} />

        {/* ── Magnetic lasso: the frozen path + the live wire (both from Rust) ── */}
        {(lassoCommitted || lassoPreview) && (
          <LassoOverlay
            committed={lassoCommitted ?? null}
            preview={lassoPreview ?? null}
            width={imgW}
            height={imgH}
            cssWidth={canvasCss?.w}
            cssHeight={canvasCss?.h}
            panOffset={panOffset}
            zoom={zoom}
          />
        )}

        {/* ── Hover preview: the "possible future region" (tinted, from Rust) ──
            Rendered BEFORE the committed ants so the real selection paints on
            top of the green/red zone. Same blit path as the ants; the engine
            already tinted it. Perception only — cleared on click/leave. */}
        {previewMask && previewMask.length > 0 && selectionActive && (
          <SelectionOverlay
            mask={previewMask}
            width={imgW}
            height={imgH}
            cssWidth={canvasCss?.w}
            cssHeight={canvasCss?.h}
            panOffset={panOffset}
            zoom={zoom}
          />
        )}

        {/* ── Selection Marker overlay (marching-ants marker, computed in Rust) ── */}
        {selectionMask &&
          selectionMask.length > 0 &&
          !!selectionWidth &&
          !!selectionHeight && (
            <SelectionOverlay
              mask={selectionMask}
              width={selectionWidth}
              height={selectionHeight}
              cssWidth={canvasCss?.w}
              cssHeight={canvasCss?.h}
              panOffset={panOffset}
              zoom={zoom}
            />
          )}

        {/* AI Object Removal's mask brush — self-gated on the tool store (it is
            the one overlay here that TAKES the pointer, so it must not linger,
            and this file is line-capped). */}
        <ObjectRemovalOverlay {...overlayFrame} />

        {/* ── Rulers & Grids overlay (non-destructive; grid geometry from Rust) ── */}
        {guides &&
          (guides.grid || guides.rulers) &&
          canvasRef.current &&
          imgW > 0 &&
          imgH > 0 &&
          (() => {
            const canvas = canvasRef.current!;
            const r = canvas.getBoundingClientRect();
            return (
              <CanvasGuidesOverlay
                rect={r}
                sx={r.width / canvas.width}
                sy={r.height / canvas.height}
                imgW={imgW}
                imgH={imgH}
                guides={{
                  rulers: guides.rulers,
                  grid: guides.grid,
                  gridColor: guides.gridColor,
                  gridOpacity: guides.gridOpacity,
                  rulerUnit: guides.rulerUnit,
                }}
                gridSegments={guides.grid ? gridSegments : EMPTY_SEGMENTS}
              />
            );
          })()}

        {/* ── Draggable image guides overlay (independent of the rulers pref) ── */}
        {imageGuides.length > 0 &&
          canvasRef.current &&
          imgW > 0 &&
          imgH > 0 &&
          (() => {
            const canvas = canvasRef.current!;
            const r = canvas.getBoundingClientRect();
            return (
              <ImageGuidesOverlay
                rect={r}
                sx={r.width / canvas.width}
                sy={r.height / canvas.height}
                imgW={imgW}
                imgH={imgH}
                guides={imageGuides}
                locked={guidesLocked}
                selectedId={selectedGuideId}
                color={guideColor}
                onSelect={selectGuide}
                onMove={moveGuide}
              />
            );
          })()}

        {/* ── Perspective quad, handles and actions ──────────────────────── */}
        {perspectiveActive && canvasRef.current && (
          <PerspectiveLayer
            toolRef={hookResult.toolRef}
            canvasEl={canvasRef.current}
            syncState={hookResult.syncState}
            flushToCanvas={hookResult.flushToCanvas}
            imgW={imgW}
            imgH={imgH}
            annotations={annotations}
            shapes={shapes}
            activeLayerId={hookResult.state.activeLayerId}
          />
        )}

        {/* Bézier pen overlay — interactive path creation (Paint → Pen). */}
        {penActive && canvasRef.current && (
          <PenOverlay
            canvasEl={canvasRef.current}
            color={penColor ?? "#ef4444"}
            strokeWidth={penStrokeWidth ?? 3}
            fillMode={penFillMode}
            fillColor={penFillColor}
            onCommit={onPenCommit ?? (async () => {})}
            onHitTest={onPenHitTest}
            onEditStart={onPenEditStart}
            onEditCommit={onPenEditCommit}
            onEditCancel={onPenEditCancel}
            editRequest={penEditRequest}
            onEditRequestHandled={onPenEditRequestHandled}
          />
        )}

        <CropLayer />


        {/* ── Marquee drag preview (Select tool) ───────────────────────────
            The live outline of the drag before it commits — same fixed-SVG
            idiom as the crop overlay above, minus mask/thirds/handles (this
            is a gesture echo, not an editable region; the committed result is
            the engine's marching-ants overlay). Dashed white-over-black
            double stroke so it reads on any image. */}
        {marqueeRect && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const r = canvas.getBoundingClientRect();
          const sx = r.width / canvas.width;
          const sy = r.height / canvas.height;
          const vx = r.left + Math.min(marqueeRect.x0, marqueeRect.x1) * sx;
          const vy = r.top + Math.min(marqueeRect.y0, marqueeRect.y1) * sy;
          const vw = Math.abs(marqueeRect.x1 - marqueeRect.x0) * sx;
          const vh = Math.abs(marqueeRect.y1 - marqueeRect.y0) * sy;

          return (
            <svg
              style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                pointerEvents: "none",
                zIndex: 40,
                overflow: "hidden",
              }}
            >
              {marqueeShape === "ellipse" ? (
                <>
                  <ellipse cx={vx + vw / 2} cy={vy + vh / 2} rx={vw / 2} ry={vh / 2}
                    fill="none" stroke={MARQUEE_SHADE} strokeWidth={2.5} strokeDasharray="5 5" />
                  <ellipse cx={vx + vw / 2} cy={vy + vh / 2} rx={vw / 2} ry={vh / 2}
                    fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />
                </>
              ) : (
                <>
                  <rect x={vx} y={vy} width={vw} height={vh}
                    fill="none" stroke={MARQUEE_SHADE} strokeWidth={2.5} strokeDasharray="5 5" />
                  <rect x={vx} y={vy} width={vw} height={vh}
                    fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />
                </>
              )}
            </svg>
          );
        })()}

        <PastePlacementLayer />


        <ShapeEditLayer />

        {/* Brush-size ring — only for the size-based brush tools: Paint's four
            brushes, and the Eraser tool's two canvas-brush modes (brush + Magic
            Eraser). Everything else keeps the standard arrow, on the canvas and
            over the panels. `!cursor` still hides it while a sub-tool declares
            its own cursor (the Effects color-picker's crosshair). Hidden during
            pan.

            ⚠️ `activeTool === "effects"` was removed 2026-08-18: it dated from
            when the blur brush lived in the Effects panel, and that brush moved
            into Paint. What was left under `effects` is Levels — Enhance ›
            Adjustments — which has NO canvas gesture at all: `useEffectiveTool`
            returns `idle` for the WHOLE Enhance group, and the registry gives
            none of its tiles a cursor. So the ring was promising a brush that
            could not paint. The ring and the dispatch are two views of one
            fact, exactly like `LiveSubTool.cursor`; if a tool idles, it gets
            the arrow.

            The `ai` clause STAYS: those two modes are the Create-side eraser
            painting a real mask onto the canvas, sharing the `ai` tool id with
            the Enhance › AI tile that only clicks. `eraserMode` is what tells
            them apart.

            `maskEditing` joins them (09-24): the Layers panel's mask brush
            paints from the `arrow` tool, so the ring must show there too —
            sized by AppShell's `effectiveBrushSize` from `maskBrushSize`. */}
        {cursorVisible &&
          (activeTool === "brush" ||
            maskEditing ||
            (activeTool === "ai" &&
              (eraserMode === "brush" || eraserMode === "magic"))) &&
          !cursor &&
          !isPanning && (
          <div
            className={`brush-cursor${maskEditing ? " brush-cursor--mask" : ""}`}
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushDiameter,
              height: brushDiameter,
              ...(maskEditing
                ? ({
                    "--mask-cursor-ink": maskCursorInk(maskPaintValue),
                    "--mask-cursor-halo": maskCursorHalo(maskPaintValue),
                  } as React.CSSProperties)
                : null),
            }}
          />
        )}

        {/* Source marker */}
        {markerStyle && (
          <div
            className="source-marker"
            style={{
              position: "fixed",
              ...markerStyle,
              width: 12,
              height: 12,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              // z-index comes from the .source-marker class (var(--z-cursor)) so
              // the clone-stamp crosshair stays below dialogs / idle / welcome.
            }}
          />
        )}

        {/* Live annotation hover highlight (text-tool only) */}
        {isTextTool &&
          annotations &&
          annotations.length > 0 &&
          hoveredAnnotationId !== null &&
          hoveredAnnotationId !== undefined &&
          canvasRef.current && (() => {
            const canvas = canvasRef.current!;
            const ann = annotations.find((a) => a.id === hoveredAnnotationId);
            if (!ann) return null;
            const r = canvas.getBoundingClientRect();
            const sX = r.width / canvas.width;
            const sY = r.height / canvas.height;
            const left = r.left + ann.x * sX;
            const top = r.top + ann.y * sY;
            const w = ann.tile_w * sX;
            const h = ann.tile_h * sY;
            return (
              <div
                style={{
                  position: "fixed",
                  left,
                  top,
                  width: w,
                  height: h,
                  outline: "2px dashed rgba(255,136,0,0.95)",
                  outlineOffset: -1,
                  pointerEvents: "none",
                  zIndex: 49,
                }}
              />
            );
          })()}

        {/* Text input overlay — draggable body, textarea, line+dot move/rotate handles */}
        {textInput && textSettings && canvasRef.current && containerRef.current && (() => {
          const canvas = canvasRef.current!;
          const container = containerRef.current!;
          const cr = canvas.getBoundingClientRect();
          const ctr = container.getBoundingClientRect();
          const scaleX = cr.width / canvas.width;
          const scaleY = cr.height / canvas.height;

          // Screen-space position of the text anchor (top-left of text box)
          const sx = cr.left - ctr.left + textInput.canvasX * scaleX;
          const sy = cr.top - ctr.top + textInput.canvasY * scaleY;

          // Style snapshot: prefer the input's own style (re-edit may use a
          // different style than the current toolbar settings).
          const effFontSize = textInput.fontSize ?? textSettings.fontSize;
          const effFontWeight = textInput.fontWeight ?? textSettings.fontWeight;
          const effTextColor = textInput.textColor ?? textSettings.textColor;
          // ⚠️ ONE FACE FOR ALL THREE SURFACES — the measuring 2D context
          // below, the textarea, and the engine. Never hardcode a family into
          // either consumer again; `engineFonts.ts` has the measurements.
          const effFontId = textSettings.textFontId ?? "";
          const effFontCss = faceCss(effFontId);

          // Measure the text box in screen pixels
          const offscreen = document.createElement("canvas");
          const mctx = offscreen.getContext("2d")!;
          const fs = effFontSize * scaleX;
          mctx.font = `${effFontWeight} ${fs}px ${effFontCss}`;
          // v8.40 — the preview breaks lines where the ENGINE will. See
          // `wrapPreviewLines`, which mirrors `src/text.rs::wrap`; the font it
          // measures with is `effFontCss` above, which is the same face.
          const wrapContentW =
            textWrapWidth > 0
              ? textWrapWidth * scaleX - 2 * Math.ceil(effFontSize * 0.25) * scaleX
              : 0;
          const lines = wrapPreviewLines(textInput.text || " ", wrapContentW, (t) =>
            mctx.measureText(t).width,
          );
          const rawW = Math.max(60, ...lines.map((l) => mctx.measureText(l || " ").width));
          // A wrapped box is the width the user DRAGGED, not the width of the
          // longest line — otherwise the box would snap inwards to the text
          // the moment they let go, and the handle would feel broken.
          const boxW =
            textWrapWidth > 0 ? Math.ceil(textWrapWidth * scaleX) : Math.ceil(rawW + fs * 0.6);
          // The height the TEXT needs. v8.41 makes this a floor rather than
          // the answer: a dragged box height overrides it when it is taller,
          // mirroring the engine, where `box_height` is a minimum and the type
          // is centered in whatever surplus there is (`text::box_top_inset`).
          const naturalH = Math.ceil(lines.length * fs * 1.3 + fs * 0.3);
          const boxH = Math.max(naturalH, Math.ceil(textBoxHeight * scaleY));

          const rotation = textInput.rotation ?? 0;

          // Rotation pivot — the box's TOP-LEFT, matching `text::rotated_tile_offset`
          // in the engine (ADR-050). The overlay must rotate about the SAME point
          // the commit does or the preview and the committed pixels disagree,
          // which is a worse defect than the drift this fixed.
          //
          // ⚠️ MATCHED PAIR. If `rotated_tile_offset` ever changes anchor, this
          // must change with it; `scripts/guardrails.sh` enforces that the two
          // files move together.
          //
          // This used to be the tile CENTER, measured out of the engine through
          // `measureText` so the two agreed. That read is gone with it — the
          // top-left is (0, 0) in the box's own frame, so nothing needs
          // measuring. It was one of the two RENDER-PASS engine reads the
          // Stage 3.5 note calls unconvertible (a render pass cannot await);
          // there is now one.
          const pivotLocalX = 0;
          const pivotLocalY = 0;
          // Transform-origin for the box body + textarea (relative to their
          // shared top-left at sx,sy).
          const boxTransformOrigin = `${pivotLocalX}px ${pivotLocalY}px`;
          // Pivot in viewport coords — the fixed SVG handle group rotates around
          // this, and the rotate/resize drags orbit/scale around it.
          const bcx = ctr.left + sx + pivotLocalX;
          const bcy = ctr.top + sy + pivotLocalY;

          const HS = 9; // resize handle size px
          // Line+dot handle geometry (screen px, unrotated frame). The handle
          // is drawn inside the rotated <g>, so it visually tracks the box.
          const STEM_GAP = 4;     // gap between textarea edge and start of stem
          const STEM_LEN = 18;    // length of straight stem
          const DOT_OFFSET = 4;   // distance from stem end to dot center
          const DOT_R = 5;
          // Rotate-handle arc (sits between bottom edge and stem)
          const ARC_GAP = 4;
          const ARC_R = 6;

          // ── v8.37 — ONE handle changes the font size, and it is not a corner.
          //
          // Until now EIGHT box handles (corners + edges) all ran the same
          // drag: proportional font scaling from the box center. Chris's
          // report: "corners need to be reserved for changing the size of the
          // bounding box, not the font size inside the box." The dedicated
          // font-size affordance is the square-on-a-stem on the LEFT edge
          // below (square = resize, circle = move/rotate — the overlay's
          // existing handle language).
          //
          // The corner/edge squares are REMOVED, not re-purposed, because
          // today there is NO box to resize: `boxW`/`boxH` are DERIVED from
          // the measured text every render, text wraps only at manual
          // newlines, and no wrap width exists anywhere in the model. Making
          // corners resize a real box means reflow, and reflow needs a stored
          // wrap width — a persisted-format change to the text annotation
          // (TextParams + the annotation encode in ops.rs + everything in
          // IndexedDB that holds one), i.e. an ADR plus the dexie-migration
          // procedure, not a handler swap. Filed in PARKING_LOT with the two
          // candidate designs. Until that lands, a rendered corner handle
          // would promise a behavior the model cannot express — so none is
          // rendered, and the dashed border alone delineates the derived box.

          // Font-size handle drag — scales font size proportionally with the
          // pointer's distance from the box center (the same feel the old
          // eight handles had, now living on exactly one handle).
          const handleFontSizePointerDown = (e: React.PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const startFs = effFontSize;
            const startDist = Math.hypot(e.clientX - bcx, e.clientY - bcy);

            const onMove = (me: PointerEvent) => {
              const dist = Math.hypot(me.clientX - bcx, me.clientY - bcy);
              if (startDist > 4) {
                const newFs = Math.round(Math.max(8, Math.min(120, startFs * (dist / startDist))));
                onTextFontSizeChange?.(newFs);
              }
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          // ── v8.40/v8.41 — the SIX box handles: they resize the BOX, not the type.
          //
          // Chris, for long-winded writers: corners make the bounding box
          // bigger and the text REFLOWS inside it at the same font size. Six
          // because six is how he pictures it — "6 pockets like a pool table",
          // 4 corners plus the two side pockets.
          //
          // v8.40 shipped them as WIDTH-ONLY, with a comment arguing that a
          // height would be a handle that does nothing because the line count
          // is derived from wrapping. The first half was right and the
          // conclusion was wrong: height cannot drive reflow, but it can drive
          // LAYOUT. v8.41 gave the engine a real `box_height` (a minimum, with
          // the text centered in the surplus and the background growing to it),
          // so dragging up and down now means something all the way through to
          // the committed pixels. Chris's report was simply "not just left and
          // right".
          //
          // Which handle moves which axis:
          //   • the four corners  → BOTH, one axis per pointer direction
          //   • W and E (the side pockets) → width only
          // No height-only handle exists, and that is the honest cost of six:
          // the corners are how you set a height. Adding N/S would make eight,
          // and eight is not what was asked for.
          //
          // A handle on the LEFT or TOP grows the box away from the anchor, so
          // the anchor has to move with it — otherwise grabbing the top-left
          // corner would silently drag the text down-right across the canvas.
          // Both compensations run off the SAME start values, so a corner drag
          // is exactly its two edge drags at once with no interaction between
          // them.
          const handleBoxResizePointerDown = (
            e: React.PointerEvent,
            side: "e" | "w",
            // null on the two side pockets: they set width and leave the
            // height alone, which is what makes them the odd two out.
            vSide: "n" | "s" | null,
          ) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            // An unwrapped/unboxed axis starts from whatever it currently
            // measures, so the first drag continues from the box the user can
            // see rather than jumping to some default.
            const startW = textWrapWidth > 0 ? textWrapWidth : boxW / (scaleX || 1);
            const startH = textBoxHeight > 0 ? textBoxHeight : boxH / (scaleY || 1);
            const startCx = textInput.canvasX;
            const startCy = textInput.canvasY;
            const onMove = (me: PointerEvent) => {
              const dx = (me.clientX - startX) / (scaleX || 1);
              const dy = (me.clientY - startY) / (scaleY || 1);
              const nextW = Math.max(MIN_WRAP_WIDTH, side === "e" ? startW + dx : startW - dx);
              setTextWrapWidth(nextW);
              const nextH =
                vSide === null
                  ? startH
                  : Math.max(MIN_BOX_HEIGHT, vSide === "s" ? startH + dy : startH - dy);
              if (vSide !== null) setTextBoxHeight(nextH);
              // One position update carrying both compensations — two calls
              // would make the second overwrite the first's axis with the
              // stale `textInput` value it captured.
              const nx = side === "w" ? startCx + (startW - nextW) : startCx;
              const ny = vSide === "n" ? startCy + (startH - nextH) : startCy;
              if (nx !== startCx || ny !== startCy) onTextPositionChange?.(nx, ny);
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          // Move drag — translates the text box
          const handleBoxPointerDown = (e: React.PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startCx = textInput.canvasX;
            const startCy = textInput.canvasY;

            const onMove = (me: PointerEvent) => {
              const dx = (me.clientX - startX) / scaleX;
              const dy = (me.clientY - startY) / scaleY;
              onTextPositionChange?.(startCx + dx, startCy + dy);
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          // Move drag — separate from box-body drag so chevron has its own
          // grab handle (cursor-grab feedback even outside the textarea).
          const handleMoveChevronPointerDown = (e: React.PointerEvent<SVGElement>) => {
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const startX = e.clientX;
            const startY = e.clientY;
            const startCx = textInput.canvasX;
            const startCy = textInput.canvasY;
            const onMove = (me: PointerEvent) => {
              const dx = (me.clientX - startX) / scaleX;
              const dy = (me.clientY - startY) / scaleY;
              onTextPositionChange?.(startCx + dx, startCy + dy);
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          // Rotate drag — orbit the handle around the box center. We track the
          // ANGULAR DELTA from where the user grabbed (not the absolute mouse
          // angle): the handle rests below the box, so reading the absolute
          // angle snapped the text ~180° the instant it was grabbed. Starting
          // from the current rotation and adding the delta keeps the grab
          // point stationary and rotation continuous.
          const handleRotatePointerDown = (e: React.PointerEvent<SVGElement>) => {
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const startRotation = textInput.rotation ?? 0;
            const grabAngle =
              Math.atan2(e.clientX - bcx, -(e.clientY - bcy)) * (180 / Math.PI);

            const onMove = (me: PointerEvent) => {
              const a =
                Math.atan2(me.clientX - bcx, -(me.clientY - bcy)) * (180 / Math.PI);
              let next = startRotation + (a - grabAngle);
              // Normalise to (-180, 180] so the committed value stays small.
              while (next > 180) next -= 360;
              while (next <= -180) next += 360;
              onTextRotationChange?.(Math.round(next));
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          // Live BG preview behind the textarea. Mirrors the Rust geometry
          // in `build_annotation_tile` so what the user sees here matches
          // what gets committed. Tail sizes match TAIL_LEN/TAIL_HALF.
          const bgKind = textSettings.bgKind ?? "none";
          const bgPad = Math.max(0, Math.round(textSettings.bgPadding ?? 0)) * scaleX;
          const bgRadius =
            Math.max(0, Math.round(textSettings.bgCornerRadius ?? 0)) * scaleX;
          const bgOpacity01 =
            Math.max(0, Math.min(100, textSettings.bgOpacity ?? 100)) / 100;
          const bgColorRaw = textSettings.bgColor ?? "#ffffff";
          const tailLen = 46 * scaleX;
          const tailHalf = 16 * scaleX;
          // Render the BG only when the toolbar has a non-"none" choice AND
          // the textarea has actual dimensions to wrap.
          const showBg = bgKind !== "none" && boxW > 0 && boxH > 0;

          // Tail angle in degrees (0-359), or null for rect / no background.
          const tailAngle =
            bgKind === "bubble" ? (textSettings.bgTail ?? 135) : null;
          // Uniform margin on all sides so the tail fits at any angle — mirrors
          // the Rust `build_annotation_tile` tail_margin.
          const tailMargin = tailAngle !== null ? tailLen + tailHalf : 0;
          // Engine-true rect anchor: the committed background rect is baked
          // (ink inset + bg_padding) up-left of the first line's glyph ink,
          // and the overlay's ink sits at the textarea content box (sx + CSS
          // pad). Anchor the preview rect THERE — not at the textarea border
          // — so the box doesn't jump when the ink-anchored commit lands
          // (commitText stores (x,y) = overlay + cssPad − text_ink_offset_bg;
          // this is the same geometry projected back onto the preview).
          // Cached, for the same reason as the pivot above: render position.
          // The `: sx - bgPad` branches below are the miss fallback.
          const inkBase = showBg
            ? textInkOffset(
                hookResult.toolRef.current,
                textInput.text || " ",
                effFontSize,
                effFontWeight === "bold",
                effFontId,
              )
            : undefined;
          const rectLeft = inkBase
            ? sx + TEXT_OVERLAY_PAD_X - (inkBase[0] * scaleX + bgPad)
            : sx - bgPad;
          const rectTop = inkBase
            ? sy + TEXT_OVERLAY_PAD_Y - (inkBase[1] * scaleY + bgPad)
            : sy - bgPad;

          const bgLeft = rectLeft - tailMargin;
          const bgTop = rectTop - tailMargin;
          const bgW = boxW + (bgPad + tailMargin) * 2;
          const bgH = boxH + (bgPad + tailMargin) * 2;

          // Triangle tail rendered as an SVG inside the rotated wrapper so it
          // tracks the textarea's orientation. Geometry matches the Rust path:
          // project a ray from the rect center at `tailAngle`° onto the rect's
          // bounding edge; that exit point is the base, apex sits tailLen past.
          const tailSvg = (() => {
            if (tailAngle === null) return null;
            const rectX0 = tailMargin;
            const rectY0 = tailMargin;
            const rectX1 = rectX0 + boxW + bgPad * 2;
            const rectY1 = rectY0 + boxH + bgPad * 2;
            const cx = (rectX0 + rectX1) / 2;
            const cy = (rectY0 + rectY1) / 2;
            const hw = (rectX1 - rectX0) / 2;
            const hh = (rectY1 - rectY0) / 2;
            const theta = (tailAngle * Math.PI) / 180;
            const dx = Math.cos(theta);
            const dy = Math.sin(theta);
            const tx = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity;
            const ty = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity;
            const t = Math.min(tx, ty);
            const ex = cx + dx * t;
            const ey = cy + dy * t;
            // Base runs ALONG the exit edge (not perpendicular to the ray) so
            // both corners stay flush; clamped off the rounded corners and sunk
            // into the body. Mirrors the Rust tail geometry exactly.
            const overlap = 4 * scaleX;
            const radEff = Math.min(bgRadius, Math.min(hw, hh));
            let p1: [number, number];
            let p2: [number, number];
            let p3: [number, number];
            if (tx <= ty) {
              const lo = rectY0 + radEff + tailHalf;
              const hi = rectY1 - radEff - tailHalf;
              const yc = lo <= hi ? Math.max(lo, Math.min(hi, ey)) : cy;
              const bx = ex + (dx >= 0 ? -overlap : overlap);
              p1 = [bx, yc - tailHalf];
              p2 = [bx, yc + tailHalf];
              p3 = [ex + dx * tailLen, yc + dy * tailLen];
            } else {
              const lo = rectX0 + radEff + tailHalf;
              const hi = rectX1 - radEff - tailHalf;
              const xc = lo <= hi ? Math.max(lo, Math.min(hi, ex)) : cx;
              const by = ey + (dy >= 0 ? -overlap : overlap);
              p1 = [xc - tailHalf, by];
              p2 = [xc + tailHalf, by];
              p3 = [xc + dx * tailLen, ey + dy * tailLen];
            }
            return (
              <svg
                width={bgW}
                height={bgH}
                style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
              >
                <polygon
                  points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`}
                  fill={bgColorRaw}
                />
              </svg>
            );
          })();

          return (
            <>
              {/* Background preview — sits behind the textarea, rotates with it */}
              {showBg && (
                <div
                  data-text-overlay
                  style={{
                    position: "absolute",
                    left: bgLeft,
                    top: bgTop,
                    width: bgW,
                    height: bgH,
                    pointerEvents: "none",
                    zIndex: 49,
                    // Opacity on the wrapper (not the children) so the tail can
                    // overlap the body without the join darkening — mirrors the
                    // single composite of the Rust coverage mask.
                    opacity: bgOpacity01,
                    transform: `rotate(${rotation}deg)`,
                    // Same pivot as the text, expressed relative to the BG
                    // wrapper's own top-left (which sits (sx−bgLeft, sy−bgTop)
                    // up-left of the textarea anchor).
                    transformOrigin: `${pivotLocalX + (sx - bgLeft)}px ${pivotLocalY + (sy - bgTop)}px`,
                  }}
                >
                  {/* The rounded rect itself — inset by the uniform tail margin.
                      Corner radius applies to both Text BG and Bubble; a large
                      "circle" value is clamped to a pill by the browser. */}
                  <div
                    style={{
                      position: "absolute",
                      left: tailMargin,
                      top: tailMargin,
                      width: boxW + bgPad * 2,
                      height: boxH + bgPad * 2,
                      backgroundColor: bgColorRaw,
                      borderRadius: bgRadius,
                    }}
                  />
                  {tailSvg}
                </div>
              )}
              {/* Draggable box body */}
              <div
                data-text-overlay
                style={{
                  position: "absolute",
                  left: sx,
                  top: sy,
                  width: boxW,
                  height: boxH,
                  cursor: "move",
                  zIndex: 50,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: boxTransformOrigin,
                }}
                onPointerDown={handleBoxPointerDown}
              />
              {/* Textarea — rotates visually to match */}
              <textarea
                data-text-overlay
                ref={textareaRef}
                value={textInput.text}
                onChange={onTextChange}
                onKeyDown={onTextKeyDown}
                onBlur={onTextBlur}
                placeholder="Type text…"
                style={{
                  position: "absolute",
                  left: sx,
                  top: sy,
                  width: boxW,
                  minHeight: boxH,
                  fontSize: fs,
                  fontWeight: effFontWeight,
                  color: effTextColor,
                  // THE FACE THE ENGINE WILL COMMIT. Same expression the box
                  // was measured with, and the same bytes the engine was given
                  // — so these glyphs ARE the committed glyphs (v8.76).
                  fontFamily: effFontCss,
                  lineHeight: 1.3,
                  padding: `${TEXT_OVERLAY_PAD_Y}px ${TEXT_OVERLAY_PAD_X}px`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  overflow: "hidden",
                  zIndex: 51,
                  cursor: "text",
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: boxTransformOrigin,
                }}
                autoFocus
              />
              {/* SVG overlay — all elements grouped and rotated around box center */}
              <svg
                data-text-overlay
                style={{
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100vh",
                  pointerEvents: "none",
                  zIndex: 52,
                  overflow: "hidden",
                }}
              >
                <g transform={`rotate(${rotation}, ${bcx}, ${bcy})`}>
                  {/* Dashed border */}
                  <rect
                    x={ctr.left + sx} y={ctr.top + sy}
                    width={boxW} height={boxH}
                    fill="none"
                    stroke={EDIT_BOX_STROKE}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                  />
                  {/* Move handle: vertical line + dot ("balloon string") above the textarea */}
                  {(() => {
                    const cx = ctr.left + sx + boxW / 2;
                    const topEdge = ctr.top + sy;
                    const stemTop = topEdge - STEM_GAP;
                    const stemBot = stemTop - STEM_LEN;
                    const dotCy = stemBot - DOT_OFFSET;
                    const filter = HANDLE_SHADOW;
                    return (
                      <g
                        style={{ cursor: "move", pointerEvents: "all", filter }}
                        onPointerDown={handleMoveChevronPointerDown}
                      >
                        {/* Invisible fat hit target for easier grabbing */}
                        <rect
                          x={cx - 8}
                          y={dotCy - DOT_R - 2}
                          width={16}
                          height={topEdge - (dotCy - DOT_R - 2)}
                          fill="transparent"
                        />
                        <line
                          x1={cx}
                          y1={stemTop}
                          x2={cx}
                          y2={stemBot}
                          stroke="white"
                          strokeWidth={2}
                        />
                        <circle
                          cx={cx}
                          cy={dotCy}
                          r={DOT_R}
                          fill="white"
                          stroke={HANDLE_OUTLINE}
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })()}
                  {/* Rotate handle: arc + line + dot ("hook") below the textarea */}
                  {(() => {
                    const cx = ctr.left + sx + boxW / 2;
                    const bottomEdge = ctr.top + sy + boxH;
                    const arcTop = bottomEdge + ARC_GAP;
                    // Arc spans from (cx-ARC_R, arcTop) to (cx+ARC_R, arcTop),
                    // curving downward by ARC_R.
                    const arcBottomY = arcTop + ARC_R;
                    const stemTop = arcBottomY;
                    const stemBot = stemTop + STEM_LEN - ARC_R;
                    const dotCy = stemBot + DOT_OFFSET;
                    const filter = HANDLE_SHADOW;
                    const arcD = `M ${cx - ARC_R} ${arcTop} A ${ARC_R} ${ARC_R} 0 1 0 ${cx + ARC_R} ${arcTop}`;
                    return (
                      <g
                        style={{ cursor: ROTATE_CURSOR, pointerEvents: "all", filter }}
                        onPointerDown={handleRotatePointerDown}
                      >
                        {/* Invisible fat hit target */}
                        <rect
                          x={cx - 10}
                          y={bottomEdge}
                          width={20}
                          height={dotCy + DOT_R + 2 - bottomEdge}
                          fill="transparent"
                        />
                        <path
                          d={arcD}
                          stroke="white"
                          strokeWidth={2}
                          fill="none"
                        />
                        <line
                          x1={cx}
                          y1={stemTop}
                          x2={cx}
                          y2={stemBot}
                          stroke="white"
                          strokeWidth={2}
                        />
                        <circle
                          cx={cx}
                          cy={dotCy}
                          r={DOT_R}
                          fill="white"
                          stroke={HANDLE_OUTLINE}
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })()}
                  {/* The six BOX handles — on the border, so they read as
                      "grab the box" against the font handle floating out on
                      its stem. The corners' diagonal cursors are now literally
                      true: since v8.41 a corner drag really does move both
                      axes. The two side pockets stay `ew-resize` because they
                      really are width-only. */}
                  {[
                    { id: "nw", x: sx, y: sy, side: "w" as const, v: "n" as const, cursor: "nwse-resize" },
                    { id: "ne", x: sx + boxW, y: sy, side: "e" as const, v: "n" as const, cursor: "nesw-resize" },
                    { id: "w", x: sx, y: sy + boxH / 2, side: "w" as const, v: null, cursor: "ew-resize" },
                    { id: "e", x: sx + boxW, y: sy + boxH / 2, side: "e" as const, v: null, cursor: "ew-resize" },
                    { id: "sw", x: sx, y: sy + boxH, side: "w" as const, v: "s" as const, cursor: "nesw-resize" },
                    { id: "se", x: sx + boxW, y: sy + boxH, side: "e" as const, v: "s" as const, cursor: "nwse-resize" },
                  ].map((h) => (
                    <rect
                      key={h.id}
                      x={ctr.left + h.x - HS / 2}
                      y={ctr.top + h.y - HS / 2}
                      width={HS}
                      height={HS}
                      fill="white"
                      stroke={HANDLE_OUTLINE}
                      strokeWidth={1}
                      rx={1}
                      style={{ cursor: h.cursor, pointerEvents: "all" }}
                      onPointerDown={(e) => handleBoxResizePointerDown(e, h.side, h.v)}
                    />
                  ))}
                  {/* Font-size handle: horizontal stem + SQUARE on the LEFT edge.
                      Square = resize, circle = move/rotate — see the v8.37
                      comment at handleFontSizePointerDown for why this is the
                      only size handle and the corners render nothing. */}
                  {(() => {
                    const leftEdge = ctr.left + sx;
                    const midY = ctr.top + sy + boxH / 2;
                    const stemRight = leftEdge - STEM_GAP;
                    const stemLeft = stemRight - STEM_LEN;
                    const sqCx = stemLeft - DOT_OFFSET;
                    const filter = HANDLE_SHADOW;
                    return (
                      <g
                        style={{ cursor: "ew-resize", pointerEvents: "all", filter }}
                        onPointerDown={handleFontSizePointerDown}
                      >
                        {/* Invisible fat hit target */}
                        <rect
                          x={sqCx - HS / 2 - 2}
                          y={midY - 8}
                          width={leftEdge - (sqCx - HS / 2 - 2)}
                          height={16}
                          fill="transparent"
                        />
                        <line
                          x1={stemRight}
                          y1={midY}
                          x2={stemLeft}
                          y2={midY}
                          stroke="white"
                          strokeWidth={2}
                        />
                        <rect
                          x={sqCx - HS / 2}
                          y={midY - HS / 2}
                          width={HS}
                          height={HS}
                          fill="white"
                          stroke={HANDLE_OUTLINE}
                          strokeWidth={1}
                          rx={1}
                        />
                      </g>
                    );
                  })()}
                </g>
              </svg>
            </>
          );
        })()}
      </div>
    );
  },
);
