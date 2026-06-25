import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  BoxSelect,
  MousePointerClick,
  SquareDashed,
  Trash2,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
} from "lucide-react";
import { LargeButton } from "@/components/ui/large-button";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SizeSlider } from "@/components/SizeSlider";
import type { CropSelection } from "@/hooks/useDrawingTools";

/** Controls for the Selection Marker (magic-wand) — Edit & Move → Selection. */
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

/* ── Aspect-ratio presets ─────────────────────────────────────────────
 * "free" leaves the user dragging without constraint; everything else
 * triggers a centered crop selection computed in Rust via the
 * `compute_aspect_crop` WASM export AND locks subsequent drags to that
 * ratio via `constrain_crop_to_ratio`.
 */
type RatioId =
  | "free"
  | "1:1"
  | "4:3"
  | "3:2"
  | "16:9"
  | "9:16";

const RATIO_OPTIONS: { id: RatioId; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "3:2", label: "3:2" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
];

const RATIO_DIMS: Record<Exclude<RatioId, "free">, [number, number]> = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:2": [3, 2],
  "16:9": [16, 9],
  "9:16": [9, 16],
};

function ratioIdFromLock(lock: [number, number] | null): RatioId {
  if (!lock) return "free";
  for (const [id, [w, h]] of Object.entries(RATIO_DIMS) as [
    Exclude<RatioId, "free">,
    [number, number],
  ][]) {
    if (lock[0] === w && lock[1] === h) return id;
  }
  return "free";
}

/* ── Align ─────────────────────────────────────────────────────────────
 * Move the currently-selected object's bounding box to an edge / center of
 * the canvas. The actual move is done in Rust (it owns the annotation
 * geometry); this panel just emits the mode. */
export type AlignMode =
  | "left"
  | "centerH"
  | "right"
  | "top"
  | "middleV"
  | "bottom";

const ALIGN_BUTTONS: {
  mode: AlignMode;
  icon: typeof AlignStartVertical;
  label: string;
}[] = [
  { mode: "left", icon: AlignStartVertical, label: "Align left" },
  { mode: "centerH", icon: AlignCenterVertical, label: "Center horizontally" },
  { mode: "right", icon: AlignEndVertical, label: "Align right" },
  { mode: "top", icon: AlignStartHorizontal, label: "Align top" },
  { mode: "middleV", icon: AlignCenterHorizontal, label: "Center vertically" },
  { mode: "bottom", icon: AlignEndHorizontal, label: "Align bottom" },
];

/* ── Main component ──────────────────────────────────────────────────── */

interface TransformCropSettingsProps {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onApplyCrop?: () => void;
  imageWidth: number;
  imageHeight: number;
  onSetCropSelection?: (sel: CropSelection | null) => void;
  /** Currently-locked aspect ratio as `[w, h]`. `null` = Free. */
  cropRatio: [number, number] | null;
  onCropRatioChange: (lock: [number, number] | null) => void;
  /** Align the currently-selected object (text / shape) within the canvas. */
  onAlign?: (mode: AlignMode) => void;
  /** Whether an object is selected on the canvas (enables the Align row). */
  hasSelection?: boolean;
  /** Select the last-added object's bounding box as the align target. */
  onSelectBoundingBox?: () => void;
  /** Selection Marker (magic-wand) controls — shown above Align. */
  selection?: SelectionControls;
}

export function TransformCropSettings({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onApplyCrop,
  imageWidth,
  imageHeight,
  onSetCropSelection,
  cropRatio,
  onCropRatioChange,
  onAlign,
  hasSelection = false,
  onSelectBoundingBox,
  selection,
}: TransformCropSettingsProps) {
  const ratio = ratioIdFromLock(cropRatio);

  const handleRatioChange = async (id: RatioId) => {
    if (id === "free") {
      onCropRatioChange(null);
      onSetCropSelection?.(null);
      return;
    }
    const [rw, rh] = RATIO_DIMS[id];
    onCropRatioChange([rw, rh]);
    if (!imageWidth || !imageHeight || !onSetCropSelection) return;
    // Delegate the centred-crop math to Rust so it stays consistent with
    // the drag-snap math driven by `constrain_crop_to_ratio`.
    const mod = await import("stamp_tool");
    await mod.default();
    const out = mod.compute_aspect_crop(imageWidth, imageHeight, rw, rh);
    if (!out || out.length !== 4) return;
    const [x, y, w, h] = out;
    onSetCropSelection({ x, y, width: w, height: h });
  };

  return (
    <div className="space-y-6">
      {/* ── Crop (first; no verbiage — just the ratio + apply) ───────────── */}
      {onApplyCrop && (
        <div className="space-y-3 -mt-2">
          <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
            Crop
          </span>

          <ToolButtonGroup
            label="Ratio"
            options={RATIO_OPTIONS}
            value={ratio}
            onChange={(id) => void handleRatioChange(id)}
            columns={3}
          />

          {ratio !== "free" && (
            <div className="flex justify-center gap-2 px-3 py-4 rounded-lg text-xs large-badge-item type-current">
              <span className="large-badge">
                Locked to {ratio} — drags snap to this ratio
              </span>
            </div>
          )}

          <LargeButton
            className="w-full"
            disabled={disabled}
            onClick={onApplyCrop}
          >
            <Crop className="h-4 w-4" /> Apply Crop
          </LargeButton>
        </div>
      )}

      {/* ── Transform ───────────────────────────────────────────────────── */}
      <div className="space-y-2 pt-3 border-t border-theme-sidebar-border">
        <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
          Transform
        </span>
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
          <ToolButton disabled={disabled} onClick={onFlipH}>
            <FlipHorizontal /> Flip H
          </ToolButton>
          <ToolButton disabled={disabled} onClick={onFlipV}>
            <FlipVertical /> Flip V
          </ToolButton>
          <ToolButton disabled={disabled} onClick={onRotate90Cw}>
            <RotateCw /> Rotate 90°
          </ToolButton>
          <ToolButton
            disabled={disabled}
            onClick={() => {
              onRotate90Cw();
              onRotate90Cw();
              onRotate90Cw();
            }}
          >
            <RotateCcw /> Rotate −90°
          </ToolButton>
        </div>
      </div>

      {/* ── Selection Marker (magic-wand) — Rust flood-fill ─────────────── */}
      {selection && (
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
      )}

      {/* ── Align — move the selected object's bounding box (Rust-driven) ─── */}
      <div className="space-y-2 pt-3 border-t border-theme-sidebar-border">
        <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
          Align
        </span>
        <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]">
          {ALIGN_BUTTONS.map(({ mode, icon: Icon, label }) => (
            <ToolButton
              key={mode}
              title={label}
              aria-label={label}
              disabled={disabled || !onAlign || !hasSelection}
              onClick={() => onAlign?.(mode)}
            >
              <Icon />
            </ToolButton>
          ))}
        </div>
        <LargeButton
          className="w-full"
          disabled={disabled}
          onClick={onSelectBoundingBox}
        >
          <BoxSelect className="h-4 w-4" /> Select bounding box
        </LargeButton>
      </div>
    </div>
  );
}
