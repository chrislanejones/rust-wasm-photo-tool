// The Select sub-mode of "Adjust & Select" (tool-arc session 2.6).
//
// Everything that decides WHAT is selected lives here. The magic wand moved in
// from Layer Settings — it was always a selection tool, it just happened to be
// parked next to Move/Resize-Layer. Two new kinds join it, and all three end in
// the same place: an engine call returning a canvas-sized overlay, stored as
// the one selection mask. Downstream (Delete, Deselect, the overlay blit) never
// learns which kind produced it.
//
//   Wand        — 4-connected flood fill within tolerance. Leaks through soft
//                 gradients, which is exactly what the next one fixes.
//   Edge-aware  — the same fill, walled in by the Sobel edge map (src/edges.rs).
//                 The shared core: the magnetic lasso and Smart Brush walk these
//                 same edges when they land, so "what is an edge" stays one
//                 definition in one place.
//   Color Range — every pixel within tolerance of the clicked colour, anywhere
//                 in the image (Photoshop's Select → Color Range). One click
//                 takes all the sky, not just the connected patch of it.
//
// The magnetic lasso's kernel now EXISTS (src/livewire.rs — live-wire /
// shortest-path over the same edge map, turned into a cost map where a strong
// edge is cheap to travel). It is wired up here behind the `ih_smart_edge`
// switch: with the switch off you still get the honest "Coming soon" stub v7.23
// shipped, because what nobody has verified yet is the FEEL, and that is a
// canvas judgement a human has to make. See lib/smartEdge.ts.
import {
  MousePointerClick,
  BoxSelect,
  SquareDashed,
  Trash2,
  Wand2,
  Blend,
  Lasso,
  Eraser,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeSlider } from "@/components/SizeSlider";
import { isSmartEdgeEnabled } from "@/lib/smartEdge";
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

/** The three selection kinds. Exported because the command palette offers each
 *  one as a jump-to entry — one list, so the panel and the palette can't end up
 *  describing them differently. */
export const SELECT_KINDS: {
  id: SelectionKind;
  label: string;
  icon: typeof Wand2;
  info: string;
}[] = [
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
];

/** The lasso only joins the grid when `ih_smart_edge` is on. Kept out of
 *  SELECT_KINDS rather than filtered into it, so with the switch off the array —
 *  and the panel it renders — is exactly what shipped. */
const LASSO_KIND = {
  id: "lasso" as SelectionKind,
  label: "Magnetic",
  icon: Lasso,
  info: "Click anchors around an object; the wire snaps to the edge between them. Double-click to close, Esc to cancel.",
};

export function SelectSettings({
  disabled,
  selection,
}: {
  disabled: boolean;
  selection: SelectionControls;
}) {
  const smartEdge = isSmartEdgeEnabled();
  const patchmatch = isPatchmatchEnabled();
  const kinds = smartEdge ? [...SELECT_KINDS, LASSO_KIND] : SELECT_KINDS;
  const activeKind = kinds.find((k) => k.id === selection.kind) ?? SELECT_KINDS[0];

  return (
    <div className="space-y-4">
      {/* ── How a click selects ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionHeader
          title="Selection Tool"
          info={
            <>
              Turn on click-to-select, then click the canvas. <kbd>Alt+A</kbd>{" "}
              selects all, <kbd>Alt+D</kbd> deselects.
            </>
          }
        />
        {/* 2-column icon-on-top grid — same tile shape as Paint's sub-mode row
            (ToolModeToggle/ToolButtonGroup `stacked`). With the lasso behind
            `ih_smart_edge` this is a clean 2x2; with it off, 3 items lay out
            2-over-1, which reads fine at this width (checked at 3 sizes). */}
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
          {kinds.map(({ id, label, icon: Icon }) => (
            <ToolButton
              key={id}
              stacked
              active={selection.kind === id}
              disabled={disabled}
              onClick={() => selection.onKindChange(id)}
              title={label}
            >
              <Icon />
              {label}
            </ToolButton>
          ))}
        </div>
        {/* Active kind's name + description — same title+lightbulb pattern as
            "Selection Tool" above, instead of a permanent paragraph that grew
            every time a kind's info text did. */}
        <SectionHeader title={activeKind.label} info={activeKind.info} />

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
        {/* Only meaningful for the edge-aware wand — hidden otherwise rather
            than shown disabled, so the panel doesn't grow dead controls. */}
        {selection.kind === "edge" && (
          <SizeSlider
            label="Edge sensitivity"
            value={selection.edgeThreshold}
            min={10}
            max={255}
            onChange={selection.onEdgeThresholdChange}
          />
        )}
      </div>

      {/* ── Act on the selection ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr] border-t border-theme-sidebar-border pt-3">
        <ToolButton
          disabled={disabled}
          onClick={selection.onSelectAll}
          title="Select all (Alt+A)"
        >
          <BoxSelect /> All
        </ToolButton>
        <ToolButton
          disabled={disabled || !selection.active}
          onClick={selection.onDeselect}
          title="Deselect (Alt+D)"
        >
          <SquareDashed /> None
        </ToolButton>
        <ToolButton
          disabled={disabled || !selection.active}
          onClick={selection.onDelete}
          title="Delete selection"
        >
          <Trash2 /> Delete
        </ToolButton>
      </div>

      {/* ── Remove Object (PatchMatch) ──────────────────────────────────────
          Behind `ih_patchmatch` — a verification switch, not a shipped
          preference (see lib/patchmatch.ts), same status as the smart-edge
          tools above. Its own section rather than a 4th slot in the "Act on
          the selection" grid: it's a materially different, much heavier
          operation than Delete, and it's flagged-off-by-default WIP — giving
          it equal visual weight to the three settled actions above would
          overstate how done it is. Day 1 (scalar, single-resolution): fill
          quality is coarse on a real photo until the pyramid lands. */}
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

      {/* ── Not built yet, and saying so ─────────────────────────────────
          Only while the switch is off. Once the lasso is live it's a real kind
          in the grid above, and leaving a disabled duplicate of it down here
          would be the panel lying about itself. */}
      {!smartEdge && (
        <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
          <SectionHeader
            title="Coming soon"
            info="Wired up but not yet built — the button is here so the shape of the tool is honest."
          />
          <ToolButton disabled className="w-full" title="Not built yet">
            <Lasso /> Magnetic Lasso
          </ToolButton>
          <p className="px-0.5 text-2xs leading-relaxed text-theme-muted-foreground">
            Draw roughly and snap to the nearest edge. The edge detection it
            needs already ships (it's what powers Edge-aware above) — the
            path-finding kernel is the remaining piece.
          </p>
        </div>
      )}
    </div>
  );
}
