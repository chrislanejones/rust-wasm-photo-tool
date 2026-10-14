// What picking an object from Review → Reselect DOES, moved out of AppShell
// (which is under a line cap and only shrinks).
//
// The pick always makes the object the Align/Placement target. What else it
// does depends on the tool that is open:
//
//   • Perspective (and its Skew / Distort modes): the pick POINTS THE TOOL AT
//     THE OBJECT — the same thing clicking the object's box on the canvas does
//     (PerspectiveOverlay). It used to fall through to the editor branches
//     below, which opened the Shapes editor (or switched to Text) and left
//     Perspective with no target, so Apply warped the PIXELS under the object
//     instead of the object (#366).
//   • Otherwise: open the object in its own editor — Text, the Pen overlay for
//     a Bézier path, or the Shapes bbox editor.
//
// Reads the tool and the setters from the stores at call time rather than
// taking them as arguments: the callback runs on a click, so a snapshot is
// exactly right, and AppShell does not have to thread four more values in.
import { useCallback } from "react";
import type { useDrawingTools } from "@/hooks/useDrawingTools";
import type { useTextTool } from "@/hooks/useTextTool";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { usePerspectiveStore } from "@/stores/usePerspectiveStore";
import { useToolStore } from "@/stores/useToolStore";

export function useReselectPick(
  textTool: ReturnType<typeof useTextTool>,
  drawingTools: ReturnType<typeof useDrawingTools>,
): (o: ReselectObject) => void {
  return useCallback(
    (o: ReselectObject) => {
      const annotations = useAnnotationStore.getState();
      const tools = useToolStore.getState();
      annotations.setSelectedObject(o);
      if (tools.activeTool === "perspective") {
        // Text and shapes are two id spaces in the engine; the (kind, id) pair
        // is what keeps "square 3" and "text 3" apart (perspectiveTarget.ts).
        usePerspectiveStore.getState().setTarget({ kind: o.type, id: o.id });
        return;
      }
      if (o.type === "text") {
        tools.setActiveTool("text");
        void textTool.selectAnnotation(o.id);
        return;
      }
      // A Bézier pen path (kind 7) re-opens in the PenOverlay — switch to
      // Paint → Pen so the overlay is mounted, then hand it the control points
      // so the curve and its anchors come back editable. Routing it through
      // drawingTools.selectShape (the rect-bbox editor) only hid the path.
      const shape = drawingTools.shapes.find((s) => s.id === o.id);
      if (shape?.kind === 7) {
        tools.setActiveTool("brush");
        tools.setBrushMode("pen");
        annotations.requestPenEdit({ id: o.id, points: shape.points.flat() });
        return;
      }
      void drawingTools.selectShape(o.id);
    },
    [textTool, drawingTools],
  );
}
