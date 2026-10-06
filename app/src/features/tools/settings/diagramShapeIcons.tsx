// Panel tiles for the diagram shapes, drawn from the SAME geometry the engine
// strokes (lib/diagramShapes.ts) — a tile cannot show a shape the canvas will
// not draw. Sized and stroked like a lucide icon so they sit in a ToolButton
// beside the Single / Double arrow glyphs.
import type React from "react";
import { DIAGRAM_SHAPES, diagramGeometry, diagramStrokes, strokesToPath } from "@/lib/diagramShapes";
import type { DiagramShapeName } from "@/lib/types";

/** Shapes that read best in a square box; the rest sit in a 5:4 one, the
 *  proportion a flowchart box is usually drawn at. */
const SQUARE: ReadonlySet<DiagramShapeName> = new Set([
  "summingJunction", "pentagon", "octagon", "cross", "cube", "note", "quadArrow", "merge",
]);

function iconFor(id: DiagramShapeName, kind: number): React.ComponentType<{ className?: string }> {
  const [from, to] = SQUARE.has(id)
    ? [{ x: 4, y: 4 }, { x: 20, y: 20 }]
    : [{ x: 2, y: 4.5 }, { x: 22, y: 19.5 }];
  const g = diagramGeometry(kind, from, to)!;
  const d = strokesToPath(diagramStrokes(g, from, to, 0, 0), (p) => p);
  function DiagramShapeIcon({ className }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    );
  }
  return DiagramShapeIcon;
}

/** The diagram shapes as ToolButtonGroup options, one list per panel group. */
export const DIAGRAM_SHAPE_GROUPS = (["Flowchart", "Basic", "Block arrows"] as const).map(
  (group) => ({
    group,
    options: DIAGRAM_SHAPES.filter((d) => d.group === group).map((d) => ({
      id: d.id,
      label: d.label,
      icon: iconFor(d.id, d.kind),
    })),
  }),
);
