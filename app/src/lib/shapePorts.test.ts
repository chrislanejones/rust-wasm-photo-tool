import { describe, it, expect } from "vitest";
import {
  BOX_KINDS,
  PORTS,
  clampGap,
  connectTarget,
  duplicateOffset,
  portPoint,
  tooSmallForActions,
  GAP_MAX,
  MIN_ACTIONABLE_SCREEN_PX,
} from "./shapePorts";

const BOX = { x0: 100, y0: 100, x1: 200, y1: 160 }; // 100 × 60
const port = (id: string) => PORTS.find((p) => p.id === id)!;

describe("shape ports", () => {
  it("has the eight resize-square positions, clockwise from the top-left", () => {
    expect(PORTS.map((p) => p.id)).toEqual(["nw", "n", "ne", "e", "se", "s", "sw", "w"]);
    expect(portPoint(BOX, 0, port("nw"))).toEqual({ x: 100, y: 100 });
    expect(portPoint(BOX, 0, port("e"))).toEqual({ x: 200, y: 130 });
    expect(portPoint(BOX, 0, port("s"))).toEqual({ x: 150, y: 160 });
  });

  it("reads a box dragged right-to-left the same as left-to-right", () => {
    const flipped = { x0: 200, y0: 160, x1: 100, y1: 100 };
    for (const p of PORTS) expect(portPoint(flipped, 0, p)).toEqual(portPoint(BOX, 0, p));
  });

  it("turns the ports with the shape", () => {
    // A 90° turn puts the east port where south was, about the center.
    const sq = { x0: 0, y0: 0, x1: 100, y1: 100 };
    const e = portPoint(sq, 90, port("e"));
    expect(e.x).toBeCloseTo(50);
    expect(e.y).toBeCloseTo(100);
  });

  it("acts on box shapes only", () => {
    for (const k of [0, 1, 8, 9, 10]) expect(BOX_KINDS.has(k)).toBe(true);
    for (const k of [2, 3, 4, 5, 6, 7]) expect(BOX_KINDS.has(k)).toBe(false);
  });
});

describe("duplicate offsets", () => {
  it("the first copy clears the shape by exactly the gap", () => {
    expect(duplicateOffset(BOX, 0, port("e"), 1, 20)).toEqual({ x: 120, y: 0 });
    expect(duplicateOffset(BOX, 0, port("n"), 1, 20)).toEqual({ x: 0, y: -80 });
  });

  it("counts from the ORIGINAL, so the 2nd copy is twice the 1st", () => {
    const one = duplicateOffset(BOX, 0, port("w"), 1, 20);
    const two = duplicateOffset(BOX, 0, port("w"), 2, 20);
    expect(two.x).toBe(2 * one.x);
  });

  it("a corner port steps both axes", () => {
    expect(duplicateOffset(BOX, 0, port("se"), 1, 20)).toEqual({ x: 120, y: 80 });
    expect(duplicateOffset(BOX, 0, port("nw"), 1, 0)).toEqual({ x: -100, y: -60 });
  });

  it("a turned shape steps along its own axis", () => {
    const d = duplicateOffset(BOX, 90, port("e"), 1, 20);
    expect(d).toEqual({ x: 0, y: 120 });
  });

  it("clamps the gap", () => {
    expect(clampGap(-5)).toBe(0);
    expect(clampGap(GAP_MAX + 100)).toBe(GAP_MAX);
    expect(clampGap(Number.NaN)).toBe(20);
  });
});

describe("too small for the karate", () => {
  it("hides the bar when the shorter on-screen side is under the cutoff", () => {
    expect(tooSmallForActions(200, MIN_ACTIONABLE_SCREEN_PX - 1)).toBe(true);
    expect(tooSmallForActions(MIN_ACTIONABLE_SCREEN_PX, MIN_ACTIONABLE_SCREEN_PX)).toBe(false);
  });
});

describe("connect targets", () => {
  const other = { id: 7, box: { x0: 400, y0: 100, x1: 500, y1: 200 }, rotation: 0 };

  it("snaps to the nearest port within reach", () => {
    expect(connectTarget([other], { x: 395, y: 152 }, 12)).toEqual({
      id: 7,
      port: "w",
      point: { x: 400, y: 150 },
    });
  });

  it("dropping anywhere on a shape lands on its nearest port", () => {
    const hit = connectTarget([other], { x: 490, y: 190 }, 12);
    expect(hit?.port).toBe("se");
  });

  it("dropping on empty canvas makes no connector", () => {
    expect(connectTarget([other], { x: 250, y: 400 }, 12)).toBeNull();
    expect(connectTarget([], { x: 0, y: 0 }, 12)).toBeNull();
  });
});
