import { describe, it, expect } from "vitest";
import { padOffset, PAD_KINDS, PAD_GAP_MIN_PX } from "./duplicatePadGeometry";

const BOX = { x0: 100, y0: 100, x1: 200, y1: 160 }; // 100 × 60

describe("duplicate pad geometry", () => {
  it("the first copy clears the shape plus a gap, never overlapping it", () => {
    const { dx } = padOffset(BOX, "right", 1);
    expect(dx).toBeGreaterThan(100); // strictly past the shape's own width
    expect(dx).toBe(112); // 100 + max(8, round(100 * .12)) = 112
  });

  it("counts from the ORIGINAL, so pressing left twice lands two apart", () => {
    const one = padOffset(BOX, "left", 1).dx;
    const two = padOffset(BOX, "left", 2).dx;
    expect(one).toBe(-112);
    expect(two).toBe(-224);
    // The pad does not walk: the 2nd copy is exactly 2× the 1st, which is
    // what keeps a later ↑ relative to the source rather than to this copy.
    expect(two).toBe(2 * one);
  });

  it("moves on exactly one axis per direction", () => {
    // h = 60, and round(60 * .12) = 7 loses to the 8px floor, so step = 68.
    expect(padOffset(BOX, "up", 1)).toEqual({ dx: 0, dy: -68 });
    expect(padOffset(BOX, "down", 1)).toEqual({ dx: 0, dy: 68 });
    expect(padOffset(BOX, "left", 1).dy).toBe(0);
    expect(padOffset(BOX, "right", 1).dy).toBe(0);
  });

  it("uses the vertical size vertically — a wide shape must not inherit its width", () => {
    const wide = { x0: 0, y0: 0, x1: 400, y1: 20 };
    expect(Math.abs(padOffset(wide, "down", 1).dy)).toBeLessThan(
      Math.abs(padOffset(wide, "right", 1).dx),
    );
  });

  it("a tiny shape still separates, via the gap floor", () => {
    const tiny = { x0: 0, y0: 0, x1: 2, y1: 2 };
    // round(2 * .12) = 0, so without the floor the copy would sit 2px away
    // and read as a rendering artifact rather than a second shape.
    expect(padOffset(tiny, "right", 1).dx).toBe(2 + PAD_GAP_MIN_PX);
  });

  it("does not assume corner order — a right-to-left drag still goes left", () => {
    const flipped = { x0: 200, y0: 160, x1: 100, y1: 100 }; // same box, reversed
    expect(padOffset(flipped, "left", 1)).toEqual(padOffset(BOX, "left", 1));
    expect(padOffset(flipped, "right", 1).dx).toBeGreaterThan(0);
  });

  it("offers the pad on rectangles and circles only", () => {
    expect(PAD_KINDS.has(0)).toBe(true); // rect
    expect(PAD_KINDS.has(1)).toBe(true); // circle
    for (const k of [2, 3, 4, 5, 6, 7]) expect(PAD_KINDS.has(k)).toBe(false);
  });
});
