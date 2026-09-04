import { useCallback, useEffect, useRef, useState } from "react";
import { zTargetIndex, type ZMove } from "@/lib/shapeZOrder";
import type { ToolType, ToolSettings } from "@/lib/types";
import type { ImageHorseTool } from "stamp_tool";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useToolStore } from "@/stores/useToolStore";
import { findForeignAnnotation } from "@/lib/annotationHitTest";

export interface Point {
  x: number;
  y: number;
}

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
   *  The type used to be read live from `ToolSettings.shape` like the colour
   *  and the stroke width, and that made picking a different shape in the
   *  panel RETYPE the shape already on the canvas: draw a circle, click
   *  Square, and the circle became a square. Chris's report — "clicking
   *  another shape should not change the last shape created on the canvas,
   *  let it just allow a new shape to be added."
   *
   *  Type is not like colour. A colour tweak is an edit to the thing in front
   *  of you; a shape click is the choice of what you are about to draw NEXT,
   *  which is why `panelStylePatch` already refuses to carry `shape` across to
   *  a RESELECTED shape. This pins the same rule for a freshly drawn one, so
   *  the two paths finally agree. Unset for reselected shapes, which carry
   *  their own type in `style.shape`. */
  drawnShape?: "rect" | "circle" | "handCircle" | "line";
  /** When set, we're editing an EXISTING live shape annotation (this id)
   *  rather than creating a new one. Commit calls update_shape_annotation. */
  editId?: number;
  /** Snapshot of the shape's own kind + style, used when re-selecting an
   *  existing shape so the overlay preview renders with the shape's real
   *  style rather than the current toolbar settings. New shapes leave this
   *  undefined and read settings live. */
  style?: {
    shape: "rect" | "circle" | "handCircle" | "line";
    strokeColor: string;
    strokeWidth: number;
    arrowStyle: "single" | "double";
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
): "rect" | "circle" | "handCircle" | "line" {
  const fromPanel = panelShape as "rect" | "circle" | "handCircle" | "line" | undefined;
  return es?.style?.shape ?? es?.drawnShape ?? fromPanel ?? "rect";
}

/**
 * Which style fields the user just changed in the Shapes panel.
 *
 * This is the fix for the seven-week "a placed square cannot be recoloured"
 * bug. `selectShape` snapshots a reselected shape's own style into
 * `editState.style` so clicking a red square shows it red rather than
 * repainting it with whatever the panel happens to hold. But that snapshot
 * then outranked the panel everywhere (`es.style?.strokeColor ?? s.strokeColor`
 * in `commitEdit`), so a colour change could never reach the shape — and
 * because only a handle drag set `editDirtyRef`, a colour-only edit also took
 * `commitEdit`'s no-op early exit and never called `update_shape_annotation`
 * at all. Two blockers, one symptom.
 *
 * The snapshot is right on reselect and wrong from then on, so it is treated
 * as a DEFAULT rather than an override: diff the panel against its own
 * PREVIOUS value and carry across only what actually changed. Comparing
 * against the shape instead would repaint it the moment it was selected,
 * which is the behaviour the snapshot exists to prevent.
 *
 * Returns `null` when nothing changed, so the caller can skip the re-render
 * and — more importantly — avoid marking the edit dirty, which would push a
 * spurious "Edit Shape" step onto the undo stack for merely selecting.
 *
 * `shape` is deliberately absent: `kindByte` preserves a pin's real kind
 * across an edit, so retyping a committed shape is a separate operation and
 * not something a colour click should trigger.
 */
export function panelStylePatch(
  prev: ToolSettings,
  next: ToolSettings,
): ShapeStylePatch | null {
  const patch: ShapeStylePatch = {};
  if (next.strokeColor !== prev.strokeColor) patch.strokeColor = next.strokeColor;
  if (next.strokeWidth !== prev.strokeWidth) patch.strokeWidth = next.strokeWidth;
  if (next.arrowStyle !== prev.arrowStyle) patch.arrowStyle = next.arrowStyle;
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
  kind: number; // 0=rect,1=circle,2=line,3=handCircle,4=arrow,5=pin,6=polyline
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  g: number;
  b: number;
  stroke_width: number;
  arrow_style: number;
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

/** Rust shape `kind` byte → ToolSettings shape name (non-arrow kinds). */
const SHAPE_KIND_NAME: Record<number, "rect" | "circle" | "handCircle" | "line"> = {
  0: "rect",
  1: "circle",
  2: "line",
  3: "handCircle",
};

/** ToolSettings shape name → Rust `kind` byte. */
const SHAPE_NAME_KIND: Record<string, number> = {
  rect: 0,
  circle: 1,
  line: 2,
  handCircle: 3,
};

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

interface UseDrawingToolsOptions {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** The rubber-band preview surface (`DrawPreviewOverlay`) — a transparent
   *  sibling of the main canvas at the same resolution and transform.
   *
   *  Every preview stroke goes HERE, never on `canvasRef`. The main canvas is
   *  the engine's output surface and nothing in React may draw on it: that is
   *  the project's engine-owns-pixels invariant, and it is also what ADR-024
   *  Stage 4 needs, since a canvas handed to a worker via
   *  `transferControlToOffscreen()` can no longer return a 2D context here.
   *
   *  Optional so the hook still functions if the overlay has not mounted yet
   *  (first frame); the preview is simply not drawn until it has. */
  previewRef?: React.RefObject<HTMLCanvasElement | null>;
  activeTool: ToolType;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
  /** "pins" when the Shapes tool's Pins tab is active (click drops a callout
   *  disc); `null` for the normal Shapes/Arrows rubber-band behavior. */
  penMode?: "pins" | null;
  /** Locked aspect ratio for crop drags as `[w, h]`. Null = free drag. */
  cropRatio?: [number, number] | null;
  /** Image dimensions used to clip the constrained crop to the canvas. */
  imageWidth?: number;
  imageHeight?: number;
}

export function useDrawingTools({
  toolRef,
  canvasRef,
  previewRef,
  activeTool,
  settings,
  flushToCanvas,
  syncState,
  penMode,
  cropRatio,
  imageWidth,
  imageHeight,
}: UseDrawingToolsOptions) {
  // Pins sub-mode kept in a ref so the stable mouse callbacks read the freshest
  // value.
  const penModeRef = useRef(penMode);
  penModeRef.current = penMode;
  // Keep ratio + image dims in a ref so onMouseMove/Up closures see the
  // freshest values without forcing a reattach of all the handlers.
  const cropRatioRef = useRef(cropRatio);
  cropRatioRef.current = cropRatio;
  const imageDimsRef = useRef({ w: imageWidth ?? 0, h: imageHeight ?? 0 });
  imageDimsRef.current = { w: imageWidth ?? 0, h: imageHeight ?? 0 };

  // Cache the synchronous Rust constrain entry point. WASM is already
  // initialized by the time the crop tool is reachable, but we fall back
  // to a JS computation if it's somehow missing.
  const constrainRef = useRef<
    | ((
        sx: number, sy: number, ex: number, ey: number,
        rw: number, rh: number, iw: number, ih: number,
      ) => Uint32Array | undefined)
    | null
  >(null);
  // Warm the cache from an effect, not from the render body. The import is
  // async either way, so `constrainRef.current` is null immediately after the
  // first render in both versions, and the only reader (`constrainDrag`) runs
  // from pointer handlers long after mount — with a JS fallback if the cache is
  // still cold. Starting it during render was a side effect in the render
  // phase, which a discarded/replayed render would fire spuriously.
  useEffect(() => {
    if (constrainRef.current) return;
    void import("stamp_tool")
      .then(async (mod) => {
        await mod.default();
        constrainRef.current = mod.constrain_crop_to_ratio;
      })
      .catch(() => {});
  }, []);

  /** Apply the locked-ratio constraint to a raw drag rect. Returns null
   *  when no ratio is locked so callers fall back to the free path. */
  const constrainDrag = useCallback(
    (start: Point, end: Point): { x: number; y: number; w: number; h: number } | null => {
      const ratio = cropRatioRef.current;
      const dims = imageDimsRef.current;
      if (!ratio || !dims.w || !dims.h) return null;
      const fn = constrainRef.current;
      if (fn) {
        const out = fn(
          Math.round(start.x), Math.round(start.y),
          Math.round(end.x), Math.round(end.y),
          ratio[0], ratio[1],
          dims.w, dims.h,
        );
        if (out && out.length === 4) {
          return { x: out[0], y: out[1], w: out[2], h: out[3] };
        }
      }
      // Cold-cache JS fallback — equivalent geometry.
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const r = ratio[0] / ratio[1];
      const w = Math.abs(dy) === 0 || Math.abs(dx) / Math.max(Math.abs(dy), 1e-9) > r
        ? Math.abs(dx) : Math.abs(dy) * r;
      const h = Math.abs(dy) === 0 || Math.abs(dx) / Math.max(Math.abs(dy), 1e-9) > r
        ? Math.abs(dx) / r : Math.abs(dy);
      let x = start.x;
      let y = start.y;
      if (dx < 0) x -= w;
      if (dy < 0) y -= h;
      return {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        w: Math.max(1, Math.round(w)),
        h: Math.max(1, Math.round(h)),
      };
    },
    [],
  );
  const isDrawing = useRef(false);
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);

  // The preview surface's 2D context, or null while it is unmounted.
  //
  // There used to be a `preSnapshot` ImageData ref here holding a full-canvas
  // copy taken on mousedown, restored on every pointermove and again on mouseup
  // to erase the rubber band. Drawing on a transparent overlay removes the need
  // for it entirely — `clearRect` erases in constant time instead of blitting a
  // 12-megapixel copy back.
  const previewCtx = useCallback(() => {
    const c = previewRef?.current;
    if (!c) return null;
    return c.getContext("2d");
  }, [previewRef]);

  /** Wipe the rubber band. Safe to call when nothing is drawn or unmounted. */
  const clearPreviewSurface = useCallback(() => {
    const c = previewRef?.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }, [previewRef]);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(
    null,
  );

  // ── Shape/arrow edit overlay state ─────────────────────────────────
  const [editState, setEditState] = useState<DrawEditState | null>(null);
  const editStateRef = useRef<DrawEditState | null>(null);
  editStateRef.current = editState;
  // Fresh settings for commit-time reads from stable callbacks.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // True once the user actually drags an existing-shape selection — lets
  // commitEdit skip a no-op "Edit Shape" history entry when a selection is
  // committed without being moved.
  const editDirtyRef = useRef(false);

  // Baseline the panel is diffed against by `panelStylePatch`. Declared up here
  // with the other refs because `selectShape` re-seeds it from the shape it is
  // opening, and reading it from below its own declaration is needlessly
  // fragile.
  const prevStyleSettingsRef = useRef(settings);

  // Live shape annotations (for the Reselect list + canvas hit-test).
  const [shapes, setShapes] = useState<ShapeMeta[]>([]);
  // Mirror for callbacks that must read the CURRENT draw order without being
  // re-created on every refresh (`moveShape`, and the keydown effect that
  // calls it). Same reason `editStateRef` exists beside `editState`.
  const shapesRef = useRef<ShapeMeta[]>([]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);
  // ADR-024 Stage 3.5. `try/catch` keeps working around the await: a rejected
  // engine call lands in the same catch that a malformed JSON string does, and
  // the fallback is the same empty list.
  const refreshShapes = useCallback(async () => {
    const tool = toolRef.current;
    if (!tool) {
      setShapes([]);
      return;
    }
    try {
      setShapes(JSON.parse(await tool.get_shape_annotations()) as ShapeMeta[]);
    } catch {
      setShapes([]);
    }
  }, [toolRef]);

  /**
   * Commit the pending shape/arrow as a live (non-destructive) annotation:
   * `add_shape_annotation` for a freshly drawn shape, or
   * `update_shape_annotation` when re-editing an existing one. All pixel work
   * stays in Rust; the shape remains re-selectable. No-op when nothing is
   * pending, so every trigger can call it unconditionally.
   */
  const commitEdit = useCallback(async () => {
    const es = editStateRef.current;
    if (!es) return;
    editStateRef.current = null;
    setEditState(null);
    const tool = toolRef.current;
    if (!tool) return;
    const s = settingsRef.current;
    // Existing-shape edits keep the shape's own style; new shapes read the
    // current toolbar settings live — except the TYPE, which every pending
    // shape pins at draw time (see `pendingShapeType` / `drawnShape`).
    const shapeName = pendingShapeType(es, s.shape);
    const strokeColor = es.style?.strokeColor ?? s.strokeColor;
    const strokeWidth = es.style?.strokeWidth ?? s.strokeWidth;
    const arrowStyle = es.style?.arrowStyle ?? s.arrowStyle;
    // Preserve the shape's real kind across an edit (e.g. a pin = kind 5 is
    // shown as a circle handle but must commit as a pin).
    const kind =
      es.style?.kindByte ??
      (es.kind === "arrow" ? 4 : (SHAPE_NAME_KIND[shapeName] ?? 0));
    const arrowByte = arrowStyle === "double" ? 1 : 0;
    // Interior fill — only rect (0) / circle (1) accept it; everything else
    // commits with fill_kind 0. Existing-shape edits keep the shape's captured
    // fill (so move/resize doesn't swap it to the panel's current fill); new
    // shapes read the live panel settings — mirrors strokeColor above.
    const fillMode = es.style?.fillMode ?? s.fillMode;
    const fillColor = es.style?.fillColor ?? s.fillColor;
    const fillColor2 = es.style?.fillColor2 ?? s.fillColor2;
    const gradientAngle = es.style?.gradientAngle ?? s.gradientAngle;
    const fillBlock = es.style?.fillBlock ?? s.fillBlock;
    const canFill = kind === 0 || kind === 1;
    const fillKind = canFill
      ? fillMode === "solid"
        ? 1
        : fillMode === "gradient"
          ? 2
          : fillMode === "pixelate"
            ? 3
            : 0
      : 0;
    const fillHex = fillColor ?? "#000000";
    const fill2Hex = fillColor2 ?? "#000000";
    const fillAngle = gradientAngle ?? 0;
    const fillBlockVal = fillBlock ?? 16;
    if (es.editId != null) {
      // Re-selection committed without a drag → just un-hide it, no history.
      if (!editDirtyRef.current) {
        tool.set_editing_shape(-1);
        flushToCanvas();
        await refreshShapes();
        return;
      }
      tool.update_shape_annotation(
        es.editId,
        kind,
        es.start.x,
        es.start.y,
        es.end.x,
        es.end.y,
        strokeColor,
        strokeWidth,
        arrowByte,
        fillKind,
        fillHex,
        fill2Hex,
        fillAngle,
        fillBlockVal,
      );
      tool.set_editing_shape(-1);
    } else {
      const newId = await tool.add_shape_annotation(
        kind,
        es.start.x,
        es.start.y,
        es.end.x,
        es.end.y,
        strokeColor,
        strokeWidth,
        arrowByte,
        fillKind,
        fillHex,
        fill2Hex,
        fillAngle,
        fillBlockVal,
      );
      // The just-drawn shape becomes the Align/Placement target, so the
      // grid (and numpad 1-9) can place it immediately after drawing.
      if (newId >= 0) {
        useAnnotationStore.getState().setSelectedObject({
          key: `s${newId}`,
          type: "shape",
          id: newId,
          label: shapeName,
        });
      }
    }
    flushToCanvas();
    syncState();
    await refreshShapes();
  }, [toolRef, flushToCanvas, syncState, refreshShapes]);

  /** Escape: drop the pending edit. For an existing-shape edit this also
   *  un-hides the committed shape (clears the Rust editing flag) and repaints. */
  const cancelEdit = useCallback(() => {
    const es = editStateRef.current;
    editStateRef.current = null;
    setEditState(null);
    if (es?.editId != null) {
      toolRef.current?.set_editing_shape(-1);
      flushToCanvas();
    }
  }, [toolRef, flushToCanvas]);

  /** Load an existing live shape into the edit overlay so it can be moved,
   *  resized, or re-angled. The committed shape is suppressed from the Rust
   *  render while editing (the overlay preview stands in for it). */
  const selectShape = useCallback(
    async (id: number) => {
      const tool = toolRef.current;
      if (!tool) return;
      // AWAITED, not fire-and-forget. `commitEdit` writes the pending shape into
      // the engine, and the very next line reads the annotation list back — so
      // dropping the await would race the read against the write and the list
      // could arrive without the shape just committed.
      if (editStateRef.current) await commitEdit();
      let list: ShapeMeta[];
      try {
        list = JSON.parse(await tool.get_shape_annotations()) as ShapeMeta[];
      } catch {
        list = [];
      }
      const sh = list.find((s) => s.id === id);
      if (!sh) return;
      // Freehand polylines (kind 6) have no bbox-handle representation — they're
      // delete-only via the Reselect panel. Ignore reselect for them.
      if (sh.kind === 6) return;
      // Bézier pen paths (kind 7) are edited by the PenOverlay (anchors +
      // control points), never by the rect-bbox handles. They used to fall
      // through `SHAPE_KIND_NAME[kind] ?? "rect"` below, which hid the baked
      // path via set_editing_shape and drew a rectangle in its place — so
      // reselecting a path made it VANISH. AppShell routes kind 7 to the pen
      // overlay instead (see handleSelectObject).
      if (sh.kind === 7) return;
      // Pins (kind 5) edit as a circle handle but keep their pin kind on commit.
      const shapeName: "rect" | "circle" | "handCircle" | "line" =
        sh.kind === 4 || sh.kind === 5
          ? sh.kind === 5
            ? "circle"
            : "line"
          : (SHAPE_KIND_NAME[sh.kind] ?? "rect");
      const next: DrawEditState = {
        kind: sh.kind === 4 ? "arrow" : "shape",
        start: { x: sh.x0, y: sh.y0 },
        end: { x: sh.x1, y: sh.y1 },
        editId: id,
        style: {
          shape: shapeName,
          strokeColor: rgbToHex(sh.r, sh.g, sh.b),
          strokeWidth: sh.stroke_width,
          arrowStyle: sh.arrow_style === 1 ? "double" : "single",
          kindByte: sh.kind,
          fillMode:
            sh.fill_kind === 1
              ? "solid"
              : sh.fill_kind === 2
                ? "gradient"
                : sh.fill_kind === 3
                  ? "pixelate"
                  : "none",
          fillColor: rgbToHex(sh.fill_r, sh.fill_g, sh.fill_b),
          fillColor2: rgbToHex(sh.fill2_r, sh.fill2_g, sh.fill2_b),
          gradientAngle: sh.fill_angle,
          fillBlock: sh.fill_block ?? 16,
        },
      };
      tool.set_editing_shape(id);
      flushToCanvas();
      editDirtyRef.current = false;
      editStateRef.current = next;
      setEditState(next);
      // Load the shape's style INTO the panel, and seed the diff baseline with
      // the same values so this sync is not mistaken for a user edit.
      //
      // Without this the panel keeps whatever was last used, which made
      // `panelStylePatch` unable to see a real edit: reselect an orange shape
      // while the panel still reads purple, click purple because that is the
      // colour you want, and the panel's value does not change — so the diff
      // returned null, the shape stayed orange, and nothing reached history.
      // Syncing here makes "the panel value changed" mean exactly "the user
      // changed a control", which is the invariant the diff depends on. It also
      // stops the panel lying about what is selected, and makes the baseline
      // the SHAPE's style, so changing only the width can no longer drag a
      // stale panel colour along with it.
      const synced: ToolSettings = {
        ...settingsRef.current,
        strokeColor: next.style!.strokeColor,
        strokeWidth: next.style!.strokeWidth,
        arrowStyle: next.style!.arrowStyle,
        fillMode: next.style!.fillMode,
        fillColor: next.style!.fillColor,
        fillColor2: next.style!.fillColor2,
        gradientAngle: next.style!.gradientAngle,
        fillBlock: next.style!.fillBlock,
      };
      prevStyleSettingsRef.current = synced;
      useToolStore.getState().setToolSettings((p) => ({ ...p, ...synced }));
      // Selecting a shape — from the canvas OR the Reselect list — makes it
      // the object the Align/Placement grid acts on. Previously only the
      // Reselect list set this, so the grid stayed disabled for objects
      // selected directly on canvas.
      useAnnotationStore.getState().setSelectedObject({
        key: `s${id}`,
        type: "shape",
        id,
        label: shapeName,
      });
    },
    [toolRef, commitEdit, flushToCanvas],
  );

  /** Restack a live shape — bring forward / send backward / to front / to
   *  back. One "Reorder Shape" history step; resolves false (and touches
   *  nothing) when the move is already satisfied. Z-order is the engine's
   *  list order, so this is one `move_shape_annotation` call — ADR-044. */
  const moveShape = useCallback(
    async (id: number, dir: ZMove): Promise<boolean> => {
      const tool = toolRef.current;
      if (!tool) return false;
      const to = zTargetIndex(
        shapesRef.current.map((s) => s.id),
        id,
        dir,
      );
      if (to === null) return false;
      if (!(await tool.move_shape_annotation(id, to))) return false;
      flushToCanvas();
      syncState();
      await refreshShapes();
      return true;
    },
    [toolRef, flushToCanvas, syncState, refreshShapes],
  );

  /** Delete a live shape (from the Reselect list X). One history step. */
  const removeShape = useCallback(
    async (id: number) => {
      const tool = toolRef.current;
      if (!tool) return;
      if (editStateRef.current?.editId === id) {
        editStateRef.current = null;
        setEditState(null);
        tool.set_editing_shape(-1);
      }
      tool.remove_shape_annotation(id);
      // A deleted shape can't stay the Align target.
      useAnnotationStore
        .getState()
        .setSelectedObject((prev) =>
          prev?.type === "shape" && prev.id === id ? null : prev,
        );
      flushToCanvas();
      syncState();
      await refreshShapes();
    },
    [toolRef, flushToCanvas, syncState, refreshShapes],
  );

  /** Drop an auto-sequenced callout pin at `p`. The sequence index = (max
   *  existing pin index on this photo) + 1, so it resets per photo when the
   *  shape list is reloaded. Diameter follows the Stroke Width slider; the
   *  label style (number vs letter) follows the Pins tab toggle. Pins are a
   *  filled circle bbox + label (Rust kind 5). */
  const dropPin = useCallback(
    async (p: Point) => {
      const tool = toolRef.current;
      if (!tool) return;
      const s = settingsRef.current;
      // Map the 1-10 stroke-width slider to a callout-sized disc radius.
      const r = 8 + s.strokeWidth * 3;
      let maxNum = 0;
      try {
        for (const sh of JSON.parse(await tool.get_shape_annotations()) as ShapeMeta[]) {
          if (sh.kind === 5 && sh.number > maxNum) maxNum = sh.number;
        }
      } catch {
        /* ignore parse errors — start from 1 */
      }
      const labelKind = s.pinLabel === "letters" ? 1 : 0;
      tool.add_pin_annotation(
        p.x - r, p.y - r, p.x + r, p.y + r,
        maxNum + 1, s.strokeColor, labelKind,
      );
      flushToCanvas();
      syncState();
      await refreshShapes();
    },
    [toolRef, flushToCanvas, syncState, refreshShapes],
  );

  // Refresh the shape list after any external history change (undo/redo/jump
  // restore a different shape overlay). Same event the text tool listens to.
  // If the shape currently being edited vanished (undone away), drop the
  // overlay so we don't leave a hidden shape with no preview.
  // Was a `text-annotations-changed` window event before stage 4; now driven by
  // the annotation-revision counter in the store. prevRev skips the mount run so
  // this fires only on an actual bump (matching the old event-only semantics).
  const annotationsRevision = useAnnotationStore((s) => s.annotationsRevision);
  const prevAnnotationsRev = useRef(annotationsRevision);
  useEffect(() => {
    if (prevAnnotationsRev.current === annotationsRevision) return;
    prevAnnotationsRev.current = annotationsRevision;
    // ADR-024 Stage 3.5. An effect callback cannot be `async` — React reads the
    // returned Promise as its cleanup — so this is an async IIFE with a
    // cancellation flag.
    //
    // THE FLAG MATTERS HERE. This fires on every undo/redo/history jump, so two
    // revisions can be in flight at once behind the worker and land in either
    // order. The stale one would tear down an edit overlay the newer revision
    // had just confirmed is still valid, leaving a hidden shape with no preview
    // — exactly the state this effect exists to prevent.
    //
    // `await tool?.get_shape_annotations() ?? "[]"` keeps the optional chain's
    // short-circuit: with no tool the await yields `undefined` and `??` supplies
    // the empty list, same as before.
    let cancelled = false;
    void (async () => {
      await refreshShapes();
      const editId = editStateRef.current?.editId;
      if (cancelled || editId == null) return;
      const tool = toolRef.current;
      let stillThere: boolean;
      try {
        stillThere = (
          JSON.parse((await tool?.get_shape_annotations()) ?? "[]") as ShapeMeta[]
        ).some((s) => s.id === editId);
      } catch {
        stillThere = false;
      }
      if (cancelled) return;
      if (!stillThere) {
        editStateRef.current = null;
        setEditState(null);
        tool?.set_editing_shape(-1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [annotationsRevision, refreshShapes, toolRef]);

  /** Overlay handle drags push new geometry here (canvas coords). */
  const updateEditGeometry = useCallback((start: Point, end: Point) => {
    editDirtyRef.current = true;
    setEditState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, start, end };
      editStateRef.current = next;
      return next;
    });
  }, []);

  // Panel restyles of a RESELECTED shape — see `panelStylePatch`.
  useEffect(() => {
    const prev = prevStyleSettingsRef.current;
    prevStyleSettingsRef.current = settings;
    const es = editStateRef.current;
    // No snapshot = a brand-new shape, which already reads the panel live.
    if (!es?.style) return;
    const patch = panelStylePatch(prev, settings);
    if (!patch) return;
    editDirtyRef.current = true;
    setEditState((cur) => {
      if (!cur?.style) return cur;
      const next = { ...cur, style: { ...cur.style, ...patch } };
      editStateRef.current = next;
      return next;
    });
  }, [settings]);

  // Key triggers — listeners exist only while an edit is pending.
  // Enter commits, Escape cancels, Delete/Backspace deletes, and Ctrl+Z
  // drops an UNCOMMITTED change instead of reaching the engine.
  //
  // CAPTURE phase, deliberately. useKeyboardShortcuts binds Ctrl+Z on the same
  // window in the bubble phase; a capture listener runs first and can stop it
  // for the one case where engine undo is the wrong answer (below).
  useEffect(() => {
    if (!editState) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const es = editStateRef.current;
      if (!es) return;
      if (e.key === "Enter") {
        e.preventDefault();
        // `void`: a DOM listener cannot await, and since Stage 3.5 this returns
        // a Promise. Marked rather than ignored — same as the pointerdown below.
        void commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // The Reselect list's ✕ row handles its own Delete and calls
        // preventDefault — yield to it, or one keypress deletes two shapes.
        if (e.defaultPrevented) return;
        e.preventDefault();
        if (es.editId != null) {
          // A selected committed shape: one "Delete Shape" history step.
          void removeShape(es.editId);
        } else {
          // A drawn-but-uncommitted shape: nothing is in the engine yet, so
          // there is nothing to snap — just drop it.
          cancelEdit();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.code === "ArrowUp" || e.code === "ArrowDown") &&
        es.editId != null
      ) {
        // Restack the SELECTED committed shape. Ctrl+Shift+↑/↓ one step, add
        // Alt to go all the way. The bracket chords were the obvious choice
        // and every one of them is taken — Ctrl+[ ] is brush size and
        // Ctrl+Shift+[ ] is LAYER front/back — so shapes get the arrows.
        e.preventDefault();
        const up = e.code === "ArrowUp";
        void moveShape(es.editId, e.altKey ? (up ? "front" : "back") : up ? "forward" : "backward");
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        // Ctrl+Z with an uncommitted change: the change the user SEES is the
        // pending one, and it is not in the engine. Letting the engine undo
        // run would step back over the PREVIOUS action while the pending
        // shape stayed on screen — "undo skipped one". So the pending change
        // is the step: discard it (same as Escape) and stop the engine undo.
        // A clean re-selection has no pending change and falls through.
        if (es.editId == null || editDirtyRef.current) {
          e.preventDefault();
          e.stopImmediatePropagation();
          cancelEdit();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editState, commitEdit, cancelEdit, removeShape, moveShape]);

  // Escape releases a pending crop selection (Edit & Transform tool) without
  // applying it — bound only while a crop rect actually exists.
  useEffect(() => {
    if (activeTool !== "crop" || !cropSelection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      e.preventDefault();
      setCropSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTool, cropSelection]);

  // Pointerdown anywhere outside the overlay commits, except:
  //   • the overlay itself (handles/body — `[data-draw-overlay]`),
  //   • the shapes/arrows settings panel (`[data-draw-panel]`) so stroke and
  //     color tweaks can live-update the pending shape (text-tool pattern),
  //   • the canvas — onMouseDown owns that path (commit, then start the
  //     next rubber-band drag) and pan mode must not commit.
  useEffect(() => {
    if (!editState) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target === canvasRef.current) return;
      if (target.closest("[data-draw-overlay]")) return;
      if (target.closest("[data-draw-panel]")) return;
      void commitEdit();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [editState, commitEdit, canvasRef]);

  // Switching tools commits the pending edit. This also covers the
  // Shapes ⇄ Arrows tab, which flips the effective tool passed in here.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      prevToolRef.current = activeTool;
      commitEdit(); // no-op when nothing is pending
    }
  }, [activeTool, commitEdit]);

  const getCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * canvas.width) / rect.width,
        y: ((e.clientY - rect.top) * canvas.height) / rect.height,
      };
    },
    [canvasRef],
  );

  const onMouseDown = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (!["arrow", "shapes", "crop"].includes(activeTool)) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Starting a new drag on empty canvas commits the pending edit first, so
      // the committed geometry is in the engine before a new one begins.
      //
      // AWAITED, and this one is load-bearing: the comment above states the
      // ordering as a requirement, and the hit-test two lines down reads the
      // annotation list that `commitEdit` writes to. Fire-and-forget here would
      // let the hit-test run against a list that does not yet contain the shape
      // just committed — the click would miss it and start a new drag instead
      // of re-selecting.
      if (editStateRef.current) await commitEdit();
      // `p` is read off the event BEFORE any await; after one, `e` is only safe
      // for values already destructured out of it.
      const p = getCoords(e);
      // Pins tab: clicking drops a callout disc, or re-selects an existing pin.
      if (activeTool === "shapes" && penModeRef.current === "pins") {
        // `await` outside the optional chain keeps the short-circuit: with no
        // tool the await yields `undefined` and `?? -1` supplies the miss.
        const hit = (await toolRef.current?.shape_annotation_at(p.x, p.y)) ?? -1;
        if (hit >= 0) {
          await selectShape(hit); // click an existing pin → move it
          return;
        }
        // #50 — a miss on the ACTIVE layer is not proof the canvas is empty.
        // Without this, clicking a pin that lives on another layer drops a
        // SECOND pin on top of it. See lib/annotationHitTest.ts.
        if (toolRef.current && (await findForeignAnnotation(toolRef.current, p.x, p.y))) {
          return;
        }
        await dropPin(p);
        return;
      }
      // Shape/arrow tools: clicking an existing live shape re-selects it for
      // editing instead of starting a brand-new rubber-band drag.
      if (activeTool === "arrow" || activeTool === "shapes") {
        const hit = (await toolRef.current?.shape_annotation_at(p.x, p.y)) ?? -1;
        if (hit >= 0) {
          await selectShape(hit);
          return;
        }
        // #50, same rule as the pins branch: a shape on another visible layer
        // is something the user can see and was aiming at. Starting a fresh
        // rubber-band drag across it is the one wrong answer.
        if (toolRef.current && (await findForeignAnnotation(toolRef.current, p.x, p.y))) {
          return;
        }
      }
      isDrawing.current = true;
      startPoint.current = p;
      lastPoint.current = p;
      clearPreviewSurface(); // a stale band from an aborted drag must not linger
      if (activeTool === "crop") setCropSelection(null);
    },
    [
      activeTool,
      canvasRef,
      getCoords,
      commitEdit,
      toolRef,
      selectShape,
      dropPin,
      clearPreviewSurface,
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || !startPoint.current) return;
      const canvas = canvasRef.current;
      const ctx = previewCtx();
      if (!canvas || !ctx) return;
      const p = getCoords(e);
      lastPoint.current = p;
      const start = startPoint.current;
      // Erase last frame's band. The overlay is transparent, so this reveals
      // the engine's pixels underneath rather than needing them blitted back.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (activeTool === "arrow") {
        drawArrowPreview(
          ctx,
          start,
          p,
          settings.strokeColor,
          settings.strokeWidth,
          settings.arrowStyle,
        );
      } else if (activeTool === "shapes") {
        drawShapePreview(
          ctx,
          start,
          p,
          settings.shape ?? "rect",
          settings.strokeColor,
          settings.strokeWidth,
        );
      } else if (activeTool === "crop") {
        // If a ratio is locked, snap the drag rect via Rust; otherwise free.
        const constrained = constrainDrag(start, p);
        const x = constrained ? constrained.x : Math.min(start.x, p.x);
        const y = constrained ? constrained.y : Math.min(start.y, p.y);
        const w = constrained ? constrained.w : Math.abs(p.x - start.x);
        const h = constrained ? constrained.h : Math.abs(p.y - start.y);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, y);
        ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));
        ctx.fillRect(0, y, x, h);
        ctx.fillRect(x + w, y, canvas.width - (x + w), h);
        ctx.strokeStyle = "white";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }
    },
    [activeTool, canvasRef, getCoords, settings, constrainDrag, previewCtx],
  );

  const onMouseUp = useCallback(() => {
    if (!isDrawing.current || !startPoint.current) return;
    isDrawing.current = false;
    const start = startPoint.current;
    const end = lastPoint.current ?? start;
    // One clear covers every branch — the band is gone the moment the drag
    // ends, whether it produced a crop rect, an edit overlay, or nothing.
    clearPreviewSurface();
    if (activeTool === "crop") {
      const constrained = constrainDrag(start, end);
      const x = constrained ? constrained.x : Math.min(start.x, end.x);
      const y = constrained ? constrained.y : Math.min(start.y, end.y);
      const w = constrained ? constrained.w : Math.abs(end.x - start.x);
      const h = constrained ? constrained.h : Math.abs(end.y - start.y);
      if (w > 5 && h > 5) {
        setCropSelection({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(w),
          height: Math.round(h),
        });
      }
    } else if (activeTool === "arrow" || activeTool === "shapes") {
      // Edit-overlay flow: the rubber band is already gone (cleared above) and
      // the geometry goes to the SVG overlay instead of being committed. Rust
      // rasterization happens once, in commitEdit.
      // Ignore stray clicks / sub-3px drags — they'd produce invisible
      // geometry (and, previously, an empty history snapshot).
      if (Math.hypot(end.x - start.x, end.y - start.y) > 3) {
        const next: DrawEditState = {
          kind: activeTool === "arrow" ? "arrow" : "shape",
          start,
          end,
          // Pin the type the user actually drew. Everything else about a new
          // shape still tracks the panel live; the type does not.
          drawnShape: settingsRef.current.shape ?? "rect",
        };
        editStateRef.current = next;
        setEditState(next);
      }
    }
    startPoint.current = null;
    lastPoint.current = null;
  }, [activeTool, constrainDrag, clearPreviewSurface]);

  const applyCrop = useCallback(() => {
    const tool = toolRef.current;
    const sel = cropSelection;
    if (!tool || !sel) return;
    tool.crop(sel.x, sel.y, sel.width, sel.height);
    flushToCanvas();
    // FIX (issue #3): call syncState so new dimensions + history entry
    // propagate to React. Without this, Apply Crop appears to do nothing
    // and the undo stack stays stuck at the previous count.
    syncState();
    setCropSelection(null);
  }, [toolRef, cropSelection, flushToCanvas, syncState]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cropSelection,
    setCropSelection,
    applyCrop,
    clearCropSelection: () => setCropSelection(null),
    editState,
    updateEditGeometry,
    commitEdit,
    cancelEdit,
    // Live shape annotations (Reselect list + selection)
    shapes,
    refreshShapes,
    selectShape,
    removeShape,
    moveShape,
  };
}

/* ------------------------------------------------------------------ */
/* JS preview functions (used during the initial rubber-band drag only).*/
/* These run on Canvas2D for real-time feedback. On mouseup the geometry */
/* becomes a DrawEditState (Figma-style overlay); the Rust commit happens */
/* in commitEdit via tool.add_shape_annotation / update_shape_annotation. */
/* ------------------------------------------------------------------ */

function drawArrowPreview(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  width: number,
  style: "single" | "double",
) {
  const headLength = Math.max(20, width * 3);
  const headWidth = Math.PI / 5;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const endX = to.x - headLength * 0.5 * Math.cos(angle);
  const endY = to.y - headLength * 0.5 * Math.sin(angle);
  const startX =
    style === "double" ? from.x + headLength * 0.5 * Math.cos(angle) : from.x;
  const startY =
    style === "double" ? from.y + headLength * 0.5 * Math.sin(angle) : from.y;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const drawHead = (x: number, y: number, a: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - headLength * Math.cos(a - headWidth),
      y - headLength * Math.sin(a - headWidth),
    );
    ctx.lineTo(
      x - headLength * Math.cos(a + headWidth),
      y - headLength * Math.sin(a + headWidth),
    );
    ctx.closePath();
    ctx.fill();
  };

  drawHead(to.x, to.y, angle);
  if (style === "double") drawHead(from.x, from.y, angle + Math.PI);
}

function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  shape: string,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);

  ctx.beginPath();

  switch (shape) {
    case "rect":
      ctx.strokeRect(x, y, w, h);
      break;

    case "circle": {
      const r = Math.min(w, h) / 2;
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case "handCircle": {
      // Hand-drawn circle preview — wobbly ellipse with tail
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const points = 60;

      const startOffset = (from.x * 31.17 + from.y * 47.53) % (Math.PI * 2);
      const mainArc = Math.PI * 2 - Math.PI * 0.15;
      const seed =
        from.x * 31.17 + from.y * 47.53 + to.x * 13.91 + to.y * 67.37;

      const getNoise = (angle: number) =>
        Math.sin(angle * 2.3 + seed) * 3 +
        Math.sin(angle * 1.1 + seed * 0.7) * 2 +
        Math.cos(angle * 3.7 + seed * 1.3) * 1.5;

      const tilt = (((seed * 1000) % 1000) / 1000 - 0.5) * 0.15;

      // Tail
      const tailLength = Math.PI * 0.3;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const angle = startOffset - tailLength * (1 - t);
        const noise = getNoise(angle) * t;
        const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
        const inward = (1 - t) * (rx * 0.15);
        const px =
          cx + (rx * squeeze - inward + noise) * Math.cos(angle + tilt);
        const py =
          cy + (ry / squeeze - inward + noise) * Math.sin(angle + tilt);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      // Main circle
      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const angle = startOffset + t * mainArc;
        const noise = getNoise(angle);
        const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
        const px = cx + (rx * squeeze + noise) * Math.cos(angle + tilt);
        const py = cy + (ry / squeeze + noise) * Math.sin(angle + tilt);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }

    case "line":
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
  }
}
