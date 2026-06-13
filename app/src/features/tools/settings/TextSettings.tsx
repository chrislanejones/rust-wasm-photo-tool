import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
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

const BG_KIND_OPTIONS = [
  { id: "none", label: "None" },
  { id: "rect", label: "Text BG" },
  { id: "bubble", label: "Bubble" },
] as const;

const BG_TAIL_OPTIONS = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "topleft", label: "TopLeft" },
  { id: "bottomright", label: "BotRight" },
  { id: "bottomleft", label: "BotLeft" },
] as const;

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
}

export function TextSettings({
  settings,
  onChange,
}: TextSettingsProps) {
  const [mode, setMode] = useState<TextMode>("text");

  return (
    <div className="space-y-5" data-text-panel>
      <TabGroup
        tabs={[
          { id: "text", label: "Text" },
          { id: "background", label: "Text Background" },
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
              <label className="text-[11px] text-theme-muted-foreground">
                Font Family
              </label>
              <div className="relative">
                <select
                  value={settings.fontFamily ?? "sans-serif"}
                  onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
                  className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-sm text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
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
              <label className="text-[11px] text-theme-muted-foreground">
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

                {/* Corner Radius — rect only */}
                {settings.bgKind === "rect" && (
                  <SizeSlider
                    label="Corner Radius"
                    value={settings.bgCornerRadius}
                    min={0}
                    max={32}
                    unit="px"
                    onChange={(v) => onChange({ ...settings, bgCornerRadius: v })}
                  />
                )}

                {/* Tail direction — bubble only */}
                {settings.bgKind === "bubble" && (
                  <ToolButtonGroup
                    label="Tail Direction"
                    options={BG_TAIL_OPTIONS}
                    value={settings.bgTail}
                    onChange={(id) => onChange({ ...settings, bgTail: id })}
                    columns={3}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
