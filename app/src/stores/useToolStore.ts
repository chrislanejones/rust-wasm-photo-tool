// Tool store: the active tool plus every tool-mode flag and settings blob that
// AppShell threads down into the sidebar, settings panels, and canvas hooks.
//
// Replaces the corresponding `useState`s in AppShell (see Grok's /zustand
// blueprint). Setters take React's `value | (prev => next)` arg via SetArg so
// existing functional-updater call sites (e.g. `setMoveActive((m) => !m)`,
// `setToolSettings((p) => ({ ...p, brushSize }))`) migrate untouched.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { SMART_BRUSH_DEFAULT_STRENGTH } from "@/lib/smartEdge";
import { resolveSet, validated, type SetArg } from "./_shared";
import { idbStorage } from "./storage/idbStorage";

/** Paint sub-modes (Paint tool): freehand paint, blur brush, Bézier pen, or
 *  the eraser (scrubs the active layer's alpha). */
export const BRUSH_MODES = ["paint", "blur", "pen", "erase"] as const;
export type BrushMode = (typeof BRUSH_MODES)[number];
/** Stamp tool sub-modes. */
export const STAMP_SUB_MODES = ["clone", "red", "emojis"] as const;
export type StampSubMode = (typeof STAMP_SUB_MODES)[number];
/** Shapes tool sub-modes. */
export const SHAPES_MODES = ["shapes", "pens", "arrows"] as const;
export type ShapesMode = (typeof SHAPES_MODES)[number];
/** Eraser tool (id "ai") sub-modes: `brush` = drag-to-erase on the canvas;
 *  `magic` = local Magic Eraser (PatchMatch); `rembg` = Background Removal and
 *  `inpaint` = Object Removal (both Replicate-backed). Lifted out of
 *  AISettings.tsx local state so the selected mode is visible to canvas
 *  routing (useEffectiveTool) — the prerequisite for Magic Eraser to receive
 *  paint strokes. Routing still sends "ai" straight to the brush eraser
 *  today; the magic branch lands with the canvas-interaction wiring.
 *  Named `ERASER_MODE_VALUES` (not `ERASER_MODES`) — AISettings.tsx already
 *  has a richer `ERASER_MODES` (icon/label/info per tile); this is just the
 *  bare value tuple for hydration validation. */
export const ERASER_MODE_VALUES = ["brush", "magic", "rembg", "inpaint"] as const;
export type EraserMode = (typeof ERASER_MODE_VALUES)[number];
/** Resize tool (legacy id `compress`) sub-modes: file-size compression
 *  (method/format/quality) vs pixel-dimension resize. */
export type ResizeMode = "compress" | "resize";
/** "Adjust & Select" (legacy id `crop`) sub-modes: Adjust = the crop /
 *  transform controls; Select = the selection tools. */
export type AdjustMode = "adjust" | "select";
/** How a canvas click selects, in Select mode.
 *  - `wand`       — 4-connected flood fill within tolerance (the original).
 *  - `edge`       — same fill, but walled in by the Sobel edge map so it stops
 *                   at the object outline instead of leaking through gradients.
 *  - `colorRange` — every pixel within tolerance of the clicked colour anywhere
 *                   in the image (Photoshop's Select → Color Range).
 *  - `lasso`      — magnetic lasso: click anchors, the wire path-finds along the
 *                   edges between them, double-click closes. Unlike the other
 *                   three this is NOT click-once — it's a session (begin →
 *                   commit* → close). Shipped by default since the
 *                   selection-tool overhaul (`ih_smart_edge` now gates only
 *                   the Paint Smart Brush; see lib/smartEdge.ts). */
export type SelectionKind = "wand" | "edge" | "colorRange" | "lasso";

interface ToolState {
  activeTool: ToolType;
  brushMode: BrushMode;
  resizeMode: ResizeMode;
  adjustMode: AdjustMode;
  selectionKind: SelectionKind;
  /** Edge-wall strength for `selectionKind: "edge"` (0..=255). Lower = more
   *  walls = tighter selection. */
  edgeThreshold: number;
  /** Smart Brush: the Paint brush is walled in by strong edges (the second
   *  consumer of the same edge core the wand + lasso use). Behind
   *  `ih_smart_edge`; OFF by default, and with it off the engine takes its
   *  original brush path. */
  smartBrush: boolean;
  /** How hard an edge must be to contain a Smart Brush stroke (0..=255). */
  smartBrushStrength: number;
  /** Layer Settings → Move-layer toggle (drags reposition the layer). */
  moveActive: boolean;
  /** Layer-mask editing: Paint brush paints the active layer's mask. */
  maskEditing: boolean;
  /** Mask paint value (0 = hide/black, 255 = reveal/white). */
  maskPaintValue: number;
  colorPickerActive: boolean;
  stampSubMode: StampSubMode;
  shapesMode: ShapesMode;
  eraserMode: EraserMode;
  /** Active Crop aspect ratio; `null` ≡ "Free" (no constraint). */
  cropRatio: [number, number] | null;
  selectionTolerance: number;
  selectionMode: boolean;
  selectionMask: Uint8Array | null;
  stampSettings: StampSettings;
  toolSettings: ToolSettings;

  setActiveTool: (v: SetArg<ToolType>) => void;
  setBrushMode: (v: SetArg<BrushMode>) => void;
  setResizeMode: (v: SetArg<ResizeMode>) => void;
  setAdjustMode: (v: SetArg<AdjustMode>) => void;
  setSelectionKind: (v: SetArg<SelectionKind>) => void;
  setEdgeThreshold: (v: SetArg<number>) => void;
  setSmartBrush: (v: SetArg<boolean>) => void;
  setSmartBrushStrength: (v: SetArg<number>) => void;
  setMoveActive: (v: SetArg<boolean>) => void;
  setMaskEditing: (v: SetArg<boolean>) => void;
  setMaskPaintValue: (v: SetArg<number>) => void;
  setColorPickerActive: (v: SetArg<boolean>) => void;
  setStampSubMode: (v: SetArg<StampSubMode>) => void;
  setShapesMode: (v: SetArg<ShapesMode>) => void;
  setEraserMode: (v: SetArg<EraserMode>) => void;
  setCropRatio: (v: SetArg<[number, number] | null>) => void;
  setSelectionTolerance: (v: SetArg<number>) => void;
  setSelectionMode: (v: SetArg<boolean>) => void;
  setSelectionMask: (v: SetArg<Uint8Array | null>) => void;
  setStampSettings: (v: SetArg<StampSettings>) => void;
  setToolSettings: (v: SetArg<ToolSettings>) => void;
}

export const useToolStore = create<ToolState>()(
  persist(
    (set) => ({
      activeTool: "compress",
      brushMode: "paint",
      resizeMode: "compress",
      adjustMode: "adjust",
      selectionKind: "wand",
      // 90/255: walls off hard outlines while ignoring film grain / JPEG noise.
      edgeThreshold: 90,
      smartBrush: false,
      smartBrushStrength: SMART_BRUSH_DEFAULT_STRENGTH,
      moveActive: false,
      maskEditing: false,
      maskPaintValue: 0,
      colorPickerActive: false,
      stampSubMode: "clone",
      shapesMode: "shapes",
      eraserMode: "brush",
      cropRatio: null,
      selectionTolerance: 24,
      selectionMode: false,
      selectionMask: null,
      stampSettings: { brushSize: 20, hardness: 0.8, opacity: 1.0 },
      toolSettings: defaultToolSettings,

      setActiveTool: (v) => set((s) => ({ activeTool: resolveSet(v, s.activeTool) })),
      setBrushMode: (v) => set((s) => ({ brushMode: resolveSet(v, s.brushMode) })),
      setResizeMode: (v) =>
        set((s) => ({ resizeMode: resolveSet(v, s.resizeMode) })),
      setAdjustMode: (v) =>
        set((s) => ({ adjustMode: resolveSet(v, s.adjustMode) })),
      setSelectionKind: (v) =>
        set((s) => ({ selectionKind: resolveSet(v, s.selectionKind) })),
      setEdgeThreshold: (v) =>
        set((s) => ({ edgeThreshold: resolveSet(v, s.edgeThreshold) })),
      setSmartBrush: (v) => set((s) => ({ smartBrush: resolveSet(v, s.smartBrush) })),
      setSmartBrushStrength: (v) =>
        set((s) => ({ smartBrushStrength: resolveSet(v, s.smartBrushStrength) })),
      setMoveActive: (v) => set((s) => ({ moveActive: resolveSet(v, s.moveActive) })),
      setMaskEditing: (v) => set((s) => ({ maskEditing: resolveSet(v, s.maskEditing) })),
      setMaskPaintValue: (v) =>
        set((s) => ({ maskPaintValue: resolveSet(v, s.maskPaintValue) })),
      setColorPickerActive: (v) =>
        set((s) => ({ colorPickerActive: resolveSet(v, s.colorPickerActive) })),
      setStampSubMode: (v) =>
        set((s) => ({ stampSubMode: resolveSet(v, s.stampSubMode) })),
      setShapesMode: (v) => set((s) => ({ shapesMode: resolveSet(v, s.shapesMode) })),
      setEraserMode: (v) => set((s) => ({ eraserMode: resolveSet(v, s.eraserMode) })),
      setCropRatio: (v) => set((s) => ({ cropRatio: resolveSet(v, s.cropRatio) })),
      setSelectionTolerance: (v) =>
        set((s) => ({ selectionTolerance: resolveSet(v, s.selectionTolerance) })),
      setSelectionMode: (v) =>
        set((s) => ({ selectionMode: resolveSet(v, s.selectionMode) })),
      setSelectionMask: (v) =>
        set((s) => ({ selectionMask: resolveSet(v, s.selectionMask) })),
      setStampSettings: (v) =>
        set((s) => ({ stampSettings: resolveSet(v, s.stampSettings) })),
      setToolSettings: (v) =>
        set((s) => ({ toolSettings: resolveSet(v, s.toolSettings) })),
    }),
    {
      name: "image-horse-tool-v1",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      // Persist ONLY the pure sub-mode prefs ("remember which sub-mode I was
      // in") — these are UI routing flags with no coupling to the WASM engine,
      // so they need no rehydrate→engine sync. NOT persisted: activeTool (start
      // on the default tool, not mid-edit), selection* (transient), and
      // stampSettings / toolSettings (these DO push into the engine via
      // stamp.setBrushSize/… so persisting them would need a one-time WASM sync
      // on rehydrate — deferred to the AppShell wiring; see
      // docs/State-Management.md §6).
      partialize: (s): Partial<ToolState> => ({
        brushMode: s.brushMode,
        stampSubMode: s.stampSubMode,
        shapesMode: s.shapesMode,
        eraserMode: s.eraserMode,
      }),
      // Runs on every rehydrate (unlike `migrate`, which only fires on a
      // version bump) — the persisted blob is same-origin-writable IndexedDB,
      // not a value this code just wrote, so each partialized field is
      // checked against ITS CURRENT union before it's allowed to overwrite
      // the freshly-constructed default. A value from an old build that
      // dropped/renamed a sub-mode rehydrates to the default instead of
      // silently landing in state as a value the running code can't switch on.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ToolState>;
        return {
          ...current,
          brushMode: validated(p.brushMode, BRUSH_MODES, current.brushMode),
          stampSubMode: validated(p.stampSubMode, STAMP_SUB_MODES, current.stampSubMode),
          shapesMode: validated(p.shapesMode, SHAPES_MODES, current.shapesMode),
          eraserMode: validated(p.eraserMode, ERASER_MODE_VALUES, current.eraserMode),
        };
      },
    },
  ),
);
