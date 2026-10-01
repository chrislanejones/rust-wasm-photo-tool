import { describe, expect, it } from "vitest";
import {
  normalizeDeg,
  pinAfterResize,
  rotatePoint,
  rotateSegment,
  rotatedResizeCursor,
  rotationAfterDrag,
  toLocalDelta,
  type Pt,
} from "./shapeRotation";

const close = (a: Pt, b: Pt) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe("normalizeDeg", () => {
  it.each([
    [0, 0],
    [180, 180],
    [-180, 180],
    [190, -170],
    [540, 180],
    [-190, 170],
    [725, 5],
  ])("%d → %d", (input, out) => {
    expect(normalizeDeg(input)).toBe(out);
  });
});

describe("rotatePoint", () => {
  it("turns clockwise on screen (y-down), like SVG rotate()", () => {
    // 90° clockwise takes a point to the RIGHT of center to BELOW it.
    close(rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90), { x: 0, y: 10 });
  });

  it("is the identity at 0°", () => {
    close(rotatePoint({ x: 3, y: 4 }, { x: 1, y: 1 }, 0), { x: 3, y: 4 });
  });
});

describe("rotationAfterDrag", () => {
  const c = { x: 0, y: 0 };

  it("adds the angle swept since the grab, not the pointer's absolute angle", () => {
    // Grabbed below the center (where the handle rests), dragged to the left:
    // a quarter turn clockwise.
    expect(rotationAfterDrag(c, { x: 0, y: 10 }, { x: -10, y: 0 }, 0)).toBe(90);
  });

  it("starts from the shape's current rotation", () => {
    expect(rotationAfterDrag(c, { x: 0, y: 10 }, { x: 0, y: 10 }, 30)).toBe(30);
  });

  it("snaps to 15° with Shift", () => {
    // ~37° of sweep snaps to 30.
    const now = rotatePoint({ x: 0, y: 10 }, c, 37);
    expect(rotationAfterDrag(c, { x: 0, y: 10 }, now, 0, true)).toBe(30);
  });

  it("stays inside (-180, 180]", () => {
    const now = rotatePoint({ x: 0, y: 10 }, c, 100);
    expect(rotationAfterDrag(c, { x: 0, y: 10 }, now, 170)).toBe(-90);
  });
});

describe("toLocalDelta", () => {
  it("maps a screen drag onto the turned box's own axes", () => {
    // Box turned 90° clockwise: its local +x points DOWN on screen, so a drag
    // straight down is a drag along local +x.
    const d = toLocalDelta(0, 10, 90);
    expect(d.dx).toBeCloseTo(10, 6);
    expect(d.dy).toBeCloseTo(0, 6);
  });
});

describe("pinAfterResize", () => {
  it("is a no-op for an upright box", () => {
    const r = pinAfterResize({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }, { x: 20, y: 10 }, 0);
    close(r.start, { x: 0, y: 0 });
    close(r.end, { x: 20, y: 10 });
  });

  it("keeps the fixed edge where it was on screen when a turned box grows", () => {
    const deg = 90;
    const oldS = { x: 0, y: 0 };
    const oldE = { x: 20, y: 10 };
    // Drag the east handle out by 10 in the box's own frame: the west edge
    // (x = 0) is the fixed one.
    const grown = pinAfterResize(oldS, oldE, { x: 0, y: 0 }, { x: 30, y: 10 }, deg);
    const oldC = { x: 10, y: 5 };
    const newC = { x: (grown.start.x + grown.end.x) / 2, y: (grown.start.y + grown.end.y) / 2 };
    // The west edge's midpoint, local (0, 5), on screen before and after.
    const before = rotatePoint({ x: oldS.x, y: 5 }, oldC, deg);
    const after = rotatePoint({ x: grown.start.x, y: (grown.start.y + grown.end.y) / 2 }, newC, deg);
    close(after, before);
    // And the box really is 30 wide in its own frame.
    expect(grown.end.x - grown.start.x).toBeCloseTo(30, 6);
  });
});

describe("rotateSegment", () => {
  it("turns a line about its midpoint", () => {
    const r = rotateSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 90);
    close(r.start, { x: 5, y: -5 });
    close(r.end, { x: 5, y: 5 });
  });
});

describe("rotatedResizeCursor", () => {
  it("is the plain cursor when upright", () => {
    expect(rotatedResizeCursor("n", 0)).toBe("n-resize");
    expect(rotatedResizeCursor("se", 0)).toBe("se-resize");
  });

  it("turns with the box", () => {
    expect(rotatedResizeCursor("n", 90)).toBe("e-resize");
    expect(rotatedResizeCursor("n", -45)).toBe("nw-resize");
    expect(rotatedResizeCursor("w", 180)).toBe("e-resize");
  });
});
