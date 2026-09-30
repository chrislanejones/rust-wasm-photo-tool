// An object's footprint — the geometry Review → Combine hands the engine.
//
// What these pin is not "a bbox is a bbox": it is the three decisions that
// stop a click on an object row from doing something surprising. Which
// producer a kind uses (a circle must select a circle), that no shape can
// collapse to a zero-area rect (which the engine reads as Photoshop's
// empty-marquee DESELECT — a line would have CLEARED the selection instead of
// adding to it), and that the lookup cannot cross the two id-spaces.
import { describe, it, expect } from "vitest";
import {
  objectFootprint,
  shapeFootprint,
  textFootprint,
  type AnnotationSource,
} from "./objectSelection";

const shape = (over: Partial<Parameters<typeof shapeFootprint>[0]> = {}) => ({
  kind: 0,
  x0: 10,
  y0: 20,
  x1: 110,
  y1: 70,
  stroke_width: 4,
  ...over,
});

const textAnn = (over: Partial<Parameters<typeof textFootprint>[0]> = {}) => ({
  x: 40,
  y: 50,
  tile_w: 120,
  tile_h: 30,
  tile_offset_x: -6,
  tile_offset_y: -4,
  ...over,
});

describe("which producer a kind uses", () => {
  it("a circle and the legacy hand-drawn circle select an ELLIPSE", () => {
    // Free correctness: `ellipse_select` already exists and takes the same four
    // corners, so a round shape has no reason to select the square around it.
    expect(shapeFootprint(shape({ kind: 1 })).producer).toBe("ellipse");
    expect(shapeFootprint(shape({ kind: 3 })).producer).toBe("ellipse");
  });

  it("everything else selects its box", () => {
    // Rect, line, hand-drawn, arrow, pin, pen, bézier, diamond, star. A diamond
    // and a star are polygons the engine has no producer for; the box is honest
    // about being a box.
    for (const kind of [0, 2, 4, 5, 6, 7, 8, 9]) {
      expect(shapeFootprint(shape({ kind })).producer, `kind ${kind}`).toBe("rect");
    }
  });
});

describe("a shape's box", () => {
  it("comes out ordered whichever way the shape was drawn", () => {
    const dragged = shapeFootprint(shape({ x0: 110, y0: 70, x1: 10, y1: 20 }));
    const drawn = shapeFootprint(shape());
    expect(dragged).toEqual(drawn);
    expect(dragged.x0).toBeLessThan(dragged.x1);
    expect(dragged.y0).toBeLessThan(dragged.y1);
  });

  it("grows by half the stroke, because that is where the ink is", () => {
    const f = shapeFootprint(shape({ stroke_width: 10 }));
    expect(f.x0).toBe(5); // 10 − 10/2
    expect(f.x1).toBe(115); // 110 + 10/2
  });

  it("a horizontal line still has height — it does not deselect", () => {
    // y0 === y1, and `rect_select` snaps a zero-height rect outward to a
    // zero-height MASK, which in New mode clears the selection. The ½ px floor
    // is what keeps "combine this line" from meaning "deselect".
    const f = shapeFootprint(shape({ kind: 2, y0: 40, y1: 40, stroke_width: 0 }));
    expect(f.y1 - f.y0).toBeGreaterThanOrEqual(1);
  });

  it("a hairline stroke still pads by the floor, not by zero", () => {
    const f = shapeFootprint(shape({ stroke_width: 0.2 }));
    expect(f.x0).toBe(9.5);
  });
});

describe("a text box's footprint", () => {
  it("is the baked tile, offsets applied and NOT padded", () => {
    // The tile IS the ink bounds. Growing it would select background no glyph
    // ever touched. Same box the canvas hover highlight outlines.
    expect(textFootprint(textAnn())).toEqual({
      x0: 34,
      y0: 46,
      x1: 154,
      y1: 76,
      producer: "rect",
    });
  });

  it("is null for a tile with no area", () => {
    // A box that has not rendered yet. Combining nothing is not what a click
    // asked for, so the caller does nothing rather than clearing the selection.
    expect(textFootprint(textAnn({ tile_w: 0 }))).toBeNull();
    expect(textFootprint(textAnn({ tile_h: 0 }))).toBeNull();
  });
});

describe("reading the footprint off the engine", () => {
  /** Both lists carry an id 4 — the two id-spaces are separate, which is the
   *  trap the type half of the ref exists to avoid. */
  const src: AnnotationSource = {
    get_shape_annotations: () =>
      JSON.stringify([
        { id: 4, ...shape({ kind: 1 }) },
        { id: 7, ...shape({ kind: 0, x0: 0, y0: 0, x1: 20, y1: 20, stroke_width: 2 }) },
      ]),
    get_text_annotations: () => JSON.stringify([{ id: 4, ...textAnn() }]),
  };

  it("a shape id and a text id of the same number are different objects", async () => {
    const asShape = await objectFootprint(src, { type: "shape", id: 4 });
    const asText = await objectFootprint(src, { type: "text", id: 4 });
    expect(asShape?.producer).toBe("ellipse");
    expect(asText?.producer).toBe("rect");
    expect(asShape).not.toEqual(asText);
  });

  it("reads the right shape out of the list", async () => {
    const f = await objectFootprint(src, { type: "shape", id: 7 });
    expect(f).toEqual({ x0: -1, y0: -1, x1: 21, y1: 21, producer: "rect" });
  });

  it("awaits a Promise-returning engine — the handle is async behind the worker", async () => {
    const async_: AnnotationSource = {
      get_shape_annotations: () => Promise.resolve(src.get_shape_annotations() as string),
      get_text_annotations: () => Promise.resolve(src.get_text_annotations() as string),
    };
    expect((await objectFootprint(async_, { type: "shape", id: 7 }))?.x1).toBe(21);
  });

  it("is null for an id that is gone — deleted, or on another layer", async () => {
    // Both getters are active-layer scoped, so this is also what a click on a
    // row whose object lives elsewhere reads as. Nothing happens; the selection
    // is not cleared.
    expect(await objectFootprint(src, { type: "shape", id: 99 })).toBeNull();
    expect(await objectFootprint(src, { type: "text", id: 99 })).toBeNull();
  });

  it("is null rather than a throw when the engine answers with nonsense", async () => {
    const broken: AnnotationSource = {
      get_shape_annotations: () => "not json",
      get_text_annotations: () => "{}",
    };
    expect(await objectFootprint(broken, { type: "shape", id: 1 })).toBeNull();
    expect(await objectFootprint(broken, { type: "text", id: 1 })).toBeNull();
  });
});
