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
import { getImageWeight, type ImageWeight } from "@/lib/webPerf";
import type { ExportFormat } from "@/lib/exportImage";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ControlRow } from "@/components/ui/control-row";

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

/** Encode the pending output exactly as Apply would; resolves its real size. */
export type MeasureApply = (req: {
  w: number;
  h: number;
  filter: number;
  exportFormat: ExportFormat;
  quality: number;
  keepSourceEncoding: boolean;
}) => Promise<{ bytes: number; kept: boolean } | null>;

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
  /** Commit everything pending (size, format, quality). */
  /** Resolves `true` when the stored file changed. */
  onResize: (w: number, h: number, filter: number) => Promise<boolean> | void;
  /** Apply Resize: the same Rust resample, re-encoded in the photo's OWN format
   *  at full quality — the dimensions change and nothing else does. */
  onResizeOnly: (w: number, h: number, filter: number) => Promise<boolean> | void;
  measureApply?: MeasureApply;
  exportFormat: ExportFormat;
  onExportFormatChange: (f: ExportFormat) => void;
  compressProgress: { completed: number; total: number };
}

function kb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  measureApply,
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
  const avifUnsupported = exportFormat === "avif" && avifOk === false;

  // The fields follow the photo's size. The compression BASELINE follows only
  // the photo: re-seeding it on a size change made "Apply Resize" quietly
  // drop a quality change that was still pending.
  useEffect(() => {
    setWidth(String(imageWidth));
    setHeight(String(imageHeight));
  }, [imageWidth, imageHeight, activePhotoId]);
  useEffect(() => {
    baseQualityRef.current = quality;
    baseFormatRef.current = exportFormat;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed per photo only
  }, [activePhotoId]);

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

  const w = parseInt(width, 10);
  const h = parseInt(height, 10);
  const dimsValid = w > 0 && h > 0;
  const newW = dimsValid ? w : imageWidth;
  const newH = dimsValid ? h : imageHeight;
  const dimensionsChanged = dimsValid && (w !== imageWidth || h !== imageHeight);

  // What counts as a pending COMPRESSION (10-07):
  //   - format: any change, PNG included. Choosing PNG alone used to leave
  //     Apply dark, because PNG was excluded from "counts".
  //   - quality: only when the output is lossy — PNG never reads it.
  //   - method: never. It picks the resample kernel, which both Apply paths
  //     use; counting it as compression sent a method-only change down the
  //     compression path, which saves in the panel's format — so picking
  //     Catmull-Rom turned a PNG into a JPEG.
  const formatChanged = exportFormat !== baseFormatRef.current;
  const qualityChanged = quality !== baseQualityRef.current && effectiveFormat !== "png";
  const compressionChanged = formatChanged || qualityChanged;
  const pending = dimensionsChanged || compressionChanged;

  // The label names exactly what will be committed — "Resize" appears only
  // when the dimensions moved. At rest it is just "Apply", not a long label
  // greyed out that reads like something half-happened.
  const applyLabel = dimensionsChanged
    ? compressionChanged
      ? "Apply Resize & Compression"
      : "Apply Resize"
    : compressionChanged
      ? "Apply Compression"
      : "Apply";

  const [applying, setApplying] = useState(false);
  const handleApply = async () => {
    if (!pending || applying) return;
    setApplying(true);
    try {
      const filter = FILTER_CODE[method];
      if (!compressionChanged) {
        await onResizeOnly(newW, newH, filter);
        return;
      }
      // The compression baseline moves only when the stored file actually
      // changed — a declined re-encode leaves the change pending, so the
      // button still says what has not happened yet.
      if ((await onResize(newW, newH, filter)) !== false) {
        baseQualityRef.current = quality;
        baseFormatRef.current = exportFormat;
      }
    } finally {
      setApplying(false);
    }
  };

  // ── The two readings (10-07) ────────────────────────────────────────────
  // "PageSpeed Insights Score" is gone: Google has no score for one image —
  // its performance score is built from page-load metrics. What it DOES say
  // about an image is a pass/fail weight rule (lib/webPerf `getImageWeight`),
  // so that is what this shows: estimated KB against Google's limit for the
  // output's pixel count. Quality is modelled RELATIVE to what the file is
  // stored at, and may exceed 100% — raising q50 to q90 makes it bigger.
  const relativeQuality = qualityChanged
    ? Math.round((quality * 100) / (currentEncodeQuality ?? 100))
    : 100;
  const modelFormat: ExportFormat | undefined = compressionChanged ? effectiveFormat : undefined;
  const [weight, setWeight] = useState<ImageWeight | null>(null);
  useEffect(() => {
    let alive = true;
    void getImageWeight({
      curW: imageWidth,
      curH: imageHeight,
      curBytes: currentByteSize,
      origBytes: originalByteSize,
      newW,
      newH,
      relativeQuality,
      curMime: currentMime,
      newFormat: modelFormat,
    }).then((r) => {
      if (alive) setWeight(r);
    });
    return () => {
      alive = false;
    };
  }, [imageWidth, imageHeight, currentByteSize, currentMime, originalByteSize, newW, newH, relativeQuality, modelFormat]);

  // The real number: encode what Apply would write and count it. Debounced
  // so a drag measures once it settles, not per pixel of travel; the formula
  // estimate above holds the readout (marked "≈") until the measurement lands.
  const [measured, setMeasured] = useState<{ key: string; bytes: number; kept: boolean } | null>(null);
  const measureKey = `${activePhotoId}:${currentByteSize}:${newW}x${newH}:${method}:${modelFormat ?? "same"}:${compressionChanged ? quality : "src"}`;
  useEffect(() => {
    if (!pending || !measureApply || currentByteSize <= 0) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void measureApply({
        w: newW,
        h: newH,
        filter: FILTER_CODE[method],
        exportFormat,
        quality,
        keepSourceEncoding: !compressionChanged,
      })
        .then((m) => {
          if (alive && m) setMeasured({ key: measureKey, bytes: m.bytes, kept: m.kept });
        })
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measureKey carries every input
  }, [measureKey, pending, measureApply]);

  const isMeasured = !pending || measured?.key === measureKey;
  const bytes = !pending ? currentByteSize : isMeasured && measured ? measured.bytes : (weight?.projectedBytes ?? 0);
  const limitBytes = weight?.limitBytes ?? 0;
  const known = currentByteSize > 0 && weight !== null;
  const pass = known && bytes <= limitBytes;
  const usedPct = known && limitBytes > 0 ? (bytes / limitBytes) * 100 : 0;
  const gain = known && originalByteSize > 0 ? Math.round((1 - bytes / originalByteSize) * 100) : 0;
  // Only a same-size re-encode is declined for growing; a resize always writes.
  const wouldGrow = known && compressionChanged && !dimensionsChanged && (isMeasured && measured ? measured.kept : bytes > currentByteSize);

  return (
    <div className="flex flex-col h-full">
      {/* Order is readings -> resize -> compress: the readout you steer toward
          sits above the controls that steer it, and resize precedes compress
          because that is the order the pixels go through. */}
      <div className="flex-1 space-y-8">
        <div className="space-y-4">
          <div className="space-y-2" data-testid="image-weight">
            <ControlRow
              label="Image weight"
              info={
                known
                  ? `The size of the file Apply would write — measured by encoding it, not guessed ("≈" while it measures) — against what Google's image check allows for ${newW}×${newH}: ${kb(limitBytes)} (one byte per six pixels, plus 4 KB). Over that, PageSpeed lists it under "Improve image delivery". It can't know how big the image is shown on your page, so a photo much wider than its spot can still be flagged for size.`
                  : "The size of the file Apply would write, against what Google's image check allows."
              }
              value={
                known ? (
                  <span className={pass ? "text-success" : "text-destructive"} aria-live="polite">
                    {isMeasured ? "" : "≈ "}
                    {kb(bytes)} / {kb(limitBytes)} · {pass ? "Pass" : "Over"}
                  </span>
                ) : (
                  "—"
                )
              }
            >
              <div className="h-2 w-full bg-theme-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ease-out ${pass ? "bg-success" : "bg-destructive"}`}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
              </div>
            </ControlRow>
          </div>
          <ControlRow
            label="Smaller than upload"
            info="How much smaller the file Apply would write is than the photo you uploaded. Negative means bigger."
            value={known ? `${gain > 0 ? "+" : ""}${gain}%` : "—"}
          >
            <div className="h-2 w-full bg-theme-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ease-out ${gain >= 50 ? "bg-success" : gain > 0 ? "bg-warning" : "bg-destructive"}`}
                style={{ width: `${Math.max(0, Math.min(100, gain))}%` }}
              />
            </div>
          </ControlRow>
        </div>

        <div className={`space-y-4 ${SECTION_SEP}`}>
          <SectionHeader
            title="Resize"
            info="New pixel size for the photo. The lock keeps its shape; the percent slider scales both sides."
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
            edited={{
              isEdited: dimensionsChanged,
              onReset: () => {
                setWidth(String(imageWidth));
                setHeight(String(imageHeight));
              },
              disabled,
            }}
          />
          {/* Never disabled: it is the kernel the NEXT resize will use. A
              disabled row showed the not-allowed cursor right above the
              Quality slider, which read as the slider being broken. */}
          <ControlRow
            label="Method"
            info="How pixels are resampled when the size changes. Lanczos3 is sharpest; Nearest keeps hard pixel edges for pixel art. It doesn't change the file format."
          >
            {({ labelId }) => (
              <ToolButtonGroup<ResampleMethod>
                aria-labelledby={labelId}
                columns={3}
                value={method}
                onChange={setMethod}
                options={(Object.keys(METHOD_LABELS) as ResampleMethod[]).map((m) => ({
                  id: m,
                  label: METHOD_LABELS[m],
                  title: METHOD_TITLES[m],
                }))}
              />
            )}
          </ControlRow>
        </div>

        <div className={`space-y-4 ${SECTION_SEP}`}>
          <SectionHeader
            title="Compress"
            info="Pick the output Format, then drag Quality. The readings above preview the file Apply would write."
          />
          <ControlRow
            label="Format"
            info="WebP and AVIF are smallest for photos. JPEG works everywhere. PNG is lossless and the largest — quality doesn't apply to it."
            reason={avifUnsupported ? "This browser can't encode AVIF — it would save as PNG." : undefined}
          >
            {({ labelId, reasonId }) => (
              <ToolButtonGroup<ExportFormat>
                aria-labelledby={labelId}
                aria-describedby={reasonId}
                columns={4}
                value={exportFormat}
                onChange={onExportFormatChange}
                options={(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => ({
                  id: f,
                  label: FORMAT_LABELS[f],
                  disabled: f === "avif" && avifOk === false,
                }))}
              />
            )}
          </ControlRow>
          {/* Presets map to TRACK POSITIONS; `SizeSlider` maps both ways and
              commits the mapped value on release. 100 is not a preset: it is
              what made a resize-only re-encode heavier than its source. */}
          <SizeSlider
            label="Quality"
            labelInfo="Lower is smaller. Relative to the quality the photo is stored at now."
            value={quality}
            onChange={onQualityChange}
            onCommit={onQualityCommit}
            presets={QUALITY_PRESETS}
            variant="numbers"
            min={10}
            max={100}
            unit="%"
            disabled={disabled || effectiveFormat === "png"}
            reason={effectiveFormat === "png" ? "Not used by PNG." : undefined}
          />
        </div>
      </div>

      <div className="border-t border-theme-sidebar-border pt-panel mt-panel space-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                size="large"
                onClick={() => void handleApply()}
                disabled={disabled || !pending || applying}
                aria-busy={applying || undefined}
                className="w-full whitespace-nowrap"
              >
                {dimensionsChanged && !compressionChanged ? (
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
              {!pending
                ? "Change the size, format or quality first."
                : wouldGrow
                  ? "The result would be bigger than the file is now, so it won't be written."
                  : dimensionsChanged && !compressionChanged
                    ? "Changes the size only. Saved in this photo's own format and quality."
                    : compressionChanged && !dimensionsChanged
                      ? "Re-saves at the chosen format and quality. Same size."
                      : "Changes the size and re-saves at the chosen format and quality."}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
