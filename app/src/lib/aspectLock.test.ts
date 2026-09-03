import { describe, it, expect } from "vitest";
import {
  aspectLocked,
  cornerDelta,
  lockCornerDelta,
  lockScaleFactors,
  lockAxisDelta,
  lockPointToAxis,
} from "./aspectLock";

/**
 * `cornerDelta` is the real function both drag handlers call; the `switch`
 * below mirrors theirs exactly (see `CanvasArea.tsx`, the crop and
 * paste-placement `onMove` handlers) so these tests assert what a user actually
 * ends up with: **vector in, dimensions out.**
 *
 * Testing `lockCornerDelta` alone would pass while the call sites disagreed
 * about when to call it — which is the drift this suite exists to pin.
 */
function resize(
  surface: "raster" | "region",
  handle: string,
  start: { x: number; y: number; width: number; height: number },
  drag: { dx: number; dy: number },
  shiftKey: boolean,
) {
  const { dx, dy } = cornerDelta(surface, { shiftKey }, handle, drag, start);
  let { x, y, width: w, height: h } = start;
  switch (handle) {
    case "nw": x += dx; y += dy; w -= dx; h -= dy; break;
    case "n":  y += dy; h -= dy; break;
    case "ne": y += dy; w += dx; h -= dy; break;
    case "e":  w += dx; break;
    case "se": w += dx; h += dy; break;
    case "s":  h += dy; break;
    case "sw": x += dx; w -= dx; h += dy; break;
    case "w":  x += dx; w -= dx; break;
  }
  return { x, y, width: w, height: h };
}

const START = { x: 0, y: 0, width: 400, height: 300 }; // 4:3
const ratio = (r: { width: number; height: number }) => r.width / r.height;

describe("aspectLocked — the policy, per surface", () => {
  it("raster is LOCKED on a plain drag and FREE with Shift", () => {
    expect(aspectLocked("raster", false)).toBe(true);
    expect(aspectLocked("raster", true)).toBe(false);
  });

  it("region (crop) is FREE on a plain drag and LOCKED with Shift", () => {
    expect(aspectLocked("region", false)).toBe(false);
    expect(aspectLocked("region", true)).toBe(true);
  });

  it("the two surfaces are opposites for every Shift state", () => {
    for (const shift of [true, false]) {
      expect(aspectLocked("raster", shift)).toBe(!aspectLocked("region", shift));
    }
  });
});

describe("raster surface — selected image / layer / paste placement", () => {
  it("plain corner drag keeps the source ratio", () => {
    const out = resize("raster", "se", START, { dx: 100, dy: 0 }, false);
    expect(out).toMatchObject({ width: 500, height: 375 });
    expect(ratio(out)).toBeCloseTo(ratio(START), 10);
  });

  it("Shift + corner drag frees it, and skews", () => {
    const out = resize("raster", "se", START, { dx: 100, dy: 0 }, true);
    expect(out).toMatchObject({ width: 500, height: 300 });
    expect(ratio(out)).not.toBeCloseTo(ratio(START), 3);
  });

  it("keeps the ratio on every corner, dragging the corner itself", () => {
    // Each corner's own outward direction, so the box grows rather than flips.
    const corners: Array<[string, { dx: number; dy: number }]> = [
      ["se", { dx: 80, dy: 0 }],
      ["ne", { dx: 80, dy: 0 }],
      ["sw", { dx: -80, dy: 0 }],
      ["nw", { dx: -80, dy: 0 }],
    ];
    for (const [handle, drag] of corners) {
      const out = resize("raster", handle, START, drag, false);
      expect(ratio(out), `corner ${handle}`).toBeCloseTo(ratio(START), 10);
    }
  });

  it("shrinks proportionally too, not just grows", () => {
    const out = resize("raster", "se", START, { dx: -200, dy: 0 }, false);
    expect(out).toMatchObject({ width: 200, height: 150 });
    expect(ratio(out)).toBeCloseTo(ratio(START), 10);
  });

  it("EDGE handles stay free even on a plain drag — one axis has no ratio to keep", () => {
    // This is the documented Figma/Illustrator/Photoshop behaviour and the
    // reason the spec says "plain CORNER drag".
    expect(resize("raster", "e", START, { dx: 100, dy: 0 }, false))
      .toMatchObject({ width: 500, height: 300 });
    expect(resize("raster", "s", START, { dx: 0, dy: 60 }, false))
      .toMatchObject({ width: 400, height: 360 });
  });

  it("a square stays square on a plain corner drag", () => {
    const sq = { x: 0, y: 0, width: 200, height: 200 };
    const out = resize("raster", "se", sq, { dx: 50, dy: 5 }, false);
    expect(out.width).toBeCloseTo(out.height, 10);
  });
});

describe("region surface — crop is unchanged by the new rule", () => {
  it("plain corner drag is free", () => {
    const out = resize("region", "se", START, { dx: 100, dy: 0 }, false);
    expect(out).toMatchObject({ width: 500, height: 300 });
  });

  it("Shift + corner drag constrains", () => {
    const out = resize("region", "se", START, { dx: 100, dy: 0 }, true);
    expect(out).toMatchObject({ width: 500, height: 375 });
    expect(ratio(out)).toBeCloseTo(ratio(START), 10);
  });

  it("produces the exact opposite rect to raster for the same gesture", () => {
    for (const shift of [true, false]) {
      const r = resize("raster", "se", START, { dx: 100, dy: 0 }, shift);
      const g = resize("region", "se", START, { dx: 100, dy: 0 }, shift);
      expect(r).not.toEqual(g);
      // and each equals the other's opposite Shift state
      expect(r).toEqual(resize("region", "se", START, { dx: 100, dy: 0 }, !shift));
    }
  });
});

describe("lockCornerDelta — sign conventions the callers depend on", () => {
  it("no-ops for edge handles", () => {
    expect(lockCornerDelta("e", 100, 0, 400, 300)).toEqual({ dx: 100, dy: 0 });
    expect(lockCornerDelta("n", 0, 50, 400, 300)).toEqual({ dx: 0, dy: 50 });
  });

  it("no-ops on a degenerate start rect rather than dividing by zero", () => {
    expect(lockCornerDelta("se", 10, 10, 0, 300)).toEqual({ dx: 10, dy: 10 });
    expect(lockCornerDelta("se", 10, 10, 400, 0)).toEqual({ dx: 10, dy: 10 });
  });

  it("honours the w/n shrink-on-positive-delta convention", () => {
    // "w" grows the box when dx is NEGATIVE, so a locked drag must return a
    // negative dy pair for the same visual direction.
    const { dx, dy } = lockCornerDelta("nw", -100, 0, 400, 300);
    expect(dx).toBeCloseTo(-100, 10);
    expect(dy).toBeCloseTo(-75, 10);
  });
});

describe("the other lock helpers are untouched by the surface policy", () => {
  it("lockScaleFactors picks the larger magnitude of change", () => {
    expect(lockScaleFactors(1.25, 1.0)).toEqual({ kx: 1.25, ky: 1.25 });
    expect(lockScaleFactors(1.0, 0.5)).toEqual({ kx: 0.5, ky: 0.5 });
  });

  it("lockAxisDelta zeroes the smaller axis", () => {
    expect(lockAxisDelta(30, 5)).toEqual({ dx: 30, dy: 0 });
    expect(lockAxisDelta(5, 30)).toEqual({ dx: 0, dy: 30 });
  });

  it("lockPointToAxis snaps to a quarter turn and keeps the length", () => {
    const p = lockPointToAxis(0, 0, 100, 10);
    expect(p.x).toBeCloseTo(Math.hypot(100, 10), 6);
    expect(p.y).toBeCloseTo(0, 6);
  });
});
