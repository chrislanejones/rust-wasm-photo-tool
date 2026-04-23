import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Contrast, Pipette } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";
import { quickSpring } from "@/lib/animations";

interface EffectsSettingsProps {
  settings: ToolSettings;
  onChange: (settings: ToolSettings) => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  imageReady: boolean;
  // Color picker
  colorPickerActive?: boolean;
  onSetColorPickerActive?: (active: boolean) => void;
  pickedColor?: string;
  activeMode?: EffectsMode;
  onModeChange?: (mode: EffectsMode) => void;
}

export type EffectsMode = "levels" | "picker";

export function EffectsSettings({
  settings,
  onChange: _onChange,
  onBrightness,
  onContrast,
  imageReady,
  colorPickerActive = false,
  onSetColorPickerActive,
  pickedColor,
  activeMode,
  onModeChange,
}: EffectsSettingsProps) {
  const [internalMode, setInternalMode] = useState<EffectsMode>("levels");
  const mode = activeMode ?? internalMode;
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(100);

  const handleModeChange = (id: string) => {
    const m = id as EffectsMode;
    setInternalMode(m);
    onModeChange?.(m);
    if (m !== "picker") onSetColorPickerActive?.(false);
  };

  const commitBrightness = (v: number) => {
    if (v !== 0) {
      onBrightness(v / 100);
      setBrightness(0);
    }
  };

  const commitContrast = (v: number) => {
    if (v !== 100) {
      onContrast(v / 100);
      setContrast(100);
    }
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
            className="space-y-8"
          >
            {/* Brightness */}
            <div className="space-y-4">
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
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{ width: `${((brightness + 100) / 200) * 100}%` }}
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
                Drag and release — processes in Rust. Each adjustment is undo-able.
              </p>
            </div>

            {/* Contrast */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Contrast className="h-3.5 w-3.5 text-theme-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
                  Contrast
                </span>
                <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
                  {contrast}%
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-theme-muted">
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{ width: `${(contrast / 300) * 100}%` }}
                />
                <input
                  type="range"
                  min={0}
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
                100% = original. Processed via Rust adjust_contrast().
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

            {/* Activate button */}
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

            {/* Color swatch */}
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
