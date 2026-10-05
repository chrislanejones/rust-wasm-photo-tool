// The drawing stack's shared vocabulary — the types CanvasArea, the session
// hooks and the Shapes panel all import, plus the pure helpers that decide
// what a pending edit IS. Moved out of useDrawingTools.ts (which re-exports
// every name here, so no import changed) so the hook file holds the hook.
import type { ShapeName, ToolSettings } from "@/lib/types";
import {
  canonicalCornerRadii,
  effectiveStarPoints,
  type CornerRadii,
  type Point,
} from "@/lib/shapeSloppiness";

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
  /** Degrees, clockwise on screen, about the box center — the rotate
   *  handle's value. GEOMETRY, not style: it lives beside `start`/`end`
   *  because a handle drag changes it, and it is never read from the panel.
   *  Absent = 0. A line never carries one — turning a line moves its
   *  endpoints instead (see lib/shapeRotation.ts). */
  rotation?: number;
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
    /** Interior fill, captured on reselect so it round-trips (every shape in
     *  `FILLABLE_KINDS`). Treated exactly like strokeColor: preserved across
     *  move/resize. */
    fillMode: FillMode;
    fillColor: string;
    fillColor2: string;
    gradientAngle: number;
    /** Mosaic block size (px) for fillMode "pixelate". */
    fillBlock: number;
    /** Star point count (3–12), captured on reselect so a 7-point star
     *  stays a 7-point star. Ignored by every other shape. */
    starPoints: number;
    /** Corner radii (px), captured on reselect so a rounded square stays
     *  rounded. Canonical per shape — see `canonicalCornerRadii`. */
    cornerRadii: CornerRadii;
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
 * The star point count and corner radii a pending edit commits. A reselected
 * shape keeps its own, a new one reads the panel. Both are canonical for the
 * shape: star points ride only on a star (every other kind stores 0, "unset"),
 * and radii only on a rect / diamond / star / triangle — a circle, line, arrow
 * or pin (re-edited as a circle) commits zeros — so nothing carries a stray
 * value into the op log. Radii come back as the `Uint16Array` the engine's
 * `&[u16]` takes.
 */
export function pendingStarAndCorners(
  es: Pick<DrawEditState, "style">,
  panel: Pick<ToolSettings, "starPoints" | "cornerRadii">,
  kind: number,
  shapeName: ShapeName,
): { starPoints: number; cornerRadii: Uint16Array } {
  const starPoints =
    kind === 9 ? effectiveStarPoints(es.style?.starPoints ?? panel.starPoints) : 0;
  const name = es.style?.kindByte === 5 ? "circle" : shapeName;
  const radii = canonicalCornerRadii(name, es.style?.cornerRadii ?? panel.cornerRadii);
  return { starPoints, cornerRadii: Uint16Array.from(radii) };
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
  if (next.starPoints !== prev.starPoints) patch.starPoints = next.starPoints;
  // Element-wise: the canvas corner dots write a fresh array every move, and
  // a new array holding the same four numbers is not an edit.
  if (!sameRadii(next.cornerRadii, prev.cornerRadii)) patch.cornerRadii = next.cornerRadii;
  return Object.keys(patch).length === 0 ? null : patch;
}

function sameRadii(a: CornerRadii | undefined, b: CornerRadii | undefined): boolean {
  const x = a ?? [0, 0, 0, 0];
  const y = b ?? [0, 0, 0, 0];
  return x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && x[3] === y[3];
}

/** One entry from `tool.get_shape_annotations()`. */
export interface ShapeMeta {
  id: number;
  kind: number; // 0=rect,1=circle,2=line,3=handCircle(legacy),4=arrow,5=pin,
                // 6=polyline,7=bezier,8=diamond,9=star,10=triangle
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
  /** Degrees clockwise about the box center. Absent on shapes written
   *  before rotation shipped (they meant 0). */
  rotation?: number;
  /** Star point count; 0 or absent = the classic 5. */
  starPoints?: number;
  /** Corner radii in px (TL, TR, BR, BL on a rect). Absent on shapes written
   *  before corner radius shipped (they meant square corners). */
  cornerRadii?: number[];
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
  10: "triangle",
};

/** ToolSettings shape name → Rust `kind` byte. */
export const SHAPE_NAME_KIND: Record<string, number> = {
  rect: 0,
  circle: 1,
  line: 2,
  diamond: 8,
  star: 9,
  triangle: 10,
};

/** The four interior fills the Shapes panel offers. */
export type FillMode = "none" | "solid" | "gradient" | "pixelate";

/** `fillMode` → Rust `fill_kind` byte, and the inverse. The mapping lives here
 *  beside `SHAPE_NAME_KIND`/`SHAPE_KIND_NAME` rather than as a ladder of
 *  ternaries at the commit site, for the same reason: one place to read, and
 *  `commitEdit` stays under its line cap. */
export const FILL_MODE_KIND: Record<FillMode, number> = {
  none: 0,
  solid: 1,
  gradient: 2,
  pixelate: 3,
};

/** Rust `fill_kind` byte → `fillMode`. An unknown byte reads as "none", which
 *  is what an older save with no fill at all already means. */
export const FILL_KIND_MODE: Record<number, FillMode> = {
  0: "none",
  1: "solid",
  2: "gradient",
  3: "pixelate",
};

/** The `kind` bytes that accept an interior fill — rect, circle, diamond, star,
 *  triangle: every drawn shape that encloses an area. The line (2) is the one
 *  that does not, and the arrow (4) / pin (5) / polyline (6) / pen path (7)
 *  kinds are not bbox shapes. Mirrors `annotations::is_fillable_kind` (Rust);
 *  change both together or a committed fill and the preview disagree. */
export const FILLABLE_KINDS: ReadonlySet<number> = new Set([0, 1, 8, 9, 10]);

/** Does this shape NAME take a Fill section in the Shapes panel? The name twin
 *  of `FILLABLE_KINDS`, for the panel and the overlay, which work in names. */
export function shapeCanFill(shape: ShapeName): boolean {
  return FILLABLE_KINDS.has(SHAPE_NAME_KIND[shape] ?? -1);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * The pending edit a saved shape opens as when it is reselected. Pure: the hook
 * keeps the engine calls (`set_editing_shape`, the flush) and this keeps the
 * mapping, so the mapping is one place to read and the hook stays under its
 * line cap. Callers have already refused the kinds with no bbox-handle
 * representation (polyline 6, Bézier 7).
 */
export function editStateFromShape(sh: ShapeMeta): DrawEditState {
  // Pins (kind 5) edit as a circle handle but keep their pin kind on commit.
  // Kind 3 (legacy hand-drawn circle) rewrote itself into a CIRCLE at
  // render-time the moment this feature shipped, and re-edits as a sloppy
  // circle: its sloppiness field was never written, so seed 100 — the look
  // it was baked with — whenever a kind-3 shape is dropped on the overlay.
  const shapeName: ShapeName =
    sh.kind === 4 || sh.kind === 5
      ? sh.kind === 5
        ? "circle"
        : "line"
      : (SHAPE_KIND_NAME[sh.kind] ?? "rect");
  const sloppiness = sh.sloppiness ?? (sh.kind === 3 ? 100 : 0);
  return {
    kind: sh.kind === 4 ? "arrow" : "shape",
    start: { x: sh.x0, y: sh.y0 },
    end: { x: sh.x1, y: sh.y1 },
    rotation: sh.rotation ?? 0,
    editId: sh.id,
    style: {
      shape: shapeName,
      strokeColor: rgbToHex(sh.r, sh.g, sh.b),
      strokeWidth: sh.stroke_width,
      arrowStyle: sh.arrow_style === 1 ? "double" : "single",
      kindByte: sh.kind,
      sloppiness,
      fillMode: FILL_KIND_MODE[sh.fill_kind] ?? "none",
      fillColor: rgbToHex(sh.fill_r, sh.fill_g, sh.fill_b),
      fillColor2: rgbToHex(sh.fill2_r, sh.fill2_g, sh.fill2_b),
      gradientAngle: sh.fill_angle,
      fillBlock: sh.fill_block ?? 16,
      starPoints: effectiveStarPoints(sh.starPoints),
      cornerRadii: canonicalCornerRadii(shapeName, sh.cornerRadii),
    },
  };
}
