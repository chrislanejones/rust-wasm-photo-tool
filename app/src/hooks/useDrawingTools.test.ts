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
import { panelStylePatch } from "./useDrawingTools";
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

  it("treats a change back to the previous value as a change", () => {
    // Red -> green -> red is two edits, not one edit and one no-op; the second
    // has to reach the shape or it keeps the green it was given in between.
    const red = settings({ strokeColor: "#ff0000" });
    const green = settings({ strokeColor: "#00ff00" });
    expect(panelStylePatch(red, green)).toEqual({ strokeColor: "#00ff00" });
    expect(panelStylePatch(green, red)).toEqual({ strokeColor: "#ff0000" });
  });
});
