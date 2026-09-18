// The vertex lists here are the JS half of a contract with drawing.rs
// (`star_vertices_n`, `triangle_vertices`): the overlay previews these points
// and the engine strokes its own copy, so a drift shows up as a shape that
// jumps on commit.
import { describe, expect, it } from "vitest";
import {
  closedOutline,
  effectiveStarPoints,
  starVertices,
  triangleVertices,
} from "./shapeSloppiness";

describe("effectiveStarPoints", () => {
  it("reads 0 and absent as the classic 5 — every star saved before the count", () => {
    expect(effectiveStarPoints(0)).toBe(5);
    expect(effectiveStarPoints(undefined)).toBe(5);
  });

  it("clamps to 3–12", () => {
    expect(effectiveStarPoints(2)).toBe(3);
    expect(effectiveStarPoints(40)).toBe(12);
    expect(effectiveStarPoints(7)).toBe(7);
  });
});

describe("starVertices", () => {
  it("defaults to five points — ten vertices, unchanged", () => {
    const v = starVertices(0, 0, 100, 100);
    expect(v).toHaveLength(10);
    expect(v[0].x).toBeCloseTo(50, 9);
    expect(v[0].y).toBeCloseTo(0, 9);
  });

  it("takes a point count: n tips and n valleys", () => {
    const v = starVertices(0, 0, 100, 100, 8);
    expect(v).toHaveLength(16);
    // With 8 points a tip lands exactly at 3 o'clock.
    expect(v[4].x).toBeCloseTo(100, 9);
    expect(v[4].y).toBeCloseTo(50, 9);
  });
});

describe("triangleVertices", () => {
  it("is apex-up and fills the box, whichever way it was dragged", () => {
    const expected = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(triangleVertices(0, 0, 100, 100)).toEqual(expected);
    expect(triangleVertices(100, 100, 0, 0)).toEqual(expected);
  });
});

describe("closedOutline", () => {
  it("covers every polygon shape and nothing else", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 20 };
    expect(closedOutline("rect", a, b)).toHaveLength(4);
    expect(closedOutline("diamond", a, b)).toHaveLength(4);
    expect(closedOutline("star", a, b, 6)).toHaveLength(12);
    expect(closedOutline("triangle", a, b)).toHaveLength(3);
    expect(closedOutline("circle", a, b)).toBeNull();
    expect(closedOutline("line", a, b)).toBeNull();
  });
});
