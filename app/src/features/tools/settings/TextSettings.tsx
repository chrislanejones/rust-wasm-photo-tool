import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import {
  PlacementGrid,
  placementToAlign,
  type AlignMode,
} from "@/components/PlacementGrid";
import { quickSpring } from "@/lib/animations";

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

type TextMode = "text" | "background";

interface TextSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  /** Place the selected text via the 3×3 grid (composes two single-axis aligns). */
  onAlign?: (mode: AlignMode) => void;
  /** A text is selected (created & selected / clicked / Reselect) → grid enabled. */
  canPlace?: boolean;
}

export function TextSettings({
  settings,
  onChange,
  onAlign,
  canPlace = false,
}: TextSettingsProps) {
  const [mode, setMode] = useState<TextMode>("text");

  return (
    <div className="space-y-5 -mt-2" data-text-panel>
      <TabGroup
        tabs={[
          { id: "text", label: "Text" },
          { id: "background", label: "Background" },
        ]}
        active={mode}
        onChange={(id) => setMode(id as TextMode)}
      />

      <AnimatePresence mode="wait">
        {mode === "text" && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-5"
          >
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
            <div className="space-y-4">
              <label className="text-2xs text-theme-muted-foreground">
                Font Weight
              </label>
              <TabGroup
                tabs={[
                  { id: "normal", label: "Normal" },
                  { id: "bold", label: "Bold" },
                ]}
                active={settings.fontWeight ?? "normal"}
                onChange={(id) =>
                  onChange({ ...settings, fontWeight: id as "normal" | "bold" })
                }
              />
            </div>

            {/* Color */}
            <ColorSwatchGrid
              colors={TEXT_COLORS}
              value={settings.textColor}
              onChange={(color) => onChange({ ...settings, textColor: color })}
            />
          </motion.div>
        )}

        {mode === "background" && (
          <motion.div
            key="background"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: quickSpring }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className="space-y-5"
          >
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

            {/* Drop shadow — soft, Rust-rendered. Works with or without a
                background: "Box" casts from the bubble, "Text" from the glyphs. */}
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
          </motion.div>
        )}
      </AnimatePresence>

      {onAlign && (
        <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
          <PlacementGrid
            label="Placement"
            disabled={!canPlace}
            numpadKeys={canPlace}
            onChange={(cell) => {
              const [h, v] = placementToAlign(cell);
              onAlign(h);
              onAlign(v);
            }}
          />
          {!canPlace && (
            <p className="text-2xs text-theme-muted-foreground">
              Select a text to place it on the canvas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
