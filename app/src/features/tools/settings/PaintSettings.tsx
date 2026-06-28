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
const OPACITY_PRESETS = [25, 50, 75, 100] as const;
const HARDNESS_PRESETS = [25, 50, 75, 100] as const;
const BLUR_SIZE_PRESETS = [8, 16, 32, 64] as const;
const PIXEL_SIZE_PRESETS = [8, 16, 32, 48] as const;

// Blur-brush modes — gaussian (soften), pixelate (mosaic), solid (redact).
const BLUR_MODES = [
  { id: "gaussian", label: "Blur" },
  { id: "pixelate", label: "Pixelate" },
  { id: "solid", label: "Solid" },
] as const;

// Stroke-stabilizer strength (off → high leash). Off by default.
const STABILIZER_LEVELS = [
  { id: "off",  label: "Off"  },
  { id: "low",  label: "Low"  },
  { id: "med",  label: "Med"  },
  { id: "high", label: "High" },
] as const;

const PEN_WIDTH_PRESETS = [2, 4, 8, 16] as const;

type PaintMode = "paint" | "blur" | "pen";

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
    <div className="space-y-2.5 -mt-2">
      <TabGroup
        tabs={[
          { id: "paint", label: "Paint" },
          { id: "blur", label: "Blur" },
          { id: "pen", label: "Pen" },
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
            className="space-y-4"
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

            {/* Opacity — preset dots (numbers variant) to match Brush Size. */}
            <SizeSlider
              label="Opacity"
              value={settings.brushOpacity}
              onChange={(v) => onChange({ ...settings, brushOpacity: v })}
              presets={OPACITY_PRESETS}
              variant="numbers"
              unit="%"
            />

            {/* Hardness — edge softness of the brush dab (100% = crisp). */}
            <SizeSlider
              label="Hardness"
              value={settings.brushHardness}
              min={0}
              max={100}
              onChange={(v) => onChange({ ...settings, brushHardness: v })}
              presets={HARDNESS_PRESETS}
              variant="numbers"
              unit="%"
            />

            {/* Color */}
            <ColorSwatchGrid
              colors={TEXT_COLORS}
              value={settings.brushColor}
              onChange={(color) => onChange({ ...settings, brushColor: color })}
            />

            {/* Stroke Stabilizer — pulled-string "lazy mouse" smoothing. Off by
                default; Low/Med/High set the leash (smoothing strength). */}
            <div className="space-y-2">
              <label className="text-2xs text-theme-muted-foreground">
                Stroke Stabilizer
              </label>
              <ToolButtonGroup
                options={STABILIZER_LEVELS}
                value={settings.paintStabilizer ?? "off"}
                onChange={(id) =>
                  onChange({
                    ...settings,
                    paintStabilizer: id as ToolSettings["paintStabilizer"],
                  })
                }
              />
            </div>
          </motion.div>
        )}

        {mode === "blur" && (
          <motion.div
            key="blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-4"
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
          </motion.div>
        )}

        {mode === "pen" && (
          <motion.div
            key="pen"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-4"
          >
            <p className="text-2xs leading-relaxed text-theme-muted-foreground">
              Click to drop points, drag to pull Bézier handles. Enter closes the
              path, Esc finishes it open, Backspace undoes a point.
            </p>

            <SizeSlider
              label="Stroke Width"
              value={settings.strokeWidth}
              min={1}
              max={40}
              onChange={(v) => onChange({ ...settings, strokeWidth: v })}
              presets={PEN_WIDTH_PRESETS}
            />

            <ColorSwatchGrid
              colors={TEXT_COLORS}
              value={settings.strokeColor}
              onChange={(color) => onChange({ ...settings, strokeColor: color })}
            />

            {/* Background — fills the closed path's interior (under the stroke). */}
            <div className="space-y-2">
              <label className="text-2xs text-theme-muted-foreground">
                Background
              </label>
              <ToolButtonGroup
                options={[
                  { id: "none", label: "None" },
                  { id: "solid", label: "Solid" },
                ]}
                value={settings.fillMode === "none" ? "none" : "solid"}
                onChange={(id) =>
                  onChange({ ...settings, fillMode: id as ToolSettings["fillMode"] })
                }
              />
              {settings.fillMode !== "none" && (
                <ColorSwatchGrid
                  colors={TEXT_COLORS}
                  value={settings.fillColor}
                  onChange={(color) => onChange({ ...settings, fillColor: color })}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
