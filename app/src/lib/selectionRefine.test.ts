// The Refine settings' shape: Clean Up is the plan's defaults, the engine gets
// the four selection ops in its own argument order, and Feather is not one of
// them (it shapes a mask made later, never the selection).
import { describe, it, expect } from "vitest";
import { CLEAN_UP, MASK_SOURCE, isNoopRefine, refineArgs } from "./selectionRefine";

describe("CLEAN_UP", () => {
  it("is islands 4, holes 6, smooth 2, feather 1, expand -1", () => {
    expect(CLEAN_UP).toEqual({ islands: 4, holes: 6, smooth: 2, feather: 1, expand: -1 });
  });
});

describe("refineArgs", () => {
  it("is islands, holes, smooth, expand — feather is not sent", () => {
    expect(refineArgs({ islands: 1, holes: 2, smooth: 3, feather: 9, expand: -4 })).toEqual([1, 2, 3, -4]);
  });
});

describe("isNoopRefine", () => {
  it("is true only when all four selection ops are off", () => {
    expect(isNoopRefine({ islands: 0, holes: 0, smooth: 0, feather: 5, expand: 0 })).toBe(true);
    for (const k of ["islands", "holes", "smooth"] as const) {
      expect(isNoopRefine({ islands: 0, holes: 0, smooth: 0, feather: 0, expand: 0, [k]: 1 })).toBe(false);
    }
    expect(isNoopRefine({ islands: 0, holes: 0, smooth: 0, feather: 0, expand: -1 })).toBe(false);
  });
});

describe("MASK_SOURCE", () => {
  it("matches the engine's numbering", () => {
    expect(MASK_SOURCE).toEqual({ revealAll: 0, hideAll: 1, revealSelection: 2, hideSelection: 3 });
  });
});
