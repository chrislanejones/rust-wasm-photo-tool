import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Contrast, Pipette, Waves, Wand2, Flame, Cloud, Moon } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";
import { quickSpring } from "@/lib/animations";

interface EffectsSettingsProps {
  settings: ToolSettings;
  onChange: (settings: ToolSettings) => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  onGlobalBlur?: (intensity: number) => void;
  imageReady: boolean;
  colorPickerActive?: boolean;
  onSetColorPickerActive?: (active: boolean) => void;
  pickedColor?: string;
  activeMode?: EffectsMode;
  onModeChange?: (mode: EffectsMode) => void;
}

export type EffectsMode = "levels" | "picker";

const PRESETS = [
  { label: "Enhance",  Icon: Wand2, brightness: 0.08,  contrast: 1.25 },
  { label: "Vivid",    Icon: Flame, brightness: 0,      contrast: 1.5  },
  { label: "Fade",     Icon: Cloud, brightness: 0.06,   contrast: 0.72 },
  { label: "Dark",     Icon: Moon,  brightness: -0.12,  contrast: 1.1  },
] as const;

export function EffectsSettings({
  settings,
  onChange: _onChange,
  onBrightness,
  onContrast,
  onGlobalBlur,
  imageReady,
  colorPickerActive = false,
  onSetColorPickerActive,
  pickedColor,
  activeMode,
  onModeChange,
}: EffectsSettingsProps) {
  const [internalMode, setInternalMode] = useState<EffectsMode>("levels");
  const mode = activeMode ?? internalMode;

  // Latching brightness: slider stays at released position.
  // Each release applies only the delta since the last commit.
  const [brightness, setBrightness] = useState(0);
  const [brightnessCommitted, setBrightnessCommitted] = useState(0);

  // Latching contrast: same principle, but delta is a ratio.
  const [contrast, setContrast] = useState(100);
  const [contrastCommitted, setContrastCommitted] = useState(100);

  // Blur resets after each apply (applying more blur is additive anyway).
  const [blur, setBlur] = useState(0);

  const handleModeChange = (id: string) => {
    const m = id as EffectsMode;
    setInternalMode(m);
    onModeChange?.(m);
    if (m !== "picker") onSetColorPickerActive?.(false);
  };

  const commitBrightness = (v: number) => {
    const delta = (v - brightnessCommitted) / 100;
    if (delta !== 0) {
      onBrightness(delta);
      setBrightnessCommitted(v);
    }
  };

  const commitContrast = (v: number) => {
    if (v === contrastCommitted) return;
    const factor = v / contrastCommitted;
    onContrast(factor);
    setContrastCommitted(v);
  };

  const commitBlur = (v: number) => {
    if (v > 0 && onGlobalBlur) {
      onGlobalBlur(v / 100);
      setBlur(0);
    }
  };

  const applyPreset = (brightness: number, contrast: number) => {
    if (brightness !== 0) onBrightness(brightness);
    if (contrast !== 1) onContrast(contrast);
  };

  const displayColor = pickedColor ?? settings.brushColor;

  return (
    <div className="space-y-8">
      <TabGroup
        tabs={[
          { id: "levels", label: "Levels" },
          { id: "picker", label: "Color Picker" },
        ]}
        active={mode}
        onChange={handleModeChange}
      />

      <AnimatePresence mode="wait">
        {mode === "levels" && (
          <motion.div
            key="levels"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-6"
          >
            {/* Brightness */}
            <div className="space-y-3">
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
                {/* track fill from center */}
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{
                    left: brightness >= 0 ? "50%" : `${((brightness + 100) / 200) * 100}%`,
                    width: `${(Math.abs(brightness) / 200) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={brightness}
                  disabled={!imageReady}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  onPointerUp={(e) =>
                    commitBrightness(Number((e.target as HTMLInputElement).value))
                  }
                  className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                />
              </div>
              <p className="text-[9px] text-theme-muted-foreground">
                Drag &amp; release — applies delta from current position. Undo-able.
              </p>
            </div>

            {/* Contrast */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Contrast className="h-3.5 w-3.5 text-theme-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
                  Contrast
                </span>
                <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
                  {contrast > 100 ? `+${contrast - 100}` : contrast < 100 ? `${contrast - 100}` : "0"}
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-theme-muted">
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{
                    left: contrast >= 100 ? "50%" : `${(contrast / 200) * 100}%`,
                    width: `${(Math.abs(contrast - 100) / 200) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={1}
                  value={contrast}
                  disabled={!imageReady}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  onPointerUp={(e) =>
                    commitContrast(Number((e.target as HTMLInputElement).value))
                  }
                  className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                />
              </div>
              <p className="text-[9px] text-theme-muted-foreground">
                100 = neutral. Slider latches — drag again to adjust further.
              </p>
            </div>

            {/* Global Blur */}
            {onGlobalBlur && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Waves className="h-3.5 w-3.5 text-theme-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
                    Blur
                  </span>
                  <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
                    {blur}%
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-theme-muted">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                    style={{ width: `${blur}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={blur}
                    disabled={!imageReady}
                    onChange={(e) => setBlur(Number(e.target.value))}
                    onPointerUp={(e) =>
                      commitBlur(Number((e.target as HTMLInputElement).value))
                    }
                    className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                  />
                </div>
                <p className="text-[9px] text-theme-muted-foreground">
                  Gaussian blur across the full image. Resets after apply.
                </p>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-3 pt-2 border-t border-theme-sidebar-border">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Quick Adjust
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(({ label, Icon, brightness: b, contrast: c }) => (
                  <button
                    key={label}
                    disabled={!imageReady}
                    onClick={() => applyPreset(b, c)}
                    className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-theme-muted text-theme-foreground hover:bg-theme-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-theme-muted-foreground">
                One-shot adjustments. Each is undo-able.
              </p>
            </div>
          </motion.div>
        )}

        {mode === "picker" && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-6"
          >
            <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
              Click the eyedropper to activate, then hover over the image to
              magnify pixels. Click to pick a color — it will be set as your
              brush and text color.
            </p>

            <button
              disabled={!imageReady}
              onClick={() => onSetColorPickerActive?.(!colorPickerActive)}
              className={[
                "w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                colorPickerActive
                  ? "bg-theme-primary text-theme-primary-foreground ring-2 ring-theme-primary/40"
                  : "bg-theme-muted text-theme-foreground hover:bg-theme-accent",
                !imageReady ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <Pipette className="h-4 w-4" />
              {colorPickerActive ? "Click image to pick" : "Activate Eyedropper"}
            </button>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Current Color
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg border-2 border-theme-muted shrink-0"
                  style={{ backgroundColor: displayColor }}
                />
                <div className="space-y-0.5">
                  <span className="block text-sm font-mono text-theme-foreground uppercase">
                    {displayColor}
                  </span>
                  <span className="block text-[10px] text-theme-muted-foreground">
                    brush &amp; text color
                  </span>
                </div>
              </div>
            </div>

            {colorPickerActive && (
              <div className="rounded-lg bg-theme-muted/50 px-3 py-2 text-[10px] text-theme-muted-foreground leading-relaxed">
                A pixel magnifier follows your cursor over the canvas. Hover to
                preview, click to pick.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
