import { describe, it, expect } from "vitest";
import {
  BOX_KINDS,
  PORTS,
  clampGap,
  attachedEnds,
  connectTarget,
  connectorsToFollow,
  duplicateOffset,
  outlinePoint,
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

describe("ports on the outline", () => {
  const SQ = { x0: 0, y0: 0, x1: 100, y1: 100 };

  it("a rect's outline is its box", () => {
    for (const p of PORTS) expect(outlinePoint(SQ, 0, p, 0)).toEqual(portPoint(SQ, 0, p));
  });

  it("an oval puts the corner ports on the curve at 45°", () => {
    const ne = outlinePoint({ x0: 0, y0: 0, x1: 200, y1: 100 }, 0, port("ne"), 1);
    expect(ne.x).toBeCloseTo(100 + 100 * Math.SQRT1_2);
    expect(ne.y).toBeCloseTo(50 - 50 * Math.SQRT1_2);
    // N/E/S/W are the oval's own extremes, the same as the box's.
    expect(outlinePoint(SQ, 0, port("e"), 1)).toEqual({ x: 100, y: 50 });
  });

  it("a diamond's sides are its tips and its corners land mid-edge", () => {
    expect(outlinePoint(SQ, 0, port("n"), 8)).toEqual({ x: 50, y: 0 });
    const nw = outlinePoint(SQ, 0, port("nw"), 8);
    expect(nw.x).toBeCloseTo(25);
    expect(nw.y).toBeCloseTo(25);
  });

  it("a triangle's N port is its apex and its W port is on the left edge", () => {
    const n = outlinePoint(SQ, 0, port("n"), 10);
    expect(n.x).toBeCloseTo(50);
    expect(n.y).toBeCloseTo(0);
    const w = outlinePoint(SQ, 0, port("w"), 10);
    expect(w.x).toBeCloseTo(25);
    expect(w.y).toBeCloseTo(50);
  });

  it("a star's ports are on the star, inside its box", () => {
    const n = outlinePoint(SQ, 0, port("n"), 9);
    expect(n.x).toBeCloseTo(50);
    expect(n.y).toBeCloseTo(0); // the top tip
    for (const p of PORTS) {
      const q = outlinePoint(SQ, 0, p, 9);
      expect(Math.hypot(q.x - 50, q.y - 50)).toBeLessThanOrEqual(50 * Math.SQRT2 + 1e-9);
      expect(Math.hypot(q.x - 50, q.y - 50)).toBeGreaterThanOrEqual(25 - 1e-9);
    }
  });

  it("turns with the shape", () => {
    const n = outlinePoint(SQ, 90, port("n"), 10);
    expect(n.x).toBeCloseTo(100);
    expect(n.y).toBeCloseTo(50);
  });
});

describe("connectors stay attached", () => {
  const box = (id: number, x: number, y: number, kind = 0) => ({
    id,
    kind,
    x0: x,
    y0: y,
    x1: x + 40,
    y1: y + 40,
  });
  const arrow = (id: number, x0: number, y0: number, x1: number, y1: number) => ({
    id,
    kind: 4,
    x0,
    y0,
    x1,
    y1,
  });
  // A (10,10)-(50,50) east port → B (120,10)-(160,50) west port.
  const before = [box(1, 10, 10), box(2, 120, 10), arrow(3, 50, 30, 120, 30)];

  it("finds the arrow ends sitting on a shape's ports", () => {
    const [a] = before;
    const ends = attachedEnds(
      { id: 1, box: a, rotation: 0, kind: 0 },
      before.filter((s) => s.kind === 4),
    );
    expect(ends).toEqual([
      { arrowId: 3, end: 0, port: "e", at: { x: 50, y: 30 }, other: { x: 120, y: 30 } },
    ]);
  });

  it("a moved box drags its connector end along", () => {
    const now = [box(1, 10, 40), box(2, 120, 10), arrow(3, 50, 30, 120, 30)];
    expect(connectorsToFollow(before, now)).toEqual([
      { id: 3, x0: 50, y0: 60, x1: 120, y1: 30 },
    ]);
  });

  it("follows the outline of a circle too", () => {
    const b4 = [box(1, 10, 10, 1), box(2, 120, 10), arrow(3, 30, 10, 120, 30)]; // A's N port
    const now = [box(1, 60, 60, 1), box(2, 120, 10), arrow(3, 30, 10, 120, 30)];
    expect(connectorsToFollow(b4, now)).toEqual([{ id: 3, x0: 80, y0: 60, x1: 120, y1: 30 }]);
  });

  it("both boxes moving re-routes both ends", () => {
    const now = [box(1, 10, 40), box(2, 120, 0), arrow(3, 50, 30, 120, 30)];
    expect(connectorsToFollow(before, now)).toEqual([
      { id: 3, x0: 50, y0: 60, x1: 120, y1: 20 },
    ]);
  });

  it("leaves arrows that moved with the box alone (undo, layer move)", () => {
    const now = [box(1, 10, 40), box(2, 120, 10), arrow(3, 50, 60, 120, 30)];
    expect(connectorsToFollow(before, now)).toEqual([]);
  });

  it("ignores arrows that were not on a port", () => {
    const b4 = [box(1, 10, 10), arrow(3, 52, 30, 120, 30)];
    const now = [box(1, 10, 40), arrow(3, 52, 30, 120, 30)];
    expect(connectorsToFollow(b4, now)).toEqual([]);
  });

  it("nothing moved, nothing to do", () => {
    expect(connectorsToFollow(before, before)).toEqual([]);
  });
});
