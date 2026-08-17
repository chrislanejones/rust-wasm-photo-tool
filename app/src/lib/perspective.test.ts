import { describe, it, expect } from "vitest";
import {
  BL,
  BR,
  IDENTITY_QUAD,
  TL,
  TR,
  denormalise,
  dragCorner,
  dragEdge,
  edgeMidpoint,
  fromFlat,
  isIdentity,
  isValidQuad,
  normalise,
  toFlat,
  unitSquareTo,
  type Quad,
} from "./perspective";

/** A 100×100 box at the origin, in pixel space — the shape every drag starts
 *  from, so it is the right base for the rule tests. */
const box = (): Quad => [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe("quad round trips", () => {
  it("survives toFlat -> fromFlat unchanged", () => {
    const q = box();
    const back = fromFlat(toFlat(q));
    expect(back).toEqual(q);
  });

  it("rejects a wrong-length or non-finite flat quad", () => {
    // The engine answers `[]` for "no such annotation". Reading that as a
    // collapsed quad would silently warp the wrong thing to nothing.
    expect(fromFlat([])).toBeNull();
    expect(fromFlat(new Float32Array(6))).toBeNull();
    expect(fromFlat([0, 0, 1, 0, 1, 1, 0, NaN])).toBeNull();
    expect(fromFlat(null)).toBeNull();
  });

  it("normalise and denormalise are inverses", () => {
    const q = box();
    expect(denormalise(normalise(q, 100, 100), 100, 100)).toEqual(q);
    // A zero-sized box cannot be normalised against; identity is the only safe
    // answer, since dividing would produce Infinity and poison the engine call.
    expect(normalise(q, 0, 100)).toEqual(IDENTITY_QUAD);
  });

  it("recognises the identity within f32 tolerance", () => {
    expect(isIdentity(IDENTITY_QUAD)).toBe(true);
    // A corner nudged by less than the f32 round-trip error still counts.
    expect(
      isIdentity([
        { x: 1e-6, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBe(true);
    expect(
      isIdentity([
        { x: 0.2, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBe(false);
  });
});

describe("validity", () => {
  it("accepts a convex quad and rejects a bow-tie", () => {
    expect(isValidQuad(box())).toBe(true);
    const bow = box();
    // Swapping two adjacent corners crosses the edges.
    [bow[TR], bow[BR]] = [bow[BR], bow[TR]];
    expect(isValidQuad(bow)).toBe(false);
  });

  it("rejects a fully collapsed quad", () => {
    const p = { x: 5, y: 5 };
    expect(isValidQuad([p, p, p, p] as Quad)).toBe(false);
  });
});

describe("drag rules — the difference between the three sub-tools", () => {
  it("distort moves only the corner you grabbed", () => {
    const q = dragCorner(box(), TL, { x: 30, y: 20 }, "distort");
    expect(q[TL]).toEqual({ x: 30, y: 20 });
    expect(q[TR]).toEqual({ x: 100, y: 0 });
    expect(q[BR]).toEqual({ x: 100, y: 100 });
    expect(q[BL]).toEqual({ x: 0, y: 100 });
  });

  it("perspective mirrors the edge partner, keeping the keystone symmetric", () => {
    // Pull the top-left corner 30px inward; the top-right must come 30px
    // inward too, so the top edge narrows about its own centre.
    const q = dragCorner(box(), TL, { x: 30, y: 0 }, "perspective");
    expect(q[TL].x).toBeCloseTo(30, 6);
    expect(q[TR].x).toBeCloseTo(70, 6);
    // The centre of the top edge has not moved — that is what "symmetric"
    // means here, and it is the property that makes the result read as a
    // keystone rather than a lopsided trapezoid.
    expect((q[TL].x + q[TR].x) / 2).toBeCloseTo(50, 6);
    // The bottom edge is untouched.
    expect(q[BR]).toEqual({ x: 100, y: 100 });
    expect(q[BL]).toEqual({ x: 0, y: 100 });
  });

  it("skew slides the whole edge the same way, keeping edges parallel", () => {
    const q = dragCorner(box(), TL, { x: 25, y: 0 }, "skew");
    expect(q[TL].x).toBeCloseTo(25, 6);
    // NOT mirrored — both top corners move the same direction, which is what
    // separates a shear from a perspective.
    expect(q[TR].x).toBeCloseTo(125, 6);
    // Top edge is still the same LENGTH, just displaced.
    expect(q[TR].x - q[TL].x).toBeCloseTo(100, 6);
    expect(q[BR]).toEqual({ x: 100, y: 100 });
  });

  it("every rule is a function of the drag START, so it cannot compound", () => {
    // Applying the rule twice from the same base must equal applying it once.
    // Feeding the previous frame back in instead would make `perspective`
    // mirror its own mirror, and a slow drag would travel further than a fast
    // one across the same distance.
    const base = box();
    const once = dragCorner(base, TL, { x: 30, y: 10 }, "perspective");
    const again = dragCorner(base, TL, { x: 30, y: 10 }, "perspective");
    expect(again).toEqual(once);
  });

  it("skew edge handles are constrained to the edge's own axis", () => {
    // The top edge may only move in x under skew; a y component is ignored.
    const q = dragEdge(box(), 0, { x: 20, y: 40 }, "skew");
    expect(q[TL]).toEqual({ x: 20, y: 0 });
    expect(q[TR]).toEqual({ x: 120, y: 0 });
    // The right edge (index 1) may only move in y.
    const r = dragEdge(box(), 1, { x: 40, y: 20 }, "skew");
    expect(r[TR]).toEqual({ x: 100, y: 20 });
    expect(r[BR]).toEqual({ x: 100, y: 120 });
  });

  it("distort edge handles translate freely on both axes", () => {
    const q = dragEdge(box(), 0, { x: 20, y: 40 }, "distort");
    expect(q[TL]).toEqual({ x: 20, y: 40 });
    expect(q[TR]).toEqual({ x: 120, y: 40 });
  });

  it("perspective edge handles widen the edge about its centre", () => {
    const q = dragEdge(box(), 0, { x: 10, y: 0 }, "perspective");
    // Grew outward by 10 on each side; centre unmoved.
    expect(q[TL].x).toBeCloseTo(-10, 6);
    expect(q[TR].x).toBeCloseTo(110, 6);
    expect((q[TL].x + q[TR].x) / 2).toBeCloseTo(50, 6);
  });

  it("reports edge midpoints where the handles are drawn", () => {
    expect(edgeMidpoint(box(), 0)).toEqual({ x: 50, y: 0 });
    expect(edgeMidpoint(box(), 1)).toEqual({ x: 100, y: 50 });
    expect(edgeMidpoint(box(), 2)).toEqual({ x: 50, y: 100 });
    expect(edgeMidpoint(box(), 3)).toEqual({ x: 0, y: 50 });
  });
});

describe("forward homography (the overlay's preview grid)", () => {
  it("maps the unit square's corners onto the quad's corners", () => {
    const quad: Quad = [
      { x: 20, y: 0 },
      { x: 80, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    const map = unitSquareTo(quad);
    expect(map).not.toBeNull();
    const corners: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    corners.forEach(([u, v], i) => {
      const p = map!(u, v);
      expect(p.x).toBeCloseTo(quad[i].x, 6);
      expect(p.y).toBeCloseTo(quad[i].y, 6);
    });
  });

  it("solves an axis-aligned quad — the FIRST solve the tool ever runs", () => {
    // Every quad starts as a rectangle, so a solver without partial pivoting
    // divides by a structural zero on the very first drag. This is the
    // regression guard for that, mirroring the crate's own test.
    expect(unitSquareTo(box())).not.toBeNull();
  });

  it("still solves a degenerate DESTINATION — validity is a separate check", () => {
    // Worth pinning because it is counter-intuitive and it is why the overlay
    // calls `isValidQuad` rather than trusting a null from the solver.
    //
    // The solver's SOURCE here is always the well-formed unit square, so the
    // 8x8 system is non-singular no matter how collapsed the destination is —
    // it happily produces the map onto a degenerate shape. (The crate's
    // `rect_from_quad` solves the other way round, with the quad as the
    // source, which IS singular for a collapsed quad; that asymmetry is the
    // whole reason these two look like they disagree and do not.)
    const collapsed: Quad = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(unitSquareTo(collapsed)).not.toBeNull();
    expect(isValidQuad(collapsed)).toBe(false); // ← this is the guard that matters
  });

  it("bends a straight interior line — the projective divide is doing work", () => {
    // A keystone maps the unit square's horizontal centre line to something
    // that is NOT at the trapezoid's vertical midpoint. If this ever comes out
    // AT the midpoint, the map has silently degraded to an affine one and the
    // tool is just an expensive shear.
    //
    // Direction: the narrow edge is the FAR one, and the far half of a
    // perspective view is the compressed half. The top edge here is narrow, so
    // the centre line lands above the geometric middle (y < 50, screen coords
    // being y-down) — nearer the far edge, exactly as a receding plane looks.
    const quad: Quad = [
      { x: 25, y: 0 },
      { x: 75, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const map = unitSquareTo(quad)!;
    const mid = map(0.5, 0.5);
    expect(mid.x).toBeCloseTo(50, 6); // symmetric quad — centre stays centred in x
    expect(mid.y).toBeLessThan(50);
    expect(mid.y).toBeCloseTo(100 / 3, 6);
  });
});
