import { useState } from "react";
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Sun,
  Contrast,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Main component ──────────────────────────────────────────────────── */

interface TransformCropSettingsProps {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  onApplyCrop?: () => void;
}

export function TransformCropSettings({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onBrightness,
  onContrast,
  onApplyCrop,
}: TransformCropSettingsProps) {
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(100);

  /* commit helpers — push one undo snapshot, then reset slider */
  const commitBrightness = (v: number) => {
    if (v !== 0) {
      onBrightness(v / 100);
      setBrightness(0);
    }
  };
  const commitContrast = (v: number) => {
    if (v !== 100) {
      onContrast(v / 100);
      setContrast(100);
    }
  };

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

      {/* ── Brightness ─────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Sun className="h-3.5 w-3.5 text-theme-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
            Brightness
          </span>
          <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
            {brightness > 0 ? `+${brightness}` : brightness}
          </span>
        </div>

        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((brightness + 100) / 200) * 100}%` }}
          />
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={brightness}
            disabled={disabled}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onPointerUp={(e) => commitBrightness(Number((e.target as HTMLInputElement).value))}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Contrast ───────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Contrast className="h-3.5 w-3.5 text-theme-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
            Contrast
          </span>
          <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
            {contrast}%
          </span>
        </div>

        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${(contrast / 300) * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={300}
            step={1}
            value={contrast}
            disabled={disabled}
            onChange={(e) => setContrast(Number(e.target.value))}
            onPointerUp={(e) => commitContrast(Number((e.target as HTMLInputElement).value))}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
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
