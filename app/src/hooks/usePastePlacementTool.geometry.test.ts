import { describe, expect, it } from "vitest";
import { boxCorners, compressTarget } from "./usePastePlacementTool";

describe("compressTarget (Resize & Compress)", () => {
  it("bakes the box's size when the box shows fewer pixels than the source", () => {
    // A 4K screenshot fit-scaled onto a 1080p photo.
    expect(compressTarget({ width: 1920, height: 1080 }, { w: 3840, h: 2160 })).toEqual({
      w: 1920,
      h: 1080,
    });
  });

  it("halves a paste that already fits 1:1, so one click always shrinks it", () => {
    expect(compressTarget({ width: 3840, height: 2160 }, { w: 3840, h: 2160 })).toEqual({
      w: 1920,
      h: 1080,
    });
  });

  it("compares area, so a box squashed on one axis still counts as smaller", () => {
    expect(compressTarget({ width: 1200, height: 400 }, { w: 1000, h: 1000 })).toEqual({
      w: 1200,
      h: 400,
    });
  });

  it("stops before an edge drops under 16 px", () => {
    expect(compressTarget({ width: 30, height: 200 }, { w: 30, h: 200 })).toBeNull();
    expect(compressTarget({ width: 32, height: 32 }, { w: 32, h: 32 })).toEqual({ w: 16, h: 16 });
  });
});

describe("boxCorners", () => {
  it("is the plain rectangle at 0°", () => {
    expect(boxCorners({ x: 10, y: 20, width: 100, height: 50, rotation: 0 })).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ]);
  });

  it("turns about the center: at 90° a wide box stands up", () => {
    const c = boxCorners({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(50);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(25);
  });
});
