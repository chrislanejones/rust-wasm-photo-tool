import { useEffect, useRef, useState } from "react";
import { Wand2, Flame, Cloud, Moon, Sparkles } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { SizeSlider } from "@/components/SizeSlider";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButton } from "@/components/ui/tool-button";

interface EffectsSettingsProps {
  settings: ToolSettings;
  onChange: (settings: ToolSettings) => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  onGlobalBlur?: (intensity: number) => void;
  onSaturation?: (factor: number) => void;
  onShadows?: (amount: number) => void;
  onHighlights?: (amount: number) => void;
  onSharpen?: (amount: number) => void;
  imageReady: boolean;
  /** WASM undo count — changes (other than our own commits) re-sync the latches. */
  undoCount?: number;
  /** Active photo id — switching photos also re-syncs the latches. */
  activePhotoId?: string | null;
}

/**
 * FIVE TILES IN ONE 3-COLUMN GRID, the same shape as Select's
 * All / Deselect / Delete / Copy / Cut — two rows out of a five-item grid, the
 * last cell empty. 4x Upscale sits in it as a disabled fifth rather than in a
 * "Coming Soon" card of its own: it is one of the things you can do to a
 * photo, and a greyed tile beside four live ones says "not yet" without
 * spending a whole row to say it.
 *
 * `upscale: true` marks the one with no numbers — the others apply brightness
 * and contrast in a single undo-able step.
 */
const PRESETS = [
  { label: "Enhance",     Icon: Wand2,    brightness: 0.08,  contrast: 1.25 },
  { label: "Vivid",       Icon: Flame,    brightness: 0,     contrast: 1.5  },
  { label: "Fade",        Icon: Cloud,    brightness: 0.06,  contrast: 0.72 },
  { label: "Dark",        Icon: Moon,     brightness: -0.12, contrast: 1.1  },
  { label: "4x Upscale",  Icon: Sparkles, upscale: true },
] as const;

export function EffectsSettings({
  settings: _settings,
  onChange: _onChange,
  onBrightness,
  onContrast,
  onGlobalBlur,
  onSaturation,
  onShadows,
  onHighlights,
  onSharpen,
  imageReady,
  undoCount,
  activePhotoId,
}: EffectsSettingsProps) {
  // Latching brightness: slider stays at released position.
  // Each release applies only the delta since the last commit.
  const [brightness, setBrightness] = useState(0);
  const [brightnessCommitted, setBrightnessCommitted] = useState(0);

  // Latching contrast: same principle, but delta is a ratio.
  const [contrast, setContrast] = useState(100);
  const [contrastCommitted, setContrastCommitted] = useState(100);

  // Blur resets after each apply (applying more blur is additive anyway).
  const [blur, setBlur] = useState(0);

  // Latching saturation: same latch-to-position principle as Contrast — a
  // ratio relative to the last committed value, 100 = neutral.
  const [saturation, setSaturation] = useState(100);
  const [saturationCommitted, setSaturationCommitted] = useState(100);

  // Shadows/Highlights are absolute, non-latching sliders like Blur: each
  // release applies the raw slider value as a luminance-masked brightness
  // delta, then resets to neutral (0) rather than staying at the dragged
  // position — repeated drags are additive on the image, not on the slider.
  const [shadows, setShadows] = useState(0);
  const [highlights, setHighlights] = useState(0);

  // Sharpen mirrors Blur's own UX exactly (0..100 range, resets after apply).
  const [sharpen, setSharpen] = useState(0);

  // Set right before we apply our own brightness/contrast/blur so the history
  // effect below can tell our own commit apart from an external change.
  const selfEditRef = useRef(false);

  // The latched sliders track *deltas* applied to the image. When the image's
  // history moves underneath us — undo, redo, or a photo switch — those latches
  // go stale (e.g. undo reverts the pixels but the slider stayed put). Re-sync
  // them to neutral so the next drag applies a correct delta from the real
  // current state, and so undo visibly returns the slider to its origin.
  useEffect(() => {
    if (selfEditRef.current) {
      selfEditRef.current = false;
      return;
    }
    setBrightness(0);
    setBrightnessCommitted(0);
    setContrast(100);
    setContrastCommitted(100);
    setBlur(0);
    setSaturation(100);
    setSaturationCommitted(100);
    setShadows(0);
    setHighlights(0);
    setSharpen(0);
  }, [undoCount, activePhotoId]);

  const commitBrightness = (v: number) => {
    const delta = (v - brightnessCommitted) / 100;
    if (delta !== 0) {
      selfEditRef.current = true;
      onBrightness(delta);
      setBrightnessCommitted(v);
    }
  };

  const commitContrast = (v: number) => {
    if (v === contrastCommitted) return;
    const factor = v / contrastCommitted;
    selfEditRef.current = true;
    onContrast(factor);
    setContrastCommitted(v);
  };

  const commitBlur = (v: number) => {
    if (v > 0 && onGlobalBlur) {
      selfEditRef.current = true;
      onGlobalBlur(v / 100);
      setBlur(0);
    }
  };

  const commitSaturation = (v: number) => {
    if (v === saturationCommitted || !onSaturation) return;
    const factor = v / saturationCommitted;
    selfEditRef.current = true;
    onSaturation(factor);
    setSaturationCommitted(v);
  };

  const commitShadows = (v: number) => {
    if (v !== 0 && onShadows) {
      selfEditRef.current = true;
      onShadows(v);
      setShadows(0);
    }
  };

  const commitHighlights = (v: number) => {
    if (v !== 0 && onHighlights) {
      selfEditRef.current = true;
      onHighlights(v);
      setHighlights(0);
    }
  };

  const commitSharpen = (v: number) => {
    if (v > 0 && onSharpen) {
      selfEditRef.current = true;
      // Map the 0..100 slider fraction onto a 0..2 unsharp-mask `amount`
      // (default-strength sharpen sits around v≈50-75 → amount 1.0-1.5).
      onSharpen((v / 100) * 2);
      setSharpen(0);
    }
  };

  const applyPreset = (brightness: number, contrast: number) => {
    if (brightness !== 0 || contrast !== 1) selfEditRef.current = true;
    if (brightness !== 0) onBrightness(brightness);
    if (contrast !== 1) onContrast(contrast);
  };

  return (
    <div className="space-y-3 -mt-2">
      <SectionHeader
        title="Levels"
        info="Brightness, Contrast, and Blur each latch to the slider's released position — drag again to apply another delta on top. All are undo-able."
      />

      {/* Brightness */}
      <div className="space-y-3">
        <SizeSlider
          label="Brightness"
          labelInfo="Drag & release — applies delta from current position. Undo-able."
          value={brightness}
          onChange={setBrightness}
          onCommit={commitBrightness}
          min={-100}
          max={100}
          disabled={!imageReady}
          valueDisplay={brightness > 0 ? `+${brightness}` : String(brightness)}
        />
      </div>

      {/* Contrast */}
      <div className="space-y-3">
        <SizeSlider
          label="Contrast"
          labelInfo="100 = neutral. Slider latches — drag again to adjust further."
          value={contrast}
          onChange={setContrast}
          onCommit={commitContrast}
          min={10}
          max={300}
          disabled={!imageReady}
          valueDisplay={
            contrast > 100
              ? `+${contrast - 100}`
              : contrast < 100
                ? `${contrast - 100}`
                : "0"
          }
        />
      </div>

      {/* Saturation */}
      {onSaturation && (
        <div className="space-y-3">
          <SizeSlider
            label="Saturation"
            labelInfo="100 = neutral, 0 = grayscale. Slider latches — drag again to adjust further."
            value={saturation}
            onChange={setSaturation}
            onCommit={commitSaturation}
            min={0}
            max={300}
            disabled={!imageReady}
            valueDisplay={
              saturation > 100
                ? `+${saturation - 100}`
                : saturation < 100
                  ? `${saturation - 100}`
                  : "0"
            }
          />
        </div>
      )}

      {/* Shadows */}
      {onShadows && (
        <div className="space-y-3">
          <SizeSlider
            label="Shadows"
            labelInfo="Lifts dark tones. Drag & release — resets after apply. Undo-able."
            value={shadows}
            onChange={setShadows}
            onCommit={commitShadows}
            min={-100}
            max={100}
            disabled={!imageReady}
            valueDisplay={shadows > 0 ? `+${shadows}` : String(shadows)}
          />
        </div>
      )}

      {/* Highlights */}
      {onHighlights && (
        <div className="space-y-3">
          <SizeSlider
            label="Highlights"
            labelInfo="Recovers blown highlights. Drag & release — resets after apply. Undo-able."
            value={highlights}
            onChange={setHighlights}
            onCommit={commitHighlights}
            min={-100}
            max={100}
            disabled={!imageReady}
            valueDisplay={highlights > 0 ? `+${highlights}` : String(highlights)}
          />
        </div>
      )}

      {/* Global Blur */}
      {onGlobalBlur && (
        <div className="space-y-3">
          <SizeSlider
            label="Blur"
            labelInfo="Gaussian blur across the full image. Resets after apply."
            value={blur}
            onChange={setBlur}
            onCommit={commitBlur}
            min={0}
            max={100}
            unit="%"
            disabled={!imageReady}
          />
        </div>
      )}

      {/* Sharpen */}
      {onSharpen && (
        <div className="space-y-3">
          <SizeSlider
            label="Sharpen"
            labelInfo="Unsharp mask across the full image. Resets after apply."
            value={sharpen}
            onChange={setSharpen}
            onCommit={commitSharpen}
            min={0}
            max={100}
            unit="%"
            disabled={!imageReady}
          />
        </div>
      )}

      {/* Quick Adjust — five tiles, 3 columns, like Select's action grid. */}
      <div className="space-y-2 pt-2 border-t border-theme-sidebar-border">
        <SectionHeader
          title="Quick Adjust"
          info={
            <>
              One-shot adjustments, each a single undo-able step. Enhance lifts
              contrast a little, Vivid pushes it hard, Fade flattens it, Dark
              drops the exposure. <strong>4x Upscale</strong> is not connected
              yet — it needs a model, so it stays greyed rather than pretending.
            </>
          }
        />
        <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]">
          {PRESETS.map((preset) => (
            <ToolButton
              key={preset.label}
              stacked
              disabled={"upscale" in preset ? true : !imageReady}
              title={
                "upscale" in preset
                  ? "4x Upscale isn't connected yet — it needs a model"
                  : `Apply ${preset.label}`
              }
              onClick={
                "upscale" in preset
                  ? undefined
                  : () => applyPreset(preset.brightness, preset.contrast)
              }
            >
              <preset.Icon /> {preset.label}
            </ToolButton>
          ))}
        </div>
      </div>
    </div>
  );
}
