import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolButton } from "@/components/ui/tool-button";

/* ── Main component ──────────────────────────────────────────────────── */

interface TransformCropSettingsProps {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onApplyCrop?: () => void;
}

export function TransformCropSettings({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onApplyCrop,
}: TransformCropSettingsProps) {
  return (
    <div className="space-y-6">
      {/* ── Geometry ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <span className="text-[11px] text-theme-muted-foreground">Transform</span>
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
          <h3 className="text-sm font-medium text-theme-foreground">Crop</h3>
          <p className="text-xs text-theme-muted-foreground leading-relaxed">
            Click and drag on the canvas to select a crop area, then apply.
          </p>
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
