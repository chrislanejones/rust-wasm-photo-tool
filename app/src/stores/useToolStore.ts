// Tool store: the active tool plus every tool-mode flag and settings blob that
// AppShell threads down into the sidebar, settings panels, and canvas hooks.
//
// Replaces the corresponding `useState`s in AppShell (see Grok's /zustand
// blueprint). Setters take React's `value | (prev => next)` arg via SetArg so
// existing functional-updater call sites (e.g. `setMoveActive((m) => !m)`,
// `setToolSettings((p) => ({ ...p, brushSize }))`) migrate untouched.
import { create } from "zustand";
import type { SelectionCombineMode } from "@/lib/selectionBool";
import type { SelectionCoverage } from "@/lib/selectionCoverage";
import { CLEAN_UP, type RefineSettings } from "@/lib/selectionRefine";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { SMART_BRUSH_DEFAULT_STRENGTH } from "@/lib/smartEdge";
import {
  resolveSet,
  validated,
  validatedNumberInRange,
  validateFields,
  type FieldValidators,
  type SetArg,
} from "./_shared";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/exportImage";
import type { MaskPoint, MaskStroke } from "@/lib/objectRemovalMask";
import { idbStorage } from "./storage/idbStorage";

/** Paint sub-modes (Paint tool): freehand paint, blur brush, Bézier pen, or
 *  the eraser (scrubs the active layer's alpha). */
const BRUSH_MODES = ["paint", "blur", "pen", "erase"] as const;
export type BrushMode = (typeof BRUSH_MODES)[number];
/** Stamp tool sub-modes. */
const STAMP_SUB_MODES = ["clone", "red", "emojis"] as const;
export type StampSubMode = (typeof STAMP_SUB_MODES)[number];
/** Shapes tool sub-modes. */
const SHAPES_MODES = ["shapes", "pens", "arrows"] as const;
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
const ERASER_MODE_VALUES = ["brush", "magic", "rembg", "inpaint"] as const;
export type EraserMode = (typeof ERASER_MODE_VALUES)[number];
/** The `effects` tool's two panels: `adjust` = the Adjustments sliders,
 *  `levels` = the Levels panel. NOT PERSISTED — it is kept out of the
 *  `partialize` allowlist, so a reload reopens Adjustments (the long-standing
 *  default) and no storage schema changes. */
export type EffectsMode = "adjust" | "levels" | "presets";
/** Text tool sub-modes: `text` = the type tool, `background` = the plate/bubble
 *  behind it, `ocr` = read text out of the image. Lifted here out of
 *  TextSettings.tsx local `useState` in the new-ui-toolbar arc — while it was
 *  component state the mode was invisible to the command palette, hash routing
 *  AND the hoisted SubtoolRow, all three of which read it via toolModes.ts. */
const TEXT_MODES = ["text", "background", "ocr"] as const;
export type TextMode = (typeof TEXT_MODES)[number];

/** Perspective tool sub-modes (v8.42). Not three tools — ONE quad and three
 *  rules about what dragging a handle does to the other corners. See
 *  `lib/perspective.ts` `dragCorner` for the rules themselves. */
// The ordered list (button order, icons, labels) lives ONCE, in
// PerspectiveSettings.tsx `PERSPECTIVE_MODES` — typed against this union.
// Renaming an id would break saved routes; reordering is free — nothing
// serializes the index, the engine stores a quad, not a mode.
export type PerspectiveMode = "perspective" | "distort" | "skew";
/** Batch tool (legacy id `emoji`) sub-modes: bulk logo stamp, bulk text, bulk
 *  rename, and AI Rename (names every photo from what the engine sees in it).
 *  Lifted out of BatchSettings.tsx local state for the same reason as
 *  `TEXT_MODES` above.
 *
 *  Persistence reads this list through `validated()`, so an older persisted
 *  state that predates `airename` falls back to the current default rather
 *  than poking an unknown string into the union. */
const BATCH_MODES = ["logo", "text", "rename", "airename"] as const;
export type BatchMode = (typeof BATCH_MODES)[number];
/** Resize tool (legacy id `compress`) sub-modes: file-size compression
 *  (method/format/quality) vs pixel-dimension resize. */
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
 *  - `colorRange` — every pixel within tolerance of the clicked color anywhere
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
  /** Which of the five-group registry's 33 sub-tools is lit — the composite
   *  `"<group>/<subTool>"` key from `features/tools/toolGroups.ts`.
   *
   *  WHY THIS EXISTS AT ALL. For 27 of the 33 sub-tools the active one is
   *  implied by `(activeTool, mode)`. The other six are not: Crop / Transform /
   *  Color Picker all resolve to `crop` with no mode, and Resize Layer /
   *  Canvas Size / Guides all resolve to `arrow` with no mode, because those
   *  are single-mode tools whose panels hold several features each. Derive the
   *  lit tile from `(tool, mode)` and those six light three-at-a-time.
   *
   *  DELIBERATELY NOT PERSISTED. `partialize` below is an explicit allowlist
   *  and this field is kept out of it — so no IndexedDB schema change, no
   *  version bump, and the `dexie-migration` skill is not triggered. On reload
   *  it is re-derived from the persisted `(activeTool, mode)` pair via
   *  `subToolForToolMode`, which is exactly the information the toolbar
   *  restored from before this field existed. */
  activeSubTool: string;
  brushMode: BrushMode;
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
  /** Shape id whose directional duplicate pad is open (Review → Reselect
   *  d-pad), or null. NOT PERSISTED — `partialize` is an allowlist and this
   *  stays out of it: a pad open across a reload would point at whatever
   *  shape happened to get that id. */
  duplicatePadId: number | null;
  /** Recently eyedroppered colors, newest first, de-duplicated, capped.
   *
   *  NOT PERSISTED — same reasoning as `activeSubTool`: `partialize` below is
   *  an explicit allowlist and this is kept out of it, so adding the feature
   *  needs no IndexedDB schema change and does not trip the `dexie-migration`
   *  gate. The cost is that history is per-session. Making it survive a reload
   *  is a one-line partialize change PLUS that migration procedure — a
   *  deliberate follow-up, not something to slip in. */
  pickedColorHistory: string[];
  stampSubMode: StampSubMode;
  shapesMode: ShapesMode;
  eraserMode: EraserMode;
  effectsMode: EffectsMode;
  textMode: TextMode;
  /** Which drag rule the Perspective tool's handles obey.
   *
   *  DELIBERATELY NOT PERSISTED — same reasoning as `activeSubTool` and
   *  `pickedColorHistory`: `partialize` below is an explicit allowlist and this
   *  is kept out of it, so the tool ships with no IndexedDB schema change, no
   *  version bump, and without tripping the `dexie-migration` gate. On reload
   *  the tool opens in `distort`, which is the mode a first-time drag wants
   *  anyway. Persisting it is a one-line partialize change PLUS that migration
   *  procedure — a deliberate follow-up, not something to slip in here. */
  perspectiveMode: PerspectiveMode;
  batchMode: BatchMode;
  /** Export format + quality for Compress / Download / Apply Compression.
   *
   *  PERSISTED (#14). These were `useState` in AppShell, so every reload threw
   *  away the choice and silently went back to JPEG at 75 — a preference the
   *  user re-set on every visit. They join the existing allowlist rather than
   *  getting a store of their own: same lifetime, same "remember what I picked"
   *  contract as the sub-modes beside them, and no engine coupling, so there is
   *  nothing to sync into WASM on rehydrate. */
  exportFormat: ExportFormat;
  /** JPEG/WebP/AVIF quality, 1..100. Ignored for PNG (lossless). */
  quality: number;
  /** Active Crop aspect ratio; `null` ≡ "Free" (no constraint). */
  cropRatio: [number, number] | null;
  selectionTolerance: number;
  selectionMask: Uint8Array | null;
  /** How the next selection combines with the current one — the Select
   *  panel's Combine group (New / Add / Subtract / Intersect). Shift and Alt
   *  still override it for one gesture. NOT PERSISTED (outside `partialize`):
   *  a session-scoped choice, and a reload that came back in Subtract would
   *  make the first click look broken. No IndexedDB change. */
  selectionCombine: SelectionCombineMode;
  /** `[selected, total]` pixels of the live selection, from the engine's
   *  `selection_coverage` — the "Selected 18.4% · 2.1 MP" readout in the
   *  panel and the status bar. `null` until the engine has answered, and
   *  whenever nothing is selected. NOT PERSISTED. */
  selectionCoverage: SelectionCoverage | null;
  /** The Refine section's sliders. Start at the Clean Up values. NOT
   *  PERSISTED (outside `partialize`): no IndexedDB change. */
  selectionRefine: RefineSettings;
  /** A Refine preview is on screen: the overlay and the readout show the
   *  refined copy, not the selection. Cleared by Apply, Clean Up, and any
   *  other change to the selection. */
  refinePreviewing: boolean;
  /** Panel → session hook: "apply now". The panel has no engine handle (it
   *  would mean threading props through AppShell), so it asks through the
   *  store and `useSelectionActions` answers. `n` makes each request new. */
  refineRequest: { kind: "apply" | "cleanUp"; n: number } | null;
  /** AI › Object Removal is painting its mask ON the canvas right now.
   *
   *  This replaced a portal-mounted popup that painted on its own private
   *  copy of the frame. The three fields below are what the popup used to
   *  hold in local `useState`; they live here because the paint surface
   *  (`features/canvas/ObjectRemovalOverlay`) and the controls that drive it
   *  (`features/tools/settings/AISettings`) are in different subtrees, and a
   *  store action is the only sanctioned way across (no new CustomEvents).
   *
   *  DELIBERATELY NOT PERSISTED — `partialize` below is an allowlist and all
   *  three are kept out of it, same as `activeSubTool` and `selectionMask`.
   *  So: no IndexedDB schema change, no version bump, and the
   *  `dexie-migration` gate is not triggered. A half-painted mask surviving a
   *  reload would also point at whatever image happened to load next. */
  objectRemovalMasking: boolean;
  /** Whether the Crop tool has a rectangle drawn. Published by
   *  `useDrawingTools` (the rectangle itself stays hook state) so the panel's
   *  Apply Crop can be disabled without threading a prop through AppShell,
   *  which must gain nothing. NOT persisted — outside the `partialize`
   *  allowlist, like every other transient field here. */
  cropSelectionActive: boolean;
  /** The painted strokes, in IMAGE-space pixels (see `lib/objectRemovalMask`).
   *  Image space, not screen space, is what makes the uploaded mask land in
   *  register at any zoom. */
  objectRemovalStrokes: MaskStroke[];
  /** Mask brush diameter in IMAGE pixels. Same range and default the popup's
   *  slider had (8–120, 40). */
  objectRemovalBrush: number;
  /** The inpaint job is in flight. The paint stays on screen over the object
   *  being removed, but the overlay stops taking the pointer — a stroke added
   *  now could not reach the model that is already running on the mask. */
  objectRemovalBusy: boolean;
  stampSettings: StampSettings;
  toolSettings: ToolSettings;

  setActiveTool: (v: SetArg<ToolType>) => void;
  setActiveSubTool: (v: SetArg<string>) => void;
  /** Record a picked color at the head of the history. */
  pushPickedColor: (hex: string) => void;
  removePickedColor: (hex: string) => void;
  clearPickedColors: () => void;
  setBrushMode: (v: SetArg<BrushMode>) => void;
  setSelectionKind: (v: SetArg<SelectionKind>) => void;
  setEdgeThreshold: (v: SetArg<number>) => void;
  setSmartBrush: (v: SetArg<boolean>) => void;
  setSmartBrushStrength: (v: SetArg<number>) => void;
  setMoveActive: (v: SetArg<boolean>) => void;
  setMaskEditing: (v: SetArg<boolean>) => void;
  setMaskPaintValue: (v: SetArg<number>) => void;
  setColorPickerActive: (v: SetArg<boolean>) => void;
  setDuplicatePadId: (v: SetArg<number | null>) => void;
  setStampSubMode: (v: SetArg<StampSubMode>) => void;
  setShapesMode: (v: SetArg<ShapesMode>) => void;
  setEraserMode: (v: SetArg<EraserMode>) => void;
  setEffectsMode: (v: SetArg<EffectsMode>) => void;
  setTextMode: (v: SetArg<TextMode>) => void;
  setPerspectiveMode: (v: SetArg<PerspectiveMode>) => void;
  setBatchMode: (v: SetArg<BatchMode>) => void;
  setCropRatio: (v: SetArg<[number, number] | null>) => void;
  setSelectionTolerance: (v: SetArg<number>) => void;
  setSelectionMask: (v: SetArg<Uint8Array | null>) => void;
  setSelectionCombine: (v: SetArg<SelectionCombineMode>) => void;
  setSelectionCoverage: (v: SelectionCoverage | null) => void;
  setSelectionRefine: (v: SetArg<RefineSettings>) => void;
  setRefinePreviewing: (v: boolean) => void;
  requestRefine: (kind: "apply" | "cleanUp") => void;
  /** Enter/leave on-canvas mask painting. Leaving ALWAYS drops the strokes:
   *  the mask describes one object on one image, so carrying it into the next
   *  visit to the panel could only ever remove the wrong thing. */
  setObjectRemovalMasking: (v: SetArg<boolean>) => void;
  setObjectRemovalBrush: (v: SetArg<number>) => void;
  setObjectRemovalBusy: (v: SetArg<boolean>) => void;
  /** Pointer down — opens a stroke at `p` with the current brush size. */
  beginObjectRemovalStroke: (p: MaskPoint) => void;
  /** Pointer move — appends to the open stroke. A no-op when none is open. */
  extendObjectRemovalStroke: (p: MaskPoint) => void;
  /** Drop the most recent stroke (the popup had Clear only). */
  undoObjectRemovalStroke: () => void;
  clearObjectRemovalStrokes: () => void;
  setExportFormat: (v: SetArg<ExportFormat>) => void;
  setQuality: (v: SetArg<number>) => void;
  setStampSettings: (v: SetArg<StampSettings>) => void;
  setToolSettings: (v: SetArg<ToolSettings>) => void;
}

/** The persisted slice of this store: exactly what `partialize` below writes. */
type ToolPersisted = Pick<
  ToolState,
  | "brushMode"
  | "stampSubMode"
  | "shapesMode"
  | "eraserMode"
  | "textMode"
  | "batchMode"
  | "exportFormat"
  | "quality"
>;

/**
 * How each persisted field is checked on its way back in — from IndexedDB on
 * rehydrate (`merge` below) and from another device through the sync layer's
 * `tools` document (lib/sync/docs.ts). One table for both; see the note on
 * UI_PERSISTED_FIELDS in useUIStore.ts, and lib/sync/syncParity.test.ts.
 *
 * Each sub-mode is checked against ITS CURRENT union, so a value from an old
 * build that dropped or renamed one falls back instead of landing in state as
 * a value the running code cannot switch on. exportFormat and quality
 * tolerate a blob written before they existed: `undefined` fails the check
 * and falls back to the constructed default, which is the pre-#14 behavior —
 * no version bump, no migration.
 */
export const TOOL_PERSISTED_FIELDS: FieldValidators<ToolPersisted> = {
  brushMode: (v, fallback) => validated(v, BRUSH_MODES, fallback),
  stampSubMode: (v, fallback) => validated(v, STAMP_SUB_MODES, fallback),
  shapesMode: (v, fallback) => validated(v, SHAPES_MODES, fallback),
  eraserMode: (v, fallback) => validated(v, ERASER_MODE_VALUES, fallback),
  textMode: (v, fallback) => validated(v, TEXT_MODES, fallback),
  batchMode: (v, fallback) => validated(v, BATCH_MODES, fallback),
  exportFormat: (v, fallback) => validated(v, EXPORT_FORMATS, fallback),
  quality: (v, fallback) => validatedNumberInRange(v, 1, 100, fallback),
};

export const useToolStore = create<ToolState>()(
  persist(
    (set) => ({
      activeTool: "compress",
      // Matches `activeTool: "compress"` — Enhance › Resize & Compress, which
      // is single-mode since the two tiles merged. Kept as a literal rather
      // than computed from the registry so the store keeps no import edge onto
      // features/tools.
      activeSubTool: "enhance/compress",
      brushMode: "paint",
      selectionKind: "wand",
      // 90/255: walls off hard outlines while ignoring film grain / JPEG noise.
      edgeThreshold: 90,
      smartBrush: false,
      smartBrushStrength: SMART_BRUSH_DEFAULT_STRENGTH,
      moveActive: false,
      maskEditing: false,
      maskPaintValue: 0,
      colorPickerActive: false,
      duplicatePadId: null,
      pickedColorHistory: [],
      stampSubMode: "clone",
      shapesMode: "shapes",
      eraserMode: "brush",
      effectsMode: "adjust",
      textMode: "text",
      perspectiveMode: "perspective",
      batchMode: "logo",
      // Same defaults the AppShell useState pair had, so a user with no
      // persisted blob (or one written before #14) sees no change at all.
      exportFormat: "jpeg",
      quality: 75,
      cropRatio: null,
      selectionTolerance: 24,
      selectionMask: null,
      selectionCombine: 0,
      selectionCoverage: null,
      selectionRefine: CLEAN_UP,
      refinePreviewing: false,
      refineRequest: null,
      objectRemovalMasking: false,
      cropSelectionActive: false,
      objectRemovalStrokes: [],
      objectRemovalBrush: 40,
      objectRemovalBusy: false,
      stampSettings: { brushSize: 20, hardness: 0.8, opacity: 1.0 },
      toolSettings: defaultToolSettings,

      setActiveTool: (v) =>
        set((s) => {
          const next = resolveSet(v, s.activeTool);
          // LEAVING THE AI TOOL ENDS REMOVE OBJECT'S MASK MODE. The mask
          // overlay is mounted for every tool and only `objectRemovalMasking`
          // hides it, but the only things that turned masking off lived in
          // AISettings — which unmounts the moment another tool is picked. So
          // switching tools mid-mask left the half-opacity paint on the canvas,
          // and the overlay (pointer-events on, z 25) swallowed every click the
          // new tool made, with Esc the only way out (QC §3, 09-22). Leaving is
          // treated exactly like Cancel: the same clears as `setObjectRemovalMasking`.
          if (next !== "ai" && s.objectRemovalMasking) {
            return {
              activeTool: next,
              objectRemovalMasking: false,
              objectRemovalStrokes: [],
              objectRemovalBusy: false,
            };
          }
          return { activeTool: next };
        }),
      setActiveSubTool: (v) =>
        set((s) => ({ activeSubTool: resolveSet(v, s.activeSubTool) })),
      // Newest first, case-insensitively de-duplicated (the engine hands back
      // uppercase hex, hand-typed swatches are lowercase — without this the
      // same color lands twice and looks like a bug). Capped at 12: it is a
      // recall list, not a log, and the panel column is 252px.
      pushPickedColor: (hex) =>
        set((s) => {
          const norm = hex.toUpperCase();
          const rest = s.pickedColorHistory.filter(
            (c) => c.toUpperCase() !== norm,
          );
          return { pickedColorHistory: [norm, ...rest].slice(0, 12) };
        }),
      removePickedColor: (hex) =>
        set((s) => ({
          pickedColorHistory: s.pickedColorHistory.filter(
            (c) => c.toUpperCase() !== hex.toUpperCase(),
          ),
        })),
      clearPickedColors: () => set({ pickedColorHistory: [] }),
      setBrushMode: (v) => set((s) => ({ brushMode: resolveSet(v, s.brushMode) })),
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
      setDuplicatePadId: (v) =>
        set((s) => ({ duplicatePadId: resolveSet(v, s.duplicatePadId) })),
      setStampSubMode: (v) =>
        set((s) => ({ stampSubMode: resolveSet(v, s.stampSubMode) })),
      setShapesMode: (v) => set((s) => ({ shapesMode: resolveSet(v, s.shapesMode) })),
      setEraserMode: (v) => set((s) => ({ eraserMode: resolveSet(v, s.eraserMode) })),
      setEffectsMode: (v) => set((s) => ({ effectsMode: resolveSet(v, s.effectsMode) })),
      setTextMode: (v) => set((s) => ({ textMode: resolveSet(v, s.textMode) })),
      setPerspectiveMode: (v) =>
        set((s) => ({ perspectiveMode: resolveSet(v, s.perspectiveMode) })),
      setBatchMode: (v) => set((s) => ({ batchMode: resolveSet(v, s.batchMode) })),
      setCropRatio: (v) => set((s) => ({ cropRatio: resolveSet(v, s.cropRatio) })),
      setSelectionTolerance: (v) =>
        set((s) => ({ selectionTolerance: resolveSet(v, s.selectionTolerance) })),
      setSelectionMask: (v) =>
        set((s) => ({ selectionMask: resolveSet(v, s.selectionMask) })),
      setSelectionCombine: (v) =>
        set((s) => ({ selectionCombine: resolveSet(v, s.selectionCombine) })),
      setSelectionCoverage: (v) => set({ selectionCoverage: v }),
      setSelectionRefine: (v) =>
        set((s) => ({ selectionRefine: resolveSet(v, s.selectionRefine) })),
      setRefinePreviewing: (v) => set({ refinePreviewing: v }),
      requestRefine: (kind) =>
        set((s) => ({ refineRequest: { kind, n: (s.refineRequest?.n ?? 0) + 1 } })),
      setObjectRemovalMasking: (v) =>
        set((s) => {
          const next = resolveSet(v, s.objectRemovalMasking);
          // Leaving clears. Entering clears too, so the panel never opens onto
          // paint left over from a mask that was canceled or already sent.
          // Busy is a property of the mode, so it goes with it — otherwise a
          // job that ended by leaving the mode would leave the next mask
          // un-paintable.
          return {
            objectRemovalMasking: next,
            objectRemovalStrokes: [],
            objectRemovalBusy: false,
          };
        }),
      setObjectRemovalBrush: (v) =>
        set((s) => ({ objectRemovalBrush: resolveSet(v, s.objectRemovalBrush) })),
      setObjectRemovalBusy: (v) =>
        set((s) => ({ objectRemovalBusy: resolveSet(v, s.objectRemovalBusy) })),
      beginObjectRemovalStroke: (p) =>
        set((s) => ({
          objectRemovalStrokes: [
            ...s.objectRemovalStrokes,
            { size: s.objectRemovalBrush, points: [p] },
          ],
        })),
      extendObjectRemovalStroke: (p) =>
        set((s) => {
          const open = s.objectRemovalStrokes[s.objectRemovalStrokes.length - 1];
          if (!open) return {};
          // New array + new stroke object: the overlay re-renders off identity,
          // and mutating in place would paint nothing until the next unrelated
          // state change.
          return {
            objectRemovalStrokes: [
              ...s.objectRemovalStrokes.slice(0, -1),
              { ...open, points: [...open.points, p] },
            ],
          };
        }),
      undoObjectRemovalStroke: () =>
        set((s) => ({ objectRemovalStrokes: s.objectRemovalStrokes.slice(0, -1) })),
      clearObjectRemovalStrokes: () => set({ objectRemovalStrokes: [] }),
      setExportFormat: (v) =>
        set((s) => ({ exportFormat: resolveSet(v, s.exportFormat) })),
      setQuality: (v) => set((s) => ({ quality: resolveSet(v, s.quality) })),
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
      // docs/archive/State-Management.md §6).
      partialize: (s): ToolPersisted => ({
        brushMode: s.brushMode,
        stampSubMode: s.stampSubMode,
        shapesMode: s.shapesMode,
        eraserMode: s.eraserMode,
        textMode: s.textMode,
        batchMode: s.batchMode,
        exportFormat: s.exportFormat,
        quality: s.quality,
      }),
      // Runs on every rehydrate (unlike `migrate`, which only fires on a
      // version bump) — the persisted blob is same-origin-writable IndexedDB,
      // not a value this code just wrote. The per-field rules are
      // TOOL_PERSISTED_FIELDS above.
      merge: (persisted, current) => ({
        ...current,
        ...validateFields(
          TOOL_PERSISTED_FIELDS,
          (persisted ?? {}) as Record<string, unknown>,
          current,
        ),
      }),
    },
  ),
);
