// The diagram shapes — the flowchart, basic and block-arrow shapes people
// reach for first in Lucidchart and draw.io — as engine kinds 11..=40.
//
// A hand mirror of `src/diagram.rs`: the same program table and the same
// flattening, so the rubber band, the edit overlay and the panel tiles draw the
// points the engine strokes. `diagramShapes.parity.test.ts` reads the Rust file
// and fails when the two tables differ — change the Rust first, then this.
import type { DiagramShapeName } from "@/lib/types";
import {
  shapeWobbleSeed,
  sloppyLoopPoints,
  sloppyPolylinePoints,
  type Point,
} from "@/lib/shapeSloppiness";

/** Panel order, grouped the way both tools group them. `id` is the
 *  `ToolSettings.shape` name, `kind` the engine byte. */
export const DIAGRAM_SHAPES: readonly {
  id: DiagramShapeName;
  kind: number;
  label: string;
  group: "Flowchart" | "Basic" | "Block arrows";
}[] = [
  { id: "terminator", kind: 11, label: "Terminator", group: "Flowchart" },
  { id: "data", kind: 12, label: "Data", group: "Flowchart" },
  { id: "document", kind: 13, label: "Document", group: "Flowchart" },
  { id: "multiDocument", kind: 14, label: "Documents", group: "Flowchart" },
  { id: "predefinedProcess", kind: 15, label: "Subprocess", group: "Flowchart" },
  { id: "manualInput", kind: 16, label: "Manual Input", group: "Flowchart" },
  { id: "manualOperation", kind: 17, label: "Manual Op", group: "Flowchart" },
  { id: "preparation", kind: 18, label: "Preparation", group: "Flowchart" },
  { id: "database", kind: 19, label: "Database", group: "Flowchart" },
  { id: "internalStorage", kind: 20, label: "Storage", group: "Flowchart" },
  { id: "offPageConnector", kind: 21, label: "Off-page", group: "Flowchart" },
  { id: "delay", kind: 22, label: "Delay", group: "Flowchart" },
  { id: "display", kind: 23, label: "Display", group: "Flowchart" },
  { id: "storedData", kind: 24, label: "Stored Data", group: "Flowchart" },
  { id: "merge", kind: 25, label: "Merge", group: "Flowchart" },
  { id: "card", kind: 26, label: "Card", group: "Flowchart" },
  { id: "punchedTape", kind: 27, label: "Tape", group: "Flowchart" },
  { id: "summingJunction", kind: 28, label: "Junction", group: "Flowchart" },
  { id: "pentagon", kind: 29, label: "Pentagon", group: "Basic" },
  { id: "octagon", kind: 30, label: "Octagon", group: "Basic" },
  { id: "cloud", kind: 31, label: "Cloud", group: "Basic" },
  { id: "callout", kind: 32, label: "Callout", group: "Basic" },
  { id: "cross", kind: 33, label: "Cross", group: "Basic" },
  { id: "cube", kind: 34, label: "Cube", group: "Basic" },
  { id: "note", kind: 35, label: "Note", group: "Basic" },
  { id: "blockArrow", kind: 36, label: "Block Arrow", group: "Block arrows" },
  { id: "doubleBlockArrow", kind: 37, label: "Double", group: "Block arrows" },
  { id: "quadArrow", kind: 38, label: "Four-way", group: "Block arrows" },
  { id: "chevron", kind: 39, label: "Chevron", group: "Block arrows" },
  { id: "stepArrow", kind: 40, label: "Step", group: "Block arrows" },
];

/** Shape name → engine kind, for the diagram shapes only. */
export const DIAGRAM_NAME_KIND: Readonly<Record<string, number>> = Object.fromEntries(
  DIAGRAM_SHAPES.map((d) => [d.id, d.kind]),
);

/** Whether a kind byte is a diagram shape. Mirrors `is_diagram_kind`. */
export function isDiagramKind(kind: number): boolean {
  return kind >= 11 && kind <= 40;
}

/** The programs — opcodes and operands exactly as `diagram::program` holds
 *  them (see the opcode table there). */
export const DIAGRAM_PROGRAMS: Readonly<Record<number, readonly number[]>> = {
  // ── Flowchart ──
  // 11 Terminator (start / end): a stadium.
  11: [0.0, 0.15, 0.0, 1.0, 0.85, 0.0, 3.0, 0.85, 0.5, 0.15, 0.5, -90.0, 90.0, 1.0, 0.15, 1.0, 3.0, 0.15, 0.5, 0.15, 0.5, 90.0, 270.0],
  // 12 Data (input / output): a parallelogram.
  12: [0.0, 0.2, 0.0, 1.0, 1.0, 0.0, 1.0, 0.8, 1.0, 1.0, 0.0, 1.0],
  // 13 Document: a page with a wavy foot.
  13: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.85, 2.0, 0.75, 0.65, 0.5, 0.85, 2.0, 0.25, 1.05, 0.0, 0.85],
  // 14 Multiple documents: three stacked pages.
  14: [0.0, 0.16, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.72, 1.0, 0.92, 0.72, 1.0, 0.92, 0.8, 1.0, 0.84, 0.8, 1.0, 0.84, 0.87, 2.0, 0.63, 0.75, 0.42, 0.87, 2.0, 0.21, 0.99, 0.0, 0.87, 1.0, 0.0, 0.16, 1.0, 0.08, 0.16, 1.0, 0.08, 0.08, 1.0, 0.16, 0.08,
       4.0, 0.08, 0.16, 1.0, 0.84, 0.16, 1.0, 0.84, 0.8,
       4.0, 0.16, 0.08, 1.0, 0.92, 0.08, 1.0, 0.92, 0.72],
  // 15 Predefined process (subroutine): a box with inner side bars.
  15: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
       4.0, 0.1, 0.0, 1.0, 0.1, 1.0,
       4.0, 0.9, 0.0, 1.0, 0.9, 1.0],
  // 16 Manual input: a box with a sloped top.
  16: [0.0, 0.0, 0.25, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0],
  // 17 Manual operation: a trapezoid, wide edge up.
  17: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.8, 1.0, 1.0, 0.2, 1.0],
  // 18 Preparation: a long hexagon.
  18: [0.0, 0.2, 0.0, 1.0, 0.8, 0.0, 1.0, 1.0, 0.5, 1.0, 0.8, 1.0, 1.0, 0.2, 1.0, 1.0, 0.0, 0.5],
  // 19 Database: a cylinder, with the front of its lid drawn.
  19: [0.0, 0.0, 0.15, 3.0, 0.5, 0.15, 0.5, 0.15, 180.0, 360.0, 1.0, 1.0, 0.85, 3.0, 0.5, 0.85, 0.5, 0.15, 0.0, 180.0,
       4.0, 0.0, 0.15, 3.0, 0.5, 0.15, 0.5, 0.15, 180.0, 0.0],
  // 20 Internal storage: a box ruled across the top and down the left.
  20: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
       4.0, 0.15, 0.0, 1.0, 0.15, 1.0,
       4.0, 0.0, 0.15, 1.0, 1.0, 0.15],
  // 21 Off-page connector: a box pointing down.
  21: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.6, 1.0, 0.5, 1.0, 1.0, 0.0, 0.6],
  // 22 Delay: a D.
  22: [0.0, 0.0, 0.0, 1.0, 0.5, 0.0, 3.0, 0.5, 0.5, 0.5, 0.5, -90.0, 90.0, 1.0, 0.0, 1.0],
  // 23 Display: a pointed left end and a round right one.
  23: [0.0, 0.0, 0.5, 1.0, 0.2, 0.0, 1.0, 0.8, 0.0, 3.0, 0.8, 0.5, 0.2, 0.5, -90.0, 90.0, 1.0, 0.2, 1.0],
  // 24 Stored data: round on the left, hollowed on the right.
  24: [0.0, 0.15, 0.0, 1.0, 1.0, 0.0, 3.0, 1.0, 0.5, 0.15, 0.5, 270.0, 90.0, 1.0, 0.15, 1.0, 3.0, 0.15, 0.5, 0.15, 0.5, 90.0, 270.0],
  // 25 Merge: a triangle, point down.
  25: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.5, 1.0],
  // 26 Card: a box with its top-left corner clipped.
  26: [0.0, 0.2, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.2],
  // 27 Punched tape: wavy top and bottom.
  27: [0.0, 0.0, 0.1, 2.0, 0.25, 0.3, 0.5, 0.1, 2.0, 0.75, -0.1, 1.0, 0.1, 1.0, 1.0, 0.9, 2.0, 0.75, 0.7, 0.5, 0.9, 2.0, 0.25, 1.1, 0.0, 0.9],
  // 28 Summing junction: a circle with an X.
  28: [0.0, 1.0, 0.5, 3.0, 0.5, 0.5, 0.5, 0.5, 0.0, 360.0,
       4.0, 0.146, 0.146, 1.0, 0.854, 0.854,
       4.0, 0.854, 0.146, 1.0, 0.146, 0.854],
  // ── Basic ──
  // 29 Pentagon.
  29: [0.0, 0.5, 0.0, 1.0, 1.0, 0.38, 1.0, 0.81, 1.0, 1.0, 0.19, 1.0, 1.0, 0.0, 0.38],
  // 30 Octagon.
  30: [0.0, 0.29, 0.0, 1.0, 0.71, 0.0, 1.0, 1.0, 0.29, 1.0, 1.0, 0.71, 1.0, 0.71, 1.0, 1.0, 0.29, 1.0, 1.0, 0.0, 0.71, 1.0, 0.0, 0.29],
  // 31 Cloud: nine scallops.
  31: [0.0, 0.496, 0.057, 2.0, 0.749, -0.103, 0.789, 0.223, 2.0, 1.04, 0.175, 0.929, 0.364, 2.0, 1.11, 0.596, 0.83, 0.725, 2.0, 0.892, 0.99, 0.67, 0.885, 2.0, 0.479, 1.138, 0.32, 0.836, 2.0, 0.087, 0.979, 0.13, 0.747, 2.0, -0.117, 0.608, 0.104, 0.391, 2.0, -0.052, 0.18, 0.181, 0.194, 2.0, 0.247, -0.106, 0.496, 0.057],
  // 32 Callout: a speech box with a tail.
  32: [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.75, 1.0, 0.45, 0.75, 1.0, 0.25, 1.0, 1.0, 0.28, 0.75, 1.0, 0.0, 0.75],
  // 33 Cross: a plus sign.
  33: [0.0, 0.33, 0.0, 1.0, 0.67, 0.0, 1.0, 0.67, 0.33, 1.0, 1.0, 0.33, 1.0, 1.0, 0.67, 1.0, 0.67, 0.67, 1.0, 0.67, 1.0, 1.0, 0.33, 1.0, 1.0, 0.33, 0.67, 1.0, 0.0, 0.67, 1.0, 0.0, 0.33, 1.0, 0.33, 0.33],
  // 34 Cube.
  34: [0.0, 0.0, 0.25, 1.0, 0.25, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.75, 1.0, 0.75, 1.0, 1.0, 0.0, 1.0,
       4.0, 0.0, 0.25, 1.0, 0.75, 0.25, 1.0, 1.0, 0.0,
       4.0, 0.75, 0.25, 1.0, 0.75, 1.0],
  // 35 Note: a page with a folded corner.
  35: [0.0, 0.0, 0.0, 1.0, 0.8, 0.0, 1.0, 1.0, 0.2, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
       4.0, 0.8, 0.0, 1.0, 0.8, 0.2, 1.0, 1.0, 0.2],
  // ── Block arrows ──
  // 36 Block arrow.
  36: [0.0, 0.0, 0.25, 1.0, 0.6, 0.25, 1.0, 0.6, 0.0, 1.0, 1.0, 0.5, 1.0, 0.6, 1.0, 1.0, 0.6, 0.75, 1.0, 0.0, 0.75],
  // 37 Double block arrow.
  37: [0.0, 0.0, 0.5, 1.0, 0.3, 0.0, 1.0, 0.3, 0.25, 1.0, 0.7, 0.25, 1.0, 0.7, 0.0, 1.0, 1.0, 0.5, 1.0, 0.7, 1.0, 1.0, 0.7, 0.75, 1.0, 0.3, 0.75, 1.0, 0.3, 1.0],
  // 38 Four-way arrow.
  38: [0.0, 0.5, 0.0, 1.0, 0.7, 0.2, 1.0, 0.6, 0.2, 1.0, 0.6, 0.4, 1.0, 0.8, 0.4, 1.0, 0.8, 0.3, 1.0, 1.0, 0.5, 1.0, 0.8, 0.7, 1.0, 0.8, 0.6, 1.0, 0.6, 0.6, 1.0, 0.6, 0.8, 1.0, 0.7, 0.8, 1.0, 0.5, 1.0, 1.0, 0.3, 0.8, 1.0, 0.4, 0.8, 1.0, 0.4, 0.6, 1.0, 0.2, 0.6, 1.0, 0.2, 0.7, 1.0, 0.0, 0.5, 1.0, 0.2, 0.3, 1.0, 0.2, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 0.2, 1.0, 0.3, 0.2],
  // 39 Chevron.
  39: [0.0, 0.0, 0.0, 1.0, 0.75, 0.0, 1.0, 1.0, 0.5, 1.0, 0.75, 1.0, 1.0, 0.0, 1.0, 1.0, 0.25, 0.5],
  // 40 Step (a process arrow).
  40: [0.0, 0.0, 0.0, 1.0, 0.75, 0.0, 1.0, 1.0, 0.5, 1.0, 0.75, 1.0, 1.0, 0.0, 1.0],
};

/** A diagram shape flattened onto its bbox. Mirrors `diagram::Geometry`. */
export interface DiagramGeometry {
  /** The closed outline, no repeated closing point. */
  outline: Point[];
  /** Open detail strokes drawn over the outline. */
  details: Point[][];
  /** The outline has curves — a sketchy stroke wobbles round the loop. */
  smooth: boolean;
}

/** Flatten a diagram kind over the bbox `from`-`to`; `null` for any other
 *  kind. Mirrors `diagram::geometry`, operation for operation. */
export function diagramGeometry(kind: number, from: Point, to: Point): DiagramGeometry | null {
  const prog = DIAGRAM_PROGRAMS[kind];
  if (!prog) return null;
  const minx = Math.min(from.x, to.x);
  const miny = Math.min(from.y, to.y);
  const w = Math.max(from.x, to.x) - minx;
  const h = Math.max(from.y, to.y) - miny;
  const map = (u: number, v: number): Point => ({ x: minx + u * w, y: miny + v * h });
  const outline: Point[] = [];
  const details: Point[][] = [];
  let smooth = false;
  let px = 0;
  let py = 0;
  let inDetail = false;
  let i = 0;
  while (i < prog.length) {
    const op = prog[i];
    const pts: Array<[number, number]> = [];
    if (op === 0 || op === 4) {
      px = prog[i + 1];
      py = prog[i + 2];
      inDetail = op === 4;
      if (inDetail) details.push([]);
      pts.push([px, py]);
      i += 3;
    } else if (op === 1) {
      px = prog[i + 1];
      py = prog[i + 2];
      pts.push([px, py]);
      i += 3;
    } else if (op === 2) {
      const [cx, cy, ex, ey] = [prog[i + 1], prog[i + 2], prog[i + 3], prog[i + 4]];
      for (let k = 1; k <= 16; k++) {
        const t = k / 16;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        pts.push([a * px + b * cx + c * ex, a * py + b * cy + c * ey]);
      }
      px = ex;
      py = ey;
      if (!inDetail) smooth = true;
      i += 5;
    } else if (op === 3) {
      const [cx, cy, rx, ry, a0, a1] = prog.slice(i + 1, i + 7);
      const segs = Math.max(Math.ceil(Math.abs(a1 - a0) / 6), 2);
      for (let k = 1; k <= segs; k++) {
        const a = ((a0 + (a1 - a0) * (k / segs)) * Math.PI) / 180;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      [px, py] = pts[pts.length - 1];
      if (!inDetail) smooth = true;
      i += 7;
    } else {
      break;
    }
    const target = inDetail ? details[details.length - 1] : outline;
    for (const [u, v] of pts) target.push(map(u, v));
  }
  if (outline.length > 1) {
    const f = outline[0];
    const l = outline[outline.length - 1];
    if (Math.abs(f.x - l.x) < 1e-9 && Math.abs(f.y - l.y) < 1e-9) outline.pop();
  }
  return { outline, details, smooth };
}

/** One polyline to stroke. */
export interface DiagramStroke {
  pts: Point[];
  closed: boolean;
}

/** Everything the engine strokes for a diagram shape, in order: the outline,
 *  then each detail. Firm (sloppiness 0) → the clean points; sketchy → the
 *  same generators `draw_shape`'s diagram arm picks (a smooth outline wobbles
 *  round the loop, a straight one overshoots its corners, each detail on its
 *  own seed). `strokeWidth` is in IMAGE pixels, like every wobble. */
export function diagramStrokes(
  geom: DiagramGeometry,
  from: Point,
  to: Point,
  sloppiness: number,
  strokeWidth: number,
): DiagramStroke[] {
  if (!(sloppiness > 0)) {
    return [
      { pts: geom.outline, closed: true },
      ...geom.details.map((pts) => ({ pts, closed: false })),
    ];
  }
  const seed = shapeWobbleSeed(from.x, from.y, to.x, to.y);
  const outline = geom.smooth
    ? sloppyLoopPoints(geom.outline, seed, sloppiness, strokeWidth)
    : sloppyPolylinePoints(geom.outline, seed, sloppiness, strokeWidth, true);
  return [
    { pts: outline, closed: false },
    ...geom.details.map((d, i) => ({
      pts: sloppyPolylinePoints(d, seed + (i + 1) * 7, sloppiness, strokeWidth, false),
      closed: false,
    })),
  ];
}

/** An SVG path `d` for a set of strokes, through a point mapper. */
export function strokesToPath(strokes: DiagramStroke[], map: (p: Point) => Point): string {
  return strokes
    .filter((s) => s.pts.length > 1)
    .map(
      (s) =>
        s.pts
          .map((p, i) => {
            const q = map(p);
            return `${i === 0 ? "M" : "L"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
          })
          .join(" ") + (s.closed ? " Z" : ""),
    )
    .join(" ");
}
