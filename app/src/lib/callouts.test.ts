import { describe, it, expect } from "vitest";
import { calloutsToFollow, defaultLabelAt, findCallouts, leaderFor, type CalloutShape, type CalloutText } from "./callouts";

const pin: CalloutShape = { id: 1, kind: 5, x0: 90, y0: 90, x1: 110, y1: 110 }; // center 100,100 r 10
const label: CalloutText = { id: 7, x: 200, y: 40, tile_offset_x: 0, tile_offset_y: 0, tile_w: 80, tile_h: 20 };
const arrow = (l: { x0: number; y0: number; x1: number; y1: number }, id = 2): CalloutShape => ({ id, kind: 4, ...l });

describe("leaderFor", () => {
  it("runs from the label edge nearest the pin to the pin's outline", () => {
    const l = leaderFor(pin, label);
    expect([l.x0, l.y0]).toEqual([200, 50]); // the label's left edge midpoint
    expect(Math.hypot(l.x1 - 100, l.y1 - 100)).toBeCloseTo(10, 9);
    // The head points at the pin's center.
    expect((l.y1 - 100) / (l.x1 - 100)).toBeCloseTo((50 - 100) / (200 - 100), 9);
  });

  it("takes the label's bottom edge when the label sits above the pin", () => {
    const above = { ...label, x: 60, y: 0 };
    expect(leaderFor(pin, above)).toMatchObject({ x0: 100, y0: 20 });
  });
});

describe("findCallouts", () => {
  it("joins a pin and a label by the arrow between them", () => {
    const shapes = [pin, arrow(leaderFor(pin, label))];
    expect(findCallouts(shapes, [label])).toEqual([{ pin: 1, leader: 2, label: 7 }]);
  });

  it("an arrow that misses either end is not a leader", () => {
    const l = leaderFor(pin, label);
    expect(findCallouts([pin, arrow({ ...l, x0: l.x0 + 3 })], [label])).toEqual([]);
    expect(findCallouts([pin, arrow({ ...l, x1: l.x1 + 3 })], [label])).toEqual([]);
    expect(findCallouts([{ ...pin, kind: 1 }, arrow(l)], [label])).toEqual([]); // a circle is not a pin
  });
});

describe("calloutsToFollow", () => {
  const before = { shapes: [pin, arrow(leaderFor(pin, label))], texts: [label] };

  it("a moved pin redraws its leader", () => {
    const moved = { ...pin, x0: 40, x1: 60 };
    const now = { shapes: [moved, before.shapes[1]], texts: [label] };
    expect(calloutsToFollow(before, now)).toEqual([{ id: 2, ...leaderFor(moved, label) }]);
  });

  it("a moved label redraws its leader", () => {
    const moved = { ...label, y: 300 };
    const now = { shapes: before.shapes, texts: [moved] };
    expect(calloutsToFollow(before, now)).toEqual([{ id: 2, ...leaderFor(pin, moved) }]);
  });

  it("nothing moved, or the leader moved with them (undo), redraws nothing", () => {
    expect(calloutsToFollow(before, before)).toEqual([]);
    const moved = { ...pin, x0: 40, x1: 60 };
    const undone = { shapes: [moved, arrow(leaderFor(moved, label))], texts: [label] };
    expect(calloutsToFollow(before, undone)).toEqual([]);
  });
});

describe("defaultLabelAt", () => {
  it("up and to the right, or left near the right edge", () => {
    expect(defaultLabelAt({ x: 100, y: 100 }, 10, 1000)).toEqual({ x: 130, y: 70 });
    expect(defaultLabelAt({ x: 950, y: 100 }, 10, 1000)).toEqual({ x: 800, y: 70 });
  });
});
