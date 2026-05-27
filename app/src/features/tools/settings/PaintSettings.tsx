import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ToolSettings } from "@/lib/types";
import { PAINT_COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
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
            <SizeSlider
              label="Opacity"
              value={settings.brushOpacity}
              onChange={(v) => onChange({ ...settings, brushOpacity: v })}
              min={10}
              max={100}
              unit="%"
            />

            {/* Color */}
            <ColorSwatchGrid
              colors={PAINT_COLORS}
              value={settings.brushColor}
              onChange={(color) => onChange({ ...settings, brushColor: color })}
            />

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
            <SizeSlider
              label="Blur Intensity"
              value={settings.blurIntensity}
              onChange={(v) => onChange({ ...settings, blurIntensity: v })}
              min={1}
              max={20}
              unit="px"
            />

            <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
              Click and drag on the image to blur regions. Uses WASM separable Gaussian blur.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
