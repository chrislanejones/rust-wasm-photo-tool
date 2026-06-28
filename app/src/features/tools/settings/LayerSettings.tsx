import {
  Move,
  MousePointerClick,
  BoxSelect,
  SquareDashed,
  Trash2,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { SizeSlider } from "@/components/SizeSlider";

/** Controls for the Selection Marker (magic-wand) — lives in Layer Settings. */
export interface SelectionControls {
  tolerance: number;
  onToleranceChange: (v: number) => void;
  /** Whether click-to-select mode is on (canvas clicks flood-select). */
  mode: boolean;
  onToggleMode: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onDelete: () => void;
  /** Whether something is currently selected (enables Deselect / Delete). */
  active: boolean;
}

interface LayerSettingsProps {
  disabled: boolean;
  /** Move-layer toggle — while on, canvas drags reposition the active layer. */
  moveActive: boolean;
  onToggleMove: () => void;
  /** Selection Marker controls. */
  selection: SelectionControls;
}

/**
 * Layer Settings tool (the renamed Move/arrow slot). Two mutually-exclusive
 * canvas modes as toggle buttons: Move (drag the active layer, also Ctrl+M) and
 * the Selection Marker (magic-wand flood-select). Only one is active at a time —
 * the parent enforces that.
 */
export function LayerSettings({
  disabled,
  moveActive,
  onToggleMove,
  selection,
}: LayerSettingsProps) {
  return (
    <div className="space-y-6 -mt-2">
      {/* ── Move the active layer ──────────────────────────────────────── */}
      <div className="space-y-2">
        <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
          Move Layer
        </span>
        <ToolButton
          active={moveActive}
          disabled={disabled}
          onClick={onToggleMove}
          className="w-full"
        >
          <Move /> {moveActive ? "Move: on" : "Move (Ctrl+M)"}
        </ToolButton>
        <p className="text-2xs text-theme-muted-foreground leading-relaxed">
          Turn on Move, then drag on the canvas to reposition the active layer
          (non-destructive). Ctrl+M toggles it.
        </p>
      </div>

      {/* ── Selection Marker (magic-wand) — Rust flood-fill ─────────────── */}
      <div className="space-y-2 pt-3 border-t border-theme-sidebar-border">
        <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
          Selection Marker
        </span>
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
        <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]">
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
        <p className="text-2xs text-theme-muted-foreground leading-relaxed">
          Turn on click-to-select, then click a region to flood-select similar
          colors. Alt+A selects all, Alt+D deselects.
        </p>
      </div>
    </div>
  );
}
