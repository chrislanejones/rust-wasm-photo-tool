import { useEffect } from "react";
import {
  Move,
  Scaling,
  Trash2,
  Minus,
  Lock,
  LockOpen,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { ActionTile } from "@/components/ui/action-tile";
import { ReselectBar } from "@/components/ui/reselect-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { CanvasResize } from "@/components/CanvasResize";
import { useGuidesStore } from "@/stores/useGuidesStore";

interface LayerSettingsProps {
  disabled: boolean;
  /** Move-layer toggle — while on, canvas drags reposition the active layer. */
  moveActive: boolean;
  onToggleMove: () => void;
  /** "Resize Layer" — opens a movable/resizable bounding box (same overlay as
   *  paste placement) around the active layer's own content; drag the handles
   *  then Enter/click-away to bake the scale, Escape to cancel. */
  onResizeLayer?: () => void;
  /** Live canvas (image) dimensions — used to evenly distribute new guides. */
  imgW: number;
  imgH: number;
  /** Canvas (image) dimensions + W×H resize apply — the backdrop is the canvas,
   *  so its one-off Canvas Size resizer lives here. */
  canvasWidth: number;
  canvasHeight: number;
  onResizeCanvas: (w: number, h: number) => void;
  /** Deletes the artboard's Background layer outright. */
  onRemoveCanvas: () => void;
  canRemoveCanvas: boolean;
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
  onResizeLayer,
  imgW,
  imgH,
  canvasWidth,
  canvasHeight,
  onResizeCanvas,
  onRemoveCanvas,
  canRemoveCanvas,
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
      {/* ── Move or Resize the active layer ──────────────────────────────── */}
      <div className="space-y-2">
        <SectionHeader
          title="Move or Resize Layer"
          info={
            <>
              <strong className="font-semibold text-theme-foreground">
                Move
              </strong>{" "}
              drags the active layer&rsquo;s content on the canvas.{" "}
              <strong className="font-semibold text-theme-foreground">
                Resize
              </strong>{" "}
              opens a draggable bounding box to scale/reposition it, then
              Enter or click away to bake it in (Escape cancels). Both are
              non-destructive until committed. <kbd>Ctrl+M</kbd> toggles Move.
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
          <ToolButton
            stacked
            active={moveActive}
            disabled={disabled}
            onClick={onToggleMove}
          >
            <Move /> <span>{moveActive ? "Move: on" : "Move"}</span>
          </ToolButton>
          <ActionTile
            icon={Scaling}
            label="Resize"
            disabled={disabled || !onResizeLayer}
            onClick={onResizeLayer}
          />
        </div>
      </div>

      {/* The Selection Marker used to live here. It moved to Adjust & Select →
          Select in the tool-arc 2.6 session — it was always a selection tool,
          just parked next to Move/Resize-Layer. */}

      {/* ── Guides (non-destructive draggable overlay lines) ─────────────── */}
      <div className="space-y-2 pt-3 border-t border-theme-sidebar-border">
        <SectionHeader
          title="Horizontal and Vertical Guides"
          info={
            <>
              Add evenly-spaced horizontal/vertical guides, then drag them on
              the canvas to reposition. Lock prevents moving;{" "}
              <kbd>Delete</kbd>/<kbd>Backspace</kbd> removes the selected
              guide.
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
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
          <>
            <span className="text-2xs font-semibold font-mono text-theme-muted-foreground">
              Guides
            </span>
            <div className="history-list max-h-40">
            {guides.map((g) => (
              <ReselectBar
                key={g.id}
                label={`${g.axis === "h" ? "H" : "V"} · ${Math.round(g.pos)}px`}
                selected={g.id === selectedGuideId}
                onSelect={() => selectGuide(g.id)}
                onDelete={() => removeGuide(g.id)}
                title="Reselect guide"
                deleteLabel="Delete guide"
              />
            ))}
            </div>
          </>
        )}
      </div>

      {/* ── Canvas size (the checkerboard backdrop is the canvas) ─────────── */}
      <div className="space-y-3 pt-3 border-t border-theme-sidebar-border">
        <SectionHeader
          title="Background Canvas Size"
          info="Resizes the backing canvas, not the photo — content keeps its native resolution, centred; new area uses the backing color."
        />
        <CanvasResize
          width={canvasWidth}
          height={canvasHeight}
          disabled={disabled}
          onApply={onResizeCanvas}
          onRemove={onRemoveCanvas}
          canRemove={canRemoveCanvas}
        />
      </div>
    </div>
  );
}
