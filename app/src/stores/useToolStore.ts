// Tool store: the active tool plus every tool-mode flag and settings blob that
// AppShell threads down into the sidebar, settings panels, and canvas hooks.
//
// Replaces the corresponding `useState`s in AppShell (see Grok's /zustand
// blueprint). Setters take React's `value | (prev => next)` arg via SetArg so
// existing functional-updater call sites (e.g. `setMoveActive((m) => !m)`,
// `setToolSettings((p) => ({ ...p, brushSize }))`) migrate untouched.
import { create } from "zustand";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import type { EffectsMode } from "@/features/tools/settings/EffectsSettings";
import { resolveSet, type SetArg } from "./_shared";

/** Paint sub-modes (Paint tool): freehand paint, blur brush, or Bézier pen. */
export type BrushMode = "paint" | "blur" | "pen";
/** Stamp tool sub-modes. */
export type StampSubMode = "clone" | "red" | "emojis";
/** Shapes tool sub-modes. */
export type ShapesMode = "shapes" | "pens" | "arrows";

interface ToolState {
  activeTool: ToolType;
  brushMode: BrushMode;
  /** Edit & Transform → Eraser toggle (canvas strokes erase while on). */
  cropEraserActive: boolean;
  /** Layer Settings → Move-layer toggle (drags reposition the layer). */
  moveActive: boolean;
  /** Layer-mask editing: Paint brush paints the active layer's mask. */
  maskEditing: boolean;
  /** Mask paint value (0 = hide/black, 255 = reveal/white). */
  maskPaintValue: number;
  effectsMode: EffectsMode;
  colorPickerActive: boolean;
  stampSubMode: StampSubMode;
  shapesMode: ShapesMode;
  /** Active Crop aspect ratio; `null` ≡ "Free" (no constraint). */
  cropRatio: [number, number] | null;
  selectionTolerance: number;
  selectionMode: boolean;
  selectionMask: Uint8Array | null;
  stampSettings: StampSettings;
  toolSettings: ToolSettings;

  setActiveTool: (v: SetArg<ToolType>) => void;
  setBrushMode: (v: SetArg<BrushMode>) => void;
  setCropEraserActive: (v: SetArg<boolean>) => void;
  setMoveActive: (v: SetArg<boolean>) => void;
  setMaskEditing: (v: SetArg<boolean>) => void;
  setMaskPaintValue: (v: SetArg<number>) => void;
  setEffectsMode: (v: SetArg<EffectsMode>) => void;
  setColorPickerActive: (v: SetArg<boolean>) => void;
  setStampSubMode: (v: SetArg<StampSubMode>) => void;
  setShapesMode: (v: SetArg<ShapesMode>) => void;
  setCropRatio: (v: SetArg<[number, number] | null>) => void;
  setSelectionTolerance: (v: SetArg<number>) => void;
  setSelectionMode: (v: SetArg<boolean>) => void;
  setSelectionMask: (v: SetArg<Uint8Array | null>) => void;
  setStampSettings: (v: SetArg<StampSettings>) => void;
  setToolSettings: (v: SetArg<ToolSettings>) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: "compress",
  brushMode: "paint",
  cropEraserActive: false,
  moveActive: false,
  maskEditing: false,
  maskPaintValue: 0,
  effectsMode: "levels",
  colorPickerActive: false,
  stampSubMode: "clone",
  shapesMode: "shapes",
  cropRatio: null,
  selectionTolerance: 24,
  selectionMode: false,
  selectionMask: null,
  stampSettings: { brushSize: 20, hardness: 0.8, opacity: 1.0 },
  toolSettings: defaultToolSettings,

  setActiveTool: (v) => set((s) => ({ activeTool: resolveSet(v, s.activeTool) })),
  setBrushMode: (v) => set((s) => ({ brushMode: resolveSet(v, s.brushMode) })),
  setCropEraserActive: (v) =>
    set((s) => ({ cropEraserActive: resolveSet(v, s.cropEraserActive) })),
  setMoveActive: (v) => set((s) => ({ moveActive: resolveSet(v, s.moveActive) })),
  setMaskEditing: (v) => set((s) => ({ maskEditing: resolveSet(v, s.maskEditing) })),
  setMaskPaintValue: (v) =>
    set((s) => ({ maskPaintValue: resolveSet(v, s.maskPaintValue) })),
  setEffectsMode: (v) => set((s) => ({ effectsMode: resolveSet(v, s.effectsMode) })),
  setColorPickerActive: (v) =>
    set((s) => ({ colorPickerActive: resolveSet(v, s.colorPickerActive) })),
  setStampSubMode: (v) =>
    set((s) => ({ stampSubMode: resolveSet(v, s.stampSubMode) })),
  setShapesMode: (v) => set((s) => ({ shapesMode: resolveSet(v, s.shapesMode) })),
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
}));
