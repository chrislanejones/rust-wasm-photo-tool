import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pipette, Wand2, Flame, Cloud, Moon } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ToolButton } from "@/components/ui/tool-button";
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
  /** WASM undo count — changes (other than our own commits) re-sync the latches. */
  undoCount?: number;
  /** Active photo id — switching photos also re-syncs the latches. */
  activePhotoId?: string | null;
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
  undoCount,
  activePhotoId,
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
  }, [undoCount, activePhotoId]);

  const handleModeChange = (id: string) => {
    const m = id as EffectsMode;
    setInternalMode(m);
    onModeChange?.(m);
    if (m !== "picker") onSetColorPickerActive?.(false);
  };

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

  const applyPreset = (brightness: number, contrast: number) => {
    if (brightness !== 0 || contrast !== 1) selfEditRef.current = true;
    if (brightness !== 0) onBrightness(brightness);
    if (contrast !== 1) onContrast(contrast);
  };

  const displayColor = pickedColor ?? settings.brushColor;

  return (
    <div className="space-y-4 -mt-2">
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
            <div className="space-y-1.5">
              <SizeSlider
                label="Brightness"
                value={brightness}
                onChange={setBrightness}
                onCommit={commitBrightness}
                min={-100}
                max={100}
                disabled={!imageReady}
                valueDisplay={brightness > 0 ? `+${brightness}` : String(brightness)}
              />
              <p className="text-[9px] text-theme-muted-foreground">
                Drag &amp; release — applies delta from current position. Undo-able.
              </p>
            </div>

            {/* Contrast */}
            <div className="space-y-1.5">
              <SizeSlider
                label="Contrast"
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
              <p className="text-[9px] text-theme-muted-foreground">
                100 = neutral. Slider latches — drag again to adjust further.
              </p>
            </div>

            {/* Global Blur */}
            {onGlobalBlur && (
              <div className="space-y-1.5">
                <SizeSlider
                  label="Blur"
                  value={blur}
                  onChange={setBlur}
                  onCommit={commitBlur}
                  min={0}
                  max={100}
                  unit="%"
                  disabled={!imageReady}
                />
                <p className="text-[9px] text-theme-muted-foreground">
                  Gaussian blur across the full image. Resets after apply.
                </p>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-3 pt-2 border-t border-theme-sidebar-border">
              <span className="text-[11px] text-theme-muted-foreground">
                Quick Adjust
              </span>
              <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
                {PRESETS.map(({ label, Icon, brightness: b, contrast: c }) => (
                  <ToolButton
                    key={label}
                    disabled={!imageReady}
                    onClick={() => applyPreset(b, c)}
                  >
                    <Icon />
                    {label}
                  </ToolButton>
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
