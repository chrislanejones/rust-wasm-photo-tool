import { describe, expect, it } from "vitest";
import {
  NONE,
  alignGroups,
  expand,
  marqueePick,
  pickedBounds,
  shapeBox,
  toggle,
  type SelShape,
  type SelText,
} from "./annotationSelection";

const rect = (id: number, x: number, y: number, w: number, h: number, rotation = 0): SelShape => ({
  id, kind: 0, x0: x, y0: y, x1: x + w, y1: y + h, rotation,
});
const arrow = (id: number, x0: number, y0: number, x1: number, y1: number): SelShape => ({ id, kind: 4, x0, y0, x1, y1 });
const pin = (id: number, cx: number, cy: number): SelShape => ({ id, kind: 5, x0: cx - 20, y0: cy - 20, x1: cx + 20, y1: cy + 20 });
const text = (id: number, x: number, y: number, w = 60, h = 20): SelText => ({
  id, x, y, tile_offset_x: 0, tile_offset_y: 0, tile_w: w, tile_h: h,
});

// A callout: pin at (300, 300) r 20, label at (400, 200) 60×20, leader from
// the label's left edge midpoint (400, 210) to the pin's outline toward it.
function callout() {
  const d = Math.hypot(100, -90);
  const head = { x: 300 + (100 / d) * 20, y: 300 + (-90 / d) * 20 };
  return {
    pin: pin(10, 300, 300),
    leader: arrow(11, 400, 210, head.x, head.y),
    label: text(20, 400, 200),
  };
}

describe("annotationSelection", () => {
  it("toggle adds and removes", () => {
    const a = toggle(NONE, "shape", 3);
    expect(a).toEqual({ shapes: [3], texts: [] });
    expect(toggle(toggle(a, "text", 3), "shape", 3)).toEqual({ shapes: [], texts: [3] });
  });

  it("a turned rect is measured by its turned corners", () => {
    expect(shapeBox(rect(1, 150, 40, 60, 20, 90))).toMatchObject({ x0: 170, x1: 190 });
    // Arrows keep their stored geometry whatever the angle.
    expect(shapeBox({ ...arrow(2, 0, 0, 10, 0), rotation: 90 })).toEqual({ x0: 0, y0: 0, x1: 10, y1: 0 });
  });

  it("picking any part of a callout picks all three", () => {
    const c = callout();
    const shapes = [c.pin, c.leader];
    const texts = [c.label];
    for (const start of [{ shapes: [10], texts: [] }, { shapes: [11], texts: [] }, { shapes: [], texts: [20] }]) {
      expect(expand(start, shapes, texts)).toEqual({ shapes: [10, 11], texts: [20] });
    }
  });

  it("a connector comes along only when both its ends are on picked boxes", () => {
    const shapes = [rect(1, 0, 0, 100, 60), rect(2, 300, 0, 100, 60), arrow(3, 100, 30, 300, 30)];
    expect(expand({ shapes: [1, 2], texts: [] }, shapes, []).shapes).toEqual([1, 2, 3]);
    expect(expand({ shapes: [1], texts: [] }, shapes, []).shapes).toEqual([1]);
  });

  it("the marquee takes what is fully inside, either drag direction", () => {
    const shapes = [rect(1, 10, 10, 50, 50), rect(2, 100, 10, 50, 50)];
    const texts = [text(5, 20, 80)];
    expect(marqueePick({ x0: 0, y0: 0, x1: 120, y1: 120 }, shapes, texts)).toEqual({ shapes: [1], texts: [5] });
    expect(marqueePick({ x0: 160, y0: 70, x1: 0, y1: 0 }, shapes, texts)).toEqual({ shapes: [1, 2], texts: [] });
  });

  it("bounds are the union of the picked boxes", () => {
    const shapes = [rect(1, 10, 10, 50, 50), rect(2, 100, 200, 50, 50)];
    expect(pickedBounds({ shapes: [1, 2], texts: [] }, shapes, [])).toEqual({ x0: 10, y0: 10, x1: 150, y1: 250 });
    expect(pickedBounds(NONE, shapes, [])).toBeNull();
  });

  it("align groups: a callout is one group, connectors re-route instead", () => {
    const c = callout();
    const shapes = [c.pin, c.leader, rect(1, 0, 0, 100, 60), rect(2, 300, 400, 100, 60), arrow(3, 100, 30, 300, 430)];
    const g = alignGroups({ shapes: [10, 11, 1, 2, 3], texts: [20] }, shapes, [c.label]);
    expect(g.shapeIds).toEqual([10, 11, 1, 2]);
    expect(g.shapeGroups[0]).toBe(g.shapeGroups[1]);
    expect(g.textGroups[0]).toBe(g.shapeGroups[0]);
    expect(new Set(g.shapeGroups).size).toBe(3);
    expect(g.groups).toBe(3);
  });
});
