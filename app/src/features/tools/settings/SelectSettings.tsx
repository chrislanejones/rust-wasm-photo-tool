// The Select TOOL's panel. Was the Select sub-mode of "Adjust & Select"
// (tool-arc 2.6) until the split: two tools were wearing one id, and the
// "Click-to-select" arming toggle was the visible seam. Now picking the tool
// IS the arming, and picking a MODE decides the gesture.
//
// Six modes, ONE exclusive set (v7.47, ADR-022 superseding ADR-021). It used
// to be two axes — a 4-way kind for clicks and a 2-way shape for drags, both
// live at once — which is strictly more capable and read as two unrelated
// groups nobody could tell apart. Exclusivity costs a mode switch before a
// marquee and buys a panel you can understand at a glance.
//
// Everything that decides WHAT is selected lives here. The magic wand moved in
// from Layer Settings — it was always a selection tool, it just happened to be
// parked next to Move/Resize-Layer. All six modes end in the same place: an
// engine call returning a canvas-sized overlay, stored as the one selection
// mask. Downstream (Delete, Deselect, New Layer, the overlay blit) never
// learns which mode produced it.
//
//   Wand           — 4-connected flood fill within tolerance. Leaks through
//                    soft gradients, which is exactly what the next one fixes.
//   Edge-aware     — the same fill, walled in by the Sobel edge map
//                    (src/edges.rs). The shared core: the magnetic lasso and
//                    Smart Brush walk these same edges, so "what is an edge"
//                    stays one definition.
//   Magnetic Lasso — src/livewire.rs: click anchors, the wire path-finds along
//                    the edges between them, double-click closes. Shipped by
//                    default since the selection-tool overhaul — the
//                    `ih_smart_edge` switch now gates ONLY the Paint Smart
//                    Brush (see lib/smartEdge.ts).
//   Color Range    — every pixel within tolerance of the clicked colour,
//                    anywhere in the image (Photoshop's Select → Color Range).
//                    One click takes all the sky, not just the connected patch.
//   Rectangle      — drag-swept marquee rect. Ignores clicks.
//   Ellipse        — the ellipse inscribed in that drag rect. Ignores clicks.
//
// The mode selector is the shared ToolModeToggle (the Paint panel's template):
// stacked icon tiles on top, the active mode's title + lightbulb info below,
// then that mode's settings — do not fork the layout.
import {
  BoxSelect,
  SquareDashed,
  CircleDashed,
  Trash2,
  Wand2,
  Blend,
  Magnet,
  Eraser,
  CopyPlus,
  Scissors,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeSlider } from "@/components/SizeSlider";
import { isPatchmatchEnabled } from "@/lib/patchmatch";
import type { SelectionKind } from "@/stores/useToolStore";
import { isMarqueeKind } from "@/stores/useToolStore";

/** Controls for the selection tools. Shared with the parent tool panel. */
export interface SelectionControls {
  tolerance: number;
  onToleranceChange: (v: number) => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onDelete: () => void;
  /** Place the selection on a new layer above the active one, leaving the
   *  source pixels in place (Ctrl+J). */
  onNewLayerCopy: () => void;
  /** Same, but clears the selected pixels off the source layer (Ctrl+Shift+J). */
  onNewLayerCut: () => void;
  /** PatchMatch object removal — behind the `ih_patchmatch` verification
   *  switch (see lib/patchmatch.ts); the panel only renders a button for
   *  this at all when that switch is on. */
  onRemoveObject: () => void;
  /** Whether something is currently selected (enables Deselect / Delete). */
  active: boolean;
  /** Which engine call a canvas click makes. */
  kind: SelectionKind;
  onKindChange: (k: SelectionKind) => void;
  /** Edge-wall strength for the edge-aware wand (0..=255). */
  edgeThreshold: number;
  onEdgeThresholdChange: (v: number) => void;
}

/** All six selection modes, in ToolModeToggle shape. Exported because the
 *  command palette offers each one as a jump-to entry — one list, so the panel
 *  and the palette can't end up describing them differently. `info` stays a
 *  plain string (narrowed below) because the palette indexes it as a search
 *  keyword. */
export const SELECT_MODES: readonly (ToolMode<SelectionKind> & {
  info: string;
})[] = [
  {
    id: "wand",
    label: "Wand",
    icon: Wand2,
    info: "Flood-selects the connected region of similar colour around your click.",
  },
  {
    id: "edge",
    label: "Edge-aware",
    icon: Blend,
    info: "The wand, but it stops at object outlines instead of leaking through soft gradients.",
  },
  {
    id: "lasso",
    label: "Magnetic Lasso",
    icon: Magnet,
    info: "Click anchors around an object; the wire snaps to the edge between them. Double-click to close, Esc to cancel.",
  },
  {
    id: "colorRange",
    label: "Color Range",
    icon: BoxSelect,
    info: "Takes every pixel of that colour anywhere in the image — not just the patch you clicked.",
  },
  {
    id: "rect",
    label: "Rectangle",
    icon: SquareDashed,
    info: "Drag a rectangle. This one ignores clicks — press, drag, release.",
  },
  {
    id: "ellipse",
    label: "Ellipse",
    icon: CircleDashed,
    info: "Drag the ellipse inscribed in the box you sweep. Ignores clicks — press, drag, release.",
  },
];

/** SELECT_MODES with the panel-level how-to appended to every lightbulb (the
 *  instructions that used to live in the old "Selection Tool" header). Built
 *  once at module scope; the palette keeps consuming the pure strings above. */
const PANEL_MODES: readonly ToolMode<SelectionKind>[] = SELECT_MODES.map(
  (m) => ({
    ...m,
    info: (
      <>
        {m.info}{" "}
        {isMarqueeKind(m.id)
          ? "Press, drag and release on the canvas."
          : "Click the canvas to select."}{" "}
        <kbd>Alt+A</kbd> selects all, <kbd>Alt+D</kbd> deselects.
      </>
    ),
  }),
);


export function SelectSettings({
  disabled,
  selection,
}: {
  disabled: boolean;
  selection: SelectionControls;
}) {
  const patchmatch = isPatchmatchEnabled();

  return (
    <div className="space-y-4">
      {/* ── The mode: one exclusive 3×2 grid of all six ──────────────────
          Three columns to match the Selection grid below, so the panel reads
          as two grids of the same shape rather than four unrelated clusters.
          Each mode's description lives in its lightbulb (ToolModeToggle's
          SectionHeader), never a permanent paragraph. */}
      <ToolModeToggle
        modes={PANEL_MODES}
        columns={3}
        activeMode={selection.kind}
        onModeChange={selection.onKindChange}
        disabled={disabled}
      >
        {(kind) => (
          <>
            {/* Tolerance drives the flood/colour-match kinds only. The marquee
                kinds sweep pure geometry, so it is hidden for them rather than
                shown disabled — same rule as Edge sensitivity below. */}
            {!isMarqueeKind(kind) && (
              <SizeSlider
                label="Tolerance"
                value={selection.tolerance}
                min={0}
                max={120}
                onChange={selection.onToleranceChange}
              />
            )}
            {/* Only meaningful for the edge-aware wand — hidden otherwise
                rather than shown disabled, so the panel doesn't grow dead
                controls. */}
            {kind === "edge" && (
              <SizeSlider
                label="Edge sensitivity"
                value={selection.edgeThreshold}
                min={10}
                max={255}
                onChange={selection.onEdgeThresholdChange}
              />
            )}
          </>
        )}
      </ToolModeToggle>

      {/* ── Act on the selection: one title + bulb over all five actions ──
          Two 3-column rows out of a single 5-item grid (All/Deselect/Delete,
          then Copy/Cut/—). The old "New Layer" sub-header is gone — its copy
          lives in this bulb now, per the no-permanent-paragraphs rule.
          Outside the ToolModeToggle body: these actions are kind-independent
          and shouldn't re-animate on every kind switch. */}
      <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
        <SectionHeader
          title="Selection"
          info={
            <>
              All selects the whole canvas (<kbd>Alt+A</kbd>); Deselect drops
              the selection (<kbd>Alt+D</kbd>); Delete clears the selected
              pixels. Copy (<kbd>Ctrl+J</kbd>) and Cut (
              <kbd>Ctrl+Shift+J</kbd>) place the selection on a new layer
              above — Cut also removes it from this one.
            </>
          }
        />
        <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]">
          <ToolButton
            stacked
            disabled={disabled}
            onClick={selection.onSelectAll}
            title="Select all (Alt+A)"
          >
            <BoxSelect /> All
          </ToolButton>
          <ToolButton
            stacked
            disabled={disabled || !selection.active}
            onClick={selection.onDeselect}
            title="Deselect (Alt+D)"
          >
            <SquareDashed /> Deselect
          </ToolButton>
          <ToolButton
            stacked
            disabled={disabled || !selection.active}
            onClick={selection.onDelete}
            title="Delete selection"
          >
            <Trash2 /> Delete
          </ToolButton>
          <ToolButton
            stacked
            disabled={disabled || !selection.active}
            onClick={selection.onNewLayerCopy}
            title="Copy selection to a new layer (Ctrl+J)"
          >
            <CopyPlus /> Copy
          </ToolButton>
          <ToolButton
            stacked
            disabled={disabled || !selection.active}
            onClick={selection.onNewLayerCut}
            title="Cut selection to a new layer (Ctrl+Shift+J)"
          >
            <Scissors /> Cut
          </ToolButton>
          {/* third cell of row two intentionally empty */}
        </div>
      </div>

      {/* ── Remove Object (PatchMatch) ──────────────────────────────────────
          SHIPPED ON since v7.46 (`ih_patchmatch` is a "0" kill switch now —
          see lib/patchmatch.ts). Its own section rather than a 4th slot in
          the "Act on the selection" grid: it's a materially different, much
          heavier operation than Delete. Still the single-resolution kernel —
          large holes show soft smearing until the pyramid lands (ADR-018). */}
      {patchmatch && (
        <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
          <SectionHeader
            title="Remove Object"
            info="Erases the selection and rebuilds it from the rest of the image, on your device. Cover the whole object — a partial selection lets it rebuild the object from its own leftovers. Big areas can come out soft."
          />
          <ToolButton
            disabled={disabled || !selection.active}
            onClick={selection.onRemoveObject}
            className="w-full"
            title="Remove Object"
          >
            <Eraser /> Remove Object
          </ToolButton>
        </div>
      )}
    </div>
  );
}
