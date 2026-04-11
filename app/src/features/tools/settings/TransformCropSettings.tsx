import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <h3 className="text-sm font-medium text-theme-foreground">Transform</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={onFlipH}
          >
            <FlipHorizontal className="h-4 w-4" /> Flip H
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={onFlipV}
          >
            <FlipVertical className="h-4 w-4" /> Flip V
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={onRotate90Cw}
          >
            <RotateCw className="h-4 w-4" /> Rotate 90°
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={() => {
              onRotate90Cw();
              onRotate90Cw();
              onRotate90Cw();
            }}
          >
            <RotateCcw className="h-4 w-4" /> Rotate −90°
          </Button>
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
