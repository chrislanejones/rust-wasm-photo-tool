import { describe, it, expect } from "vitest";
import {
  basisOfShape,
  sameTarget,
  shapeKindLabel,
  type PerspectiveTarget,
} from "./perspectiveTarget";
import { denormalise, normalise, type Quad } from "./perspective";

/**
 * The rules that let the Perspective tool point at a SQUARE or a CIRCLE, and
 * the one number both sides of the wasm boundary have to agree on.
 *
 * `basisOfShape` is a hand-mirror of `shape_basis_rect` in
 * `src/annotations.rs`, in the same family as `annotationHitTest.ts` — a pair
 * of implementations that cannot be compiled against each other, so the way
 * they stay honest is a test that states the contract in both directions.
 */
describe("basisOfShape — the quad's normalisation rect", () => {
  it("is the plain bbox, with no stroke padding", () => {
    // The bbox and NOTHING else is the contract. Padding it here (by the
    // stroke, by the arrowhead, by anything) without padding the crate's copy
    // puts the committed warp somewhere other than where the user dragged it,
    // and drifts a little further on every reselect.
    expect(basisOfShape({ x0: 10, y0: 20, x1: 50, y1: 60 })).toEqual({
      x: 10,
      y: 20,
      w: 40,
      h: 40,
    });
  });

  it("normalises a shape dragged right-to-left the same as left-to-right", () => {
    // `x0,y0` is where the pointer went down, so a shape dragged up-and-left
    // has x1 < x0. The engine's `shape_basis_rect` takes the min/abs for
    // exactly this reason; a basis that inherited the drag direction would
    // mirror the warp on half the shapes ever drawn.
    const forward = basisOfShape({ x0: 10, y0: 20, x1: 50, y1: 60 });
    const backward = basisOfShape({ x0: 50, y0: 60, x1: 10, y1: 20 });
    expect(backward).toEqual(forward);
  });

  it("survives the round trip the commit path actually makes", () => {
    // What Apply does: take the dragged quad in image px, rebase it onto the
    // basis, normalise, hand 8 floats to the engine. What the reselect seed
    // does: denormalise back onto the basis. The two must compose to identity,
    // or a warp would creep on every visit.
    const shape = { x0: 30, y0: 40, x1: 130, y1: 90 };
    const b = basisOfShape(shape);
    const dragged: Quad = [
      { x: 55, y: 40 },
      { x: 105, y: 40 },
      { x: 130, y: 90 },
      { x: 30, y: 90 },
    ];
    const local = dragged.map((p) => ({ x: p.x - b.x, y: p.y - b.y })) as Quad;
    const stored = normalise(local, b.w, b.h);
    const back = denormalise(stored, b.w, b.h).map((p) => ({
      x: p.x + b.x,
      y: p.y + b.y,
    }));
    back.forEach((p, i) => {
      expect(p.x).toBeCloseTo(dragged[i].x, 6);
      expect(p.y).toBeCloseTo(dragged[i].y, 6);
    });
  });

  it("describes the SHAPE, not its pixels — the same quad re-applies after a resize", () => {
    // This is the whole reason the stored form is normalised. Drag the square
    // twice as wide afterwards and the stored corners still mean "the top edge
    // is the middle half", so the warp scales with the shape instead of
    // sliding off it.
    const small = basisOfShape({ x0: 0, y0: 0, x1: 100, y1: 100 });
    const large = basisOfShape({ x0: 0, y0: 0, x1: 200, y1: 200 });
    const stored: Quad = [
      { x: 0.25, y: 0 },
      { x: 0.75, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(denormalise(stored, small.w, small.h)[0]).toEqual({ x: 25, y: 0 });
    expect(denormalise(stored, large.w, large.h)[0]).toEqual({ x: 50, y: 0 });
  });
});

describe("sameTarget — two id spaces, not one", () => {
  const text3: PerspectiveTarget = { kind: "text", id: 3 };
  const shape3: PerspectiveTarget = { kind: "shape", id: 3 };

  it("does not confuse text 3 with shape 3", () => {
    // The engine keeps `next_text_id` and `next_shape_id` separately, so any
    // document with three of each has both. Comparing bare ids — which is what
    // the tool did while text was all it could reach — warps the wrong object
    // as soon as shapes are pickable.
    expect(sameTarget(text3, shape3)).toBe(false);
    expect(sameTarget(text3, { kind: "text", id: 3 })).toBe(true);
  });

  it("treats null as its own answer, not as a wildcard", () => {
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(null, shape3)).toBe(false);
    expect(sameTarget(text3, null)).toBe(false);
  });
});

describe("shapeKindLabel", () => {
  it("names the two kinds the report actually asked for", () => {
    expect(shapeKindLabel(0)).toBe("Square");
    expect(shapeKindLabel(1)).toBe("Circle");
  });

  it("falls back to a real word for an unknown kind byte", () => {
    // A new shape kind in the engine must not make the panel say "undefined".
    expect(shapeKindLabel(99)).toBe("Shape");
  });
});
