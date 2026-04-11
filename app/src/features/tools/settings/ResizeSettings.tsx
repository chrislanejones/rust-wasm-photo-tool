// ===== FILE: app/src/features/tools/settings/ResizeSettings.tsx =====
import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResizeSettingsProps {
  disabled: boolean;
  imageWidth: number;
  imageHeight: number;
  quality: number;
  onQualityChange: (q: number) => void;
  onResize: (w: number, h: number) => void;
  compareActive: boolean;
  onToggleCompare: () => void;
  hasBeenModified: boolean;
  onAutoCompress: () => void;
  isCompressing: boolean;
  compressProgress: { completed: number; total: number };
}

function trafficColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function ResizeSettings({
  disabled,
  imageWidth,
  imageHeight,
  quality,
  onQualityChange,
  onResize,
  compareActive,
  onToggleCompare,
  hasBeenModified,
  onAutoCompress,
  isCompressing,
  compressProgress,
}: ResizeSettingsProps) {
  const [width, setWidth] = useState(String(imageWidth));
  const [height, setHeight] = useState(String(imageHeight));
  const [lockAspect, setLockAspect] = useState(true);

  useEffect(() => {
    setWidth(String(imageWidth));
    setHeight(String(imageHeight));
  }, [imageWidth, imageHeight]);

  const handleWidthChange = useCallback(
    (val: string) => {
      setWidth(val);
      const w = parseInt(val, 10);
      if (!isNaN(w) && w > 0 && lockAspect && imageWidth > 0) {
        setHeight(String(Math.round((w / imageWidth) * imageHeight)));
      }
    },
    [lockAspect, imageWidth, imageHeight],
  );

  const handleHeightChange = useCallback(
    (val: string) => {
      setHeight(val);
      const h = parseInt(val, 10);
      if (!isNaN(h) && h > 0 && lockAspect && imageHeight > 0) {
        setWidth(String(Math.round((h / imageHeight) * imageWidth)));
      }
    },
    [lockAspect, imageWidth, imageHeight],
  );

  const handleApplyResize = () => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (w > 0 && h > 0) {
      onResize(w, h);
    }
  };

  const handleQualityChange = (val: number) => {
    onQualityChange(val);
  };

  const compareDisabled = !hasBeenModified;

  // Lighthouse score calculation
  const originalArea = imageWidth * imageHeight;
  const newW = parseInt(width, 10) || imageWidth;
  const newH = parseInt(height, 10) || imageHeight;
  const newArea = newW * newH;
  const areaRatio = originalArea > 0 ? newArea / originalArea : 1;
  const qualityRatio = quality / 100;
  const scoreBase = areaRatio * qualityRatio;
  const lighthouseScore = Math.min(
    100,
    Math.max(0, Math.round(100 - scoreBase * 50)),
  );
  const savingsPercent = Math.max(
    0,
    Math.round((1 - areaRatio * qualityRatio) * 100),
  );

  return (
    <div className="space-y-8 flex flex-col h-full">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Resize &amp; Compress
      </h3>

      {/* ── Content ── */}
      <div className="space-y-8 flex-1">
        {/* ── Performance Gain ── */}
        <div className="space-y-4">
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

        {/* ── Lighthouse Score ── */}
        <div className="space-y-4">
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

        {/* ── Quality — gradient slider ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
              Quality
            </label>
            <span className="text-xs text-theme-foreground tabular-nums">
              {quality}%
            </span>
          </div>

          <div className="relative h-2 w-full rounded-full bg-theme-muted">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
              style={{ width: `${quality}%` }}
            />
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => handleQualityChange(Number(e.target.value))}
              className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>
        </div>

        {/* ── Dimensions ── */}
        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase text-text-primary tracking-widest">
            Dimensions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <input
                type="number"
                value={width}
                onChange={(e) => handleWidthChange(e.target.value)}
                min={1}
                disabled={disabled}
                className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
              />
              <span className="text-xs text-text-secondary">width</span>
            </div>
            <div className="space-y-1">
              <input
                type="number"
                value={height}
                onChange={(e) => handleHeightChange(e.target.value)}
                min={1}
                disabled={disabled}
                className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
              />
              <span className="text-xs text-text-secondary">height</span>
            </div>
          </div>
        </div>

        {/* ── Lock Aspect ── */}
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

        {/* ── A/B Compare ── */}
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
                Resize or adjust quality first, then use A/B compare to see the
                difference vs. the original.
              </p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* ── Bottom Buttons ── */}
      <div className="border-t border-theme-sidebar-border pt-4 space-y-2">
        <Button
          onClick={handleApplyResize}
          disabled={disabled}
          className="w-full gap-2"
        >
          Apply Resize
        </Button>
        <Button
          onClick={onAutoCompress}
          disabled={disabled || isCompressing}
          className="w-full gap-2 bg-accent text-text-primary hover:ring-2 hover:ring-theme-primary/50 hover:ring-offset-2 hover:ring-offset-theme-background"
        >
          <Zap className="h-4 w-4" />
          {isCompressing ? "Compressing…" : "Auto Compress All Images"}
        </Button>

        {isCompressing && (
          <div className="h-1.5 w-full bg-theme-muted rounded-full overflow-hidden">
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
