// ===== FILE: app/src/features/tools/settings/ResizeSettings.tsx =====
import { useCallback, useEffect, useRef, useState } from "react";
import { Scaling, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canEncode } from "@/lib/encodeSupport";
import { DimensionFields } from "@/components/DimensionFields";
import { SizeSlider } from "@/components/ui/size-slider";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getWebPerfMetrics, webTargetBytes } from "@/lib/webPerf";
import type { ExportFormat } from "@/lib/exportImage";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";

/** The seam between this panel's sections — the same rule its footer draws,
 *  and the same `border-t border-theme-sidebar-border` four other settings
 *  panels use for theirs. */
const SECTION_SEP = "border-t border-theme-sidebar-border pt-4";

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

/** What each kernel is FOR — a tooltip, since the label alone does not say. */
const METHOD_TITLES: Record<ResampleMethod, string> = {
  lanczos3: "Sharpest. The best downscale, and the default.",
  "catmull-rom": "Slightly softer than Lanczos3, a little faster.",
  nearest: "Hard pixel edges. For pixel art and flat colour.",
};

/** The four quick values above the Quality track — the same preset row Paint's
 *  Opacity and Hardness use. 100 is not among them; see the SizeSlider below. */
const QUALITY_PRESETS = [50, 70, 80, 90] as const;

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
  /** Quality the current file was last lossy-encoded at; undefined when
   *  unknown (an untouched upload) or lossless. */
  currentEncodeQuality?: number;
  activePhotoId: string | null;
  quality: number;
  onQualityChange: (q: number) => void;
  /** Fired on slider RELEASE — commits the quality as one undo step.
   *  ADR-031: `onQualityChange` is the live draft and records nothing. */
  onQualityCommit: (q: number) => void;
  /** Apply Compression & Resize: resample to w×h with the given Rust filter
   *  code, then re-encode at the panel's format + quality. */
  onResize: (w: number, h: number, filter: number) => void;
  /** Apply Resize: the same Rust resample, re-encoded in the photo's OWN format
   *  at full quality — the dimensions change and nothing else does. */
  onResizeOnly: (w: number, h: number, filter: number) => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (f: ExportFormat) => void;
  compressProgress: { completed: number; total: number };
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
  currentEncodeQuality,
  activePhotoId,
  quality,
  onQualityChange,
  onQualityCommit,
  onResize,
  onResizeOnly,
  exportFormat,
  onExportFormatChange,
}: ResizeSettingsProps) {
  const [width, setWidth] = useState(String(imageWidth));
  const [height, setHeight] = useState(String(imageHeight));
  const [lockAspect, setLockAspect] = useState(true);
  const [method, setMethod] = useState<ResampleMethod>("lanczos3");
  // Sub-mode lives in the tool store (like Paint's brushMode) so the command
  // palette's registry-derived `mode.compress.*` entries can deep-link to a
  // sub-mode. Was panel-local useState before Session 2.1.
  const baseQualityRef = useRef(quality);
  const baseFormatRef = useRef(exportFormat);
  const baseMethodRef = useRef(method);

  // Whether the browser can really encode the chosen format. `undefined` until
  // the one-pixel probe resolves — the note simply stays hidden until then
  // rather than flashing a wrong answer.
  const [avifOk, setAvifOk] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void canEncode("image/avif").then((ok) => {
      if (live) setAvifOk(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  // The format that will actually be written. Chrome answers an AVIF request
  // with PNG (silently — see lib/encodeSupport.ts), so every number derived
  // from "the chosen format" has to be derived from this instead.
  const effectiveFormat: ExportFormat =
    exportFormat === "avif" && avifOk === false ? "png" : exportFormat;

  // A quiet line under the picker. Information, not a warning: PNG being large
  // is correct behavior, and the surprise it causes is only that the status
  // bar shows the SOURCE size while a lossless re-encode lands on disk.
  const formatNote =
    exportFormat === "png"
      ? "Lossless — the largest file, and larger than the source for photos. Quality does not apply, so the slider below is off."
      : exportFormat === "avif" && avifOk === false
        ? "This browser can't encode AVIF — the file will be saved as PNG."
        : null;

  useEffect(() => {
    setWidth(String(imageWidth));
    setHeight(String(imageHeight));
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

  /** Resize only. Deliberately does NOT touch baseQualityRef / baseFormatRef:
   *  those track what the COMPRESSION button has committed, and a resize leaves
   *  a pending quality change still pending. */
  const handleApplyResizeOnly = () => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (w > 0 && h > 0 && (w !== imageWidth || h !== imageHeight)) {
      onResizeOnly(w, h, FILTER_CODE[method]);
      baseMethodRef.current = method;
    }
  };


  const handleQualityChange = (val: number) => {
    onQualityChange(val);
  };

  // Was `<`, so only LOWERING quality counted as a pending change: dragging
  // 75 → 90 left the apply button dark, recorded nothing, and moved neither
  // score. Raising the quality is a compression exactly as much as lowering it
  // is, so this is a plain inequality.
  const qualityChanged = quality !== baseQualityRef.current;
  const formatChanged = exportFormat !== baseFormatRef.current;
  const methodChanged = method !== baseMethodRef.current;
  /** PNG is lossless, so `encodeQuality` is not consulted at all on the write
   *  path (`usePersistActiveCanvas`: `const lossy = encodeFormat !== "png"`).
   *  Method has no resample to choose between unless the dimensions moved, so
   *  neither of those two can change the bytes when they are what changed.
   *
   *  Both used to feed `compressionChanged` anyway, which lit the apply button
   *  and let it claim a compression that did not happen. */
  const methodCounts =
    methodChanged && (parseInt(width, 10) !== imageWidth || parseInt(height, 10) !== imageHeight);
  const formatCounts = formatChanged && exportFormat !== "png";
  /** Dimensions alone — what "Apply Resize" acts on. Separate from
   *  `resizeChanged` below, which also counts quality/format/method, because a
   *  resize-only button must stay dark when the only pending change is one it
   *  would silently discard. */
  const dimensionsChanged =
    parseInt(width, 10) !== imageWidth || parseInt(height, 10) !== imageHeight;
  const resizeChanged =
    parseInt(width, 10) !== imageWidth ||
    parseInt(height, 10) !== imageHeight ||
    qualityChanged ||
    formatCounts ||
    methodCounts;
  /** Compression alone — the mirror of `dimensionsChanged`. */
  const compressionChanged = qualityChanged || formatCounts || methodCounts;
  /** ONE apply button that names what it will actually do. Two buttons became
   *  wrong the moment the tiles merged: "Apply Resize" and "Apply Compression &
   *  Resize" sat next to each other, one of them almost always dark, and
   *  neither label told you which of your pending changes it would commit.
   *
   *  Dimensions ONLY routes to `handleApplyResizeOnly`, which re-saves in the
   *  photo's own format at full quality — the quality slider is deliberately
   *  left alone, which is the whole reason that handler exists. Every other
   *  case commits everything pending. */
  const applyResizeOnly = dimensionsChanged && !compressionChanged;
  const applyLabel = applyResizeOnly
    ? "Apply Resize"
    : compressionChanged && !dimensionsChanged
      ? "Apply Compression"
      : "Apply Compression & Resize";
  // Web-performance indicators come from Rust (`web_perf_metrics`). The
  // PageSpeed Insights score is byte-aware: a big, still-uncompressed photo
  // scores low, and resizing or lowering quality (smaller projected delivery)
  // raises it.
  //
  // The model must mirror what the Apply button will ACTUALLY write, or the
  // numbers lie in both directions:
  //   - nothing pending, or dimensions only ("Apply Resize"): the file keeps
  //     its own format and quality, so the projection is the current bytes
  //     scaled by area. This used to multiply by quality/100 regardless, so an
  //     already-compressed photo was scored as if it would shrink another 25%
  //     at the default 75 — and then Apply Resize wrote something bigger.
  //   - compression pending: quality is RELATIVE to the quality the file is
  //     already at. A file stored at q=60 re-encoded at q=50 does not lose
  //     half its bytes. Unknown (an untouched upload) counts as 100, which is
  //     the old absolute model.
  const qualityApplies = qualityChanged && exportFormat !== "png";
  const modelQuality = qualityApplies
    ? Math.min(100, Math.round((quality * 100) / (currentEncodeQuality ?? 100)))
    : 100;
  const modelFormat: ExportFormat | undefined = compressionChanged
    ? effectiveFormat
    : undefined;
  const newW = parseInt(width, 10) || imageWidth;
  const newH = parseInt(height, 10) || imageHeight;
  const [budgetUsed, setBudgetUsed] = useState(0);
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
      quality: modelQuality,
      curMime: currentMime,
      // Model the format that will ACTUALLY land, not the one requested. AVIF
      // weights as the most efficient format in the Rust scorer, so an AVIF
      // selection the browser cannot encode would promise a large gain and then
      // write a PNG — the panel contradicting its own note one line below.
      // Undefined with no compression pending: the file keeps its own format.
      newFormat: modelFormat,
    }).then((m) => {
      if (!alive) return;
      setBudgetUsed(m.budgetUsed);
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
    modelQuality,
    modelFormat,
    // effectiveFormat, not exportFormat: the AVIF probe resolves asynchronously,
    // so the first render models AVIF and only the re-run after `avifOk` lands
    // corrects it. Depending on exportFormat alone would leave the AVIF numbers
    // on screen permanently, since exportFormat never changed. (It reaches
    // the call through `modelFormat`.)
  ]);

  return (
    <div className="flex flex-col h-full -mt-2">
      {/* ONE tile, not two. Compress and Resize were separate sub-modes
          behind a ToolModeToggle, and both of them move the SAME two
          numbers: Web Performance Gain and PageSpeed Insights Score are a
          function of dimensions AND format/quality together. Split across
          two tiles, the scores sat under one while half their inputs sat
          under the other. Squoosh keeps the whole pipeline on one panel for
          the same reason.

          Order is scores -> resize -> compress: the readout you are steering
          toward sits above the controls that steer it, and resize precedes
          compress because that is the order the pixels actually go through. */}
      <div className="flex-1 space-y-8 mt-2.5">
        {/* Both scores, 16px apart — what the compress body gave them before
            the tiles merged (its ToolModeToggle slot was space-y-4). The
            32px section gap below is between GROUPS, not inside one. */}
        <div className="space-y-4">
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

        {/* ── PageSpeed budget, as a percentage USED ──
            This is Lighthouse's actual rule (`bytes <= pixels / 6`) expressed
            as a share of the budget, so it keeps the 0–100 shape while meaning
            something true. It is not a Lighthouse score — that does not exist
            for a single image — so the label says what it is.

            OVER 100 is the useful case, and the bar has to show it: a
            percentage of budget used has no ceiling to normalise against, so
            anything above 100 draws full and the number carries the rest.
            Clamping the bar's width at 100 is why the label matters. */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-2xs">
            <span className="flex items-center gap-1 text-theme-muted-foreground">
              PageSpeed budget used
              <InfoTooltip
                info={`The pending output against the size Google PageSpeed stops flagging: ${Math.round(webTargetBytes(newW, newH) / 1024)} KB for ${newW}×${newH}. At 100% or less it passes; above that it is over by this much.`}
                label="PageSpeed budget used"
              />
            </span>
            <span className="text-theme-foreground tabular-nums">
              {budgetUsed}%
            </span>
          </div>
          <div className="h-2 w-full bg-theme-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ease-out ${trafficColor(budgetUsed)}`}
              // Clamped: over budget is the failure state and draws the bar
              // full; the percentage beside it carries how far over. A bar
              // that overflowed its own track would read as a broken width.
              style={{ width: `${Math.min(100, budgetUsed)}%` }}
            />
          </div>
          {budgetUsed > 100 && (
            <p className="text-2xs leading-snug text-destructive">
              Over what Google PageSpeed allows for this size — pick a smaller
              size, a lower quality, or WebP or AVIF.
            </p>
          )}
        </div>
        </div>

        {/* Header → first control is 16px in every section, the spacing
            Select › Magic Wand › Tolerance already uses; the merge had left
            it at 32 here and 39 under Compress. The border is this panel's own
            footer rule (and four other panels' section seam) — one line
            between the scores, Resize and Compress. */}
        <div className={`space-y-4 ${SECTION_SEP}`}>
        <SectionHeader
          title="Resize"
          info="Sets new pixel dimensions. The lock keeps the aspect ratio; the percent slider scales width and height proportionally. Apply Resize changes dimensions only — Apply Compression &amp; Resize commits both."
        />
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

        </div>

        <div className={`space-y-4 ${SECTION_SEP}`}>
        <SectionHeader
          title="Compress"
          info="Shrinks the file size: pick a resample Method and output Format, then drag Quality. The two scores above preview the pending output — Apply Compression &amp; Resize commits it."
        />
        {/* ── Method / Format as tile groups ──
            Both were <SelectField>s, which cannot say why a control is off.
            Method is only meaningful on a click that also resamples — the
            resize-only path (`keepSourceEncoding`) never calls
            `resize_with_filter` at all — so it now states that in place of
            choosing a resample kernel that will not run. And Format is four
            exclusive choices, which is what `ToolButtonGroup`'s SELECT mode
            exists for; as a native <select> it announced nothing about which
            one was lit. */}
        <div className="space-y-4">
          <ToolButtonGroup<ResampleMethod>
            label="Method"
            columns={3}
            value={method}
            onChange={setMethod}
            aria-describedby="method-note"
            options={(Object.keys(METHOD_LABELS) as ResampleMethod[]).map((m) => ({
              id: m,
              label: METHOD_LABELS[m],
              title: METHOD_TITLES[m],
              // Only a resample reads this. With the dimensions unchanged the
              // filter code is passed in and never used, so offering a choice
              // here was offering a control that does nothing.
              disabled: !dimensionsChanged,
            }))}
          />
          <p
            id="method-note"
            className="text-2xs leading-relaxed text-theme-muted-foreground"
          >
            {dimensionsChanged
              ? "Applied by resampling the pixels on the way out."
              : "The filter the resample will use. Change the dimensions above to turn this on."}
          </p>
        </div>

        <div className="space-y-4">
          <ToolButtonGroup<ExportFormat>
            label="Format"
            columns={4}
            value={exportFormat}
            onChange={onExportFormatChange}
            aria-describedby="format-note"
            options={(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => ({
              id: f,
              label: FORMAT_LABELS[f],
              disabled: f === "avif" && avifOk === false,
            }))}
          />
          <p
            id="format-note"
            className="text-2xs leading-relaxed text-theme-muted-foreground"
          >
            {formatNote ??
              "WebP and AVIF are what the web-performance check below is measured against."}
          </p>
        </div>

        {/* ── Quality ──
            The preset row is the same primitive Paint's Opacity and Hardness
            use (`variant="numbers"`), so the four quick values are a named
            radio group above the track rather than four unlabelled buttons.

            Presets turn the input's own value into a TRACK POSITION (0–100,
            each preset an equal segment), which `SizeSlider` maps both ways and
            `aria-valuetext` carries the real number. 80 therefore sits at
            position 67 — visible in the knob, but announced as 80.

            100 is deliberately not a preset: on this panel it is the setting
            that made a resize-only re-encode heavier than the file it replaced
            (see `usePersistActiveCanvas`, which keeps the source quality for
            exactly that reason). */}
        <SizeSlider
          label="Quality"
          labelInfo="Lower quality = smaller file. Drag & release — recalculates Web Performance Gain and PageSpeed Insights Score below."
          value={quality}
          onChange={handleQualityChange}
          onCommit={onQualityCommit}
          presets={QUALITY_PRESETS}
          variant="numbers"
          min={10}
          max={100}
          unit="%"
          disabled={disabled || exportFormat === "png"}
          reason={
            exportFormat === "png"
              ? "PNG is lossless — quality does not apply to it. Pick JPEG, WebP or AVIF to compress."
              : undefined
          }
        />

        {/* EXIF keep/strip moved to Settings → Security. */}

        </div>
      </div>

      {/* ── Bottom Buttons ── */}
      {/* `mt-panel`, not `mt-8`: 32px above this rule left a band of dead space
          under the Quality slider while the rule itself sat nowhere near either
          neighbour. One panel inset on each side of the rule reads as a
          separator rather than a gap. */}
      <div className="border-t border-theme-sidebar-border pt-panel mt-panel space-y-2">
        {/* ONE apply button, labeled for what is actually pending. It says
            "Apply Resize" when only the dimensions moved, "Apply Compression"
            when only quality/format/method moved, and "Apply Compression &
            Resize" when both did — which is also the disabled resting label,
            because with nothing pending there is nothing to name. It is what
            commits in every case. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button size="large"
                onClick={applyResizeOnly ? handleApplyResizeOnly : handleApplyResize}
                disabled={disabled || !resizeChanged}
                // The longest label is 26 characters; at this width it was
                // breaking at the ampersand into two lines and a 38px button.
                className="w-full whitespace-nowrap"
              >
                {applyResizeOnly ? (
                  <Scaling className="h-4 w-4" />
                ) : (
                  <FileArchive className="h-4 w-4" />
                )}
                {applyLabel}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-center">
            <p className="text-xs">
              {!resizeChanged
                ? "Change the dimensions, or the quality, format or method, and this commits it."
                : applyResizeOnly
                  ? "Changes the pixel dimensions only — re-saved in this photo's own format at full quality, so the quality slider is left alone."
                  : compressionChanged && !dimensionsChanged
                    ? "Re-encodes at the chosen format and quality. The dimensions are unchanged."
                    : "Commits both the new dimensions and the new format and quality."}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
