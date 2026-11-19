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
  Ban,
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
import { FILL_FIRST_KINDS, SHAPE_KIND_NAME, SHAPE_NAME_KIND } from "@/lib/drawEditState";
import { canonicalCornerRadii, cornerCount } from "@/lib/shapeSloppiness";
import type { DiagramShapeName } from "@/lib/types";
import { isDiagramKind } from "@/lib/diagramShapes";
import { DIAGRAM_SHAPE_GROUPS } from "./diagramShapeIcons";
import { ControlRow } from "@/components/ui/control-row";
import { PinStepsControls } from "./PinStepsControls";

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

// A fill-first shape's optional stroke: None first, because none is the
// default, then three widths. The width a stroke is turned on at when its
// color is picked while it is still None is the first real one.
const SHAPE_STROKE_PRESETS = [0, 2, 4, 8] as const;
const SHAPE_STROKE_ON = SHAPE_STROKE_PRESETS[1];

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
    info: "Pick a shape and its fill color, then click-drag on the canvas to draw it. A shape is filled and has no outline until you give it one under Stroke. It stays live-editable until you commit it: drag the handles to resize, the hook below the box to rotate (Shift snaps to 15°), the dots inside the corners to round them (Shift rounds one corner only), and a circle's oval handle — left of its box — to stretch it into an oval.",
  },
  {
    id: "pens",
    label: "Pins",
    icon: MapPin,
    info: "Click the canvas to drop an auto-sequenced callout pin — Numbers or Letters, in the order you place them.",
  },
  {
    id: "arrows",
    label: "Arrows & Diagram Shapes",
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
  // Fill first, or stroke first? The shape in hand decides — the reselected
  // one if there is one, else the tile. Everything with an interior on this
  // tab is fill first; the line (and a reselected pin or arrow) has only a
  // stroke, so it leads with that, like the Arrows tab.
  const fillFirst = FILL_FIRST_KINDS.has(editingKind ?? SHAPE_NAME_KIND[currentShape] ?? -1);
  // Arrows panel: the line arrow is picked (the default), or a diagram shape.
  // A reselected diagram shape shows its own controls whatever is picked —
  // the starPoints rule above.
  const arrowPicked = (settings.arrowShape ?? "arrow") === "arrow";
  const diagramInHand = !arrowPicked || (editingKind != null && isDiagramKind(editingKind));

  return (
    // data-draw-panel: clicking inside this panel must NOT commit a pending
    // shape edit, so stroke/color/shape tweaks live-update the overlay.
    <div data-draw-panel>
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

                  {/* THE COLOR PALETTE COMES FIRST (Chris, 11-19-2026) — a
                      design-system rule since, UI_CONSISTENCY §8: the color is
                      the first thing chosen about a shape, so it is the first
                      control under the tiles. A shape with an interior is
                      FILL FIRST: this is its fill, and its stroke is the
                      closed Stroke section at the foot. The line has no
                      interior, so its one color is its stroke and the width
                      follows it directly, as on the Arrows tab. */}
                  {fillFirst ? (
                    <ColorSwatchGrid
                      label="Fill Color"
                      colors={TEXT_COLORS}
                      value={settings.shapeFillColor}
                      // A reselected older shape may be outline-only, a
                      // gradient or a pixelate box: then no swatch is its
                      // fill, and picking one makes it a solid.
                      selected={settings.shapeFillMode === "solid"}
                      onChange={(color) =>
                        onChange({ ...settings, shapeFillMode: "solid", shapeFillColor: color })
                      }
                    />
                  ) : (
                    <StrokeFirst settings={settings} onChange={onChange} />
                  )}

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

                  {/* Sloppiness — how hand-drawn the outline is, firm (0) →
                      hand-drawn (100). It roams the STROKE, never the fill,
                      so on a shape with no stroke there is nothing to roam. */}
                  <SizeSlider
                    label="Sloppiness"
                    value={settings.sloppiness ?? 0}
                    onChange={(v) => onChange({ ...settings, sloppiness: v })}
                    presets={SLOPPINESS_PRESETS}
                    variant="numbers"
                    unit="%"
                  />

                  {fillFirst && <ShapeStrokeSection settings={settings} onChange={onChange} />}
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

                  {/* Next number (insert a step) and Renumber. */}
                  <PinStepsControls letters={settings.pinLabel === "letters"} />

                  {/* Color (pin fill), then the pin's size — which reuses the
                      Stroke Width slider. Palette first, as on every tab. */}
                  <StrokeFirst settings={settings} onChange={onChange} colorLabel="Color" />
                </>
              );

            // ── Arrows & Diagram Shapes ── the line arrow (Single / Double),
            // then 30 diagram shapes in three groups. One pick across all
            // four rows: `arrowShape` is "arrow" or a diagram shape's name.
            case "arrows":
              return (
                <>
                  <ControlRow label="Arrow">
                    {({ labelId }) => (
                      <ToolButtonGroup
                        aria-labelledby={labelId}
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
                    )}
                  </ControlRow>

                  {DIAGRAM_SHAPE_GROUPS.map(({ group, options }) => (
                    <ControlRow label={group}>
                      {({ labelId }) => (
                        <ToolButtonGroup
                          key={group}
                          aria-labelledby={labelId}
                          stacked
                          columns={3}
                          options={options}
                          value={arrowPicked ? undefined : (settings.arrowShape as DiagramShapeName)}
                          onChange={(id) => onChange({ ...settings, arrowShape: id })}
                        />
                      )}
                    </ControlRow>
                  ))}

                  {/* Stroke Color, then Stroke Width: an arrow is only a
                      stroke, and a diagram shape is read by its outline, so
                      this tab stays stroke first — palette first all the same. */}
                  <StrokeFirst settings={settings} onChange={onChange} />

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

type PanelProps = Pick<ShapesSettingsProps, "settings" | "onChange">;

/** The four growing dots every Stroke Width row shows above its track. */
const strokeDot = (preset: number) => (
  <span
    className="rounded-full bg-theme-foreground"
    style={{ width: preset * 2, height: preset * 2 }}
  />
);

/** Stroke Color, then Stroke Width — the two controls of everything that is
 *  drawn as a stroke: the line, the arrow, a diagram shape's outline, and a
 *  pin (whose "stroke width" is its size, and whose color is just Color).
 *  One component so the order is one decision: the palette first. */
function StrokeFirst({
  settings,
  onChange,
  colorLabel = "Stroke Color",
}: PanelProps & { colorLabel?: string }) {
  return (
    <>
      <ColorSwatchGrid
        label={colorLabel}
        colors={TEXT_COLORS}
        value={settings.strokeColor}
        onChange={(color) => onChange({ ...settings, strokeColor: color })}
      />
      <SizeSlider
        label="Stroke Width"
        value={settings.strokeWidth}
        min={1}
        max={10}
        onChange={(v) => onChange({ ...settings, strokeWidth: v })}
        presets={STROKE_WIDTH_PRESETS}
        renderPreset={strokeDot}
      />
    </>
  );
}

/** Stroke — a fill-first shape's optional outline, closed like Placement.
 *  None is the default (Chris, 11-19-2026: "default stroke is none"), and the
 *  shut header says so, or says the width once there is one, so a stroke
 *  that is ON is never hidden.
 *
 *  Picking a Stroke Color while the stroke is still None turns it on at the
 *  first width: a color click that changed nothing on the canvas would read
 *  as broken. An OUTLINE-ONLY shape (a reselected older one) cannot go back
 *  to None — with no fill either it would be an invisible object. */
function ShapeStrokeSection({ settings, onChange }: PanelProps) {
  const width = settings.shapeStrokeWidth;
  const least = settings.shapeFillMode === "none" ? 1 : 0;
  return (
    <CollapsibleSection label="Stroke" summary={width > 0 ? `${width} px` : "None"}>
      <ColorSwatchGrid
        label="Stroke Color"
        colors={TEXT_COLORS}
        value={settings.shapeStrokeColor}
        selected={width > 0}
        onChange={(color) =>
          onChange({
            ...settings,
            shapeStrokeColor: color,
            shapeStrokeWidth: width > 0 ? width : SHAPE_STROKE_ON,
          })
        }
      />
      <SizeSlider
        label="Stroke Width"
        value={width}
        valueDisplay={width > 0 ? undefined : "None"}
        onChange={(v) => onChange({ ...settings, shapeStrokeWidth: Math.max(least, v) })}
        presets={SHAPE_STROKE_PRESETS}
        renderPreset={(preset) =>
          preset > 0 ? strokeDot(preset) : <Ban aria-hidden className="size-3.5 text-theme-muted-foreground" />
        }
      />
    </CollapsibleSection>
  );
}

/** Fill — None / Solid / Gradient / Pixelate, and each one's controls. The
 *  DIAGRAM shapes' section only since 11-19-2026: the Shapes tab's shapes are
 *  fill first, so their fill is the Fill Color palette at the top of the
 *  panel and this dropdown left that tab.
 *
 *  Collapsed, like Placement (Chris, 11-07-2026: "treat like placement and
 *  do a closed dropdown"). The header is the word itself, so the mode tiles
 *  carry no second heading; their accessible name is still "Fill". The
 *  closed summary shows the mode, so a fill that is ON is never hidden. */
function FillSection({ settings, onChange }: PanelProps) {
  const mode = settings.fillMode ?? "none";
  return (
    <CollapsibleSection
      label="Fill"
      summary={FILL_MODES.find((m) => m.id === mode)?.label}
    >
      <ToolButtonGroup
        aria-label="Fill"
        options={FILL_MODES}
        value={mode}
        onChange={(id) =>
          onChange({ ...settings, fillMode: id as ToolSettings["fillMode"] })
        }
      />

      {settings.fillMode === "solid" && (
        <ColorSwatchGrid
          label="Fill Color"
          colors={TEXT_COLORS}
          value={settings.fillColor}
          onChange={(color) => onChange({ ...settings, fillColor: color })}
        />
      )}

      {settings.fillMode === "gradient" && (
        <div className="space-y-4">
          {/* The grid's own label slot, not a span above a grid that also
              said "Color": two words for one row, and two radio groups both
              named "Color". */}
          <ColorSwatchGrid
            label="From"
            colors={TEXT_COLORS}
            value={settings.fillColor}
            onChange={(color) => onChange({ ...settings, fillColor: color })}
          />
          <ColorSwatchGrid
            label="To"
            colors={TEXT_COLORS}
            value={settings.fillColor2}
            onChange={(color) => onChange({ ...settings, fillColor2: color })}
          />
          <ControlRow label="Direction">
            {({ labelId }) => (
              <ToolButtonGroup
                aria-labelledby={labelId}
                options={GRADIENT_DIRS}
                value={
                  String(settings.gradientAngle ?? 0) as
                    (typeof GRADIENT_DIRS)[number]["id"]
                }
                onChange={(id) =>
                  onChange({ ...settings, gradientAngle: Number(id) })
                }
              />
            )}
          </ControlRow>
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
    </CollapsibleSection>
  );
}
