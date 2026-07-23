import { useState } from "react";
import type { MutableRefObject } from "react";
import { ChevronDown, Type, PaintBucket, ScanText, Lock, Copy } from "lucide-react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { SectionHeader } from "@/components/ui/section-header";
import { PlacementGrid, type PlacementCell } from "@/components/PlacementGrid";
import { Spinner } from "@/components/ui/spinner";
import { useAIJob } from "@/hooks/useAIJob";

const FONT_FAMILIES = [
  { label: "Sans Serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Comic Sans", value: "Comic Sans MS, cursive" },
  { label: "Trebuchet", value: "Trebuchet MS, sans-serif" },
  { label: "Palatino", value: "Palatino, serif" },
] as const;

const FONT_SIZE_PRESETS = [16, 32, 48, 72] as const;

const SHADOW_MODE_OPTIONS = [
  { id: "off", label: "Off" },
  { id: "box", label: "Box" },
  { id: "text", label: "Text" },
  { id: "both", label: "Both" },
] as const;

const BG_KIND_OPTIONS = [
  { id: "none", label: "None" },
  { id: "rect", label: "Text BG" },
  { id: "bubble", label: "Bubble" },
] as const;

// Corner style as three presets instead of a free slider. Discrete radii keep
// the bubble-tail geometry simple/flush (see Rust `build_annotation_tile`):
// Square = sharp, Rounded = fixed radius, Circle = pill (Rust/CSS clamp the
// large value to half the shorter side).
type CornerId = "circle" | "rounded" | "square";
const BG_CORNER_OPTIONS = [
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
] as const;
const CORNER_RADIUS: Record<CornerId, number> = {
  square: 0,
  rounded: 16,
  circle: 999, // pill sentinel — clamped to min(w,h)/2 when rendered
};
const cornerIdFromRadius = (r: number): CornerId =>
  r <= 0 ? "square" : r >= 200 ? "circle" : "rounded";

export interface TextMemory {
  id: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  textColor: string;
}

type TextMode = "text" | "background" | "ocr";

const MODE_OPTIONS: readonly ToolMode<TextMode>[] = [
  {
    id: "text",
    label: "Text",
    icon: Type,
    info: "Font, weight and colour for the text itself.",
  },
  {
    id: "background",
    label: "Background",
    icon: PaintBucket,
    info: "A fill behind the text — plain box or speech bubble, with padding, corners and a drop shadow.",
  },
  {
    id: "ocr",
    label: "OCR",
    icon: ScanText,
    info: "Read the text out of the photo (Replicate-backed) — extract, then copy it.",
  },
];

interface TextSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  /** Place the selected text into one of the nine grid cells. */
  onPlace?: (cell: PlacementCell) => void;
  /** A text is selected (created & selected / clicked / Reselect) → grid enabled. */
  canPlace?: boolean;
  /** OCR tab — same Replicate + Convex pipeline as the AI tool's Background
   *  Removal / Object Removal, just its own dedicated job instance (moved
   *  from AISettings.tsx: OCR is text-shaped, not image-shaped). */
  aiEnabled?: boolean;
  activePhotoId: string | null;
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
}

export function TextSettings({
  settings,
  onChange,
  onPlace,
  canPlace = false,
  aiEnabled = false,
  activePhotoId,
  stampToolRef,
}: TextSettingsProps) {
  const [mode, setMode] = useState<TextMode>("text");

  // OCR's own job instance — never runs an image model, so onImageResult is
  // genuinely a no-op here (useAIJob only calls it for rembg/upscale/inpaint;
  // text models surface solely through the returned textResult).
  const { run: runOcr, phase: ocrPhase, busy: ocrBusy, error: ocrError, textResult } =
    useAIJob(() => {});
  const [copied, setCopied] = useState(false);
  const canRunOcr = aiEnabled && !!activePhotoId && !!stampToolRef.current;

  const runOcrJob = () => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    const png = new Uint8Array(tool.export_png());
    setCopied(false);
    void runOcr("ocr", activePhotoId, png);
  };

  const copyOcrText = async () => {
    if (!textResult) return;
    try {
      await navigator.clipboard.writeText(textResult);
      setCopied(true);
    } catch {
      /* clipboard blocked - no-op */
    }
  };

  const activeModeInfo = MODE_OPTIONS.find((opt) => opt.id === mode);

  return (
    <div className="space-y-5 -mt-2" data-text-panel>
    <ToolButtonGroup
      stacked
      columns={3}
      options={MODE_OPTIONS}
      value={mode}
      onChange={setMode}
    />
    {activeModeInfo && (
      <SectionHeader title={activeModeInfo.label} info={activeModeInfo.info} />
    )}
    {(() => {
      const m = mode;
      return (
        <>
        {m === "text" && (
          <div className="space-y-5">
            {/* Font Size */}
            <SizeSlider
              label="Font Size"
              value={settings.fontSize}
              min={8}
              max={120}
              onChange={(v) => onChange({ ...settings, fontSize: v })}
              presets={FONT_SIZE_PRESETS}
              variant="numbers"
            />

            {/* Font Family */}
            <div className="space-y-4">
              <label className="text-2xs text-theme-muted-foreground">
                Font Family
              </label>
              <div className="relative">
                <select
                  value={settings.fontFamily ?? "sans-serif"}
                  onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                  className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-xs text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
                  style={{ fontFamily: settings.fontFamily ?? "sans-serif" }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted-foreground" />
              </div>
            </div>

            {/* Font Weight */}
            <ToolButtonGroup
              label="Font Weight"
              options={[
                { id: "normal", label: "Normal" },
                { id: "bold", label: "Bold" },
              ] as const}
              value={settings.fontWeight ?? "normal"}
              onChange={(id) => onChange({ ...settings, fontWeight: id })}
            />

            {/* Color */}
            <ColorSwatchGrid
              colors={TEXT_COLORS}
              value={settings.textColor}
              onChange={(color) => onChange({ ...settings, textColor: color })}
            />
          </div>
        )}

        {m === "background" && (
          <div className="space-y-5">
            {/* Style toggle */}
            <ToolButtonGroup
              label="Style"
              options={BG_KIND_OPTIONS}
              value={settings.bgKind}
              onChange={(id) => onChange({ ...settings, bgKind: id })}
              columns={3}
            />

            {settings.bgKind !== "none" && (
              <>
                {/* Background color */}
                <ColorSwatchGrid
                  label="Background Color"
                  colors={TEXT_COLORS}
                  value={settings.bgColor}
                  onChange={(color) => onChange({ ...settings, bgColor: color })}
                />

                {/* Padding */}
                <SizeSlider
                  label="Padding"
                  value={settings.bgPadding}
                  min={0}
                  max={40}
                  unit="px"
                  onChange={(v) => onChange({ ...settings, bgPadding: v })}
                />

                {/* Corner style — three presets, for both Text BG and Bubble. */}
                <ToolButtonGroup
                  label="Corners"
                  options={BG_CORNER_OPTIONS}
                  value={cornerIdFromRadius(settings.bgCornerRadius)}
                  onChange={(id) =>
                    onChange({ ...settings, bgCornerRadius: CORNER_RADIUS[id] })
                  }
                  columns={3}
                />

                {/* Tail direction — bubble only. Angle in degrees (0-359):
                    the slider sweeps the tail all the way around the bubble. */}
                {settings.bgKind === "bubble" && (
                  <SizeSlider
                    label="Tail Direction"
                    value={settings.bgTail}
                    min={0}
                    max={359}
                    unit="°"
                    onChange={(v) => onChange({ ...settings, bgTail: v })}
                  />
                )}

                {/* Opacity */}
                <SizeSlider
                  label="Opacity"
                  value={settings.bgOpacity}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => onChange({ ...settings, bgOpacity: v })}
                />
              </>
            )}

            {/* Drop shadow — soft, Rust-rendered. With a background, "Box" casts
                from the box/bubble and "Text" from the glyphs. With Background =
                None there's no box, so any shadow (Box/Text/Both) casts from the
                text silhouette — "Box" still produces a visible shadow. */}
            <ToolButtonGroup
              label="Drop Shadow"
              options={SHADOW_MODE_OPTIONS}
              value={
                settings.shadowBox && settings.shadowText
                  ? "both"
                  : settings.shadowBox
                    ? "box"
                    : settings.shadowText
                      ? "text"
                      : "off"
              }
              onChange={(id) =>
                onChange({
                  ...settings,
                  shadowBox: id === "box" || id === "both",
                  shadowText: id === "text" || id === "both",
                })
              }
              columns={4}
            />

            {(settings.shadowBox || settings.shadowText) && (
              <>
                <ColorSwatchGrid
                  label="Shadow Color"
                  colors={TEXT_COLORS}
                  value={settings.shadowColor}
                  onChange={(color) =>
                    onChange({ ...settings, shadowColor: color })
                  }
                />
                <SizeSlider
                  label="Shadow Opacity"
                  value={settings.shadowOpacity}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => onChange({ ...settings, shadowOpacity: v })}
                />
                <SizeSlider
                  label="Offset X"
                  value={settings.shadowOffsetX}
                  min={-20}
                  max={20}
                  unit="px"
                  onChange={(v) => onChange({ ...settings, shadowOffsetX: v })}
                />
                <SizeSlider
                  label="Offset Y"
                  value={settings.shadowOffsetY}
                  min={-20}
                  max={20}
                  unit="px"
                  onChange={(v) => onChange({ ...settings, shadowOffsetY: v })}
                />
                <SizeSlider
                  label="Blur"
                  value={settings.shadowBlur}
                  min={0}
                  max={30}
                  unit="px"
                  onChange={(v) => onChange({ ...settings, shadowBlur: v })}
                />
              </>
            )}
          </div>
        )}

        {m === "ocr" && (
          <div className="space-y-3">
            {!aiEnabled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <Lock className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <p className="text-2xs text-warning/90">
                  OCR needs <strong>sign-in</strong> + a <strong>Paid</strong> plan.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={runOcrJob}
              disabled={!canRunOcr || ocrBusy}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!aiEnabled && <Lock className="h-3.5 w-3.5" />}
              {ocrBusy && <Spinner size={14} />}
              {ocrPhase === "uploading"
                ? "Uploading..."
                : ocrPhase === "running"
                  ? "Reading text..."
                  : "Extract Text"}
            </button>
            {ocrError && (
              <p className="text-2xs text-destructive leading-relaxed">{ocrError}</p>
            )}
            {ocrPhase === "done" && !ocrError && (
              <div>
                {textResult && textResult.trim() ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xs text-theme-muted-foreground">
                        Extracted text
                      </span>
                      <button
                        type="button"
                        onClick={copyOcrText}
                        className="flex items-center gap-1 text-2xs text-theme-muted-foreground hover:text-theme-foreground"
                      >
                        <Copy className="h-3 w-3" />
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 border border-theme-sidebar-border p-2 text-2xs text-theme-foreground leading-relaxed">
                      {textResult}
                    </pre>
                  </>
                ) : (
                  <p className="text-2xs text-theme-muted-foreground">No text detected.</p>
                )}
              </div>
            )}
          </div>
        )}
        </>
      );
    })()}

    {/* Placement only applies to the Text mode — Background/OCR aren't
        placing a new object on the canvas. */}
    {mode === "text" && onPlace && (
      <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
        <PlacementGrid
          label="Placement"
          info={
            canPlace
              ? "Numpad 1-9 also work, spatially matched to the grid."
              : "Select a text to place it on the canvas."
          }
          disabled={!canPlace}
          numpadKeys={canPlace}
          onChange={onPlace}
        />
      </div>
    )}
    </div>
  );
}
