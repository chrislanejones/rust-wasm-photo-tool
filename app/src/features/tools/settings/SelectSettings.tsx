// The Select sub-mode of "Adjust & Select" (tool-arc session 2.6).
//
// Everything that decides WHAT is selected lives here. The magic wand moved in
// from Layer Settings — it was always a selection tool, it just happened to be
// parked next to Move/Resize-Layer. All four kinds end in the same place: an
// engine call returning a canvas-sized overlay, stored as the one selection
// mask. Downstream (Delete, Deselect, New Layer, the overlay blit) never
// learns which kind produced it.
//
//   Wand        — 4-connected flood fill within tolerance. Leaks through soft
//                 gradients, which is exactly what the next one fixes.
//   Edge-aware  — the same fill, walled in by the Sobel edge map (src/edges.rs).
//                 The shared core: the magnetic lasso and Smart Brush walk these
//                 same edges, so "what is an edge" stays one definition.
//   Color Range — every pixel within tolerance of the clicked colour, anywhere
//                 in the image (Photoshop's Select → Color Range). One click
//                 takes all the sky, not just the connected patch of it.
//   Magnetic    — the lasso (src/livewire.rs): click anchors, the wire
//                 path-finds along the edges between them, double-click closes.
//                 Shipped by default since the selection-tool overhaul — the
//                 `ih_smart_edge` switch now gates ONLY the Paint Smart Brush
//                 (see lib/smartEdge.ts).
//
// The sub-mode selector is the shared ToolModeToggle (the Paint panel's
// template): stacked icon tiles on top, the active kind's title + lightbulb
// info below, then the kind's settings — do not fork the layout.
import {
  MousePointerClick,
  BoxSelect,
  SquareDashed,
  Trash2,
  Wand2,
  Blend,
  Lasso,
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

/** Controls for the selection tools. Shared with the parent tool panel. */
export interface SelectionControls {
  tolerance: number;
  onToleranceChange: (v: number) => void;
  /** Whether click-to-select mode is on (canvas clicks select). */
  mode: boolean;
  onToggleMode: () => void;
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

/** The four selection kinds, in ToolModeToggle shape. Exported because the
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
    id: "colorRange",
    label: "Color Range",
    icon: BoxSelect,
    info: "Takes every pixel of that colour anywhere in the image — not just the patch you clicked.",
  },
  {
    id: "lasso",
    label: "Magnetic",
    icon: Lasso,
    info: "Click anchors around an object; the wire snaps to the edge between them. Double-click to close, Esc to cancel.",
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
        {m.info} Turn on click-to-select, then click the canvas.{" "}
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
      {/* ── How a click selects: the 2×2 kind toggle ─────────────────────
          Each kind's description lives in its lightbulb (ToolModeToggle's
          SectionHeader), never a permanent paragraph. */}
      <ToolModeToggle
        modes={PANEL_MODES}
        columns={2}
        activeMode={selection.kind}
        onModeChange={selection.onKindChange}
        disabled={disabled}
      >
        {(kind) => (
          <>
            <ToolButton
              active={selection.mode}
              disabled={disabled}
              onClick={selection.onToggleMode}
              className="w-full"
            >
              <MousePointerClick />{" "}
              {selection.mode ? "Click-to-select: on" : "Click-to-select"}
            </ToolButton>

            <SizeSlider
              label="Tolerance"
              value={selection.tolerance}
              min={0}
              max={120}
              onChange={selection.onToleranceChange}
            />
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

      {/* ── Act on the selection ────────────────────────────────────────
          Stacked tiles, same shape as the kind toggle above (Paint's tile
          look). Outside the ToolModeToggle body: these actions are
          kind-independent and shouldn't re-animate on every kind switch. */}
      <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr] border-t border-theme-sidebar-border pt-3">
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
          <SquareDashed /> None
        </ToolButton>
        <ToolButton
          stacked
          disabled={disabled || !selection.active}
          onClick={selection.onDelete}
          title="Delete selection"
        >
          <Trash2 /> Delete
        </ToolButton>
      </div>

      {/* ── New Layer (Layer Via Copy / Layer Via Cut) ──────────────────── */}
      <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
        <SectionHeader
          title="New Layer"
          info={
            <>
              Places the current selection onto a new layer above. Copy leaves
              the original (<kbd>Ctrl+J</kbd>); Cut removes it from this layer
              (<kbd>Ctrl+Shift+J</kbd>).
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
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
        </div>
      </div>

      {/* ── Remove Object (PatchMatch) ──────────────────────────────────────
          Behind `ih_patchmatch` — a verification switch, not a shipped
          preference (see lib/patchmatch.ts). Its own section rather than a
          4th slot in the "Act on the selection" grid: it's a materially
          different, much heavier operation than Delete, and it's
          flagged-off-by-default WIP — giving it equal visual weight to the
          settled actions above would overstate how done it is. Day 1 (scalar,
          single-resolution): fill quality is coarse on a real photo until the
          pyramid lands. */}
      {patchmatch && (
        <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
          <SectionHeader
            title="Remove Object"
            info="Erases the selection and reconstructs it from the rest of the image (PatchMatch). Verification switch — day 1, single-resolution, so fill quality is still coarse on a full photo."
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
