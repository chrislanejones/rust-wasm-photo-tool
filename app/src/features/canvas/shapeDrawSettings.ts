// The live panel style a PENDING shape is previewed with — the `drawSettings`
// CanvasArea hands the Shapes edit overlay.
//
// It used to be nine fields copied out of the tool settings, twice, in
// AppShell. It is a function of the pending shape now, because since shapes
// became fill first (11-19-2026) the panel holds two stroke-and-fill sets and
// which one a new shape reads depends on its kind: a square reads Fill Color
// and its own optional stroke, the arrow drawn next reads Stroke Color and
// Stroke Width. `panelShapeStyle` picks; this only finds the kind.
import {
  panelShapeStyle,
  pendingShapeType,
  SHAPE_NAME_KIND,
  type DrawEditState,
} from "@/lib/drawEditState";
import type { ToolSettings } from "@/lib/types";
import type { ShapeDrawSettings } from "./ShapeEditOverlay";

export function shapeDrawSettings(
  s: ToolSettings,
  es: DrawEditState | null | undefined,
): ShapeDrawSettings {
  // Same rule `commitEdit` uses for a new shape's kind, so the preview and
  // the commit read the same set.
  const kind = es?.kind === "arrow" ? 4 : SHAPE_NAME_KIND[pendingShapeType(es, s.shape)];
  return {
    ...panelShapeStyle(s, kind),
    arrowStyle: s.arrowStyle,
    shape: s.shape ?? "rect",
    sloppiness: s.sloppiness ?? 0,
    fillColor2: s.fillColor2,
    gradientAngle: s.gradientAngle,
  };
}
