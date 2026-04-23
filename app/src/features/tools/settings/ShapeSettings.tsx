import { useState } from "react";
import { Square, Circle, PenLine, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabGroup } from "@/components/TabGroup";
import type { ToolSettings } from "@/lib/types";
import { ARROW_COLORS } from "@/lib/colors";

const SHAPES = [
  { id: "rect",       label: "Rectangle",   Icon: Square   },
  { id: "circle",     label: "Circle",       Icon: Circle   },
  { id: "handCircle", label: "Hand-drawn",   Icon: PenLine  },
  { id: "line",       label: "Line",         Icon: Minus    },
] as const;

const STROKE_WIDTH_PRESETS = [2, 4, 6, 8] as const;

const SHAPE_COLORS = [
  "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#000000",
] as const;

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Stroke Width
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {settings.strokeWidth}px
              </span>
            </div>
            <div className="flex items-center justify-between">
              {STROKE_WIDTH_PRESETS.map((width) => {
                const active = settings.strokeWidth === width;
                return (
                  <button
                    key={width}
                    onClick={() => onChange({ ...settings, strokeWidth: width })}
                    className={[
                      "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                      active
                        ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                        : "hover:bg-theme-accent",
                    ].join(" ")}
                    aria-label={`Stroke width ${width}`}
                  >
                    <span
                      className="rounded-full bg-theme-foreground"
                      style={{ width: width * 2, height: width * 2 }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{ width: `${((settings.strokeWidth - 1) / 9) * 100}%` }}
              />
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={settings.strokeWidth}
                onChange={(e) =>
                  onChange({ ...settings, strokeWidth: Number(e.target.value) })
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
            <div className="flex flex-wrap gap-2 py-2">
              {SHAPE_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onChange({ ...settings, strokeColor: color })}
                  className={[
                    "w-7 h-7 rounded-full border-2 transition-all",
                    settings.strokeColor === color
                      ? "border-accent scale-110 ring-2 ring-accent/30"
                      : "border-transparent hover:scale-105",
                  ].join(" ")}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Arrows tab ── */}
      {mode === "arrows" && (
        <div className="space-y-8">
          {/* Stroke Width */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Stroke Width
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {settings.strokeWidth}px
              </span>
            </div>
            <div className="flex items-center justify-between">
              {STROKE_WIDTH_PRESETS.map((width) => {
                const active = settings.strokeWidth === width;
                return (
                  <button
                    key={width}
                    onClick={() => onChange({ ...settings, strokeWidth: width })}
                    className={[
                      "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                      active
                        ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                        : "hover:bg-theme-accent",
                    ].join(" ")}
                    aria-label={`Stroke width ${width}`}
                  >
                    <span
                      className="rounded-full bg-theme-foreground"
                      style={{ width, height: width }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{ width: `${((settings.strokeWidth - 1) / 9) * 100}%` }}
              />
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={settings.strokeWidth}
                onChange={(e) =>
                  onChange({ ...settings, strokeWidth: Number(e.target.value) })
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>

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
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
              Color
            </label>
            <div className="grid grid-cols-5 gap-2 py-2">
              {ARROW_COLORS.map((color) => {
                const active = settings.strokeColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => onChange({ ...settings, strokeColor: color })}
                    className={[
                      "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                      active
                        ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                        : "",
                    ].join(" ")}
                    style={{ backgroundColor: color }}
                    aria-label={`Arrow color ${color}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
