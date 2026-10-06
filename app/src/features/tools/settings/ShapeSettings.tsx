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
  Triangle,
} from "lucide-react";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { SizeSlider } from "@/components/ui/size-slider";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PlacementGrid, type PlacementCell } from "@/components/PlacementGrid";
import type { ToolSettings } from "@/lib/types";
import type { ShapesMode } from "@/stores/useToolStore";
import { TEXT_COLORS } from "@/lib/colors";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { shapeCanFill, SHAPE_KIND_NAME } from "@/lib/drawEditState";
import { canonicalCornerRadii, cornerCount } from "@/lib/shapeSloppiness";
import type { DiagramShapeName } from "@/lib/types";
import { isDiagramKind } from "@/lib/diagramShapes";
import { DIAGRAM_SHAPE_GROUPS } from "./diagramShapeIcons";

// Six, laid out 3 × 2 — the same grid as Select → Selection, so the two
// "row of tiles" panels read as one family.
const SHAPES = [
  { id: "rect",     label: "Rectangle", icon: Square   },
  { id: "circle",   label: "Circle",    icon: Circle   },
  { id: "line",     label: "Line",      icon: Minus    },
  { id: "diamond",  label: "Diamond",   icon: Diamond  },
  { id: "star",     label: "Star",      icon: Star     },
  { id: "triangle", label: "Triangle",  icon: Triangle },
] as const;

// Star points — numbers variant like Sloppiness. 3 is the fewest that still
// reads as a star; 12 is where the tips start to blur into a sunburst.
const STAR_POINT_PRESETS = [3, 5, 8, 12] as const;

const PIN_LABELS = [
  { id: "numbers", label: "Numbers", icon: Hash },
  { id: "letters", label: "Letters", icon: Type },
] as const;

const ARROW_STYLES = [
  { id: "single", label: "Single", icon: ArrowRight },
  { id: "double", label: "Double", icon: ArrowLeftRight },
] as const;

const STROKE_WIDTH_PRESETS = [2, 4, 6, 8] as const;

// Corner radius presets, px — numbers variant like Points. Square, a soft
// round, a card, and a pill on most shapes (the engine clamps to what fits).
const CORNER_RADIUS_PRESETS = [0, 8, 24, 64] as const;

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
    info: "Pick a shape, style it below, then click-drag on the canvas to draw it — it stays live-editable until you commit it: drag the handles to resize, the hook below the box to rotate (Shift snaps to 15°), and the dots inside the corners to round them (Shift rounds one corner only).",
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
    title: "Arrows & Diagram Shapes",
    icon: ArrowUpRight,
    info: "A single or double-headed arrow, or one of 30 diagram shapes — flowchart symbols, basic shapes and block arrows. Drag on the canvas to draw it. An arrow's endpoints snap to 0/90/180/270° with Shift; a shape resizes, turns and fills like any other.",
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
  // A reselected star needs its Points slider even when the panel's tile says
  // something else — the tile is what you draw NEXT, not what is selected.
  const starSelected = useAnnotationStore((s) => s.editingShapeKind === 9);
  // Same for corners: a reselected rounded square shows its radius even when
  // the tile says Circle. Pins (5) re-edit as circles and have none.
  const editingKind = useAnnotationStore((s) => s.editingShapeKind);
  const editingShape = editingKind == null ? undefined : SHAPE_KIND_NAME[editingKind];
  const radiusOf = (name: string | undefined) =>
    name && cornerCount(name) > 0 ? name : null;
  const radiusShape = editingKind == null ? radiusOf(currentShape) : radiusOf(editingShape);
  const radii = canonicalCornerRadii(radiusShape ?? "rect", settings.cornerRadii);
  const cornersUsed = radiusShape === "triangle" ? 3 : radiusShape === "star" ? 1 : 4;
  const mixed = radii.slice(0, cornersUsed).some((r) => r !== radii[0]);
  // Arrows panel: the line arrow is picked (the default), or a diagram shape.
  // A reselected diagram shape shows its own controls whatever is picked —
  // the starPoints rule above.
  const arrowPicked = (settings.arrowShape ?? "arrow") === "arrow";
  const diagramInHand = !arrowPicked || (editingKind != null && isDiagramKind(editingKind));

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
                    columns={3}
                    options={SHAPES}
                    value={currentShape}
                    onChange={(id) => onChange({ ...settings, shape: id })}
                  />

                  {/* Points — the star only. The count lives on the star rather
                      than the triangle because a star with 4 or 8 points is
                      still a star; a triangle with 5 is a pentagon. */}
                  {(currentShape === "star" || starSelected) && (
                    <SizeSlider
                      label="Points"
                      value={settings.starPoints ?? 5}
                      onChange={(v) => onChange({ ...settings, starPoints: v })}
                      presets={STAR_POINT_PRESETS}
                      variant="numbers"
                    />
                  )}

                  {/* Corner Radius — every shape with corners (not the circle
                      or the line). Sets all corners at once; the dots inside
                      the corners on the canvas do the same, and Shift-drag on
                      one rounds that corner only, which reads here as Mixed. */}
                  {radiusShape && (
                    <SizeSlider
                      label="Corner Radius"
                      value={Math.max(...radii.slice(0, cornersUsed))}
                      valueDisplay={mixed ? "Mixed" : undefined}
                      onChange={(v) => onChange({ ...settings, cornerRadii: [v, v, v, v] })}
                      presets={CORNER_RADIUS_PRESETS}
                      variant="numbers"
                      unit="px"
                    />
                  )}

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

                  {/* Fill — every shape that encloses an area: rect, circle,
                      diamond, star, triangle. The line is the one shape with no
                      interior, so it is the one without this section. */}
                  {shapeCanFill(currentShape) && (
                    <FillSection settings={settings} onChange={onChange} />
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

            // ── Arrows & Diagram Shapes ── the line arrow (Single / Double),
            // then 30 diagram shapes in three groups. One pick across all
            // four rows: `arrowShape` is "arrow" or a diagram shape's name.
            case "arrows":
              return (
                <>
                  <ToolButtonGroup
                    label="Arrow"
                    stacked
                    options={ARROW_STYLES}
                    value={arrowPicked ? (settings.arrowStyle ?? "single") : undefined}
                    onChange={(id) =>
                      onChange({
                        ...settings,
                        arrowShape: "arrow",
                        arrowStyle: id as "single" | "double",
                      })
                    }
                  />

                  {DIAGRAM_SHAPE_GROUPS.map(({ group, options }) => (
                    <ToolButtonGroup
                      key={group}
                      label={group}
                      stacked
                      columns={3}
                      options={options}
                      value={arrowPicked ? undefined : (settings.arrowShape as DiagramShapeName)}
                      onChange={(id) => onChange({ ...settings, arrowShape: id })}
                    />
                  ))}

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

                  {/* Sloppiness — a diagram shape only; the arrow has none. */}
                  {diagramInHand && (
                    <SizeSlider
                      label="Sloppiness"
                      value={settings.sloppiness ?? 0}
                      onChange={(v) => onChange({ ...settings, sloppiness: v })}
                      presets={SLOPPINESS_PRESETS}
                      variant="numbers"
                      unit="%"
                    />
                  )}

                  {/* Color */}
                  <ColorSwatchGrid
                    colors={TEXT_COLORS}
                    value={settings.strokeColor}
                    onChange={(color) => onChange({ ...settings, strokeColor: color })}
                  />

                  {/* Every diagram shape is closed, so every one fills. */}
                  {diagramInHand && <FillSection settings={settings} onChange={onChange} />}
                </>
              );
          }
        }}
      </ToolModeToggle>

      {/* Placement, collapsed (Chris, 09-30-2026). It took the disclosure
          FROM the Stroke Stabilizer, which people should see rather than have
          to open; placing from a 9-cell grid is the recognisable thing that
          can wait. Since 10-05-2026 the header is named for what is inside,
          so the grid carries no second heading; its accessible name is still
          "Placement". No closed summary: the grid holds no state between
          uses. */}
      {onPlace && (
        <CollapsibleSection
          label="Placement"
          info={
            canPlace
              ? "Numpad 1-9 also work, spatially matched to the grid."
              : "Select a shape to place it on the canvas."
          }
        >
          <PlacementGrid
            disabled={!canPlace}
            numpadKeys={canPlace}
            onChange={onPlace}
          />
        </CollapsibleSection>
      )}
    </div>
  );
}

/** Fill — None / Solid / Gradient / Pixelate, and each one's controls. One
 *  section for every shape with an interior, in both the Shapes and the
 *  Arrows & Diagram Shapes panels. */
function FillSection({ settings, onChange }: Pick<ShapesSettingsProps, "settings" | "onChange">) {
  return (
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
            Mosaics whatever is beneath the shape — a re-selectable redaction
            you can move, resize, and undo from the Review panel.
          </p>
        </div>
      )}
    </div>
  );
}
