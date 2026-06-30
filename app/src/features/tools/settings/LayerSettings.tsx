import { useEffect } from "react";
import {
  Move,
  MousePointerClick,
  BoxSelect,
  SquareDashed,
  Trash2,
  Minus,
  Lock,
  LockOpen,
  X,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { SizeSlider } from "@/components/SizeSlider";
import { useGuidesStore } from "@/stores/useGuidesStore";

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
  /** Live canvas (image) dimensions — used to evenly distribute new guides. */
  imgW: number;
  imgH: number;
}

/**
 * Layer Settings tool (the renamed Move/arrow slot). Two mutually-exclusive
 * canvas modes as toggle buttons: Move (drag the active layer, also Ctrl+M) and
 * the Selection Marker (magic-wand flood-select). Only one is active at a time —
 * the parent enforces that. Plus draggable image **Guides** (non-destructive
 * overlay lines; the W×H Canvas Size control now lives in Settings → Layers and
 * Canvas).
 */
export function LayerSettings({
  disabled,
  moveActive,
  onToggleMove,
  selection,
  imgW,
  imgH,
}: LayerSettingsProps) {
  // Guide state lives in the dedicated Zustand slice (shared with the canvas
  // overlay), so we read it directly rather than prop-drilling.
  const guides = useGuidesStore((s) => s.guides);
  const guidesLocked = useGuidesStore((s) => s.guidesLocked);
  const selectedGuideId = useGuidesStore((s) => s.selectedGuideId);
  const addGuide = useGuidesStore((s) => s.addGuide);
  const removeGuide = useGuidesStore((s) => s.removeGuide);
  const clearGuides = useGuidesStore((s) => s.clearGuides);
  const selectGuide = useGuidesStore((s) => s.selectGuide);
  const toggleGuidesLock = useGuidesStore((s) => s.toggleGuidesLock);

  // Delete / Backspace removes the selected guide — but only when a guide is
  // selected AND the user isn't typing in a field (don't hijack the key).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      const id = useGuidesStore.getState().selectedGuideId;
      if (!id) return;
      e.preventDefault();
      removeGuide(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeGuide]);

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

      {/* ── Guides (non-destructive draggable overlay lines) ─────────────── */}
      <div className="space-y-2 pt-3 border-t border-theme-sidebar-border">
        <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
          Guides
        </span>
        <div className="grid grid-cols-4 gap-2 [grid-auto-rows:1fr]">
          <ToolButton
            disabled={disabled}
            onClick={() => addGuide("h", imgW, imgH)}
            title="Add horizontal guide"
          >
            <Minus /> H
          </ToolButton>
          <ToolButton
            disabled={disabled}
            onClick={() => addGuide("v", imgW, imgH)}
            title="Add vertical guide"
          >
            <Minus className="rotate-90" /> V
          </ToolButton>
          <ToolButton
            disabled={disabled || guides.length === 0}
            onClick={clearGuides}
            title="Remove all guides"
          >
            <Trash2 /> Clear
          </ToolButton>
          <ToolButton
            active={guidesLocked}
            disabled={disabled}
            onClick={toggleGuidesLock}
            title="Prevent guides from being moved"
          >
            {guidesLocked ? <Lock /> : <LockOpen />} Lock
          </ToolButton>
        </div>

        {guides.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {guides.map((g) => {
              const isSelected = g.id === selectedGuideId;
              return (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectGuide(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectGuide(g.id);
                    }
                  }}
                  className={`flex items-center justify-between rounded px-2 py-1 cursor-pointer font-mono text-2xs ${
                    isSelected
                      ? "bg-theme-muted text-text-primary ring-1 ring-theme-ring"
                      : "text-theme-muted-foreground hover:bg-theme-muted"
                  }`}
                >
                  <span>
                    {g.axis === "h" ? "H" : "V"} · {Math.round(g.pos)}px
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGuide(g.id);
                    }}
                    title="Delete guide"
                    className="ml-2 rounded p-0.5 text-theme-muted-foreground hover:text-text-primary hover:bg-theme-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-2xs text-theme-muted-foreground leading-relaxed">
          Add evenly-spaced horizontal/vertical guides, then drag them on the
          canvas to reposition. Lock prevents moving; Delete/Backspace removes the
          selected guide.
        </p>
      </div>
    </div>
  );
}
