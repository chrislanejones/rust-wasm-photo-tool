import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

/* ── Props ───────────────────────────────────────────────────────────── */

interface ResizeSettingsProps {
  /** Current WASM image width */
  imageWidth: number;
  /** Current WASM image height */
  imageHeight: number;
  /** Calls Rust resize_bilinear via WASM — pushes one undo snapshot */
  onResize: (newW: number, newH: number) => void;
  /** Export quality 10-100 (browser-side, not Rust) */
  quality: number;
  onQualityChange: (q: number) => void;
  /** Disabled when no image loaded */
  disabled: boolean;
}

/* ── Component ───────────────────────────────────────────────────────── */

export function ResizeSettings({
  imageWidth,
  imageHeight,
  onResize,
  quality,
  onQualityChange,
  disabled,
}: ResizeSettingsProps) {
  const [width, setWidth] = useState(imageWidth);
  const [height, setHeight] = useState(imageHeight);
  const [lockAspect, setLockAspect] = useState(true);

  // Sync when a new image is loaded or after resize commits
  useEffect(() => {
    setWidth(imageWidth);
    setHeight(imageHeight);
  }, [imageWidth, imageHeight]);

  const aspectRatio = imageWidth / (imageHeight || 1);

  const handleWidthChange = useCallback(
    (raw: string) => {
      const v = Math.max(1, Number(raw) || 1);
      setWidth(v);
      if (lockAspect) setHeight(Math.max(1, Math.round(v / aspectRatio)));
    },
    [lockAspect, aspectRatio],
  );

  const handleHeightChange = useCallback(
    (raw: string) => {
      const v = Math.max(1, Number(raw) || 1);
      setHeight(v);
      if (lockAspect) setWidth(Math.max(1, Math.round(v * aspectRatio)));
    },
    [lockAspect, aspectRatio],
  );

  const handleResize = useCallback(() => {
    if (width === imageWidth && height === imageHeight) return;
    onResize(width, height);
  }, [width, height, imageWidth, imageHeight, onResize]);

  // ── Metrics ─────────────────────────────────────────────────────────
  const originalArea = imageWidth * imageHeight;
  const newArea = width * height;
  const areaRatio = originalArea > 0 ? newArea / originalArea : 1;
  const qualityRatio = quality / 100;
  const savingsPercent = Math.max(
    0,
    Math.round((1 - areaRatio * qualityRatio) * 100),
  );
  const lighthouseScore = Math.min(
    100,
    Math.max(0, Math.round(100 - areaRatio * qualityRatio * 50)),
  );

  const trafficColor = (v: number) =>
    v >= 80 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-red-500";

  const dimensionsChanged = width !== imageWidth || height !== imageHeight;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-medium text-theme-foreground">
        Resize & Compress
      </h3>

      {/* ── Dimensions ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest">
          Dimensions
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={width}
            onChange={(e) => handleWidthChange(e.target.value)}
            min={1}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-sm"
          />
          <input
            type="number"
            value={height}
            onChange={(e) => handleHeightChange(e.target.value)}
            min={1}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-sm"
          />
        </div>
        <button
          onClick={() => setLockAspect((v) => !v)}
          className="flex items-center gap-3 w-full p-2 rounded-lg bg-theme-muted/20 hover:bg-theme-muted/30 transition-colors"
        >
          <span
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
              lockAspect ? "bg-theme-primary" : "bg-theme-muted"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full transition-all duration-200 ${
                lockAspect
                  ? "left-6 bg-theme-primary-foreground"
                  : "left-1 bg-theme-foreground"
              }`}
            />
          </span>
          <span className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest">
            Lock Aspect
          </span>
        </button>
      </div>

      {/* ── Quality ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest">
            Quality
          </h4>
          <span className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest">
            {quality}%
          </span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((quality - 10) / (100 - 10)) * 100}%` }}
          />
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={quality}
            onChange={(e) => onQualityChange(Number(e.target.value))}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Performance Gain ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest">
            Performance Gain
          </h4>
          <span className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest tabular-nums">
            +{savingsPercent}%
          </span>
        </div>
        <div className="h-2 w-full bg-theme-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ease-out ${trafficColor(savingsPercent)}`}
            style={{ width: `${savingsPercent}%` }}
          />
        </div>
      </div>

      {/* ── Lighthouse Score ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest">
            Lighthouse Score
          </h4>
          <span className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest tabular-nums">
            {lighthouseScore}%
          </span>
        </div>
        <div className="h-2 w-full bg-theme-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ease-out ${trafficColor(lighthouseScore)}`}
            style={{ width: `${lighthouseScore}%` }}
          />
        </div>
      </div>

      {/* ── Resize Button ───────────────────────────────────────── */}
      <Button
        onClick={handleResize}
        disabled={disabled}
        className="w-full bg-accent text-text-primary hover:ring-2 hover:ring-theme-primary/50 hover:ring-offset-2 hover:ring-offset-theme-background"
      >
        {dimensionsChanged
          ? `Resize to ${width} × ${height}`
          : `Current: ${imageWidth} × ${imageHeight}`}
      </Button>
    </div>
  );
}
