import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolType, ToolSettings } from "@/lib/types";
import type { ImageHorseTool } from "stamp_tool";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

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
 * endpoints for line/arrow). Stroke color/width, the shape type, and the
 * arrow style are intentionally NOT snapshotted here — they're read live
 * from ToolSettings at render and at commit, so panel tweaks made while the
 * overlay is open apply to the pending shape (mirroring how the text tool
 * live-updates its open input).
 */
export interface DrawEditState {
  kind: "shape" | "arrow";
  start: Point;
  end: Point;
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
  if (!constrainRef.current) {
    void import("stamp_tool").then(async (mod) => {
      await mod.default();
      constrainRef.current = mod.constrain_crop_to_ratio;
    }).catch(() => {});
  }

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
      let w = Math.abs(dy) === 0 || Math.abs(dx) / Math.max(Math.abs(dy), 1e-9) > r
        ? Math.abs(dx) : Math.abs(dy) * r;
      let h = Math.abs(dy) === 0 || Math.abs(dx) / Math.max(Math.abs(dy), 1e-9) > r
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
  const preSnapshot = useRef<ImageData | null>(null);
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

  // Live shape annotations (for the Reselect list + canvas hit-test).
  const [shapes, setShapes] = useState<ShapeMeta[]>([]);
  const refreshShapes = useCallback(() => {
    const tool = toolRef.current;
    if (!tool) {
      setShapes([]);
      return;
    }
    try {
      setShapes(JSON.parse(tool.get_shape_annotations()) as ShapeMeta[]);
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
  const commitEdit = useCallback(() => {
    const es = editStateRef.current;
    if (!es) return;
    editStateRef.current = null;
    setEditState(null);
    const tool = toolRef.current;
    if (!tool) return;
    const s = settingsRef.current;
    // Existing-shape edits keep the shape's own style; new shapes read the
    // current toolbar settings live.
    const shapeName = es.style?.shape ?? s.shape ?? "rect";
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
        refreshShapes();
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
      const newId = tool.add_shape_annotation(
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
          label: es.style?.shape ?? "shape",
        });
      }
    }
    flushToCanvas();
    syncState();
    refreshShapes();
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
    (id: number) => {
      const tool = toolRef.current;
      if (!tool) return;
      if (editStateRef.current) commitEdit();
      let list: ShapeMeta[] = [];
      try {
        list = JSON.parse(tool.get_shape_annotations()) as ShapeMeta[];
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

  /** Delete a live shape (from the Reselect list X). One history step. */
  const removeShape = useCallback(
    (id: number) => {
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
      refreshShapes();
    },
    [toolRef, flushToCanvas, syncState, refreshShapes],
  );

  /** Drop an auto-sequenced callout pin at `p`. The sequence index = (max
   *  existing pin index on this photo) + 1, so it resets per photo when the
   *  shape list is reloaded. Diameter follows the Stroke Width slider; the
   *  label style (number vs letter) follows the Pins tab toggle. Pins are a
   *  filled circle bbox + label (Rust kind 5). */
  const dropPin = useCallback(
    (p: Point) => {
      const tool = toolRef.current;
      if (!tool) return;
      const s = settingsRef.current;
      // Map the 1-10 stroke-width slider to a callout-sized disc radius.
      const r = 8 + s.strokeWidth * 3;
      let maxNum = 0;
      try {
        for (const sh of JSON.parse(tool.get_shape_annotations()) as ShapeMeta[]) {
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
      refreshShapes();
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
    refreshShapes();
    const editId = editStateRef.current?.editId;
    if (editId == null) return;
    const tool = toolRef.current;
    let stillThere = false;
    try {
      stillThere = (JSON.parse(tool?.get_shape_annotations() ?? "[]") as ShapeMeta[])
        .some((s) => s.id === editId);
    } catch {
      stillThere = false;
    }
    if (!stillThere) {
      editStateRef.current = null;
      setEditState(null);
      tool?.set_editing_shape(-1);
    }
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

  // Commit triggers — listeners exist only while an edit is pending.
  // Enter commits, Escape cancels.
  useEffect(() => {
    if (!editState) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editState, commitEdit, cancelEdit]);

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
      commitEdit();
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
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (!["arrow", "shapes", "crop"].includes(activeTool)) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      // Starting a new drag on empty canvas commits the pending edit first.
      // commitEdit flushes WASM→canvas synchronously, so the snapshot below
      // includes the just-committed pixels.
      if (editStateRef.current) commitEdit();
      const p = getCoords(e);
      // Pins tab: clicking drops a callout disc, or re-selects an existing pin.
      if (activeTool === "shapes" && penModeRef.current === "pins") {
        const hit = toolRef.current?.shape_annotation_at(p.x, p.y) ?? -1;
        if (hit >= 0) {
          selectShape(hit); // click an existing pin → move it
          return;
        }
        dropPin(p);
        return;
      }
      // Shape/arrow tools: clicking an existing live shape re-selects it for
      // editing instead of starting a brand-new rubber-band drag.
      if (activeTool === "arrow" || activeTool === "shapes") {
        const hit = toolRef.current?.shape_annotation_at(p.x, p.y) ?? -1;
        if (hit >= 0) {
          selectShape(hit);
          return;
        }
      }
      isDrawing.current = true;
      startPoint.current = p;
      lastPoint.current = p;
      preSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (activeTool === "crop") setCropSelection(null);
    },
    [activeTool, canvasRef, getCoords, commitEdit, toolRef, selectShape, dropPin],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || !startPoint.current || !preSnapshot.current)
        return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const p = getCoords(e);
      lastPoint.current = p;
      const start = startPoint.current;
      ctx.putImageData(preSnapshot.current, 0, 0);
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
    [activeTool, canvasRef, getCoords, settings, constrainDrag],
  );

  const onMouseUp = useCallback(() => {
    if (!isDrawing.current || !startPoint.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const start = startPoint.current;
    const end = lastPoint.current ?? start;
    if (activeTool === "crop") {
      if (preSnapshot.current && ctx) {
        ctx.putImageData(preSnapshot.current, 0, 0);
      }
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
      // Edit-overlay flow: erase the rubber-band preview from the 2D canvas
      // and hand the geometry to the SVG overlay instead of committing.
      // Rust rasterization happens once, in commitEdit.
      if (preSnapshot.current && ctx) {
        ctx.putImageData(preSnapshot.current, 0, 0);
      }
      // Ignore stray clicks / sub-3px drags — they'd produce invisible
      // geometry (and, previously, an empty history snapshot).
      if (Math.hypot(end.x - start.x, end.y - start.y) > 3) {
        const next: DrawEditState = {
          kind: activeTool === "arrow" ? "arrow" : "shape",
          start,
          end,
        };
        editStateRef.current = next;
        setEditState(next);
      }
    }
    startPoint.current = null;
    lastPoint.current = null;
    preSnapshot.current = null;
  }, [activeTool, canvasRef, constrainDrag, toolRef, flushToCanvas, syncState, refreshShapes]);

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
