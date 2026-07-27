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
// Retained as a TYPE only: ShapeSettings still switches its panel body on
// which draw mode is active, and it is now fed the Vector mode. The standalone
// Shapes tool (and its own `shapesMode` store field) went away in v7.51.
export type ShapesMode = "shapes" | "pens" | "arrow" | "line";
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
/** Text tool sub-modes: `text` = the type tool, `background` = the plate/bubble
 *  behind it, `ocr` = read text out of the image. Lifted here out of
 *  TextSettings.tsx local `useState` in the new-ui-toolbar arc — while it was
 *  component state the mode was invisible to the command palette, hash routing
 *  AND the hoisted SubtoolRow, all three of which read it via toolModes.ts. */
// The VECTOR tool's sub-modes (tool id stays `text` — ids are only renamed
// during a registry migration, same rule as crop="Adjust" and ai="Eraser").
// v7.51 absorbed the Shapes tool: its `shapes`/`pens`/`arrows` sub-modes moved
// in here, `arrows` lost its plural to match the others, and `line` was
// PROMOTED from a shape kind (it was one of four options inside the Shapes
// sub-mode) to a sub-mode of its own, because reaching for a line is a
// different intent from reaching for a box.
//
// `background` is NOT here any more and was not deleted: the plate/bubble
// behind a caption is a text STYLE, not a separate tool, so its controls moved
// inside the Text panel. OCR stays a sub-mode — it is a distinct job (read text
// OUT of the image) rather than a way of drawing.
export const TEXT_MODES = [
  "text",
  "ocr",
  "shapes",
  "pens",
  "arrow",
  "line",
] as const;
/** The Vector sub-modes that DRAW on the canvas — i.e. the ones that must route
 *  pointer gestures the way the old standalone Shapes tool did. Text and OCR
 *  are excluded: they have their own interaction (a click places a caption; OCR
 *  runs a job and touches no pixels). */
export const VECTOR_DRAW_MODES = ["shapes", "pens", "arrow", "line"] as const;
export type TextMode = (typeof TEXT_MODES)[number];

/** Narrows a Vector sub-mode to the drawing ones. The guard exists so the
 *  panel router and the gesture layer agree on one definition of "draws" —
 *  two hand-written `mode === "shapes" || mode === "pens" || ...` lists would
 *  drift the first time a seventh mode arrives. */
export function isVectorDrawMode(mode: TextMode): mode is ShapesMode {
  return (VECTOR_DRAW_MODES as readonly string[]).includes(mode);
}
/** Batch tool (legacy id `emoji`) sub-modes: bulk logo stamp, bulk text, bulk
 *  rename. Lifted out of BatchSettings.tsx local state for the same reason as
 *  `TEXT_MODES` above. */
export const BATCH_MODES = ["logo", "text", "rename"] as const;
export type BatchMode = (typeof BATCH_MODES)[number];
/** Resize tool (legacy id `compress`) sub-modes: file-size compression
 *  (method/format/quality) vs pixel-dimension resize. */
export type ResizeMode = "compress" | "resize";
/** Marquee shape a `rect`/`ellipse` drag sweeps out. Derived from the active
 *  `SelectionKind` now rather than stored beside it — see the note there. */
export type SelectionShape = "rect" | "ellipse";
/** The Select tool's mode — ONE mutually-exclusive set of six.
 *
 *  Until v7.47 this was two orthogonal axes (a 4-way "kind" for clicks, a
 *  2-way "shape" for drags), so a wand click and a rect drag were both live at
 *  once. That was deliberate (ADR-021 rejected marquee-as-a-tile to avoid
 *  mode-switching for the commonest gesture) but it read as two unrelated
 *  groups in the panel and nobody could tell the axes apart. Collapsed here
 *  into one exclusive list; ADR-022 supersedes 021 with the reasoning.
 *
 *  Click-once — a canvas click resolves the whole selection:
 *  - `wand`       — 4-connected flood fill within tolerance (the original).
 *  - `edge`       — same fill, but walled in by the Sobel edge map so it stops
 *                   at the object outline instead of leaking through gradients.
 *  - `colorRange` — every pixel within tolerance of the clicked colour anywhere
 *                   in the image (Photoshop's Select → Color Range).
 *  Session — many clicks, then a close:
 *  - `lasso`      — magnetic lasso: click anchors, the wire path-finds along the
 *                   edges between them, double-click closes (begin → commit* →
 *                   close). `ih_smart_edge` now gates only the Paint Smart
 *                   Brush; see lib/smartEdge.ts.
 *  Drag — a press-drag-release sweeps the marquee, and a click does nothing:
 *  - `rect`       — the drag rectangle.
 *  - `ellipse`    — the ellipse inscribed in that rectangle. */
export type SelectionKind =
  | "wand"
  | "edge"
  | "colorRange"
  | "lasso"
  | "rect"
  | "ellipse";
/** The two drag kinds — the marquee runs for these and only these. */
export const MARQUEE_KINDS = ["rect", "ellipse"] as const;
/** True when the kind sweeps a marquee on drag (and ignores plain clicks). */
export function isMarqueeKind(k: SelectionKind): k is SelectionShape {
  return k === "rect" || k === "ellipse";
}

/** Exported because `features/tools/toolModes.ts` types its per-tool mode
 *  SELECTORS against it — one selector definition serving both the imperative
 *  `getState()` read (palette/router) and the reactive `useToolStore(...)` read
 *  (SubtoolRow), so the two can't drift. That is the only outside consumer. */
export interface ToolState {
  activeTool: ToolType;
  brushMode: BrushMode;
  resizeMode: ResizeMode;
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
  eraserMode: EraserMode;
  textMode: TextMode;
  batchMode: BatchMode;
  /** Active Crop aspect ratio; `null` ≡ "Free" (no constraint). */
  cropRatio: [number, number] | null;
  selectionTolerance: number;
  selectionMask: Uint8Array | null;
  stampSettings: StampSettings;
  toolSettings: ToolSettings;

  setActiveTool: (v: SetArg<ToolType>) => void;
  setBrushMode: (v: SetArg<BrushMode>) => void;
  setResizeMode: (v: SetArg<ResizeMode>) => void;
  setSelectionKind: (v: SetArg<SelectionKind>) => void;
  setEdgeThreshold: (v: SetArg<number>) => void;
  setSmartBrush: (v: SetArg<boolean>) => void;
  setSmartBrushStrength: (v: SetArg<number>) => void;
  setMoveActive: (v: SetArg<boolean>) => void;
  setMaskEditing: (v: SetArg<boolean>) => void;
  setMaskPaintValue: (v: SetArg<number>) => void;
  setColorPickerActive: (v: SetArg<boolean>) => void;
  setStampSubMode: (v: SetArg<StampSubMode>) => void;
  setEraserMode: (v: SetArg<EraserMode>) => void;
  setTextMode: (v: SetArg<TextMode>) => void;
  setBatchMode: (v: SetArg<BatchMode>) => void;
  setCropRatio: (v: SetArg<[number, number] | null>) => void;
  setSelectionTolerance: (v: SetArg<number>) => void;
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
      eraserMode: "brush",
      textMode: "text",
      batchMode: "logo",
      cropRatio: null,
      selectionTolerance: 24,
      selectionMask: null,
      stampSettings: { brushSize: 20, hardness: 0.8, opacity: 1.0 },
      toolSettings: defaultToolSettings,

      setActiveTool: (v) => set((s) => ({ activeTool: resolveSet(v, s.activeTool) })),
      setBrushMode: (v) => set((s) => ({ brushMode: resolveSet(v, s.brushMode) })),
      setResizeMode: (v) =>
        set((s) => ({ resizeMode: resolveSet(v, s.resizeMode) })),
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
      setEraserMode: (v) => set((s) => ({ eraserMode: resolveSet(v, s.eraserMode) })),
      setTextMode: (v) => set((s) => ({ textMode: resolveSet(v, s.textMode) })),
      setBatchMode: (v) => set((s) => ({ batchMode: resolveSet(v, s.batchMode) })),
      setCropRatio: (v) => set((s) => ({ cropRatio: resolveSet(v, s.cropRatio) })),
      setSelectionTolerance: (v) =>
        set((s) => ({ selectionTolerance: resolveSet(v, s.selectionTolerance) })),
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
        eraserMode: s.eraserMode,
        textMode: s.textMode,
        batchMode: s.batchMode,
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
          eraserMode: validated(p.eraserMode, ERASER_MODE_VALUES, current.eraserMode),
          textMode: validated(p.textMode, TEXT_MODES, current.textMode),
          batchMode: validated(p.batchMode, BATCH_MODES, current.batchMode),
        };
      },
    },
  ),
);
