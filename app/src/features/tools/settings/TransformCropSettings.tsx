import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { CropSelection } from "@/hooks/useDrawingTools";

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
    if (out.length !== 4) return;
    const [x, y, w, h] = out;
    onSetCropSelection({ x, y, width: w, height: h });
  };

  return (
    <div className="space-y-6">
      {/* ── Geometry ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 -mt-2">
        <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
          Transform
        </span>
        <div className="grid grid-cols-2 gap-2">
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

      {/* ── Crop ───────────────────────────────────────────────────── */}
      {onApplyCrop && (
        <div className="space-y-3 pt-3 border-t border-theme-sidebar-border">
          <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
            Crop
          </span>
          <p className="text-xs text-theme-muted-foreground leading-relaxed">
            Pick a ratio or drag on the canvas to select an area, then apply.
          </p>

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

          <Button
            variant="default"
            className="w-full gap-2"
            disabled={disabled}
            onClick={onApplyCrop}
          >
            <Crop className="h-4 w-4" /> Apply Crop
          </Button>
        </div>
      )}
    </div>
  );
}
