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
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeSlider } from "@/components/SizeSlider";
import { isSmartEdgeEnabled } from "@/lib/smartEdge";
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
  /** Whether something is currently selected (enables Deselect / Delete). */
  active: boolean;
  /** Which engine call a canvas click makes. */
  kind: SelectionKind;
  onKindChange: (k: SelectionKind) => void;
  /** Edge-wall strength for the edge-aware wand (0..=255). */
  edgeThreshold: number;
  onEdgeThresholdChange: (v: number) => void;
}

const KINDS: {
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

/** The lasso only joins the grid when `ih_smart_edge` is on. Kept out of KINDS
 *  rather than filtered into it, so with the switch off the array — and the
 *  panel it renders — is exactly what shipped. */
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
  const kinds = smartEdge ? [...KINDS, LASSO_KIND] : KINDS;
  const activeKind = kinds.find((k) => k.id === selection.kind) ?? KINDS[0];

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
        <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]">
          {kinds.map(({ id, label, icon: Icon }) => (
            <ToolButton
              key={id}
              active={selection.kind === id}
              disabled={disabled}
              onClick={() => selection.onKindChange(id)}
              title={label}
            >
              <Icon /> {label}
            </ToolButton>
          ))}
        </div>
        <p className="px-0.5 text-2xs leading-relaxed text-theme-muted-foreground">
          {activeKind.info}
        </p>

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
