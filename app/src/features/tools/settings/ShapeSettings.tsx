import { useState } from "react";
import { Square, Circle, PenLine, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabGroup } from "@/components/TabGroup";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { SizeSlider } from "@/components/SizeSlider";
import type { ToolSettings } from "@/lib/types";
import { ARROW_COLORS } from "@/lib/colors";

const SHAPES = [
  { id: "rect",       label: "Rectangle",   Icon: Square   },
  { id: "circle",     label: "Circle",       Icon: Circle   },
  { id: "handCircle", label: "Hand-drawn",   Icon: PenLine  },
  { id: "line",       label: "Line",         Icon: Minus    },
] as const;

const STROKE_WIDTH_PRESETS = [2, 4, 6, 8] as const;

type ShapeType = (typeof SHAPES)[number]["id"];
export type ShapesMode = "shapes" | "arrows";

interface ShapesSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  activeMode?: ShapesMode;
  onModeChange?: (mode: ShapesMode) => void;
}

export function ShapesSettings({ settings, onChange, activeMode, onModeChange }: ShapesSettingsProps) {
  const [internalMode, setInternalMode] = useState<ShapesMode>("shapes");
  const mode = activeMode ?? internalMode;
  const currentShape = (settings.shape ?? "rect") as ShapeType;

  return (
    <div className="space-y-6">
      <TabGroup
        tabs={[
          { id: "shapes", label: "Shapes" },
          { id: "arrows", label: "Arrows" },
        ]}
        active={mode}
        onChange={(id) => {
          const m = id as ShapesMode;
          setInternalMode(m);
          onModeChange?.(m);
        }}
      />

      {/* ── Shapes tab ── */}
      {mode === "shapes" && (
        <div className="space-y-6">
          {/* Shape selector — styled like Transform buttons */}
          <div className="grid grid-cols-2 gap-2">
            {SHAPES.map(({ id, label, Icon }) => (
              <Button
                key={id}
                variant={currentShape === id ? "default" : "secondary"}
                size="sm"
                className="gap-2"
                onClick={() => onChange({ ...settings, shape: id })}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>

          {/* Stroke Width */}
          <SizeSlider
            label="Stroke Width"
            value={settings.strokeWidth}
            min={1}
            max={10}
            onChange={(v) => onChange({ ...settings, strokeWidth: v })}
            presets={STROKE_WIDTH_PRESETS}
            renderPreset={(preset) => (
              <span
                className="rounded-full bg-theme-foreground"
                style={{ width: preset * 2, height: preset * 2 }}
              />
            )}
          />

          {/* Color */}
          <ColorSwatchGrid
            colors={ARROW_COLORS}
            value={settings.strokeColor}
            onChange={(color) => onChange({ ...settings, strokeColor: color })}
          />
        </div>
      )}

      {/* ── Arrows tab ── */}
      {mode === "arrows" && (
        <div className="space-y-8">
          {/* Stroke Width */}
          <SizeSlider
            label="Stroke Width"
            value={settings.strokeWidth}
            min={1}
            max={10}
            onChange={(v) => onChange({ ...settings, strokeWidth: v })}
            presets={STROKE_WIDTH_PRESETS}
            renderPreset={(preset) => (
              <span
                className="rounded-full bg-theme-foreground"
                style={{ width: preset * 2, height: preset * 2 }}
              />
            )}
          />

          {/* Arrow Style */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
              Arrow Style
            </label>
            <TabGroup
              tabs={[
                { id: "single", label: "→ Single" },
                { id: "double", label: "↔ Double" },
              ]}
              active={settings.arrowStyle ?? "single"}
              onChange={(id) =>
                onChange({ ...settings, arrowStyle: id as "single" | "double" })
              }
            />
          </div>

          {/* Color */}
          <ColorSwatchGrid
            colors={ARROW_COLORS}
            value={settings.strokeColor}
            onChange={(color) => onChange({ ...settings, strokeColor: color })}
          />
        </div>
      )}
    </div>
  );
}
