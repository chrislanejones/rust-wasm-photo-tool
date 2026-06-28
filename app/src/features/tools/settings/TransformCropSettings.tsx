import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Eraser,
  Maximize,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import { LargeButton } from "@/components/ui/large-button";
import { ToolButton } from "@/components/ui/tool-button";
import { ActionTile } from "@/components/ui/action-tile";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SizeSlider } from "@/components/SizeSlider";
import type { CropSelection } from "@/hooks/useDrawingTools";

/** Eraser controls — the Eraser lives at the bottom of Edit & Transform. While
 *  `active`, canvas strokes erase the active layer to transparent. */
export interface EraserControls {
  active: boolean;
  onToggle: () => void;
  size: number;
  onSizeChange: (v: number) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
  hardness: number;
  onHardnessChange: (v: number) => void;
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

const RATIO_OPTIONS: { id: RatioId; label: string; icon: typeof Square }[] = [
  { id: "free", label: "Free", icon: Maximize },
  { id: "1:1", label: "1:1", icon: Square },
  { id: "4:3", label: "4:3", icon: RectangleHorizontal },
  { id: "3:2", label: "3:2", icon: RectangleHorizontal },
  { id: "16:9", label: "16:9", icon: RectangleHorizontal },
  { id: "9:16", label: "9:16", icon: RectangleVertical },
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
  /** Eraser controls (bottom of the panel). */
  eraser?: EraserControls;
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
  eraser,
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
            stacked
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
          <ActionTile
            icon={FlipHorizontal}
            label="Flip H"
            disabled={disabled}
            onClick={onFlipH}
          />
          <ActionTile
            icon={FlipVertical}
            label="Flip V"
            disabled={disabled}
            onClick={onFlipV}
          />
          <ActionTile
            icon={RotateCw}
            label="Rotate 90°"
            disabled={disabled}
            onClick={onRotate90Cw}
          />
          <ActionTile
            icon={RotateCcw}
            label="Rotate −90°"
            disabled={disabled}
            onClick={() => {
              onRotate90Cw();
              onRotate90Cw();
              onRotate90Cw();
            }}
          />
        </div>
      </div>

      {/* ── Eraser — scrubs the active layer to transparent ─────────────── */}
      {eraser && (
        <div className="space-y-2 pt-3 border-t border-theme-sidebar-border">
          <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
            Eraser
          </span>
          <ToolButton
            active={eraser.active}
            disabled={disabled}
            onClick={eraser.onToggle}
            className="w-full"
          >
            <Eraser /> {eraser.active ? "Erasing: on" : "Eraser"}
          </ToolButton>
          {eraser.active && (
            <>
              <SizeSlider
                label="Size"
                value={eraser.size}
                min={1}
                max={100}
                onChange={eraser.onSizeChange}
              />
              <SizeSlider
                label="Opacity"
                value={eraser.opacity}
                min={0}
                max={100}
                variant="numbers"
                unit="%"
                presets={[25, 50, 75, 100]}
                onChange={eraser.onOpacityChange}
              />
              <SizeSlider
                label="Hardness"
                value={eraser.hardness}
                min={0}
                max={100}
                variant="numbers"
                unit="%"
                presets={[25, 50, 75, 100]}
                onChange={eraser.onHardnessChange}
              />
            </>
          )}
          <p className="text-2xs text-theme-muted-foreground leading-relaxed">
            Turn on the eraser, then drag on the canvas to scrub the active layer
            to transparent — revealing whatever&rsquo;s beneath it. Lower opacity
            erases gradually.
          </p>
        </div>
      )}
    </div>
  );
}
