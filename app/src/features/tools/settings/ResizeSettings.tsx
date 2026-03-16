import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── Props ───────────────────────────────────────────────────────────── */

interface ResizeSettingsProps {
  imageWidth: number;
  imageHeight: number;
  onResize: (newW: number, newH: number) => void;
  quality: number;
  onQualityChange: (q: number) => void;
  disabled: boolean;
  /** Has the image been modified (resized, quality changed, etc.)? */
  hasBeenModified: boolean;
  /** Toggle A/B compare overlay */
  compareActive: boolean;
  onToggleCompare: () => void;
  /** Auto compress all images */
  onAutoCompress: () => void;
  isCompressing: boolean;
  compressProgress: { completed: number; total: number };
}

/* ── Component ───────────────────────────────────────────────────────── */

export function ResizeSettings({
  imageWidth,
  imageHeight,
  onResize,
  quality,
  onQualityChange,
  disabled,
  hasBeenModified,
  compareActive,
  onToggleCompare,
  onAutoCompress,
  isCompressing,
  compressProgress,
}: ResizeSettingsProps) {
  const [width, setWidth] = useState(imageWidth);
  const [height, setHeight] = useState(imageHeight);
  const [lockAspect, setLockAspect] = useState(true);

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

  // Metrics
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
  const compareDisabled = disabled || !hasBeenModified;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-medium text-theme-foreground">
        Resize & Compress
      </h3>

      {/* ── Dimensions ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase text-text-primary tracking-widest">
          Dimensions
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={width}
            onChange={(e) => handleWidthChange(e.target.value)}
            min={1}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
          />
          <input
            type="number"
            value={height}
            onChange={(e) => handleHeightChange(e.target.value)}
            min={1}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
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
          <span className="text-xs font-black uppercase text-theme-muted-foreground tracking-widest tabular-nums">
            {quality}%
          </span>
        </div>
        <Slider
          value={[quality]}
          onValueChange={([v]) => onQualityChange(v)}
          min={10}
          max={100}
          step={1}
          disabled={disabled}
        />
      </div>

      {/* ── A/B Compare Toggle ──────────────────────────────────── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <button
              onClick={onToggleCompare}
              disabled={compareDisabled}
              className={[
                "flex items-center gap-3 w-full p-3 rounded-lg transition-all",
                "text-xs font-black uppercase tracking-widest",
                compareActive
                  ? "bg-theme-primary/15 ring-1 ring-theme-primary/40 text-theme-primary"
                  : "bg-theme-muted/20 hover:bg-theme-muted/30 text-theme-muted-foreground",
                compareDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer",
              ].join(" ")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {compareActive ? "Hide A/B Compare" : "Show A/B Compare"}
            </button>
          </div>
        </TooltipTrigger>
        {compareDisabled && (
          <TooltipContent side="bottom" className="max-w-[220px] text-center">
            <p className="text-xs">
              Resize or compress an image first, then use A/B compare to see the
              difference vs. the original.
            </p>
          </TooltipContent>
        )}
      </Tooltip>

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
        disabled={disabled || !dimensionsChanged}
        className="w-full bg-accent text-text-primary hover:ring-2 hover:ring-theme-primary/50 hover:ring-offset-2 hover:ring-offset-theme-background"
      >
        {dimensionsChanged
          ? `Resize to ${width} × ${height}`
          : `Current: ${imageWidth} × ${imageHeight}`}
      </Button>

      {/* ── Auto Compress All ───────────────────────────────────── */}
      <div className="pt-3 border-t border-theme-sidebar-border">
        <Button
          onClick={onAutoCompress}
          disabled={disabled || isCompressing}
          className="w-full bg-accent text-text-primary hover:ring-2 hover:ring-theme-primary/50 hover:ring-offset-2 hover:ring-offset-theme-background"
        >
          <Zap className="h-4 w-4" />
          {isCompressing
            ? `Compressing ${compressProgress.completed}/${compressProgress.total}…`
            : "Auto Compress All Images"}
        </Button>
        {isCompressing && (
          <div className="mt-2 h-1.5 w-full bg-theme-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-300"
              style={{
                width: `${
                  compressProgress.total > 0
                    ? (compressProgress.completed / compressProgress.total) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
