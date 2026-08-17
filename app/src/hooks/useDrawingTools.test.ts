// ===== FILE: app/src/hooks/useDrawingTools.test.ts =====
// Covers `panelStylePatch`, the decision at the centre of the seven-week
// "draw a square, click it again, change the colour — nothing happens" bug.
//
// The engine side was never broken: `update_shape_annotation` already wrote
// the colour, snapped history and rendered into the export. What was broken
// was that a panel colour click never reached it. Two things had to be true
// before it could, and both live in this function's contract:
//
//   • the panel has to be able to OVERRIDE the reselect style snapshot
//     (otherwise `es.style?.strokeColor ?? s.strokeColor` pins the old colour),
//   • and only when something actually changed (otherwise merely selecting a
//     shape marks the edit dirty and drops a junk "Edit Shape" step on the
//     undo stack).
//
// Engine-side guarantees — undo, reload, export — are pinned separately in
// `tests/shape_recolour.rs`.
import { describe, it, expect } from "vitest";
import { panelStylePatch, pendingShapeType } from "./useDrawingTools";
import type { DrawEditState } from "./useDrawingTools";
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

  it("carries a stroke colour change", () => {
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
    // "the colour changes of shapes are not in history".
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
    // now also orange) and change ONLY the stroke width. Colour must not be
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

// ── pendingShapeType ────────────────────────────────────────────────────────
// Chris, 2026-08-14: "clicking another shape should not change the last shape
// created on the canvas, let it just allow a new shape to be added — if I add
// a circle, then click square, it turns circle into a square."
//
// A freshly drawn shape used to read its TYPE live from the panel, exactly the
// way it reads its colour, so choosing the next shape retyped the current one.
// Type is not like colour: a colour click edits the thing in front of you, a
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
    expect(pendingShapeType(null, "handCircle")).toBe("handCircle");
    expect(pendingShapeType(undefined, "circle")).toBe("circle");
  });

  it("defaults to rect when neither the edit nor the panel names a shape", () => {
    expect(pendingShapeType(null, undefined)).toBe("rect");
  });
});
