// ===== FILE: app/src/features/tools/settings/ResizeSettings.tsx =====
import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Zap, Scaling, ChevronDown, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DimensionFields } from "@/components/DimensionFields";
import { SizeSlider } from "@/components/SizeSlider";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getWebPerfMetrics } from "@/lib/webPerf";
import type { ExportFormat } from "@/lib/exportImage";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";
import type { ResizeMode } from "@/stores/useToolStore";

/** Resize's sub-modes for the shared ToolModeToggle (icon tiles + per-mode
 *  SectionHeader title/info). Also consumed by the tool registry
 *  (features/tools/toolModules.ts) as the Resize module's `modes`. The mode
 *  union (`ResizeMode`) is canonical in `stores/useToolStore.ts`. */
export const RESIZE_MODES: readonly ToolMode<ResizeMode>[] = [
  {
    id: "compress",
    label: "Compress",
    icon: FileArchive,
    info: (
      <>
        Shrinks the file size: pick a resample Method and output Format,
        then drag Quality. Web Performance Gain and PageSpeed Insights
        Score preview the pending output — Apply Compression &amp; Resize
        commits it.
      </>
    ),
  },
  {
    id: "resize",
    label: "Resize",
    icon: Scaling,
    info: (
      <>
        Sets new pixel dimensions. The lock keeps the aspect ratio; the
        percent slider scales width and height proportionally. Apply
        Compression &amp; Resize commits it.
      </>
    ),
  },
];

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
  onToggleCompare: () => void;
  /** Run Auto Compress over the current selection, or over the whole gallery. */
  onAutoCompress: (scope: "selected" | "all") => void;
  isCompressing: boolean;
  compressProgress: { completed: number; total: number };
  /** Number of selected gallery photos; >0 switches to "Compress Selected". */
  selectedCount: number;
  /** Total photos in the gallery; the "All Images" button hides when ≤ 1. */
  totalCount: number;
}

function trafficColor(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
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
  onToggleCompare,
  onAutoCompress,
  isCompressing,
  selectedCount,
  totalCount,
}: ResizeSettingsProps) {
  // A/B compare view lives in the UI store; the active-image dirty flag in the
  // gallery store — both were prop-drilled from AppShell before stage 1.
  const compareActive = useUIStore((s) => s.compareActive);
  const hasBeenModified = useGalleryStore((s) => s.hasBeenModified);
  const [width, setWidth] = useState(String(imageWidth));
  const [height, setHeight] = useState(String(imageHeight));
  const [lockAspect, setLockAspect] = useState(true);
  const [method, setMethod] = useState<ResampleMethod>("lanczos3");
  // Sub-mode lives in the tool store (like Paint's brushMode) so the command
  // palette's registry-derived `mode.compress.*` entries can deep-link to a
  // sub-mode. Was panel-local useState before Session 2.1.
  const mode = useToolStore((s) => s.resizeMode);
  const setMode = useToolStore((s) => s.setResizeMode);
  // A/B Compare stays locked until the user actually applies an edit —
  // either "Apply Compression & Resize" or "Auto Compress" — in this photo.
  // Pending (unapplied) changes no longer unlock it; there's nothing to
  // compare against until something is committed. Reset per photo below.
  const [appliedHere, setAppliedHere] = useState(false);
  const baseQualityRef = useRef(quality);
  const baseFormatRef = useRef(exportFormat);
  const baseMethodRef = useRef(method);

  useEffect(() => {
    setWidth(String(imageWidth));
    setHeight(String(imageHeight));
    baseQualityRef.current = quality;
    baseFormatRef.current = exportFormat;
    baseMethodRef.current = method;
    setAppliedHere(false);
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
      setAppliedHere(true);
    }
  };

  const handleAutoCompress = (scope: "selected" | "all") => {
    onAutoCompress(scope);
    setAppliedHere(true);
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
  // A/B compare unlocks only after an edit is *applied* in this photo —
  // Apply Compression & Resize or Auto Compress (`appliedHere`), or an edit
  // already on the photo (`hasBeenModified`). Pending changes don't count.
  const compareDisabled = disabled || !(hasBeenModified || appliedHere);

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
    <div className="flex flex-col h-full -mt-2">
      {/* [Compress] | [Resize] — the shared ToolModeToggle (icon-top tiles +
          title-below + body slot, same template as Paint). `mt-0` cancels the
          toggle's baked-in -mt-2 (this panel's outer flex column already
          carries it); `flex-1` keeps the shared footer pinned to the bottom
          exactly like the old `space-y-8 flex-1 mt-2.5` content wrapper. */}
      <ToolModeToggle
        modes={RESIZE_MODES}
        activeMode={mode}
        onModeChange={setMode}
        className="flex-1 mt-0"
      >
        {(m) =>
          m === "resize" ? (
            <DimensionFields
              width={width}
              height={height}
              widthPercent={widthPercent}
              lockAspect={lockAspect}
              disabled={disabled}
              onWidthChange={handleWidthChange}
              onHeightChange={handleHeightChange}
              onPercentChange={handlePercentChange}
              onToggleLock={() => setLockAspect((v) => !v)}
            />
          ) : (
            <>
              {/* ── Method / Format side by side to save vertical space ── */}
              <div className="grid grid-cols-2 gap-3">
                {/* ── Method ── */}
                <div className="space-y-4">
                  <label className="text-2xs text-theme-muted-foreground">
                    Method
                  </label>
                  <div className="relative">
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as ResampleMethod)}
                      disabled={disabled}
                      className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-xs text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
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
                  <label className="text-2xs text-theme-muted-foreground">
                    Format
                  </label>
                  <div className="relative">
                    <select
                      value={exportFormat}
                      onChange={(e) =>
                        onExportFormatChange(e.target.value as ExportFormat)
                      }
                      disabled={disabled}
                      className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-xs text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
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
                labelInfo="Lower quality = smaller file. Drag & release — recalculates Web Performance Gain and PageSpeed Insights Score below."
                value={quality}
                onChange={handleQualityChange}
                min={10}
                max={100}
                unit="%"
              />

              {/* EXIF keep/strip moved to Settings → Security. */}

              {/* ── Web Performance Gain ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-2xs">
                  <span className="flex items-center gap-1 text-theme-muted-foreground">
                    Web Performance Gain
                    <InfoTooltip
                      info="Estimated byte savings vs. the current file, based on the pending size/quality/format below."
                      label="Web Performance Gain"
                    />
                  </span>
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
                <div className="flex items-center justify-between text-2xs">
                  <span className="flex items-center gap-1 text-theme-muted-foreground">
                    PageSpeed Insights Score
                    <InfoTooltip
                      info="Estimated Lighthouse score (0–100) for the pending output — weighs dimensions, format, and quality the way the real audit does."
                      label="PageSpeed Insights Score"
                    />
                  </span>
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
            </>
          )
        }
      </ToolModeToggle>

      {/* ── Bottom Buttons ── */}
      <div className="border-t border-theme-sidebar-border pt-4 mt-8 space-y-2">
        <Button size="large"
          onClick={handleApplyResize}
          disabled={disabled || !resizeChanged}
          className="w-full"
        >
          <Scaling className="h-4 w-4" />
          Apply Compression &amp; Resize
        </Button>

        {/* A/B Compare — same Button size="large", locked until an edit is applied via
            Apply Compression & Resize or Auto Compress. Shows the active ring
            when the compare overlay is on. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button size="large"
                onClick={onToggleCompare}
                disabled={compareDisabled}
                aria-pressed={compareActive}
                className={
                  compareActive
                    ? "w-full bg-theme-primary/15 border-theme-primary/40 text-theme-primary"
                    : "w-full"
                }
              >
                <SlidersHorizontal className="h-4 w-4" />
                {compareActive ? "Hide A/B Compare" : "Show A/B Compare"}
              </Button>
            </div>
          </TooltipTrigger>
          {compareDisabled && (
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              <p className="text-xs">
                Apply Compression &amp; Resize or Auto Compress first, then use
                A/B compare to see the difference vs. the original.
              </p>
            </TooltipContent>
          )}
        </Tooltip>

        <hr className="border-theme-sidebar-border" />

        {/* ── Auto Compress & Resize: labelled section with explicit scope buttons.
            The name says "& Resize" because that is what it does — since v7.22 it
            also shrinks anything over 2500px on a side. Calling it "Auto Compress"
            hid a resize from the person clicking it. ── */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold font-mono text-theme-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          Auto Compress &amp; Resize
          <InfoTooltip
            label="Auto Compress & Resize"
            info={
              <>
                One click, aiming at a web-ready file (~200&nbsp;KB): it re-encodes the
                photo, and if either side is over <strong>2500&nbsp;px</strong> it scales the
                image down as well — big photos can&rsquo;t hit a PageSpeed-grade size on
                quality alone.
                <br />
                <br />
                It stops at 1280&nbsp;px on the long edge, so it will never shrink a photo to
                mush chasing the target. The green badge on the thumbnail shows what you
                saved.
              </>
            }
          />
        </div>
        {/* Compression progress is surfaced via a sonner toast, not inline.
            "Compress Image" compresses whatever is in the ring — enabled as long
            as a photo is active (disabled handles the empty-gallery case). The
            "All Images" button is hidden when the gallery holds a single image. */}
        <div className={totalCount > 1 ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
          <Button size="large"
            onClick={() => handleAutoCompress("selected")}
            disabled={disabled || isCompressing}
            className="w-full"
          >
            {isCompressing
              ? "Compressing…"
              : selectedCount > 1
                ? "Compress Images"
                : "Compress Image"}
          </Button>
          {totalCount > 1 && (
            <Button size="large"
              onClick={() => handleAutoCompress("all")}
              disabled={disabled || isCompressing}
              className="w-full"
            >
              {isCompressing ? "Compressing…" : "Compress All Images"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
