import { describe, it, expect } from "vitest";
import { constrainCropFallback, freeCropRect } from "./cropRatioFallback";

describe("constrainCropFallback", () => {
  it("a wide drag keeps its width and derives the height", () => {
    expect(constrainCropFallback({ x: 10, y: 10 }, { x: 110, y: 30 }, [1, 1])).toEqual({
      x: 10, y: 10, w: 100, h: 100,
    });
  });

  it("a tall drag keeps its height and derives the width", () => {
    expect(constrainCropFallback({ x: 0, y: 0 }, { x: 10, y: 90 }, [16, 9])).toEqual({
      x: 0, y: 0, w: 160, h: 90,
    });
  });

  it("a drag up and to the left grows away from its start, clamped to the origin", () => {
    expect(constrainCropFallback({ x: 50, y: 50 }, { x: 10, y: 30 }, [2, 1])).toEqual({
      x: 10, y: 30, w: 40, h: 20,
    });
    expect(constrainCropFallback({ x: 5, y: 5 }, { x: -100, y: 0 }, [1, 1])).toEqual({
      x: 0, y: 0, w: 105, h: 105,
    });
  });

  it("a click with no movement is still 1×1", () => {
    expect(constrainCropFallback({ x: 3, y: 3 }, { x: 3, y: 3 }, [4, 3])).toEqual({
      x: 3, y: 3, w: 1, h: 1,
    });
  });
});

describe("freeCropRect", () => {
  it("is the box two points span, whichever way the drag went", () => {
    expect(freeCropRect({ x: 40, y: 10 }, { x: 10.5, y: 30 })).toEqual({ x: 10.5, y: 10, w: 29.5, h: 20 });
  });
});
