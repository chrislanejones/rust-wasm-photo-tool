// The drawing stack's shared vocabulary — the types CanvasArea, the session
// hooks and the Shapes panel all import, plus the pure helpers that decide
// what a pending edit IS. Moved out of useDrawingTools.ts (which re-exports
// every name here, so no import changed) so the hook file holds the hook.
import type { ShapeName, ToolSettings } from "@/lib/types";
import type { Point } from "@/lib/shapeSloppiness";

// One `Point` for the drawing stack: defined in lib/shapeSloppiness.ts,
// re-exported here so canvas code can keep importing it beside CropSelection.
export type { Point };

export interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pending (uncommitted) shape/arrow being edited via the Figma-style
 * overlay. Geometry lives in canvas pixels; `start`/`end` are the original
 * drag endpoints (opposite bbox corners for rect/circle, the actual segment
 * endpoints for line/arrow). Stroke color/width and the arrow style are
 * intentionally NOT snapshotted here — they're read live from ToolSettings at
 * render and at commit, so panel tweaks made while the overlay is open apply
 * to the pending shape (mirroring how the text tool live-updates its open
 * input). The shape TYPE is the exception — see `drawnShape`.
 */
export interface DrawEditState {
  kind: "shape" | "arrow";
  start: Point;
  end: Point;
  /** The shape type this pending NEW shape was drawn as, pinned at mouse-up.
   *
   *  The type used to be read live from `ToolSettings.shape` like the color
   *  and the stroke width, and that made picking a different shape in the
   *  panel RETYPE the shape already on the canvas: draw a circle, click
   *  Square, and the circle became a square. Chris's report — "clicking
   *  another shape should not change the last shape created on the canvas,
   *  let it just allow a new shape to be added."
   *
   *  Type is not like color. A color tweak is an edit to the thing in front
   *  of you; a shape click is the choice of what you are about to draw NEXT,
   *  which is why `panelStylePatch` already refuses to carry `shape` across to
   *  a RESELECTED shape. This pins the same rule for a freshly drawn one, so
   *  the two paths finally agree. Unset for reselected shapes, which carry
   *  their own type in `style.shape`. */
  drawnShape?: ShapeName;
  /** When set, we're editing an EXISTING live shape annotation (this id)
   *  rather than creating a new one. Commit calls update_shape_annotation. */
  editId?: number;
  /** Snapshot of the shape's own kind + style, used when re-selecting an
   *  existing shape so the overlay preview renders with the shape's real
   *  style rather than the current toolbar settings. New shapes leave this
   *  undefined and read settings live. */
  style?: {
    shape: ShapeName;
    strokeColor: string;
    strokeWidth: number;
    arrowStyle: "single" | "double";
    /** Stroke sloppiness 0-100 (how hand-drawn the outline is), captured on
      * reselect so it round-trips — a sketchy circle stays sketchy. */
    sloppiness: number;
    /** The shape's real Rust `kind` byte, preserved across an edit so a pin
     *  (kind 5) re-rendered as a circle handle still commits as a pin. */
    kindByte?: number;
    /** Interior fill, captured on reselect so it round-trips (rect/circle).
     *  Treated exactly like strokeColor: preserved across move/resize. */
    fillMode: "none" | "solid" | "gradient" | "pixelate";
    fillColor: string;
    fillColor2: string;
    gradientAngle: number;
    /** Mosaic block size (px) for fillMode "pixelate". */
    fillBlock: number;
  };
}

/** The style fields a reselected shape carries, minus `shape`/`kindByte`. */
export type ShapeStylePatch = Partial<NonNullable<DrawEditState["style"]>>;

/**
 * Which shape type a pending edit IS — the single rule shared by the overlay
 * renderer (CanvasArea) and `commitEdit`, so the preview and the committed
 * pixels can never disagree about it.
 *
 * Precedence, most specific first:
 *   1. `style.shape`  — a RESELECTED shape's own type, snapshotted on select.
 *   2. `drawnShape`   — a NEW shape's type, pinned at mouse-up.
 *   3. the panel      — nothing pending, so the panel is the only answer.
 *
 * The panel used to come FIRST for new shapes, which is what made clicking
 * Square retype the circle already sitting on the canvas.
 */
export function pendingShapeType(
  es: Pick<DrawEditState, "style" | "drawnShape"> | null | undefined,
  panelShape: string | undefined,
): ShapeName {
  const fromPanel = panelShape as ShapeName | undefined;
  return es?.style?.shape ?? es?.drawnShape ?? fromPanel ?? "rect";
}

/**
 * Which style fields the user just changed in the Shapes panel.
 *
 * This is the fix for the seven-week "a placed square cannot be recolored"
 * bug. `selectShape` snapshots a reselected shape's own style into
 * `editState.style` so clicking a red square shows it red rather than
 * repainting it with whatever the panel happens to hold. But that snapshot
 * then outranked the panel everywhere (`es.style?.strokeColor ?? s.strokeColor`
 * in `commitEdit`), so a color change could never reach the shape — and
 * because only a handle drag set `editDirtyRef`, a color-only edit also took
 * `commitEdit`'s no-op early exit and never called `update_shape_annotation`
 * at all. Two blockers, one symptom.
 *
 * The snapshot is right on reselect and wrong from then on, so it is treated
 * as a DEFAULT rather than an override: diff the panel against its own
 * PREVIOUS value and carry across only what actually changed. Comparing
 * against the shape instead would repaint it the moment it was selected,
 * which is the behavior the snapshot exists to prevent.
 *
 * Returns `null` when nothing changed, so the caller can skip the re-render
 * and — more importantly — avoid marking the edit dirty, which would push a
 * spurious "Edit Shape" step onto the undo stack for merely selecting.
 *
 * `shape` is deliberately absent: `kindByte` preserves a pin's real kind
 * across an edit, so retyping a committed shape is a separate operation and
 * not something a color click should trigger.
 */
export function panelStylePatch(
  prev: ToolSettings,
  next: ToolSettings,
): ShapeStylePatch | null {
  const patch: ShapeStylePatch = {};
  if (next.strokeColor !== prev.strokeColor) patch.strokeColor = next.strokeColor;
  if (next.strokeWidth !== prev.strokeWidth) patch.strokeWidth = next.strokeWidth;
  if (next.arrowStyle !== prev.arrowStyle) patch.arrowStyle = next.arrowStyle;
  if (next.sloppiness !== prev.sloppiness) patch.sloppiness = next.sloppiness;
  if (next.fillMode !== prev.fillMode) patch.fillMode = next.fillMode;
  if (next.fillColor !== prev.fillColor) patch.fillColor = next.fillColor;
  if (next.fillColor2 !== prev.fillColor2) patch.fillColor2 = next.fillColor2;
  if (next.gradientAngle !== prev.gradientAngle)
    patch.gradientAngle = next.gradientAngle;
  if (next.fillBlock !== prev.fillBlock) patch.fillBlock = next.fillBlock;
  return Object.keys(patch).length === 0 ? null : patch;
}

/** One entry from `tool.get_shape_annotations()`. */
export interface ShapeMeta {
  id: number;
  kind: number; // 0=rect,1=circle,2=line,3=handCircle(legacy),4=arrow,5=pin,
                // 6=polyline,7=bezier,8=diamond,9=star
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  g: number;
  b: number;
  stroke_width: number;
  arrow_style: number;
  /** Stroke sloppiness 0-100 (how hand-drawn the outline is). Absent on
   *  shapes written before the field shipped (they meant "firm"). */
  sloppiness?: number;
  /** Pin sequence index (kind 5). */
  number: number;
  /** Pin label style (kind 5): 0 = number, 1 = letter. */
  label_kind?: number;
  /** Interior fill (rect/circle): 0 none, 1 solid, 2 linear gradient. */
  fill_kind: number;
  fill_r: number; fill_g: number; fill_b: number; fill_a: number;
  fill2_r: number; fill2_g: number; fill2_b: number; fill2_a: number;
  /** Gradient direction in degrees. */
  fill_angle: number;
  /** Mosaic block size (px) for fill_kind 3 (pixelate). */
  fill_block: number;
  /** Polyline vertices (kind 6) as [[x,y],…]. */
  points: number[][];
}

/** Rust shape `kind` byte → ToolSettings shape name (non-arrow kinds). Kind 3
 *  (the legacy hand-drawn circle) re-edits as a CIRCLE — its hand-drawn look
 *  is not lost, because `selectShape` seeds sloppiness 100 for shapes that
 *  predate the field. */
export const SHAPE_KIND_NAME: Record<number, ShapeName> = {
  0: "rect",
  1: "circle",
  2: "line",
  3: "circle",
  8: "diamond",
  9: "star",
};

/** ToolSettings shape name → Rust `kind` byte. */
export const SHAPE_NAME_KIND: Record<string, number> = {
  rect: 0,
  circle: 1,
  line: 2,
  diamond: 8,
  star: 9,
};

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
