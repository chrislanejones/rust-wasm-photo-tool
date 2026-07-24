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
import type { CropSelection, DrawEditState, Point } from "@/hooks/useDrawingTools";
import type { PastePlacementRect } from "@/hooks/usePastePlacementTool";
import { TEXT_OVERLAY_PAD_X, TEXT_OVERLAY_PAD_Y } from "@/hooks/useTextTool";
import {
  lockAxisDelta,
  lockCornerDelta,
  lockPointToAxis,
  lockScaleFactors,
} from "@/lib/aspectLock";
import { CompareSlider } from "./CompareSlider";
import { PenOverlay } from "./PenOverlay";
import { CanvasGuidesOverlay } from "./CanvasGuidesOverlay";
import { ImageGuidesOverlay } from "./ImageGuidesOverlay";
import { SelectionOverlay } from "./SelectionOverlay";
import { LassoOverlay } from "./LassoOverlay";
import { useGuidesStore } from "@/stores/useGuidesStore";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { gridLinesSync, ensureGridGeometry } from "@/lib/gridGeometry";
import type { GridKind } from "@/lib/preferences";
import { selectionCombineMode } from "@/lib/selectionBool";

const EMPTY_SEGMENTS = new Float32Array(0);

/** Screen-px movement below which a Select-tool press is a CLICK (fires the
 *  active kind), at or above which it's a marquee DRAG. Screen px, not canvas
 *  px, so the feel is zoom-independent. Matches the crop tool's 5px spirit. */
const MARQUEE_THRESHOLD_PX = 4;

// Data-URI SVG cursor for the rotate handle — there's no standard CSS
// rotation cursor, so we draw a small curved-arrow glyph. Falls back to
// `grab` if the browser can't decode the data-URI. Two stacked strokes
// (black outer 3.5, white inner 2.5) keep it visible against any background.
const ROTATE_CURSOR =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M21 12a9 9 0 1 1-3-6.7' stroke='black' stroke-width='3.5'/>
      <polyline points='21 4 21 12 13 12' stroke='black' stroke-width='3.5'/>
      <path d='M21 12a9 9 0 1 1-3-6.7' stroke='white' stroke-width='2.5'/>
      <polyline points='21 4 21 12 13 12' stroke='white' stroke-width='2.5'/>
    </svg>`,
  ) +
  "\") 12 12, grab";

// Crosshair-with-plus / crosshair-with-minus for the Select tool while a
// Shift (add) / Alt (subtract) modifier is held — no standard CSS cursor
// carries the intent badge, so we draw it (same data-URI approach as the
// rotate cursor above; black-under-white double stroke for contrast on any
// background). Falls back to plain `crosshair`.
const combineCursor = (badge: "plus" | "minus"): string => {
  const bar =
    "<line x1='16' y1='20' x2='22' y2='20' stroke='black' stroke-width='3.5'/>" +
    "<line x1='16' y1='20' x2='22' y2='20' stroke='white' stroke-width='2'/>";
  const cross =
    badge === "plus"
      ? bar +
        "<line x1='19' y1='17' x2='19' y2='23' stroke='black' stroke-width='3.5'/>" +
        "<line x1='19' y1='17' x2='19' y2='23' stroke='white' stroke-width='2'/>"
      : bar;
  return (
    "url(\"data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round'>
        <line x1='10' y1='2' x2='10' y2='18' stroke='black' stroke-width='3'/>
        <line x1='2' y1='10' x2='18' y2='10' stroke='black' stroke-width='3'/>
        <line x1='10' y1='2' x2='10' y2='18' stroke='white' stroke-width='1.5'/>
        <line x1='2' y1='10' x2='18' y2='10' stroke='white' stroke-width='1.5'/>
        ${cross}
      </svg>`,
    ) +
    "\") 10 10, crosshair"
  );
};
const SELECT_ADD_CURSOR = combineCursor("plus");
const SELECT_SUBTRACT_CURSOR = combineCursor("minus");

interface TextInputState {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  text: string;
  rotation: number;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
}

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
  activeTool?: string;
  textInput?: TextInputState | null;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onCanvasClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onTextKeyDown?: (e: React.KeyboardEvent) => void;
  onTextChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onTextBlur?: () => void;
  textSettings?: {
    fontSize: number;
    fontFamily?: string;
    fontWeight: string;
    textColor: string;
    /** Background-preview fields. The open textarea renders a live preview
     *  using these so the user can configure their BG before committing. */
    bgKind?: "none" | "rect" | "bubble";
    bgColor?: string;
    bgOpacity?: number;
    bgPadding?: number;
    bgCornerRadius?: number;
    /** Speech-bubble tail angle in degrees (0-359). */
    bgTail?: number;
  };
  colorPickerActive?: boolean;
  /** Select tool: canvas clicks fire the active selection kind. */
  selectionActive?: boolean;
  /** Layer Settings → Move toggle on — drives the canvas cursor. */
  layerMoveActive?: boolean;
  onSelectionClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** Select tool, click-once kinds: a DRAG sweeps a marquee instead of
   *  clicking — preview here, engine commit on release. Off for the lasso
   *  kind (its clicks are session anchors; a drag must not fight it). */
  marqueeActive?: boolean;
  /** Rect, or the ellipse inscribed in the drag rect — mirrors
   *  `useToolStore.selectionShape` for the preview outline. */
  marqueeShape?: "rect" | "ellipse";
  /** Commit the marquee: canvas-space corners + the release modifiers
   *  (Shift add / Alt subtract, flag-gated in the handler). */
  onMarqueeCommit?: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    mods: { shiftKey: boolean; altKey: boolean },
  ) => void;
  /** Canvas-sized RGBA selection overlay (from Rust), drawn over the image. */
  selectionMask?: Uint8Array | null;
  selectionWidth?: number;
  selectionHeight?: number;
  /** Magnetic lasso kind: a session may be open, so mouse-moves drive the
   *  live wire and a double-click closes the loop. */
  lassoActive?: boolean;
  onLassoMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onLassoClose?: () => void;
  /** Flat [x,y,…] image-space polylines from Rust — the frozen path and the
   *  live wire. Drawn by LassoOverlay; no geometry happens here. */
  lassoCommitted?: Int32Array | null;
  lassoPreview?: Int32Array | null;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onTextPositionChange?: (canvasX: number, canvasY: number) => void;
  onTextFontSizeChange?: (size: number) => void;
  onTextRotationChange?: (angle: number) => void;
  /** Live, non-destructive text annotations (bbox + id). The text-tool
   *  hover highlight is drawn over the one whose id matches
   *  `hoveredAnnotationId`. */
  annotations?: AnnotationBox[];
  hoveredAnnotationId?: number | null;
  /** Mousemove handler used to drive the hover highlight while the text
   *  tool is active. */
  onCanvasHover?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  cropSelection?: CropSelection | null;
  onCropChange?: (sel: CropSelection) => void;
  /** Pending paste-onto-layer placement (movable/resizable bounding box).
   *  Floats independent of `activeTool` — same pattern as `drawEditState`. */
  pastePlacementRect?: PastePlacementRect | null;
  onPastePlacementChange?: (rect: PastePlacementRect) => void;
  /** Pending shape/arrow being edited via the Figma-style overlay. */
  drawEditState?: DrawEditState | null;
  /** Overlay handle drags push new geometry (canvas coords) up through this. */
  onDrawEditChange?: (start: Point, end: Point) => void;
  /** Live stroke/shape settings — read at render so panel tweaks update the
   *  pending shape immediately (same values commitEdit reads at commit). */
  drawSettings?: {
    strokeColor: string;
    strokeWidth: number;
    arrowStyle: "single" | "double";
    shape: "rect" | "circle" | "handCircle" | "line";
    fillMode: "none" | "solid" | "gradient" | "pixelate";
    fillColor: string;
    fillColor2: string;
    gradientAngle: number;
  };
  /** Bézier pen tool (Paint → Pen sub-mode). When active, an interactive
   *  pen overlay captures the canvas; finished paths commit via onPenCommit. */
  penActive?: boolean;
  penColor?: string;
  penStrokeWidth?: number;
  /** Live Background fill for the pen preview (shares toolSettings fill). */
  penFillMode?: "none" | "solid" | "gradient" | "pixelate";
  penFillColor?: string;
  onPenCommit?: (flatPoints: number[], close: boolean) => void;
  /** Pen edit: hit-test a committed path, then load/commit/cancel a reshape. */
  onPenHitTest?: (imgX: number, imgY: number) => { id: number; points: number[] } | null;
  onPenEditStart?: (id: number) => void;
  onPenEditCommit?: (id: number, flatPoints: number[]) => void;
  onPenEditCancel?: (id: number) => void;
  /** Reselect from the Review list → open this committed path in the overlay. */
  penEditRequest?: { id: number; points: number[] } | null;
  onPenEditRequestHandled?: () => void;
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
  };
}

/**
 * Arrow geometry in canvas coords — shaft endpoints plus head triangle(s).
 * Mirrors the math in `drawArrowPreview` (useDrawingTools) and Rust's
 * `drawing::draw_arrow`, so the SVG overlay matches the committed pixels.
 */
function arrowGeometry(
  from: Point,
  to: Point,
  strokeWidth: number,
  double: boolean,
): { shaftStart: Point; shaftEnd: Point; heads: Point[][] } {
  const headLength = Math.max(20, strokeWidth * 3);
  const headWidth = Math.PI / 5;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const shaftEnd = {
    x: to.x - headLength * 0.5 * Math.cos(angle),
    y: to.y - headLength * 0.5 * Math.sin(angle),
  };
  const shaftStart = double
    ? {
        x: from.x + headLength * 0.5 * Math.cos(angle),
        y: from.y + headLength * 0.5 * Math.sin(angle),
      }
    : { x: from.x, y: from.y };
  const head = (tip: Point, a: number): Point[] => [
    tip,
    {
      x: tip.x - headLength * Math.cos(a - headWidth),
      y: tip.y - headLength * Math.sin(a - headWidth),
    },
    {
      x: tip.x - headLength * Math.cos(a + headWidth),
      y: tip.y - headLength * Math.sin(a + headWidth),
    },
  ];
  return {
    shaftStart,
    shaftEnd,
    heads: double ? [head(to, angle), head(from, angle + Math.PI)] : [head(to, angle)],
  };
}

/**
 * SVG path for the hand-drawn circle preview — a straight port of the
 * `handCircle` case in `drawShapePreview` (wobbly ellipse with a lead-in
 * tail, deterministic from the bbox coords). `toSX`/`toSY` map canvas
 * coords to screen so the path tracks zoom/pan exactly.
 */
function handCirclePath(
  from: Point,
  to: Point,
  toSX: (x: number) => number,
  toSY: (y: number) => number,
): string {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const points = 60;

  const startOffset = (from.x * 31.17 + from.y * 47.53) % (Math.PI * 2);
  const mainArc = Math.PI * 2 - Math.PI * 0.15;
  const seed = from.x * 31.17 + from.y * 47.53 + to.x * 13.91 + to.y * 67.37;

  const getNoise = (angle: number) =>
    Math.sin(angle * 2.3 + seed) * 3 +
    Math.sin(angle * 1.1 + seed * 0.7) * 2 +
    Math.cos(angle * 3.7 + seed * 1.3) * 1.5;

  const tilt = (((seed * 1000) % 1000) / 1000 - 0.5) * 0.15;

  const d: string[] = [];
  // Tail
  const tailLength = Math.PI * 0.3;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const angle = startOffset - tailLength * (1 - t);
    const noise = getNoise(angle) * t;
    const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
    const inward = (1 - t) * (rx * 0.15);
    const px = cx + (rx * squeeze - inward + noise) * Math.cos(angle + tilt);
    const py = cy + (ry / squeeze - inward + noise) * Math.sin(angle + tilt);
    d.push(`${i === 0 ? "M" : "L"}${toSX(px).toFixed(2)} ${toSY(py).toFixed(2)}`);
  }
  // Main circle
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const angle = startOffset + t * mainArc;
    const noise = getNoise(angle);
    const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
    const px = cx + (rx * squeeze + noise) * Math.cos(angle + tilt);
    const py = cy + (ry / squeeze + noise) * Math.sin(angle + tilt);
    d.push(`L${toSX(px).toFixed(2)} ${toSY(py).toFixed(2)}`);
  }
  return d.join(" ");
}

function getCursorForTool(
  tool?: string,
  isPanning?: boolean,
  colorPickerActive?: boolean,
  moveActive?: boolean,
  combineIntent?: 0 | 1 | 2,
): string | undefined {
  if (isPanning) return "grab";
  if (colorPickerActive && tool === "crop") return "crosshair";
  switch (tool) {
    case "text":
      return "text";
    case "arrow":
      // Layer Settings: Move toggle on → move cursor, otherwise default.
      if (moveActive) return "move";
      return undefined;
    case "select":
      // The gesture's intent is visible before it lands: Shift (add) and Alt
      // (subtract) badge the crosshair while held (`ih_selection_bool`; with
      // the flag off combineIntent is always 0).
      if (combineIntent === 1) return SELECT_ADD_CURSOR;
      if (combineIntent === 2) return SELECT_SUBTRACT_CURSOR;
      return "crosshair";
    case "crop":
    case "shapes":
      return "crosshair";
    default:
      return undefined;
  }
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
      activeTool,
      textInput,
      textareaRef,
      onCanvasClick,
      onTextKeyDown,
      onTextChange,
      onTextBlur,
      textSettings,
      containerRef: externalContainerRef,
      onTextPositionChange,
      onTextFontSizeChange,
      onTextRotationChange,
      annotations,
      hoveredAnnotationId,
      onCanvasHover,
      cropSelection,
      onCropChange,
      pastePlacementRect,
      onPastePlacementChange,
      colorPickerActive,
      selectionActive,
      layerMoveActive,
      onSelectionClick,
      marqueeActive,
      marqueeShape,
      onMarqueeCommit,
      selectionMask,
      selectionWidth,
      selectionHeight,
      lassoActive,
      onLassoMove,
      onLassoClose,
      lassoCommitted,
      lassoPreview,
      drawEditState,
      onDrawEditChange,
      drawSettings,
      penActive,
      penColor,
      penStrokeWidth,
      penFillMode,
      penFillColor,
      onPenCommit,
      onPenHitTest,
      onPenEditStart,
      onPenEditCommit,
      onPenEditCancel,
      penEditRequest,
      onPenEditRequestHandled,
      guides,
    },
    ref,
  ) => {
    const { onMouseDown, onMouseMove, onMouseUp, state, flushToCanvas } = hookResult;
    const canvasRef = ref as React.RefObject<HTMLCanvasElement | null>;
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = externalContainerRef ?? internalContainerRef;

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
    //   • the canvas element re-mounts (ref changes),
    //   • the WASM image dimensions change (state.width / state.height),
    //   • the surrounding container resizes (via ResizeObserver).
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
    }, [canvasRef, containerRef, flushToCanvas, state.ready, state.width, state.height]);

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
    const [combineIntent, setCombineIntent] = useState<0 | 1 | 2>(0);
    // Ref mirror so the rAF preview closure (below) and the keyboard effect
    // read the LIVE intent, not a stale render's. `setIntent` keeps both in
    // step — the state drives the cursor re-render, the ref the async reads.
    const combineIntentRef = useRef<0 | 1 | 2>(0);
    const setIntent = useCallback((next: 0 | 1 | 2) => {
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
    const selectionKind = useToolStore((s) => s.selectionKind);
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
      previewRafRef.current = requestAnimationFrame(() => {
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
        const ov = tool.selection_preview(
          pt.x,
          pt.y,
          previewKindCode,
          selectionTolerance,
          edgeThreshold,
          intent,
        );
        setPreviewMask(ov && ov.length ? ov : null);
      });
    }, [hookResult, canvasRef, previewKindCode, selectionTolerance, edgeThreshold, clearPreview]);

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

    // ── Crop handle drag ───────────────────────────────────────────────
    const cropDragRef = useRef<{
      handle: string;
      startX: number;
      startY: number;
      startSel: CropSelection;
      scaleX: number;
      scaleY: number;
    } | null>(null);

    const onCropChangeRef = useRef(onCropChange);
    useEffect(() => { onCropChangeRef.current = onCropChange; });

    useEffect(() => {
      const onMove = (e: PointerEvent) => {
        const drag = cropDragRef.current;
        if (!drag || !onCropChangeRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const { handle, startX, startY, startSel, scaleX, scaleY } = drag;
        let dx = (e.clientX - startX) / scaleX;
        let dy = (e.clientY - startY) / scaleY;
        if (e.shiftKey) {
          ({ dx, dy } = lockCornerDelta(handle, dx, dy, startSel.width, startSel.height));
        }
        let { x, y, width: w, height: h } = startSel;
        switch (handle) {
          case "nw": x += dx; y += dy; w -= dx; h -= dy; break;
          case "n":  y += dy; h -= dy; break;
          case "ne": y += dy; w += dx; h -= dy; break;
          case "e":  w += dx; break;
          case "se": w += dx; h += dy; break;
          case "s":  h += dy; break;
          case "sw": x += dx; w -= dx; h += dy; break;
          case "w":  x += dx; w -= dx; break;
        }
        const min = 10;
        w = Math.max(min, w);
        h = Math.max(min, h);
        x = Math.max(0, Math.min(x, canvas.width - min));
        y = Math.max(0, Math.min(y, canvas.height - min));
        w = Math.min(w, canvas.width - x);
        h = Math.min(h, canvas.height - y);
        onCropChangeRef.current({
          x: Math.round(x), y: Math.round(y),
          width: Math.round(w), height: Math.round(h),
        });
      };
      const onUp = () => { cropDragRef.current = null; };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }, []);

    const handleCropPointerDown = useCallback(
      (e: React.PointerEvent<SVGRectElement>, handle: string) => {
        if (!cropSelection || !canvasRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        cropDragRef.current = {
          handle,
          startX: e.clientX,
          startY: e.clientY,
          startSel: { ...cropSelection },
          scaleX: rect.width / canvas.width,
          scaleY: rect.height / canvas.height,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      [cropSelection, canvasRef],
    );

    // ── Paste-placement drag (move body + resize handles) ──────────────
    // Same window-listener pattern as the crop handles, extended with a
    // "move" mode since — unlike crop, where the selection rect overlays the
    // photo itself — a placed paste needs to be draggable by its body too.
    const pasteDragRef = useRef<{
      mode: "move" | "resize";
      handle: string; // resize: nw|n|ne|e|se|s|sw|w · move: "body"
      startX: number;
      startY: number;
      startRect: PastePlacementRect;
      scaleX: number;
      scaleY: number;
    } | null>(null);

    const onPastePlacementChangeRef = useRef(onPastePlacementChange);
    useEffect(() => {
      onPastePlacementChangeRef.current = onPastePlacementChange;
    });

    useEffect(() => {
      const onMove = (e: PointerEvent) => {
        const drag = pasteDragRef.current;
        if (!drag || !onPastePlacementChangeRef.current) return;
        const { mode, handle, startX, startY, startRect, scaleX, scaleY } = drag;
        const dx = (e.clientX - startX) / scaleX;
        const dy = (e.clientY - startY) / scaleY;
        if (mode === "move") {
          const { dx: mdx, dy: mdy } = e.shiftKey
            ? lockAxisDelta(dx, dy)
            : { dx, dy };
          onPastePlacementChangeRef.current({
            ...startRect,
            x: Math.round(startRect.x + mdx),
            y: Math.round(startRect.y + mdy),
          });
          return;
        }
        let { x, y, width: w, height: h } = startRect;
        let cdx = dx;
        let cdy = dy;
        if (e.shiftKey) {
          ({ dx: cdx, dy: cdy } = lockCornerDelta(
            handle,
            dx,
            dy,
            startRect.width,
            startRect.height,
          ));
        }
        switch (handle) {
          case "nw": x += cdx; y += cdy; w -= cdx; h -= cdy; break;
          case "n":  y += cdy; h -= cdy; break;
          case "ne": y += cdy; w += cdx; h -= cdy; break;
          case "e":  w += cdx; break;
          case "se": w += cdx; h += cdy; break;
          case "s":  h += cdy; break;
          case "sw": x += cdx; w -= cdx; h += cdy; break;
          case "w":  x += cdx; w -= cdx; break;
        }
        const min = 10;
        w = Math.max(min, w);
        h = Math.max(min, h);
        onPastePlacementChangeRef.current({
          x: Math.round(x), y: Math.round(y),
          width: Math.round(w), height: Math.round(h),
        });
      };
      const onUp = () => { pasteDragRef.current = null; };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }, []);

    const handlePastePointerDown = useCallback(
      (
        e: React.PointerEvent<SVGElement>,
        mode: "move" | "resize",
        handle: string,
      ) => {
        if (!pastePlacementRect || !canvasRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        pasteDragRef.current = {
          mode,
          handle,
          startX: e.clientX,
          startY: e.clientY,
          startRect: { ...pastePlacementRect },
          scaleX: rect.width / canvas.width,
          scaleY: rect.height / canvas.height,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      [pastePlacementRect, canvasRef],
    );

    // ── Shape/arrow edit-overlay drag ──────────────────────────────────
    // Same window-listener pattern as the crop handles. Geometry math is
    // plain JS (trivial); Rust does all pixel rendering at commit.
    const drawDragRef = useRef<{
      mode: "resize" | "move" | "endpoint";
      /** resize: nw|n|ne|e|se|s|sw|w · endpoint: start|end · move: body */
      handle: string;
      startX: number;
      startY: number;
      startGeom: { sx: number; sy: number; ex: number; ey: number };
      scaleX: number;
      scaleY: number;
    } | null>(null);

    const onDrawEditChangeRef = useRef(onDrawEditChange);
    useEffect(() => { onDrawEditChangeRef.current = onDrawEditChange; });

    useEffect(() => {
      const onMove = (e: PointerEvent) => {
        const drag = drawDragRef.current;
        const cb = onDrawEditChangeRef.current;
        if (!drag || !cb) return;
        const dx = (e.clientX - drag.startX) / drag.scaleX;
        const dy = (e.clientY - drag.startY) / drag.scaleY;
        const g = drag.startGeom;
        if (drag.mode === "move") {
          // Translate the whole geometry. Shift constrains the drag to
          // whichever axis (horizontal/vertical) is moving more.
          const { dx: mdx, dy: mdy } = e.shiftKey
            ? lockAxisDelta(dx, dy)
            : { dx, dy };
          cb({ x: g.sx + mdx, y: g.sy + mdy }, { x: g.ex + mdx, y: g.ey + mdy });
          return;
        }
        if (drag.mode === "endpoint") {
          // Re-angle a line/arrow by dragging one endpoint freely. Shift
          // snaps the resulting angle (relative to the fixed endpoint) to
          // the nearest 90° — lets an arrow go cleanly left/right/up/down.
          if (drag.handle === "start") {
            const free = { x: g.sx + dx, y: g.sy + dy };
            const p = e.shiftKey
              ? lockPointToAxis(g.ex, g.ey, free.x, free.y)
              : free;
            cb(p, { x: g.ex, y: g.ey });
          } else {
            const free = { x: g.ex + dx, y: g.ey + dy };
            const p = e.shiftKey
              ? lockPointToAxis(g.sx, g.sy, free.x, free.y)
              : free;
            cb({ x: g.sx, y: g.sy }, p);
          }
          return;
        }
        // Resize: scale both endpoints about the bbox side(s) opposite the
        // dragged handle. Corner handles scale both axes, edge handles one.
        // Degenerate axes (perfectly horizontal/vertical segments) keep
        // scale 1 — the endpoint circles re-angle those instead.
        const x0 = Math.min(g.sx, g.ex);
        const y0 = Math.min(g.sy, g.ey);
        const x1 = Math.max(g.sx, g.ex);
        const y1 = Math.max(g.sy, g.ey);
        const MIN = 2; // canvas px — don't let the bbox collapse or flip
        const h = drag.handle;
        let kx = 1;
        let ax = x0;
        if (h.includes("w")) {
          ax = x1;
          if (x1 - x0 > 0.5) kx = Math.max(MIN, x1 - (x0 + dx)) / (x1 - x0);
        } else if (h.includes("e")) {
          ax = x0;
          if (x1 - x0 > 0.5) kx = Math.max(MIN, x1 + dx - x0) / (x1 - x0);
        }
        let ky = 1;
        let ay = y0;
        if (h.includes("n")) {
          ay = y1;
          if (y1 - y0 > 0.5) ky = Math.max(MIN, y1 - (y0 + dy)) / (y1 - y0);
        } else if (h.includes("s")) {
          ay = y0;
          if (y1 - y0 > 0.5) ky = Math.max(MIN, y1 + dy - y0) / (y1 - y0);
        }
        // Shift-lock only makes sense on corner handles — edge handles leave
        // one of kx/ky at exactly 1 by construction above, and forcing it
        // toward the other would pull a single-axis drag off its own axis.
        if (e.shiftKey && h.length === 2) {
          ({ kx, ky } = lockScaleFactors(kx, ky));
        }
        cb(
          { x: ax + (g.sx - ax) * kx, y: ay + (g.sy - ay) * ky },
          { x: ax + (g.ex - ax) * kx, y: ay + (g.ey - ay) * ky },
        );
      };
      const onUp = () => { drawDragRef.current = null; };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }, []);

    const handleDrawPointerDown = useCallback(
      (
        e: React.PointerEvent<SVGElement>,
        mode: "resize" | "move" | "endpoint",
        handle: string,
      ) => {
        if (!drawEditState || !canvasRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        drawDragRef.current = {
          mode,
          handle,
          startX: e.clientX,
          startY: e.clientY,
          startGeom: {
            sx: drawEditState.start.x,
            sy: drawEditState.start.y,
            ex: drawEditState.end.x,
            ey: drawEditState.end.y,
          },
          scaleX: rect.width / canvas.width,
          scaleY: rect.height / canvas.height,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      [drawEditState, canvasRef],
    );

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
    const cursor = getCursorForTool(
      activeTool,
      isPanning,
      colorPickerActive,
      layerMoveActive,
      selectionActive ? combineIntent : 0,
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

    // Draggable image guides (read the store directly — non-destructive overlay,
    // independent of the rulers/grid pref).
    const imageGuides = useGuidesStore((s) => s.guides);
    const guidesLocked = useGuidesStore((s) => s.guidesLocked);
    const selectedGuideId = useGuidesStore((s) => s.selectedGuideId);
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
          ref={ref}
          className="main-canvas checkerboard-canvas"
          style={{
            // Item 3: Fixed zoom + pan transform
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            cursor: panCursor,
          }}
          onMouseDown={wrappedMouseDown}
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
        <CompareSlider canvasEl={canvasRef.current} />

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
                onSelect={selectGuide}
                onMove={moveGuide}
              />
            );
          })()}

        {/* Bézier pen overlay — interactive path creation (Paint → Pen). */}
        {penActive && canvasRef.current && (
          <PenOverlay
            canvasEl={canvasRef.current}
            color={penColor ?? "#ef4444"}
            strokeWidth={penStrokeWidth ?? 3}
            fillMode={penFillMode}
            fillColor={penFillColor}
            onCommit={onPenCommit ?? (() => {})}
            onHitTest={onPenHitTest}
            onEditStart={onPenEditStart}
            onEditCommit={onPenEditCommit}
            onEditCancel={onPenEditCancel}
            editRequest={penEditRequest}
            onEditRequestHandled={onPenEditRequestHandled}
          />
        )}

        {/* ── Crop overlay: dark mask + rule-of-thirds + draggable handles ── */}
        {activeTool === "crop" && cropSelection && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const r = canvas.getBoundingClientRect();
          const sx = r.width / canvas.width;
          const sy = r.height / canvas.height;
          const { x, y, width: sw, height: sh } = cropSelection;
          const vx = r.left + x * sx;
          const vy = r.top + y * sy;
          const vw = sw * sx;
          const vh = sh * sy;
          const HS = 9; // handle size in screen px

          const handles = [
            { id: "nw", hx: vx,        hy: vy,       cursor: "nw-resize" },
            { id: "n",  hx: vx+vw/2,   hy: vy,       cursor: "n-resize"  },
            { id: "ne", hx: vx+vw,     hy: vy,       cursor: "ne-resize" },
            { id: "e",  hx: vx+vw,     hy: vy+vh/2,  cursor: "e-resize"  },
            { id: "se", hx: vx+vw,     hy: vy+vh,    cursor: "se-resize" },
            { id: "s",  hx: vx+vw/2,   hy: vy+vh,    cursor: "s-resize"  },
            { id: "sw", hx: vx,        hy: vy+vh,    cursor: "sw-resize" },
            { id: "w",  hx: vx,        hy: vy+vh/2,  cursor: "w-resize"  },
          ];

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
              {/* Dark overlay — 4 rects framing the crop selection */}
              <rect x={r.left} y={r.top}   width={r.width}        height={Math.max(0, vy - r.top)}         fill="rgba(0,0,0,0.55)" />
              <rect x={r.left} y={vy + vh} width={r.width}        height={Math.max(0, r.bottom - (vy+vh))} fill="rgba(0,0,0,0.55)" />
              <rect x={r.left} y={vy}      width={Math.max(0, vx - r.left)}        height={vh} fill="rgba(0,0,0,0.55)" />
              <rect x={vx+vw}  y={vy}      width={Math.max(0, r.right - (vx+vw))}  height={vh} fill="rgba(0,0,0,0.55)" />

              {/* Dashed selection border */}
              <rect x={vx} y={vy} width={vw} height={vh}
                fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />

              {/* Rule-of-thirds guides */}
              <line x1={vx + vw/3}   y1={vy} x2={vx + vw/3}   y2={vy+vh} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
              <line x1={vx + 2*vw/3} y1={vy} x2={vx + 2*vw/3} y2={vy+vh} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
              <line x1={vx} y1={vy + vh/3}   x2={vx+vw} y2={vy + vh/3}   stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
              <line x1={vx} y1={vy + 2*vh/3} x2={vx+vw} y2={vy + 2*vh/3} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />

              {/* Resize handles */}
              {handles.map(h => (
                <rect
                  key={h.id}
                  x={h.hx - HS/2} y={h.hy - HS/2}
                  width={HS} height={HS}
                  fill="white"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1}
                  rx={1}
                  style={{ cursor: h.cursor, pointerEvents: "all" }}
                  onPointerDown={(e) => handleCropPointerDown(e, h.id)}
                />
              ))}
            </svg>
          );
        })()}

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
                    fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={2.5} strokeDasharray="5 5" />
                  <ellipse cx={vx + vw / 2} cy={vy + vh / 2} rx={vw / 2} ry={vh / 2}
                    fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />
                </>
              ) : (
                <>
                  <rect x={vx} y={vy} width={vw} height={vh}
                    fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={2.5} strokeDasharray="5 5" />
                  <rect x={vx} y={vy} width={vw} height={vh}
                    fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />
                </>
              )}
            </svg>
          );
        })()}

        {/* ── Paste-placement overlay: movable/resizable bounding box ──────
            Floats independent of `activeTool` (same pattern as the shape/arrow
            edit overlay below) — a pasted image can be adjusted no matter what
            tool is selected. No dimming mask: the pasted content itself is the
            visible thing, nothing needs to be dimmed around it. */}
        {pastePlacementRect && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const r = canvas.getBoundingClientRect();
          const sx = r.width / canvas.width;
          const sy = r.height / canvas.height;
          const { x, y, width: pw, height: ph } = pastePlacementRect;
          const vx = r.left + x * sx;
          const vy = r.top + y * sy;
          const vw = pw * sx;
          const vh = ph * sy;
          const HS = 9; // handle size in screen px

          const handles = [
            { id: "nw", hx: vx,        hy: vy,       cursor: "nw-resize" },
            { id: "n",  hx: vx+vw/2,   hy: vy,       cursor: "n-resize"  },
            { id: "ne", hx: vx+vw,     hy: vy,       cursor: "ne-resize" },
            { id: "e",  hx: vx+vw,     hy: vy+vh/2,  cursor: "e-resize"  },
            { id: "se", hx: vx+vw,     hy: vy+vh,    cursor: "se-resize" },
            { id: "s",  hx: vx+vw/2,   hy: vy+vh,    cursor: "s-resize"  },
            { id: "sw", hx: vx,        hy: vy+vh,    cursor: "sw-resize" },
            { id: "w",  hx: vx,        hy: vy+vh/2,  cursor: "w-resize"  },
          ];

          return (
            <svg
              data-paste-overlay="true"
              style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                pointerEvents: "none",
                // Was 40 (--z-panel), tied with the Gallery filmstrip — DOM
                // order let the filmstrip win the tie and swallow pointerdowns
                // on handles near the bottom edge, which the "click outside
                // commits" listener then read as a commit. 45 (--z-cursor,
                // "above canvas chrome") matches the shape/arrow overlay below.
                zIndex: 45,
                overflow: "hidden",
              }}
            >
              {/* Draggable body (move) — under the handles in z-order. */}
              <rect
                x={vx} y={vy} width={vw} height={vh}
                fill="transparent"
                stroke="white"
                strokeWidth={1.5}
                style={{ cursor: "move", pointerEvents: "all" }}
                onPointerDown={(e) => handlePastePointerDown(e, "move", "body")}
              />

              {/* Resize handles */}
              {handles.map(h => (
                <rect
                  key={h.id}
                  x={h.hx - HS/2} y={h.hy - HS/2}
                  width={HS} height={HS}
                  fill="white"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1}
                  rx={1}
                  style={{ cursor: h.cursor, pointerEvents: "all" }}
                  onPointerDown={(e) => handlePastePointerDown(e, "resize", h.id)}
                />
              ))}
            </svg>
          );
        })()}

        {/* ── Shape/arrow edit overlay: SVG preview + dashed bbox + handles ──
            Rendered while a drawn shape/arrow is pending (Figma-style edit
            box). All sizes for grab targets are in SCREEN px so handles stay
            grabbable at any zoom; geometry maps through the canvas rect like
            the crop/text overlays. The preview is clipped to the canvas box
            to match Rust's raster clipping at commit. */}
        {drawEditState && drawSettings && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const r = canvas.getBoundingClientRect();
          const sx = r.width / canvas.width;
          const sy = r.height / canvas.height;
          const toSX = (x: number) => r.left + x * sx;
          const toSY = (y: number) => r.top + y * sy;

          const { start, end, kind } = drawEditState;
          // When re-editing an existing shape, render with its own captured
          // style rather than the live toolbar settings (a new shape has no
          // `style` and reads the toolbar).
          const eff = drawEditState.style ?? drawSettings;
          const shape = kind === "arrow" ? "line" : eff.shape;
          const isSegment = kind === "arrow" || shape === "line";

          // Bounding box (canvas coords → viewport coords)
          const bx0 = Math.min(start.x, end.x);
          const by0 = Math.min(start.y, end.y);
          const bx1 = Math.max(start.x, end.x);
          const by1 = Math.max(start.y, end.y);
          const vx = toSX(bx0);
          const vy = toSY(by0);
          const vw = (bx1 - bx0) * sx;
          const vh = (by1 - by0) * sy;

          const HS = 9;   // resize-square size — screen px, zoom-independent
          const EP_R = 6; // endpoint-circle radius — screen px
          const strokeW = Math.max(1, eff.strokeWidth * sx);
          const color = eff.strokeColor;

          // Live interior-fill preview. `eff` is the shape's captured style on
          // reselect, or the live panel for a new shape — both carry fill, so
          // reselected rect/circles preview their fill too.
          const fillCfg = eff;
          let fillAttr = "none";
          let gradientDef: React.ReactNode = null;
          if (fillCfg && (shape === "rect" || shape === "circle")) {
            if (fillCfg.fillMode === "solid") {
              fillAttr = fillCfg.fillColor;
            } else if (fillCfg.fillMode === "gradient") {
              fillAttr = "url(#draw-fill-grad)";
              const ang = ((fillCfg.gradientAngle ?? 0) * Math.PI) / 180;
              const dx = 0.5 * Math.cos(ang);
              const dy = 0.5 * Math.sin(ang);
              gradientDef = (
                <defs>
                  <linearGradient
                    id="draw-fill-grad"
                    x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}
                  >
                    <stop offset="0%" stopColor={fillCfg.fillColor} />
                    <stop offset="100%" stopColor={fillCfg.fillColor2} />
                  </linearGradient>
                </defs>
              );
            } else if (fillCfg.fillMode === "pixelate") {
              // A true live mosaic isn't practical in SVG — preview a checker
              // hint; the real pixelation is applied to the pixels on commit.
              fillAttr = "url(#draw-fill-pixelate)";
              gradientDef = (
                <defs>
                  <pattern
                    id="draw-fill-pixelate"
                    width="8" height="8"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="8" height="8" fill="rgba(120,120,120,0.4)" />
                    <rect width="4" height="4" fill="rgba(40,40,40,0.5)" />
                    <rect x="4" y="4" width="4" height="4" fill="rgba(40,40,40,0.5)" />
                  </pattern>
                </defs>
              );
            }
          }

          // Move handle (line + dot above the box) — same geometry as the
          // text overlay's "balloon string".
          const STEM_GAP = 4;
          const STEM_LEN = 18;
          const DOT_OFFSET = 4;
          const DOT_R = 5;

          const handles = [
            { id: "nw", hx: vx,          hy: vy,          cursor: "nw-resize" },
            { id: "n",  hx: vx + vw / 2, hy: vy,          cursor: "n-resize"  },
            { id: "ne", hx: vx + vw,     hy: vy,          cursor: "ne-resize" },
            { id: "e",  hx: vx + vw,     hy: vy + vh / 2, cursor: "e-resize"  },
            { id: "se", hx: vx + vw,     hy: vy + vh,     cursor: "se-resize" },
            { id: "s",  hx: vx + vw / 2, hy: vy + vh,     cursor: "s-resize"  },
            { id: "sw", hx: vx,          hy: vy + vh,     cursor: "sw-resize" },
            { id: "w",  hx: vx,          hy: vy + vh / 2, cursor: "w-resize"  },
          ];

          // Geometry preview + invisible body hit-area (drag body = move).
          const bodyProps = {
            style: { cursor: "move", pointerEvents: "all" } as React.CSSProperties,
            onPointerDown: (e: React.PointerEvent<SVGElement>) =>
              handleDrawPointerDown(e, "move", "body"),
          };
          let preview: React.ReactNode;
          let bodyHit: React.ReactNode;

          if (kind === "arrow") {
            const g = arrowGeometry(
              start,
              end,
              eff.strokeWidth,
              eff.arrowStyle === "double",
            );
            preview = (
              <>
                <line
                  x1={toSX(g.shaftStart.x)} y1={toSY(g.shaftStart.y)}
                  x2={toSX(g.shaftEnd.x)}   y2={toSY(g.shaftEnd.y)}
                  stroke={color} strokeWidth={strokeW} strokeLinecap="round"
                />
                {g.heads.map((head, i) => (
                  <polygon
                    key={i}
                    points={head.map((p) => `${toSX(p.x)},${toSY(p.y)}`).join(" ")}
                    fill={color}
                  />
                ))}
              </>
            );
            bodyHit = (
              <line
                x1={toSX(start.x)} y1={toSY(start.y)}
                x2={toSX(end.x)}   y2={toSY(end.y)}
                stroke="transparent" strokeWidth={Math.max(strokeW, 14)}
                {...bodyProps}
              />
            );
          } else if (shape === "line") {
            preview = (
              <line
                x1={toSX(start.x)} y1={toSY(start.y)}
                x2={toSX(end.x)}   y2={toSY(end.y)}
                stroke={color} strokeWidth={strokeW} strokeLinecap="round"
              />
            );
            bodyHit = (
              <line
                x1={toSX(start.x)} y1={toSY(start.y)}
                x2={toSX(end.x)}   y2={toSY(end.y)}
                stroke="transparent" strokeWidth={Math.max(strokeW, 14)}
                {...bodyProps}
              />
            );
          } else if (shape === "circle") {
            // Rust parity: radius = half the SHORTER bbox dimension.
            const cr = (Math.min(bx1 - bx0, by1 - by0) / 2) * sx;
            const ccx = vx + vw / 2;
            const ccy = vy + vh / 2;
            preview = (
              <>
                {gradientDef}
                <circle cx={ccx} cy={ccy} r={cr} fill={fillAttr} stroke={color} strokeWidth={strokeW} />
              </>
            );
            bodyHit = (
              <circle cx={ccx} cy={ccy} r={Math.max(cr, 8)} fill="transparent" {...bodyProps} />
            );
          } else if (shape === "handCircle") {
            preview = (
              <path
                d={handCirclePath(start, end, toSX, toSY)}
                fill="none" stroke={color} strokeWidth={strokeW}
                strokeLinecap="round" strokeLinejoin="round"
              />
            );
            bodyHit = (
              <ellipse
                cx={vx + vw / 2} cy={vy + vh / 2}
                rx={Math.max(vw / 2, 8)} ry={Math.max(vh / 2, 8)}
                fill="transparent" {...bodyProps}
              />
            );
          } else {
            // rect
            preview = (
              <>
                {gradientDef}
                <rect
                  x={vx} y={vy} width={vw} height={vh}
                  fill={fillAttr} stroke={color} strokeWidth={strokeW} strokeLinejoin="round"
                />
              </>
            );
            bodyHit = (
              <rect x={vx} y={vy} width={vw} height={vh} fill="transparent" {...bodyProps} />
            );
          }

          return (
            <svg
              data-draw-overlay
              style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                pointerEvents: "none",
                zIndex: 45,
                overflow: "hidden",
              }}
            >
              <defs>
                <clipPath id="draw-edit-clip">
                  <rect x={r.left} y={r.top} width={r.width} height={r.height} />
                </clipPath>
              </defs>
              {/* Live preview, clipped to the canvas box */}
              <g clipPath="url(#draw-edit-clip)">{preview}</g>

              {/* Dashed bounding box */}
              <rect
                x={vx} y={vy} width={vw} height={vh}
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />

              {/* Body hit-area — drag anywhere on the shape to move it */}
              {bodyHit}

              {/* Move handle: vertical line + dot above the box (same markup
                  as the text overlay's move handle) */}
              {(() => {
                const cx = vx + vw / 2;
                const stemTop = vy - STEM_GAP;
                const stemBot = stemTop - STEM_LEN;
                const dotCy = stemBot - DOT_OFFSET;
                const filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
                return (
                  <g
                    style={{ cursor: "move", pointerEvents: "all", filter }}
                    onPointerDown={(e) => handleDrawPointerDown(e, "move", "body")}
                  >
                    {/* Invisible fat hit target for easier grabbing */}
                    <rect
                      x={cx - 8}
                      y={dotCy - DOT_R - 2}
                      width={16}
                      height={vy - (dotCy - DOT_R - 2)}
                      fill="transparent"
                    />
                    <line x1={cx} y1={stemTop} x2={cx} y2={stemBot} stroke="white" strokeWidth={2} />
                    <circle cx={cx} cy={dotCy} r={DOT_R} fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
                  </g>
                );
              })()}

              {/* Resize squares — corners scale both axes, edges one axis */}
              {handles.map((h) => (
                <rect
                  key={h.id}
                  x={h.hx - HS / 2} y={h.hy - HS / 2}
                  width={HS} height={HS}
                  fill="white"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={1}
                  rx={1}
                  style={{ cursor: h.cursor, pointerEvents: "all" }}
                  onPointerDown={(e) => handleDrawPointerDown(e, "resize", h.id)}
                />
              ))}

              {/* Endpoint circles — line/arrow only: drag to re-angle the
                  segment (the natural "rotate" for segments) */}
              {isSegment && (
                <>
                  <circle
                    cx={toSX(start.x)} cy={toSY(start.y)} r={EP_R}
                    fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1.5}
                    style={{ cursor: "crosshair", pointerEvents: "all" }}
                    onPointerDown={(e) => handleDrawPointerDown(e, "endpoint", "start")}
                  />
                  <circle
                    cx={toSX(end.x)} cy={toSY(end.y)} r={EP_R}
                    fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth={1.5}
                    style={{ cursor: "crosshair", pointerEvents: "all" }}
                    onPointerDown={(e) => handleDrawPointerDown(e, "endpoint", "end")}
                  />
                </>
              )}
            </svg>
          );
        })()}

        {/* Brush-size ring — only for the size-based brush tools (Paint/Blur/
            Eraser brush + the Effects blur brush, plus the Eraser tool's two
            canvas-brush modes: brush + Magic Eraser). Other tools (Resize/
            compress, Layer-Settings arrow, the Eraser tool's click-action
            modes, …) keep the standard default arrow, on the canvas and over
            the panels. `!cursor` still hides it while the Effects color-picker
            shows its crosshair. Hidden during pan. */}
        {cursorVisible &&
          (activeTool === "brush" ||
            activeTool === "effects" ||
            (activeTool === "ai" &&
              (eraserMode === "brush" || eraserMode === "magic"))) &&
          !cursor &&
          !isPanning && (
          <div
            className="brush-cursor"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushDiameter,
              height: brushDiameter,
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

          // Measure the text box in screen pixels
          const offscreen = document.createElement("canvas");
          const mctx = offscreen.getContext("2d")!;
          const fs = effFontSize * scaleX;
          mctx.font = `${effFontWeight} ${fs}px 'Liberation Sans', Arial, sans-serif`;
          const lines = (textInput.text || " ").split("\n");
          const rawW = Math.max(60, ...lines.map((l) => mctx.measureText(l || " ").width));
          const boxW = Math.ceil(rawW + fs * 0.6);
          const boxH = Math.ceil(lines.length * fs * 1.3 + fs * 0.3);

          const rotation = textInput.rotation ?? 0;

          // Rotation pivot. Rust bakes the tile rotating around the centre of
          // the (unrotated) text — and because its background padding is
          // uniform, the padded-tile centre coincides with the text centre too.
          // The overlay must rotate around that SAME point or committed text
          // lands off-axis from the preview. Measure the Rust tile so the pivot
          // matches exactly; fall back to the JS-measured box centre.
          let pivotLocalX = boxW / 2;
          let pivotLocalY = boxH / 2;
          const measured = hookResult.toolRef.current?.measure_text(
            textInput.text || " ",
            effFontSize,
            effFontWeight === "bold",
          );
          if (measured && measured.length >= 2 && measured[0] > 0) {
            pivotLocalX = (measured[0] * scaleX) / 2;
            pivotLocalY = (measured[1] * scaleY) / 2;
          }
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

          const handles = [
            { id: "nw", hx: sx,         hy: sy,          cursor: "nw-resize" },
            { id: "n",  hx: sx + boxW/2, hy: sy,          cursor: "n-resize"  },
            { id: "ne", hx: sx + boxW,   hy: sy,          cursor: "ne-resize" },
            { id: "e",  hx: sx + boxW,   hy: sy + boxH/2, cursor: "e-resize"  },
            { id: "se", hx: sx + boxW,   hy: sy + boxH,   cursor: "se-resize" },
            { id: "s",  hx: sx + boxW/2, hy: sy + boxH,   cursor: "s-resize"  },
            { id: "sw", hx: sx,          hy: sy + boxH,   cursor: "sw-resize" },
            { id: "w",  hx: sx,          hy: sy + boxH/2, cursor: "w-resize"  },
          ];

          // Resize handle drag — scales font size proportionally from box centre
          const handleResizePointerDown = (e: React.PointerEvent) => {
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

          // Rotate drag — orbit the handle around the box centre. We track the
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
          const inkBase = showBg
            ? hookResult.toolRef.current?.text_ink_offset(
                textInput.text || " ",
                effFontSize,
                effFontWeight === "bold",
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
          // project a ray from the rect centre at `tailAngle`° onto the rect's
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
                  fontFamily: textSettings.fontFamily ?? "'Liberation Sans', Arial, sans-serif",
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
              {/* SVG overlay — all elements grouped and rotated around box centre */}
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
                    stroke="rgba(255,255,255,0.85)"
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
                    const filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
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
                          stroke="rgba(0,0,0,0.5)"
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
                    const filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
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
                          stroke="rgba(0,0,0,0.5)"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })()}
                  {/* Resize handles */}
                  {handles.map((h) => (
                    <rect
                      key={h.id}
                      x={ctr.left + h.hx - HS / 2}
                      y={ctr.top + h.hy - HS / 2}
                      width={HS} height={HS}
                      fill="white"
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={1}
                      rx={1}
                      style={{ cursor: h.cursor, pointerEvents: "all" }}
                      onPointerDown={handleResizePointerDown}
                    />
                  ))}
                </g>
              </svg>
            </>
          );
        })()}
      </div>
    );
  },
);
