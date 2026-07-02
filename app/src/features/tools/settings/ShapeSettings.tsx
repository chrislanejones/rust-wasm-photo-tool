import { useState } from "react";
import {
  Square,
  Circle,
  PenLine,
  Minus,
  Hash,
  Type,
  ArrowRight,
  ArrowLeftRight,
} from "lucide-react";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { TabGroup } from "@/components/TabGroup";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { SizeSlider } from "@/components/SizeSlider";
import { PlacementGrid, type PlacementCell } from "@/components/PlacementGrid";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";

const SHAPES = [
  { id: "rect",       label: "Rectangle", icon: Square  },
  { id: "circle",     label: "Circle",    icon: Circle  },
  { id: "handCircle", label: "Hand-drawn", icon: PenLine },
  { id: "line",       label: "Line",      icon: Minus   },
] as const;

const PIN_LABELS = [
  { id: "numbers", label: "Numbers", icon: Hash },
  { id: "letters", label: "Letters", icon: Type },
] as const;

const ARROW_STYLES = [
  { id: "single", label: "Single", icon: ArrowRight },
  { id: "double", label: "Double", icon: ArrowLeftRight },
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
  /** Place the selected shape into one of the nine grid cells. */
  onPlace?: (cell: PlacementCell) => void;
  /** A shape is selected (created & selected / clicked / Reselect) → grid enabled. */
  canPlace?: boolean;
}

export function ShapesSettings({ settings, onChange, activeMode, onModeChange, onPlace, canPlace = false }: ShapesSettingsProps) {
  const [internalMode, setInternalMode] = useState<ShapesMode>("shapes");
  const mode = activeMode ?? internalMode;
  const currentShape = (settings.shape ?? "rect") as ShapeType;

  return (
    // data-draw-panel: clicking inside this panel must NOT commit a pending
    // shape edit, so stroke/colour/shape tweaks live-update the overlay.
    <div className="space-y-3 -mt-2" data-draw-panel>
      <TabGroup
        tabs={[
          { id: "shapes", label: "Shapes" },
          { id: "pens", label: "Pins" },
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
        <div className="space-y-3">
          <SectionHeader
            title="Shapes"
            info="Pick a shape, style it below, then click-drag on the canvas to draw it — it stays live-editable (drag handles, re-angle) until you commit it."
          />

          {/* Shape selector — stacked tiles (icon on top, label below). */}
          <ToolButtonGroup
            stacked
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
              <label className="text-2xs font-bold text-theme-muted-foreground">
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
                    <span className="text-2xs text-theme-muted-foreground">From</span>
                    <ColorSwatchGrid
                      colors={TEXT_COLORS}
                      value={settings.fillColor}
                      onChange={(color) => onChange({ ...settings, fillColor: color })}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-2xs text-theme-muted-foreground">To</span>
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
                  <p className="text-2xs leading-relaxed text-theme-muted-foreground">
                    Mosaics whatever is beneath the box — a re-selectable redaction
                    box you can move, resize, and undo from the Review panel.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Pins tab ── click the image to drop an auto-sequenced callout disc.
          A static body (no mode toggle / panel swap): Stroke Width → pin
          label style → colour. */}
      {mode === "pens" && (
        <div className="space-y-3">
          <SectionHeader
            title="Pins"
            info="Click the canvas to drop an auto-sequenced callout pin — Numbers or Letters, in the order you place them."
          />

          {/* Pin label style: Numbers / Letters — first, above the size. */}
          <ToolButtonGroup
            stacked
            options={PIN_LABELS}
            value={settings.pinLabel ?? "numbers"}
            onChange={(id) =>
              onChange({ ...settings, pinLabel: id as "numbers" | "letters" })
            }
          />

          {/* Pin size — reuses the Stroke Width slider. */}
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

          {/* Color (pin fill). */}
          <ColorSwatchGrid
            colors={TEXT_COLORS}
            value={settings.strokeColor}
            onChange={(color) => onChange({ ...settings, strokeColor: color })}
          />
        </div>
      )}

      {/* ── Arrows tab ── mirrors the Pins tab: Stroke Width (dots variant) →
          style toggle → colour, same spacing + same components. */}
      {mode === "arrows" && (
        <div className="space-y-3">
          <SectionHeader
            title="Arrow"
            info="Single or double-headed. Drag on the canvas to draw it, then hold Shift while dragging an endpoint to snap the angle to 0/90/180/270°."
          />

          {/* Arrow style: Single / Double — first, above the size. */}
          <ToolButtonGroup
            stacked
            options={ARROW_STYLES}
            value={settings.arrowStyle ?? "single"}
            onChange={(id) =>
              onChange({ ...settings, arrowStyle: id as "single" | "double" })
            }
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

          {/* Color */}
          <ColorSwatchGrid
            colors={TEXT_COLORS}
            value={settings.strokeColor}
            onChange={(color) => onChange({ ...settings, strokeColor: color })}
          />
        </div>
      )}

      {onPlace && (
        <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
          <PlacementGrid
            label="Placement"
            info={
              canPlace
                ? "Numpad 1-9 also work, spatially matched to the grid."
                : "Select a shape to place it on the canvas."
            }
            disabled={!canPlace}
            numpadKeys={canPlace}
            onChange={onPlace}
          />
        </div>
      )}
    </div>
  );
}
