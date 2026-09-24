import { useState } from "react";
import {
  Square,
  Circle,
  Minus,
  Hash,
  Type,
  ArrowRight,
  ArrowLeftRight,
  Shapes as ShapesIcon,
  MapPin,
  ArrowUpRight,
  Diamond,
  Star,
} from "lucide-react";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { SizeSlider } from "@/components/SizeSlider";
import { PlacementGrid, type PlacementCell } from "@/components/PlacementGrid";
import type { ToolSettings } from "@/lib/types";
import type { ShapesMode } from "@/stores/useToolStore";
import { TEXT_COLORS } from "@/lib/colors";
import { PANEL_SECTION } from "@/lib/styles";

const SHAPES = [
  { id: "rect",    label: "Rectangle", icon: Square  },
  { id: "circle",  label: "Circle",    icon: Circle  },
  { id: "line",    label: "Line",      icon: Minus   },
  { id: "diamond", label: "Diamond",   icon: Diamond },
  { id: "star",    label: "Star",      icon: Star    },
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

// Sloppiness presets — numbers variant, same 4-above-the-track layout as the
// Eraser's Opacity slider. 0 (firm) is a real preset, then 25/50/100, so the
// hand-drawn range tops out at 100%.
const SLOPPINESS_PRESETS = [0, 25, 50, 100] as const;

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

/** Shapes' sub-modes for the shared ToolModeToggle (icon tiles + per-mode
 *  SectionHeader title/info) — same 2-column icon-grid pattern Paint/Resize/
 *  Select/Crop already use. `shapes` isn't in the tool registry yet (still a
 *  LEGACY_SUBMODES entry in features/tools/toolModes.ts), so this stays local
 *  rather than exported — a registry migration is a separate session. */
const SHAPES_TOOL_MODES: readonly ToolMode<ShapesMode>[] = [
  {
    id: "shapes",
    label: "Shapes",
    icon: ShapesIcon,
    info: "Pick a shape, style it below, then click-drag on the canvas to draw it — it stays live-editable (drag handles, re-angle) until you commit it.",
  },
  {
    id: "pens",
    label: "Pens",
    icon: MapPin,
    info: "Click the canvas to drop an auto-sequenced callout pin — Numbers or Letters, in the order you place them.",
  },
  {
    id: "arrows",
    label: "Arrows",
    title: "Arrow",
    icon: ArrowUpRight,
    info: "Single or double-headed. Drag on the canvas to draw it, then hold Shift while dragging an endpoint to snap the angle to 0/90/180/270°.",
  },
];

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
    // shape edit, so stroke/color/shape tweaks live-update the overlay.
    <div className="space-y-3 -mt-2" data-draw-panel>
      <ToolModeToggle
        modes={SHAPES_TOOL_MODES}
        columns={3}
        activeMode={mode}
        onModeChange={(m) => {
          setInternalMode(m);
          onModeChange?.(m);
        }}
      >
        {(m) => {
          switch (m) {
            // ── Shapes ──
            case "shapes":
              return (
                <>
                  {/* Shape selector — stacked tiles (icon on top, label below). */}
                  <ToolButtonGroup
                    aria-label="Shape"
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

                  {/* Stroke Sloppiness — how hand-drawn the outline is. Same
                      SizeSlider as Stroke Width/Opacity (numbers variant), so
                      firm (0) → hand-drawn (100) with the max at the top. */}
                  <SizeSlider
                    label="Sloppiness"
                    value={settings.sloppiness ?? 0}
                    onChange={(v) => onChange({ ...settings, sloppiness: v })}
                    presets={SLOPPINESS_PRESETS}
                    variant="numbers"
                    unit="%"
                  />

                  {/* Stroke Color */}
                  <ColorSwatchGrid
                    colors={TEXT_COLORS}
                    value={settings.strokeColor}
                    onChange={(color) => onChange({ ...settings, strokeColor: color })}
                  />

                  {/* Fill — rect + circle only (line/diamond/star have no fill
                      in the engine: `fill_shape` handles kinds 0/1 only) */}
                  {(currentShape === "rect" || currentShape === "circle") && (
                    <div className="space-y-4">
                      <label className="text-2xs font-bold text-theme-muted-foreground">
                        Fill
                      </label>
                      <ToolButtonGroup
                        aria-label="Fill"
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
                </>
              );

            // ── Pins ── click the image to drop an auto-sequenced callout
            // disc. A static body: pin label style → size → color.
            case "pens":
              return (
                <>
                  {/* Pin label style: Numbers / Letters — first, above the size. */}
                  <ToolButtonGroup
                    aria-label="Pin label style"
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
                </>
              );

            // ── Arrows ── mirrors Pins: style toggle → size → color.
            case "arrows":
              return (
                <>
                  {/* Arrow style: Single / Double — first, above the size. */}
                  <ToolButtonGroup
                    aria-label="Arrow style"
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
                </>
              );
          }
        }}
      </ToolModeToggle>

      {onPlace && (
        <div className={PANEL_SECTION}>
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
