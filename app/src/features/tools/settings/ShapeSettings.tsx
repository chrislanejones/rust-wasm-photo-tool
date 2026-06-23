import { useState } from "react";
import { Square, Circle, PenLine, Minus, MapPin, Spline } from "lucide-react";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { TabGroup } from "@/components/TabGroup";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { SizeSlider } from "@/components/SizeSlider";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";

const SHAPES = [
  { id: "rect",       label: "Rectangle", icon: Square  },
  { id: "circle",     label: "Circle",    icon: Circle  },
  { id: "handCircle", label: "Hand-drawn", icon: PenLine },
  { id: "line",       label: "Line",      icon: Minus   },
] as const;

const PEN_MODES = [
  { id: "pins",     label: "Pins",     icon: MapPin },
  { id: "freehand", label: "Freehand", icon: Spline },
] as const;

const STROKE_WIDTH_PRESETS = [2, 4, 6, 8] as const;

const FILL_MODES = [
  { id: "none",     label: "None"     },
  { id: "solid",    label: "Solid"    },
  { id: "gradient", label: "Gradient" },
  { id: "pixelate", label: "Pixelate" },
] as const;

// Gradient direction presets. `id` is the angle in degrees (string for the
// button group), label is a glyph hinting the direction.
const GRADIENT_DIRS = [
  { id: "0",   label: "→" },
  { id: "45",  label: "↘" },
  { id: "90",  label: "↓" },
  { id: "135", label: "↙" },
] as const;

type ShapeType = (typeof SHAPES)[number]["id"];
export type ShapesMode = "shapes" | "pens" | "arrows";

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
    // data-draw-panel: clicking inside this panel must NOT commit a pending
    // shape edit, so stroke/colour/shape tweaks live-update the overlay.
    <div className="space-y-6" data-draw-panel>
      <TabGroup
        tabs={[
          { id: "shapes", label: "Shapes" },
          { id: "pens", label: "Pens" },
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
          {/* Shape selector */}
          <ToolButtonGroup
            options={SHAPES}
            value={currentShape}
            onChange={(id) => onChange({ ...settings, shape: id })}
          />

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

          {/* Stroke Color */}
          <ColorSwatchGrid
            colors={TEXT_COLORS}
            value={settings.strokeColor}
            onChange={(color) => onChange({ ...settings, strokeColor: color })}
          />

          {/* Fill — rectangle + circle only (line/hand-drawn have no area) */}
          {(currentShape === "rect" || currentShape === "circle") && (
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Fill
              </label>
              <ToolButtonGroup
                options={FILL_MODES}
                value={settings.fillMode ?? "none"}
                onChange={(id) =>
                  onChange({ ...settings, fillMode: id as ToolSettings["fillMode"] })
                }
              />

              {settings.fillMode === "solid" && (
                <ColorSwatchGrid
                  colors={TEXT_COLORS}
                  value={settings.fillColor}
                  onChange={(color) => onChange({ ...settings, fillColor: color })}
                />
              )}

              {settings.fillMode === "gradient" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[11px] text-theme-muted-foreground">From</span>
                    <ColorSwatchGrid
                      colors={TEXT_COLORS}
                      value={settings.fillColor}
                      onChange={(color) => onChange({ ...settings, fillColor: color })}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] text-theme-muted-foreground">To</span>
                    <ColorSwatchGrid
                      colors={TEXT_COLORS}
                      value={settings.fillColor2}
                      onChange={(color) => onChange({ ...settings, fillColor2: color })}
                    />
                  </div>
                  <ToolButtonGroup
                    label="Direction"
                    options={GRADIENT_DIRS}
                    value={
                      String(settings.gradientAngle ?? 0) as
                        (typeof GRADIENT_DIRS)[number]["id"]
                    }
                    onChange={(id) =>
                      onChange({ ...settings, gradientAngle: Number(id) })
                    }
                  />
                </div>
              )}

              {settings.fillMode === "pixelate" && (
                <div className="space-y-2">
                  <SizeSlider
                    label="Block Size"
                    value={settings.fillBlock ?? 16}
                    min={4}
                    max={64}
                    unit="px"
                    onChange={(v) => onChange({ ...settings, fillBlock: v })}
                  />
                  <p className="text-[11px] leading-relaxed text-theme-muted-foreground">
                    Mosaics whatever is beneath the box — a re-selectable redaction
                    box you can move, resize, and undo from the Review panel.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Pens tab ── */}
      {mode === "pens" && (
        <div className="space-y-6">
          {/* Pins (numbered callouts) vs Freehand polyline */}
          <ToolButtonGroup
            options={PEN_MODES}
            value={settings.penMode ?? "pins"}
            onChange={(id) =>
              onChange({ ...settings, penMode: id as "pins" | "freehand" })
            }
          />

          {(settings.penMode ?? "pins") === "pins" ? (
            <>
              <p className="text-[11px] leading-relaxed text-theme-muted-foreground">
                Click the image to drop auto-numbered callout pins (1, 2, 3…).
                Click an existing pin to move it.
              </p>
              <SizeSlider
                label="Pin Size"
                value={settings.pinSize ?? 32}
                min={16}
                max={72}
                unit="px"
                onChange={(v) => onChange({ ...settings, pinSize: v })}
              />
            </>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-theme-muted-foreground">
                Drag on the image to draw a freehand pen stroke.
              </p>
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
            </>
          )}

          {/* Color (shared: pin fill / pen stroke) */}
          <ColorSwatchGrid
            colors={TEXT_COLORS}
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
            colors={TEXT_COLORS}
            value={settings.strokeColor}
            onChange={(color) => onChange({ ...settings, strokeColor: color })}
          />
        </div>
      )}
    </div>
  );
}
