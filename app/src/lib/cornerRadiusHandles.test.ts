import { describe, expect, it } from "vitest";
import { cornerHandles, radiusAfterDrag } from "./cornerRadiusHandles";
import {
  canonicalCornerRadii,
  closedOutline,
  cornerCount,
  roundCorners,
  SQUARE_CORNERS,
} from "./shapeSloppiness";

const A = { x: 0, y: 0 };
const B = { x: 100, y: 60 };

describe("cornerHandles", () => {
  it("puts one dot in each corner of a rect, TL TR BR BL", () => {
    const hs = cornerHandles("rect", A, B, undefined, SQUARE_CORNERS, 1, 1);
    expect(hs.map((h) => h.index)).toEqual([0, 1, 2, 3]);
    expect(hs.map((h) => h.corner)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
      { x: 0, y: 60 },
    ]);
    // Inward along the diagonal, the minimum inset in from the corner.
    expect(hs[0].dot.x).toBeCloseTo(14 / Math.SQRT2, 6);
    expect(hs[0].dot.y).toBeCloseTo(14 / Math.SQRT2, 6);
    // A rect corner can take up to half its shorter side.
    expect(hs[0].maxR).toBeCloseTo(30, 6);
  });

  it("sits the dot on the arc's center once the radius clears the inset", () => {
    const [tl] = cornerHandles("rect", A, B, undefined, [20, 0, 0, 0], 1, 1);
    expect(tl.dot.x).toBeCloseTo(20, 6);
    expect(tl.dot.y).toBeCloseTo(20, 6);
  });

  it("gives the triangle three dots and the star one, at its top tip", () => {
    expect(cornerHandles("triangle", A, B, undefined, SQUARE_CORNERS, 1, 1)).toHaveLength(3);
    const star = cornerHandles("star", A, B, 7, SQUARE_CORNERS, 1, 1);
    expect(star).toHaveLength(1);
    expect(star[0].corner).toEqual({ x: 50, y: 0 });
    expect(star[0].bisector.y).toBeGreaterThan(0.99); // straight down, inward
  });

  it("has none for the circle and the line, or a box too small on screen", () => {
    expect(cornerHandles("circle", A, B, undefined, SQUARE_CORNERS, 1, 1)).toEqual([]);
    expect(cornerHandles("line", A, B, undefined, SQUARE_CORNERS, 1, 1)).toEqual([]);
    expect(cornerHandles("rect", A, B, undefined, SQUARE_CORNERS, 0.3, 0.3)).toEqual([]);
  });
});

describe("radiusAfterDrag", () => {
  const [tl] = cornerHandles("rect", A, B, undefined, SQUARE_CORNERS, 1, 1);

  it("rounds by how far the pointer moves along the bisector", () => {
    // 10 px right and 10 down moves the arc center 10√2 along the diagonal.
    expect(radiusAfterDrag(tl, SQUARE_CORNERS, 10, 10)).toBe(10);
    // Sideways to the bisector does nothing.
    expect(radiusAfterDrag(tl, [8, 0, 0, 0], 10, -10)).toBe(8);
  });

  it("clamps to 0 and to the corner's room", () => {
    expect(radiusAfterDrag(tl, [5, 0, 0, 0], -50, -50)).toBe(0);
    expect(radiusAfterDrag(tl, SQUARE_CORNERS, 500, 500)).toBe(30);
  });
});

describe("canonicalCornerRadii", () => {
  it("is the engine's stored form", () => {
    expect(canonicalCornerRadii("rect", [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(canonicalCornerRadii("star", [7, 1, 1, 1])).toEqual([7, 7, 7, 7]);
    expect(canonicalCornerRadii("triangle", [1, 2, 3, 4])).toEqual([1, 2, 3, 0]);
    expect(canonicalCornerRadii("circle", [5, 5, 5, 5])).toEqual([0, 0, 0, 0]);
    expect(canonicalCornerRadii("diamond", [2.6, -4, Number.NaN])).toEqual([3, 0, 0, 0]);
    expect(canonicalCornerRadii("rect", undefined)).toEqual([0, 0, 0, 0]);
  });

  it("agrees with cornerCount", () => {
    expect(["rect", "diamond", "triangle", "star", "circle", "line"].map(cornerCount)).toEqual([
      4, 4, 3, 1, 0, 0,
    ]);
  });
});

describe("roundCorners", () => {
  it("leaves square corners alone", () => {
    const sq = closedOutline("rect", A, B)!;
    expect(roundCorners(sq, () => 0)).toEqual(sq);
    expect(closedOutline("rect", A, B, undefined, SQUARE_CORNERS)).toEqual(sq);
  });

  it("replaces a corner with an arc tangent to both edges", () => {
    const out = closedOutline("rect", A, B, undefined, [10, 0, 0, 0])!;
    // Starts at the tangent point on the left edge and ends on the top edge.
    expect(out[0].x).toBeCloseTo(0, 9);
    expect(out[0].y).toBeCloseTo(10, 9);
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    const topTangent = out.findIndex((p) => near(p.y, 0) && near(p.x, 10));
    expect(topTangent).toBeGreaterThan(1);
    // Every arc point is 10 px from the center (10, 10).
    for (const p of out.slice(0, topTangent + 1)) {
      expect(Math.hypot(p.x - 10, p.y - 10)).toBeCloseTo(10, 6);
    }
    // The other three corners are still sharp.
    expect(out).toContainEqual({ x: 100, y: 0 });
    expect(out).toContainEqual({ x: 100, y: 60 });
    expect(out).toContainEqual({ x: 0, y: 60 });
  });

  it("clamps a radius to half of each edge", () => {
    const out = closedOutline("rect", A, B, undefined, [999, 999, 999, 999])!;
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(100 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(60 + 1e-9);
    }
    // The stadium: a 30 px radius on the 60 px sides.
    expect(out[0].x).toBeCloseTo(0, 9);
    expect(out[0].y).toBeCloseTo(30, 9);
  });
});
