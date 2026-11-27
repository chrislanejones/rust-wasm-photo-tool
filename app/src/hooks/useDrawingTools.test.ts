// ===== FILE: app/src/hooks/useDrawingTools.test.ts =====
// Covers `panelStylePatch`, the decision at the center of the seven-week
// "draw a square, click it again, change the color — nothing happens" bug.
//
// The engine side was never broken: `update_shape_annotation` already wrote
// the color, snapped history and rendered into the export. What was broken
// was that a panel color click never reached it. Two things had to be true
// before it could, and both live in this function's contract:
//
//   • the panel has to be able to OVERRIDE the reselect style snapshot
//     (otherwise `es.style?.strokeColor ?? s.strokeColor` pins the old color),
//   • and only when something actually changed (otherwise merely selecting a
//     shape marks the edit dirty and drops a junk "Edit Shape" step on the
//     undo stack).
//
// Engine-side guarantees — undo, reload, export — are pinned separately in
// `tests/shape_recolour.rs`.
import { describe, it, expect } from "vitest";
import { panelStylePatch, pendingShapeType } from "./useDrawingTools";
import type { DrawEditState } from "./useDrawingTools";
import {
  editStateFromShape,
  withLatePanelRestyle,
  type ShapeMeta,
  FILL_FIRST_KINDS,
  FILL_KIND_MODE,
  FILL_MODE_KIND,
  FILLABLE_KINDS,
  panelFieldsForStyle,
  panelShapeStyle,
  shapeCanFill,
} from "@/lib/drawEditState";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { TEXT_COLORS } from "@/lib/colors";
import type { ToolSettings } from "@/lib/types";

/** A settings object shaped like the Shapes panel's defaults. */
function settings(over: Partial<ToolSettings> = {}): ToolSettings {
  return {
    strokeColor: "#ff0000",
    strokeWidth: 3,
    arrowStyle: "single",
    shape: "rect",
    fillMode: "none",
    fillColor: "#000000",
    fillColor2: "#ffffff",
    gradientAngle: 0,
    fillBlock: 16,
    ...over,
  } as ToolSettings;
}

describe("panelStylePatch", () => {
  it("returns null when the panel did not change", () => {
    // The load-bearing case: `selectShape` runs this effect on the render that
    // opens the overlay. A patch here would mark the edit dirty and cost the
    // user an undo step for doing nothing but clicking a shape.
    expect(panelStylePatch(settings(), settings())).toBeNull();
  });

  it("returns null for a change to a field it does not own", () => {
    // `shape` is excluded on purpose — kindByte preserves a pin's real kind.
    const patch = panelStylePatch(settings(), settings({ shape: "circle" }));
    expect(patch).toBeNull();
  });

  it("carries a star point-count change", () => {
    const patch = panelStylePatch(settings(), settings({ starPoints: 8 }));
    expect(patch).toEqual({ starPoints: 8 });
  });

  it("carries a stroke color change", () => {
    const patch = panelStylePatch(settings(), settings({ strokeColor: "#00ff00" }));
    expect(patch).toEqual({ strokeColor: "#00ff00" });
  });

  it("carries ONLY the changed field, so untouched style stays the shape's own", () => {
    // This is what keeps a reselected shape from being repainted wholesale
    // with the panel's current values the moment one control is touched.
    const patch = panelStylePatch(settings(), settings({ strokeColor: "#00ff00" }));
    expect(patch).not.toHaveProperty("strokeWidth");
    expect(patch).not.toHaveProperty("fillColor");
    expect(patch).not.toHaveProperty("fillMode");
    expect(Object.keys(patch ?? {})).toEqual(["strokeColor"]);
  });

  it("carries stroke width", () => {
    expect(panelStylePatch(settings(), settings({ strokeWidth: 8 }))).toEqual({
      strokeWidth: 8,
    });
  });

  it("carries the fill controls", () => {
    expect(panelStylePatch(settings(), settings({ fillMode: "solid" }))).toEqual({
      fillMode: "solid",
    });
    expect(panelStylePatch(settings(), settings({ fillColor: "#123456" }))).toEqual({
      fillColor: "#123456",
    });
    expect(panelStylePatch(settings(), settings({ fillColor2: "#654321" }))).toEqual({
      fillColor2: "#654321",
    });
    expect(panelStylePatch(settings(), settings({ gradientAngle: 90 }))).toEqual({
      gradientAngle: 90,
    });
    expect(panelStylePatch(settings(), settings({ fillBlock: 32 }))).toEqual({
      fillBlock: 32,
    });
  });

  it("carries the arrow style", () => {
    expect(panelStylePatch(settings(), settings({ arrowStyle: "double" }))).toEqual({
      arrowStyle: "double",
    });
  });

  it("carries several changes at once", () => {
    const patch = panelStylePatch(
      settings(),
      settings({ strokeColor: "#00ff00", strokeWidth: 6, fillMode: "solid" }),
    );
    expect(patch).toEqual({
      strokeColor: "#00ff00",
      strokeWidth: 6,
      fillMode: "solid",
    });
  });

  it("REGRESSION: a swatch click is inert when the panel already shows that value", () => {
    // This is the hole that shipped in v7.63 and was found in user testing:
    // "the color changes of shapes are not in history".
    //
    // Reselect an ORANGE shape while the panel still reads PURPLE from earlier
    // use, then click purple because purple is what you want. The panel's value
    // does not change, so the diff sees nothing, the edit is never marked dirty,
    // the shape stays orange and no "Edit Shape" reaches history.
    const purple = settings({ strokeColor: "#8b5cf6" });
    expect(panelStylePatch(purple, purple)).toBeNull();

    // The function is right — it reports what the PANEL did. The fix is that
    // `selectShape` now loads the shape's style into the panel and re-seeds
    // this baseline with it, so the baseline is the SHAPE's orange and the
    // click becomes a real change. Simulated here as the seeded baseline:
    const seededFromShape = settings({ strokeColor: "#f97316" }); // shape = orange
    expect(panelStylePatch(seededFromShape, purple)).toEqual({
      strokeColor: "#8b5cf6",
    });
  });

  it("REGRESSION: with the baseline seeded from the shape, one control does not drag the others", () => {
    // The flip side of seeding from the shape: reselect an orange shape (panel
    // now also orange) and change ONLY the stroke width. Color must not be
    // dragged along, or every width tweak silently repaints the shape.
    const seededFromShape = settings({ strokeColor: "#f97316", strokeWidth: 3 });
    const widthOnly = settings({ strokeColor: "#f97316", strokeWidth: 9 });
    expect(panelStylePatch(seededFromShape, widthOnly)).toEqual({ strokeWidth: 9 });
  });

  it("treats a change back to the previous value as a change", () => {
    // Red -> green -> red is two edits, not one edit and one no-op; the second
    // has to reach the shape or it keeps the green it was given in between.
    const red = settings({ strokeColor: "#ff0000" });
    const green = settings({ strokeColor: "#00ff00" });
    expect(panelStylePatch(red, green)).toEqual({ strokeColor: "#00ff00" });
    expect(panelStylePatch(green, red)).toEqual({ strokeColor: "#ff0000" });
  });
});

// ── fill first ──────────────────────────────────────────────────────────────
// Chris, 11-19-2026: a shape is its Fill Color first, and its stroke is an
// optional extra that starts at none. The panel therefore holds TWO stroke-
// and-fill sets — `shape*` for the Shapes tab's shapes with an interior, the
// shared one for the line, the arrow, the diagram shapes and the pins — and
// `panelShapeStyle` is the one place that picks. If the commit and the diff
// ever read different sets, a width change lands on the wrong shape.
describe("panelShapeStyle: which stroke and fill a shape of this kind means", () => {
  const panel = {
    ...defaultToolSettings,
    strokeColor: "#ff0000",
    strokeWidth: 3,
    fillMode: "none",
    fillColor: "#3b82f6",
    shapeStrokeColor: "#00ff00",
    shapeStrokeWidth: 0,
    shapeFillMode: "solid",
    shapeFillColor: "#ffffff",
  } satisfies ToolSettings;

  it("the fill-first kinds are the Shapes tab's shapes with an interior", () => {
    // rect, circle, diamond, star, triangle, oval — not the line (2), and not
    // a diagram shape (11..=40), which fills but stays stroke first.
    expect([...FILL_FIRST_KINDS].sort((a, b) => a - b)).toEqual([0, 1, 8, 9, 10, 41]);
    for (const k of FILL_FIRST_KINDS) expect(FILLABLE_KINDS.has(k)).toBe(true);
  });

  it("a square reads the shape set; a line, an arrow and a diagram shape the shared one", () => {
    const fillFirst = {
      strokeColor: "#00ff00", strokeWidth: 0, fillMode: "solid", fillColor: "#ffffff",
    };
    const strokeFirst = {
      strokeColor: "#ff0000", strokeWidth: 3, fillMode: "none", fillColor: "#3b82f6",
    };
    for (const kind of [0, 1, 8, 9, 10, 41]) expect(panelShapeStyle(panel, kind)).toEqual(fillFirst);
    for (const kind of [2, 4, 5, 11, 40, undefined]) {
      expect(panelShapeStyle(panel, kind)).toEqual(strokeFirst);
    }
  });

  it("a new shape is filled red (the palette's second color) and has no stroke", () => {
    const style = panelShapeStyle(defaultToolSettings, 0);
    expect(style.fillMode).toBe("solid");
    expect(style.fillColor).toBe(TEXT_COLORS[1]);
    expect(style.strokeWidth).toBe(0);
    // …and the arrow drawn next still has a stroke to be seen by.
    expect(panelShapeStyle(defaultToolSettings, 4).strokeWidth).toBeGreaterThan(0);
  });

  it("reselect writes a shape's style back into the fields it is edited through", () => {
    const style = {
      strokeColor: "#111111", strokeWidth: 6, fillMode: "gradient" as const, fillColor: "#222222",
    };
    expect(panelFieldsForStyle({ ...style, kindByte: 9 })).toEqual({
      shapeStrokeColor: "#111111",
      shapeStrokeWidth: 6,
      shapeFillMode: "gradient",
      shapeFillColor: "#222222",
    });
    expect(panelFieldsForStyle({ ...style, kindByte: 4 })).toEqual(style);
    // Round trip: what reselect writes is what the commit reads back.
    for (const kindByte of [0, 2, 20]) {
      const synced = { ...panel, ...panelFieldsForStyle({ ...style, kindByte }) };
      expect(panelShapeStyle(synced, kindByte)).toEqual(style);
    }
  });

  it("the restyle diff reads the same set: a square's stroke is `shapeStroke*`", () => {
    const wider = { ...panel, shapeStrokeWidth: 4 };
    expect(panelStylePatch(panel, wider, 0)).toEqual({ strokeWidth: 4 });
    // The same panel change is NOT an edit to a reselected arrow…
    expect(panelStylePatch(panel, wider, 4)).toBeNull();
    // …and the Arrows tab's width is not an edit to a reselected square.
    expect(panelStylePatch(panel, { ...panel, strokeWidth: 9 }, 0)).toBeNull();
    expect(panelStylePatch(panel, { ...panel, strokeWidth: 9 }, 4)).toEqual({ strokeWidth: 9 });
  });

  it("picking a Fill Color on an outline-only square is two fields, one patch", () => {
    const hollow = { ...panel, shapeFillMode: "none" as const };
    const picked = { ...hollow, shapeFillMode: "solid" as const, shapeFillColor: "#ef4444" };
    expect(panelStylePatch(hollow, picked, 0)).toEqual({ fillMode: "solid", fillColor: "#ef4444" });
  });
});

// ── pendingShapeType ────────────────────────────────────────────────────────
// Chris, 2026-08-14: "clicking another shape should not change the last shape
// created on the canvas, let it just allow a new shape to be added — if I add
// a circle, then click square, it turns circle into a square."
//
// A freshly drawn shape used to read its TYPE live from the panel, exactly the
// way it reads its color, so choosing the next shape retyped the current one.
// Type is not like color: a color click edits the thing in front of you, a
// shape click chooses what you are about to draw next. `panelStylePatch`
// already refused to carry `shape` across to a RESELECTED shape (see the test
// above); this pins the same rule for a NEW one, and pins that the overlay and
// the commit ask the same function so the preview cannot lie about what will
// be committed.
describe("pendingShapeType", () => {
  it("REGRESSION: a new shape keeps the type it was drawn as, whatever the panel says", () => {
    const drawnCircle = { drawnShape: "circle" as const };
    expect(pendingShapeType(drawnCircle, "rect")).toBe("circle");
  });

  it("a reselected shape keeps its own type over both the panel and drawnShape", () => {
    const reselected = {
      style: { shape: "line" as const } as NonNullable<DrawEditState["style"]>,
      drawnShape: "circle" as const,
    };
    expect(pendingShapeType(reselected, "rect")).toBe("line");
  });

  it("falls back to the panel when nothing is pending — that is what picks the NEXT shape", () => {
    expect(pendingShapeType(null, "diamond")).toBe("diamond");
    expect(pendingShapeType(undefined, "circle")).toBe("circle");
  });

  it("defaults to rect when neither the edit nor the panel names a shape", () => {
    expect(pendingShapeType(null, undefined)).toBe("rect");
  });
});

// ── Which shapes take a Fill, and what byte each mode commits ───────────────
// `FILLABLE_KINDS` and `FILL_MODE_KIND` are the two tables `commitEdit` reads
// to turn the panel's Fill section into `add_shape_annotation`'s `fill_kind`
// argument. Both are mirrored on the Rust side (`annotations::is_fillable_kind`
// and the `fill_kind` match in `drawing::fill_shape`), so they are pinned here
// against the shape NAMES the panel actually offers rather than a copy of the
// list — a new shape added to the panel with no engine fill shows up as a
// failure in this file.
describe("the fill tables", () => {
  it("every shape that encloses an area can be filled — the line cannot", () => {
    for (const shape of ["rect", "circle", "diamond", "star", "triangle"] as const) {
      expect(shapeCanFill(shape), shape).toBe(true);
    }
    expect(shapeCanFill("line")).toBe(false);
  });

  it("the arrow, pin, polyline and pen-path kinds are not fillable bbox shapes", () => {
    // 4 = arrow, 5 = pin, 6 = polyline, 7 = Bézier pen path. The pen path DOES
    // get an interior, but through `fill_polygon` over its own points, not
    // through the bbox route `FILLABLE_KINDS` gates.
    for (const kind of [2, 4, 5, 6, 7]) {
      expect(FILLABLE_KINDS.has(kind), `kind ${kind}`).toBe(false);
    }
  });

  it("each fill mode maps to the engine byte, and back again", () => {
    expect(FILL_MODE_KIND).toEqual({ none: 0, solid: 1, gradient: 2, pixelate: 3 });
    for (const mode of ["none", "solid", "gradient", "pixelate"] as const) {
      expect(FILL_KIND_MODE[FILL_MODE_KIND[mode]], mode).toBe(mode);
    }
  });
});

// ── A panel change Enter beat to the edit state (CI, 11-20/21-2026) ────────────
describe("withLatePanelRestyle", () => {
  // A white, strokeless rectangle reselected, and the panel synced to it the
  // way `selectShape` does. A rectangle is fill-first, so its fill is the
  // panel's `shapeFillColor`.
  const white = editStateFromShape({
    id: 7, kind: 0, x0: 300, y0: 250, x1: 620, y1: 470, r: 0, g: 0, b: 0, stroke_width: 0,
    fill_kind: 1, fill_r: 255, fill_g: 255, fill_b: 255, fill2_r: 0, fill2_g: 0, fill2_b: 0, fill_angle: 0,
  } as ShapeMeta);
  const baseline = settings(panelFieldsForStyle(white.style!));

  it("carries a Fill Color pick the restyle effect has not delivered yet", () => {
    const dirty = { current: false };
    const out = withLatePanelRestyle(white, baseline, { ...baseline, shapeFillColor: "#ef4444" }, dirty);
    expect(out?.style?.fillColor).toBe("#ef4444");
    expect(dirty.current).toBe(true);
  });

  it("changes nothing when the effect already delivered it", () => {
    const delivered = { ...white, style: { ...white.style!, fillColor: "#ef4444" } };
    const dirty = { current: false };
    const out = withLatePanelRestyle(delivered, baseline, { ...baseline, shapeFillColor: "#ef4444" }, dirty);
    expect(out).toBe(delivered);
    expect(dirty.current).toBe(false);
  });

  it("changes nothing when the panel still matches the shape", () => {
    const dirty = { current: false };
    expect(withLatePanelRestyle(white, baseline, baseline, dirty)).toBe(white);
    expect(dirty.current).toBe(false);
  });

  it("leaves a brand-new shape alone: it reads the panel live", () => {
    const fresh: DrawEditState = { kind: "shape", start: { x: 0, y: 0 }, end: { x: 9, y: 9 } };
    const dirty = { current: false };
    expect(withLatePanelRestyle(fresh, baseline, { ...baseline, shapeFillColor: "#ef4444" }, dirty)).toBe(fresh);
    expect(dirty.current).toBe(false);
  });

  it("leaves corner radii to their own live path", () => {
    const dirty = { current: false };
    const out = withLatePanelRestyle(white, baseline, { ...baseline, cornerRadii: [8, 8, 8, 8] }, dirty);
    expect(out).toBe(white);
  });

  it("passes null through", () => {
    expect(withLatePanelRestyle(null, baseline, baseline, { current: false })).toBeNull();
  });
});
