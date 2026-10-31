// Create › Select objects — its own panel (Night 10-28).
//
// The sub-tool shares the `shapes` tool and carries no mode, so it used to
// render ShapesSettings in whatever mode came before it. After Arrows &
// Diagram Shapes that was the whole arrow and diagram picker under a second
// tile, which read as two tiles for one tool. Picking happens on the canvas
// and the actions live on the canvas's "N selected" bar
// (AnnotationSelectionLayer), so the panel only names the tool, says how to
// pick, and shows the count.
import { SectionHeader } from "@/components/ui/section-header";
import { ToolPanel } from "@/components/ui/tool-panel";
import { pickedCount } from "@/lib/annotationSelection";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

export function SelectObjectsSettings() {
  const count = useAnnotationStore((s) => pickedCount(s.picked));
  return (
    <ToolPanel>
      <SectionHeader
        title="Select objects"
        value={count > 0 ? `${count} selected` : undefined}
        info="Click a shape, arrow, pin or text to pick it. Shift-click adds or removes one, and a box dragged on empty canvas picks everything fully inside it. Ctrl+A picks them all. Then drag to move them together, or use the bar on the canvas to align, distribute or delete."
      />
    </ToolPanel>
  );
}
