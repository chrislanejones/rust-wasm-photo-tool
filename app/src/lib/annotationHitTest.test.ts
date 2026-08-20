// Pins annotationHitTest.ts against the Rust it mirrors (#50).
//
// This module is a deliberate second definition of a rule that lives in
// annotations.rs (see that file's header for why). These tests are what stops
// the two drifting: each one states the Rust behaviour it is holding the TS to,
// so a future change to either side fails here rather than in someone's canvas.
import { describe, it, expect } from "vitest";
import {
  textAnnotationAt,
  shapeAnnotationAt,
  pointSegmentDistance,
  findForeignAnnotation,
  type TextHitGeometry,
  type ShapeHitGeometry,
} from "./annotationHitTest";

const text = (o: Partial<TextHitGeometry> & { id: number }): TextHitGeometry => ({
  x: 0,
  y: 0,
  tile_w: 100,
  tile_h: 50,
  tile_offset_x: 0,
  tile_offset_y: 0,
  ...o,
});

const shape = (o: Partial<ShapeHitGeometry> & { id: number }): ShapeHitGeometry => ({
  kind: 0,
  x0: 0,
  y0: 0,
  x1: 100,
  y1: 100,
  stroke_width: 2,
  ...o,
});

describe("textAnnotationAt", () => {
  it("matches the live engine on a measured real annotation", () => {
    // Captured from the running engine 2026-08-18: TEXT-A at (120,120),
    // tile 177x87, zero offsets. `text_annotation_at(208,163)` returned 1.
    const anns = [text({ id: 1, x: 120, y: 120, tile_w: 177, tile_h: 87 })];
    expect(textAnnotationAt(anns, 208, 163)).toBe(1);
  });

  it("returns -1 for an empty list", () => {
    expect(textAnnotationAt([], 10, 10)).toBe(-1);
  });

  it("includes the near edge and EXCLUDES the far edge (half-open, as Rust)", () => {
    const anns = [text({ id: 7, x: 10, y: 20, tile_w: 100, tile_h: 50 })];
    expect(textAnnotationAt(anns, 10, 20)).toBe(7); // top-left corner: inside
    expect(textAnnotationAt(anns, 109, 69)).toBe(7); // last inside pixel
    expect(textAnnotationAt(anns, 110, 40)).toBe(-1); // x == tx + w → outside
    expect(textAnnotationAt(anns, 50, 70)).toBe(-1); // y == ty + h → outside
  });

  it("applies tile_offset to the origin", () => {
    // Rust: tx = a.x + a.tile_offset_x. A negative offset (rotated/shadowed
    // tiles have one) moves the box up-left of the anchor.
    const anns = [
      text({ id: 3, x: 100, y: 100, tile_offset_x: -20, tile_offset_y: -10 }),
    ];
    expect(textAnnotationAt(anns, 85, 95)).toBe(3);
    expect(textAnnotationAt(anns, 100, 100)).toBe(3);
    expect(textAnnotationAt(anns, 79, 95)).toBe(-1);
  });

  it("newest-added wins on overlap (iterates in reverse, as Rust)", () => {
    const anns = [text({ id: 1 }), text({ id: 2 })]; // identical boxes
    expect(textAnnotationAt(anns, 10, 10)).toBe(2);
  });
});

describe("pointSegmentDistance", () => {
  it("clamps to the segment rather than the infinite line", () => {
    // Straight off the end: nearest point is the endpoint, distance 10.
    expect(pointSegmentDistance(110, 0, 0, 0, 100, 0)).toBeCloseTo(10);
  });

  it("measures perpendicular distance inside the span", () => {
    expect(pointSegmentDistance(50, 7, 0, 0, 100, 0)).toBeCloseTo(7);
  });

  it("degenerates to point distance for a zero-length segment", () => {
    expect(pointSegmentDistance(3, 4, 0, 0, 0, 0)).toBeCloseTo(5);
  });
});

describe("shapeAnnotationAt", () => {
  it("uses distance-to-segment for line (2) and arrow (4)", () => {
    // pad = max(2*0.5, 6) = 6, tolerance = pad + 4 = 10.
    const line = [shape({ id: 5, kind: 2, x0: 0, y0: 0, x1: 100, y1: 0 })];
    expect(shapeAnnotationAt(line, 50, 9)).toBe(5);
    expect(shapeAnnotationAt(line, 50, 11)).toBe(-1);
    const arrow = [shape({ id: 6, kind: 4, x0: 0, y0: 0, x1: 100, y1: 0 })];
    expect(shapeAnnotationAt(arrow, 50, 9)).toBe(6);
  });

  it("widens tolerance with stroke_width", () => {
    // pad = max(40*0.5, 6) = 20, tolerance 24.
    const fat = [
      shape({ id: 9, kind: 2, x0: 0, y0: 0, x1: 100, y1: 0, stroke_width: 40 }),
    ];
    expect(shapeAnnotationAt(fat, 50, 23)).toBe(9);
    expect(shapeAnnotationAt(fat, 50, 25)).toBe(-1);
  });

  it("checks every segment of a polyline (6)", () => {
    const poly = [
      shape({
        id: 11,
        kind: 6,
        points: [
          [0, 0],
          [100, 0],
          [100, 100],
        ],
      }),
    ];
    expect(shapeAnnotationAt(poly, 100, 50)).toBe(11); // on the second segment
    expect(shapeAnnotationAt(poly, 50, 50)).toBe(-1); // interior, not near either
  });

  it("uses a padded bounding box for closed kinds, INCLUSIVE both edges", () => {
    // Rust's box test is `>=` and `<=` on both sides — unlike the text tile,
    // which is half-open. The asymmetry is real; keep it.
    const rect = [shape({ id: 13, kind: 0, x0: 10, y0: 10, x1: 50, y1: 50 })];
    expect(shapeAnnotationAt(rect, 4, 4)).toBe(13); // pad 6 → 4 is inside
    expect(shapeAnnotationAt(rect, 56, 56)).toBe(13);
    expect(shapeAnnotationAt(rect, 3, 30)).toBe(-1);
  });

  it("normalises an inverted rect (x1 < x0)", () => {
    const rect = [shape({ id: 14, kind: 0, x0: 50, y0: 50, x1: 10, y1: 10 })];
    expect(shapeAnnotationAt(rect, 30, 30)).toBe(14);
  });

  it("treats bézier (7) as a bounding box, as Rust's fallback branch does", () => {
    const bez = [shape({ id: 15, kind: 7, x0: 0, y0: 0, x1: 20, y1: 20 })];
    expect(shapeAnnotationAt(bez, 10, 10)).toBe(15);
  });
});

describe("findForeignAnnotation", () => {
  const makeTool = (layers: {
    id: number;
    name: string;
    visible: boolean;
    active: boolean;
    texts?: TextHitGeometry[];
    shapes?: ShapeHitGeometry[];
  }[]) => ({
    get_layers: () => JSON.stringify(layers.map(({ texts: _t, shapes: _s, ...l }) => l)),
    get_layer_text_annotations: (i: number) => JSON.stringify(layers[i].texts ?? []),
    get_layer_shape_annotations: (i: number) => JSON.stringify(layers[i].shapes ?? []),
  });

  it("finds a text on a non-active layer", async () => {
    const tool = makeTool([
      { id: 1, name: "Photo", visible: true, active: true },
      { id: 2, name: "Layer B", visible: true, active: false, texts: [text({ id: 42 })] },
    ]);
    expect(await findForeignAnnotation(tool, 10, 10)).toEqual({
      layerIndex: 1,
      layerName: "Layer B",
      id: 42,
      kind: "text",
    });
  });

  it("ignores the ACTIVE layer — the engine already answered for that one", async () => {
    const tool = makeTool([
      { id: 1, name: "Photo", visible: true, active: true, texts: [text({ id: 42 })] },
    ]);
    expect(await findForeignAnnotation(tool, 10, 10)).toBeNull();
  });

  it("ignores HIDDEN layers — invisible ink must not create a dead zone", async () => {
    const tool = makeTool([
      { id: 1, name: "Photo", visible: true, active: true },
      { id: 2, name: "Hidden", visible: false, active: false, texts: [text({ id: 42 })] },
    ]);
    expect(await findForeignAnnotation(tool, 10, 10)).toBeNull();
  });

  it("reports the TOPMOST layer when several overlap", async () => {
    const tool = makeTool([
      { id: 1, name: "Photo", visible: true, active: true },
      { id: 2, name: "Middle", visible: true, active: false, texts: [text({ id: 20 })] },
      { id: 3, name: "Top", visible: true, active: false, texts: [text({ id: 30 })] },
    ]);
    const hit = await findForeignAnnotation(tool, 10, 10);
    expect(hit?.layerName).toBe("Top");
    expect(hit?.id).toBe(30);
  });

  it("returns null on genuinely empty canvas", async () => {
    const tool = makeTool([
      { id: 1, name: "Photo", visible: true, active: true },
      { id: 2, name: "Layer B", visible: true, active: false, texts: [text({ id: 42 })] },
    ]);
    expect(await findForeignAnnotation(tool, 900, 900)).toBeNull();
  });

  it("survives malformed JSON from the engine rather than throwing into a click", async () => {
    const tool = {
      get_layers: () => "not json",
      get_layer_text_annotations: () => "[]",
      get_layer_shape_annotations: () => "[]",
    };
    expect(await findForeignAnnotation(tool, 10, 10)).toBeNull();
  });

  it("works when the engine returns Promises (worker-backed, ADR-024)", async () => {
    const tool = {
      get_layers: async () =>
        JSON.stringify([
          { id: 1, name: "Photo", visible: true, active: true },
          { id: 2, name: "Layer B", visible: true, active: false },
        ]),
      get_layer_text_annotations: async (i: number) =>
        i === 1 ? JSON.stringify([text({ id: 42 })]) : "[]",
      get_layer_shape_annotations: async () => "[]",
    };
    expect((await findForeignAnnotation(tool, 10, 10))?.id).toBe(42);
  });
});
