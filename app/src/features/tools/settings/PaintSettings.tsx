import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ToolSettings } from "@/lib/types";
import { PAINT_COLORS as COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { quickSpring } from "@/lib/animations";

const BRUSH_SIZE_PRESETS = [4, 8, 16, 32] as const;
const BLUR_SIZE_PRESETS = [8, 16, 32, 64] as const;

type PaintMode = "paint" | "blur";

interface PaintSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  activeMode?: PaintMode;
  onModeChange?: (mode: PaintMode) => void;
}

export function PaintSettings({ settings, onChange, activeMode, onModeChange }: PaintSettingsProps) {
  const [internalMode, setInternalMode] = useState<PaintMode>("paint");
  const mode = activeMode ?? internalMode;

  const handleModeChange = (id: string) => {
    const m = id as PaintMode;
    setInternalMode(m);
    onModeChange?.(m);
  };

  return (
    <div className="space-y-5">
      <TabGroup
        tabs={[
          { id: "paint", label: "Paint" },
          { id: "blur", label: "Blur Brush" },
        ]}
        active={mode}
        onChange={handleModeChange}
      />

      <AnimatePresence mode="wait">
        {mode === "paint" && (
          <motion.div
            key="paint"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-8"
          >
            {/* Brush Size */}
            <SizeSlider
              label="Brush Size"
              value={settings.brushSize}
              min={1}
              max={50}
              onChange={(v) => onChange({ ...settings, brushSize: v })}
              presets={BRUSH_SIZE_PRESETS}
            />

            {/* Opacity */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                  Opacity
                </label>
                <span className="text-xs text-theme-foreground tabular-nums">
                  {settings.brushOpacity}%
                </span>
              </div>

              <div className="relative h-2 w-full rounded-full bg-theme-muted">
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{ width: `${((settings.brushOpacity - 10) / 90) * 100}%` }}
                />
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={settings.brushOpacity}
                  onChange={(e) =>
                    onChange({ ...settings, brushOpacity: Number(e.target.value) })
                  }
                  className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Color
              </label>
              <div className="grid grid-cols-5 gap-2 py-2">
                {COLORS.map((color) => {
                  const active = settings.brushColor === color;
                  return (
                    <button
                      key={color}
                      onClick={() => onChange({ ...settings, brushColor: color })}
                      className={[
                        "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                        active
                          ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                          : "",
                      ].join(" ")}
                      style={{ backgroundColor: color }}
                      aria-label={`Brush color ${color}`}
                    />
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
              Click and drag to paint. Rendering runs in WASM for smooth strokes.
            </p>
          </motion.div>
        )}

        {mode === "blur" && (
          <motion.div
            key="blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-8"
          >
            {/* Blur Size */}
            <SizeSlider
              label="Brush Size"
              value={settings.blurSize}
              min={4}
              max={128}
              onChange={(v) => onChange({ ...settings, blurSize: v })}
              presets={BLUR_SIZE_PRESETS}
              blurredDots
            />

            {/* Blur Intensity */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                  Blur Intensity
                </label>
                <span className="text-xs text-theme-foreground tabular-nums">
                  {settings.blurIntensity}px
                </span>
              </div>

              <div className="relative h-2 w-full rounded-full bg-theme-muted">
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                  style={{
                    width: `${((settings.blurIntensity - 1) / 19) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={settings.blurIntensity}
                  onChange={(e) =>
                    onChange({ ...settings, blurIntensity: Number(e.target.value) })
                  }
                  className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                />
              </div>
            </div>

            <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
              Click and drag on the image to blur regions. Uses WASM separable Gaussian blur.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
