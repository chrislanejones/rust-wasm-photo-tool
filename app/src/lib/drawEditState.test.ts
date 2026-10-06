import { describe, it, expect } from "vitest";
import { withEditGeometry, type DrawEditState } from "./drawEditState";

const base: DrawEditState = {
  kind: "shape",
  start: { x: 0, y: 0 },
  end: { x: 10, y: 10 },
  drawnShape: "circle",
};

describe("withEditGeometry", () => {
  it("moves the geometry and leaves type and rotation alone without them", () => {
    const next = withEditGeometry({ ...base, rotation: 30 }, { x: 1, y: 2 }, { x: 3, y: 4 });
    expect(next.start).toEqual({ x: 1, y: 2 });
    expect(next.end).toEqual({ x: 3, y: 4 });
    expect(next.rotation).toBe(30);
    expect(next.drawnShape).toBe("circle");
  });

  it("the oval handle retypes a NEW circle through drawnShape", () => {
    const next = withEditGeometry(base, { x: -5, y: 0 }, { x: 15, y: 10 }, undefined, "oval");
    expect(next.drawnShape).toBe("oval");
    expect(next.style).toBeUndefined();
  });

  it("the oval handle retypes a RESELECTED circle's own shape and kind byte", () => {
    const style = { shape: "circle", kindByte: 1 } as NonNullable<DrawEditState["style"]>;
    const next = withEditGeometry(
      { ...base, drawnShape: undefined, editId: 7, style },
      { x: -5, y: 0 },
      { x: 15, y: 10 },
      undefined,
      "oval",
    );
    expect(next.style?.shape).toBe("oval");
    expect(next.style?.kindByte).toBe(41);
    expect(style.shape).toBe("circle"); // the snapshot itself is not mutated
  });
});
