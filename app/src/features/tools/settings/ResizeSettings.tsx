// ===== FILE: app/src/features/tools/settings/ResizeSettings.tsx =====
import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Zap, Scaling, ChevronDown } from "lucide-react";
import { LargeButton } from "@/components/ui/large-button";
import { SizeSlider } from "@/components/SizeSlider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getWebPerfMetrics } from "@/lib/webPerf";
import type { ExportFormat } from "@/lib/exportImage";

/** Resampling method → Rust filter code (see `resize_with_filter`). */
const FILTER_CODE = {
  lanczos3: 3,
  "catmull-rom": 2,
  nearest: 0,
} as const;

type ResampleMethod = keyof typeof FILTER_CODE;

const METHOD_LABELS: Record<ResampleMethod, string> = {
  lanczos3: "Lanczos3",
  "catmull-rom": "Catmull-Rom",
  nearest: "Nearest",
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
};

interface ResizeSettingsProps {
  disabled: boolean;
  imageWidth: number;
  imageHeight: number;
  /** Current on-disk size of the active photo, in bytes (PageSpeed score). */
  currentByteSize: number;
  /** Current file's MIME type — feeds the PSI next-gen-format audit. */
  currentMime?: string;
  /** Immutable size at upload, in bytes — the performance-gain baseline. */
  originalByteSize: number;
  activePhotoId: string | null;
  quality: number;
  onQualityChange: (q: number) => void;
  /** Apply Compression & Resize: resample to w×h with the given Rust filter
   *  code, then re-encode at the panel's format + quality. */
  onResize: (w: number, h: number, filter: number) => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (f: ExportFormat) => void;
  compareActive: boolean;
  onToggleCompare: () => void;
  hasBeenModified: boolean;
  onAutoCompress: () => void;
  isCompressing: boolean;
  compressProgress: { completed: number; total: number };
  /** Number of selected gallery photos; >0 switches to "Compress Selected". */
  selectedCount: number;
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
  currentByteSize,
  currentMime,
  originalByteSize,
  activePhotoId,
  quality,
  onQualityChange,
  onResize,
  exportFormat,
  onExportFormatChange,
  compareActive,
  onToggleCompare,
  hasBeenModified,
  onAutoCompress,
  isCompressing,
  selectedCount,
}: ResizeSettingsProps) {
  const [width, setWidth] = useState(String(imageWidth));
  const [height, setHeight] = useState(String(imageHeight));
  const [lockAspect, setLockAspect] = useState(true);
  const [method, setMethod] = useState<ResampleMethod>("lanczos3");
  const baseQualityRef = useRef(quality);
  const baseFormatRef = useRef(exportFormat);
  const baseMethodRef = useRef(method);

  useEffect(() => {
    setWidth(String(imageWidth));
    setHeight(String(imageHeight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    baseQualityRef.current = quality;
    baseFormatRef.current = exportFormat;
    baseMethodRef.current = method;
  }, [imageWidth, imageHeight, activePhotoId]);

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
    [lockAspect, imageHeight, imageWidth],
  );

  // ── Width percent slider ──
  // Derived from the width field (typing a width moves the slider). Dragging
  // sets BOTH width and height proportionally from the panel-open dimensions
  // — percent is inherently proportional (like Squoosh presets), regardless
  // of the Lock Aspect toggle.
  const widthPercent =
    imageWidth > 0 && parseInt(width, 10) > 0
      ? Math.round((parseInt(width, 10) / imageWidth) * 100)
      : 100;

  const handlePercentChange = useCallback(
    (pct: number) => {
      setWidth(String(Math.max(1, Math.round((imageWidth * pct) / 100))));
      setHeight(String(Math.max(1, Math.round((imageHeight * pct) / 100))));
    },
    [imageWidth, imageHeight],
  );

  const handleApplyResize = () => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (w > 0 && h > 0) {
      onResize(w, h, FILTER_CODE[method]);
      baseQualityRef.current = quality;
      baseFormatRef.current = exportFormat;
      baseMethodRef.current = method;
    }
  };

  const handleQualityChange = (val: number) => {
    onQualityChange(val);
  };

  const qualityChanged = quality < baseQualityRef.current;
  const formatChanged = exportFormat !== baseFormatRef.current;
  const methodChanged = method !== baseMethodRef.current;
  const resizeChanged =
    parseInt(width, 10) !== imageWidth ||
    parseInt(height, 10) !== imageHeight ||
    qualityChanged ||
    formatChanged ||
    methodChanged;
  // A/B compare unlocks as soon as anything in the panel changes (pending or
  // applied) — not only after an applied edit.
  const compareDisabled = !(hasBeenModified || resizeChanged);

  // Web-performance indicators come from Rust (`web_perf_metrics`). The
  // PageSpeed Insights score is byte-aware: a big, still-uncompressed photo
  // scores low, and resizing or lowering quality (smaller projected delivery)
  // raises it.
  const newW = parseInt(width, 10) || imageWidth;
  const newH = parseInt(height, 10) || imageHeight;
  const [lighthouseScore, setLighthouseScore] = useState(0);
  const [savingsPercent, setSavingsPercent] = useState(0);

  useEffect(() => {
    let alive = true;
    void getWebPerfMetrics({
      curW: imageWidth,
      curH: imageHeight,
      curBytes: currentByteSize,
      origBytes: originalByteSize,
      newW,
      newH,
      quality,
      curMime: currentMime,
      newFormat: exportFormat,
    }).then((m) => {
      if (!alive) return;
      setLighthouseScore(m.lighthouseScore);
      setSavingsPercent(m.performanceGain);
    });
    return () => {
      alive = false;
    };
  }, [
    imageWidth,
    imageHeight,
    currentByteSize,
    currentMime,
    originalByteSize,
    newW,
    newH,
    quality,
    exportFormat,
  ]);

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-semibold font-mono text-text-muted mb-3">
        Resize
      </h3>

      {/* ── Content ── */}
      <div className="space-y-8 flex-1">
        {/* ── Width percent slider ── */}
        <SizeSlider
          label="Width"
          value={widthPercent}
          onChange={handlePercentChange}
          min={1}
          max={100}
          unit="%"
          disabled={disabled}
        />

        {/* ── Dimensions ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] text-theme-muted-foreground">
              Dimensions
            </h4>
            <button
              onClick={() => setLockAspect((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-theme-muted/20 hover:bg-theme-muted/30 transition-colors px-2 py-1"
            >
              <span
                className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
                  lockAspect ? "bg-theme-primary" : "bg-theme-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ${
                    lockAspect
                      ? "left-4 bg-theme-primary-foreground"
                      : "left-0.5 bg-theme-foreground"
                  }`}
                />
              </span>
              <span className="text-[11px] text-theme-muted-foreground">
                Lock Aspect
              </span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-secondary">width</span>
              <input
                type="number"
                value={width}
                onChange={(e) => handleWidthChange(e.target.value)}
                min={1}
                disabled={disabled}
                className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-secondary">height</span>
              <input
                type="number"
                value={height}
                onChange={(e) => handleHeightChange(e.target.value)}
                min={1}
                disabled={disabled}
                className="w-full px-3 py-2 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
              />
            </div>
          </div>
        </div>

        <hr className="border-theme-sidebar-border" />

        {/* ── Compress ── */}
        <div className="flex flex-col gap-5 -mt-2">
          <h3 className="text-xs font-semibold font-mono text-text-muted">
            Compress
          </h3>

          {/* ── Method ── */}
          <div className="space-y-4">
            <label className="text-[11px] text-theme-muted-foreground">
              Method
            </label>
          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ResampleMethod)}
              disabled={disabled}
              className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-sm text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
            >
              {(Object.keys(METHOD_LABELS) as ResampleMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted-foreground" />
          </div>
        </div>

          {/* ── Format ── */}
          <div className="space-y-4">
            <label className="text-[11px] text-theme-muted-foreground">
              Format
            </label>
            <div className="relative">
              <select
                value={exportFormat}
                onChange={(e) =>
                  onExportFormatChange(e.target.value as ExportFormat)
                }
                disabled={disabled}
                className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-sm text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
              >
                {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted-foreground" />
            </div>
          </div>
        </div>

        {/* ── Quality ── */}
        <SizeSlider
          label="Quality"
          value={quality}
          onChange={handleQualityChange}
          min={10}
          max={100}
          unit="%"
        />

        <hr className="border-theme-sidebar-border" />

        {/* ── Web Performance Gain ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px]">
            <h4 className="text-theme-muted-foreground">Web Performance Gain</h4>
            <span className="text-theme-foreground tabular-nums">
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

        {/* ── PageSpeed Insights Score ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px]">
            <h4 className="text-theme-muted-foreground">
              PageSpeed Insights Score
            </h4>
            <span className="text-theme-foreground tabular-nums">
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
      <div className="border-t border-theme-sidebar-border pt-4 mt-8 space-y-2">
        <LargeButton
          onClick={handleApplyResize}
          disabled={disabled || !resizeChanged}
          className="w-full"
        >
          <Scaling className="h-4 w-4" />
          Apply Compression &amp; Resize
        </LargeButton>
        {/* Compression progress is surfaced via a sonner toast, not inline. */}
        <LargeButton
          onClick={onAutoCompress}
          disabled={disabled || isCompressing}
          className="w-full"
        >
          <Zap className="h-4 w-4" />
          {isCompressing
            ? "Compressing…"
            : selectedCount > 0
              ? "Auto Compress Selected Images"
              : "Auto Compress All Images"}
        </LargeButton>
      </div>
    </div>
  );
}
