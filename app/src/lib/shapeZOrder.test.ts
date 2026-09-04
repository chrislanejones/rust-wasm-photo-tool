import { describe, it, expect } from "vitest";
import { zTargetIndex, zMoveFor } from "./shapeZOrder";

// ids are bottom → top, the order `get_shape_annotations()` returns them in.
const ids = [10, 20, 30];

describe("zTargetIndex", () => {
  it("steps one index for forward / backward", () => {
    expect(zTargetIndex(ids, 20, "forward")).toBe(2);
    expect(zTargetIndex(ids, 20, "backward")).toBe(0);
  });

  it("jumps to the ends for front / back", () => {
    expect(zTargetIndex(ids, 10, "front")).toBe(2);
    expect(zTargetIndex(ids, 30, "back")).toBe(0);
  });

  it("returns null when the move would change nothing", () => {
    // Already on top / at the bottom — this is what disables the buttons.
    expect(zTargetIndex(ids, 30, "forward")).toBeNull();
    expect(zTargetIndex(ids, 30, "front")).toBeNull();
    expect(zTargetIndex(ids, 10, "backward")).toBeNull();
    expect(zTargetIndex(ids, 10, "back")).toBeNull();
  });

  it("returns null for an id that is not in the list", () => {
    expect(zTargetIndex(ids, 99, "forward")).toBeNull();
    expect(zTargetIndex([], 10, "front")).toBeNull();
  });

  it("a single shape can go nowhere", () => {
    for (const dir of ["forward", "backward", "front", "back"] as const) {
      expect(zTargetIndex([7], 7, dir)).toBeNull();
    }
  });
});

describe("zMoveFor", () => {
  it("maps the ▲/▼ buttons, with Shift going all the way", () => {
    expect(zMoveFor(true, false)).toBe("forward");
    expect(zMoveFor(true, true)).toBe("front");
    expect(zMoveFor(false, false)).toBe("backward");
    expect(zMoveFor(false, true)).toBe("back");
  });
});
