import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { quickSpring } from "@/lib/animations";

const BRUSH_SIZE_PRESETS = [4, 8, 16, 32] as const;
const BLUR_SIZE_PRESETS = [8, 16, 32, 64] as const;
const PIXEL_SIZE_PRESETS = [8, 16, 32, 48] as const;

// Blur-brush modes — gaussian (soften), pixelate (mosaic), solid (redact).
const BLUR_MODES = [
  { id: "gaussian", label: "Blur" },
  { id: "pixelate", label: "Pixelate" },
  { id: "solid", label: "Solid" },
] as const;

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
          { id: "blur", label: "Blur" },
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
              colors={TEXT_COLORS}
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
            {/* Mode: Gaussian blur / Pixelate / Solid redaction */}
            <ToolButtonGroup
              columns={3}
              options={BLUR_MODES}
              value={settings.blurMode ?? "gaussian"}
              onChange={(id) =>
                onChange({ ...settings, blurMode: id as ToolSettings["blurMode"] })
              }
            />

            {/* Brush footprint — shared by every mode */}
            <SizeSlider
              label="Brush Size"
              value={settings.blurSize}
              min={4}
              max={128}
              onChange={(v) => onChange({ ...settings, blurSize: v })}
              presets={BLUR_SIZE_PRESETS}
              blurredDots
            />

            {(settings.blurMode ?? "gaussian") === "gaussian" && (
              <SizeSlider
                label="Blur Intensity"
                value={settings.blurIntensity}
                onChange={(v) => onChange({ ...settings, blurIntensity: v })}
                min={1}
                max={20}
                unit="px"
              />
            )}

            {settings.blurMode === "pixelate" && (
              <SizeSlider
                label="Block Size"
                value={settings.pixelSize ?? 16}
                onChange={(v) => onChange({ ...settings, pixelSize: v })}
                min={4}
                max={64}
                unit="px"
                presets={PIXEL_SIZE_PRESETS}
              />
            )}

            {settings.blurMode === "solid" && (
              <ColorSwatchGrid
                colors={TEXT_COLORS}
                value={settings.redactColor ?? "#000000"}
                onChange={(color) => onChange({ ...settings, redactColor: color })}
              />
            )}

            <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
              {settings.blurMode === "pixelate"
                ? "Click and drag to mosaic regions into blocks — great for redacting faces or text."
                : settings.blurMode === "solid"
                  ? "Click and drag to paint an opaque block over sensitive areas."
                  : "Click and drag on the image to blur regions. Uses WASM separable Gaussian blur."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
