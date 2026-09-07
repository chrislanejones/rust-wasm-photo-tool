import { Frame, Grid3x3, LayoutGrid, Ruler } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { GridKind, Preferences, RulerUnit } from "@/lib/preferences";

/**
 * Rulers & Grid — non-destructive canvas overlays persisted via
 * `lib/preferences.ts` (`usePreferences`, localStorage `image-horse-prefs`):
 * - Rulers — top + left rulers whose tick labels track the zoom level.
 * - Grid — a composition overlay: uniform squares, golden-ratio guides, or an
 *   N×M division. Colour + opacity apply to every layout.
 *
 * ⚠️ RENDERED IN TWO PLACES AT TWO WIDTHS: the Settings modal (wide) and the
 * tool sidebar (narrow, Edit → Rulers and Grid). It is built for the NARROW
 * one, because that is the one that breaks — the previous version used
 * full-width `ToggleButtonGroup` rows and the third Layout button was clipped
 * off the right edge in the sidebar.
 *
 * So it uses the same primitives every other tool panel uses rather than its
 * own: `SectionHeader` for the title + lightbulb, `ToolButtonGroup` for the
 * pick-one rows (the Stroke Stabilizer pattern — it wraps on a `columns` grid
 * instead of one squeezed row), and `ColorSwatchGrid` for the colour.
 *
 * And the prose is in the lightbulbs, not the panel. A tool panel is
 * button-only; the explanation hides behind the info icon (`SectionHeader`'s
 * own doc says so, and the paragraphs here were what pushed the controls out
 * of the visible area).
 */
interface RulersGridsPaneProps {
  /** The draft being edited (owned by the Settings modal). */
  value: Preferences;
  /** Patch the draft; the Settings footer's Apply commits it. */
  onChange: (patch: Partial<Preferences>) => void;
}

const RULER_TOGGLE = [
  { id: "off" as const, label: "Off", icon: Ruler },
  { id: "on" as const, label: "On", icon: Ruler },
];

const RULER_UNITS: { id: RulerUnit; label: string }[] = [
  { id: "px", label: "Pixels" },
  { id: "in", label: "Inches" },
  { id: "cm", label: "Cm" },
];

const GRID_TOGGLE = [
  { id: "off" as const, label: "Off", icon: Grid3x3 },
  { id: "on" as const, label: "On", icon: Grid3x3 },
];

const GRID_LAYOUTS: { id: GridKind; label: string; icon: typeof Grid3x3 }[] = [
  { id: "square", label: "Square", icon: Grid3x3 },
  { id: "golden", label: "Golden", icon: Frame },
  { id: "grid", label: "Grid", icon: LayoutGrid },
];

/** Fixed, high-contrast set — a grid overlay has to read against an arbitrary
 *  photo, so this is a functional palette, not a creative one. `allowCustom`
 *  is off for that reason: the user's saved paint colours are the wrong list
 *  to offer here. */
const GRID_COLORS: readonly string[] = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#06b6d4",
];

export function RulersGridsPane({ value, onChange }: RulersGridsPaneProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionHeader
          title="Rulers"
          info={
            <>
              Top and left rulers along the canvas; the tick labels track the
              zoom level. Inches and centimetres are derived at 96&nbsp;DPI — a
              web image has no physical size of its own, so that is a fixed
              convention rather than a print measurement.
            </>
          }
        />
        <ToolButtonGroup
          options={RULER_TOGGLE}
          value={value.rulers ? "on" : "off"}
          onChange={(id) => onChange({ rulers: id === "on" })}
        />
        {/* Units stay hidden while the rulers are off — a unit picker for an
            invisible ruler is a control with no visible effect, which is how a
            panel starts feeling broken. */}
        {value.rulers && (
          <ToolButtonGroup
            label="Units"
            options={RULER_UNITS}
            columns={3}
            value={value.rulerUnit}
            onChange={(id) => onChange({ rulerUnit: id })}
          />
        )}
      </div>

      <div className="space-y-2">
        <SectionHeader
          title="Grid"
          info={
            <>
              A non-destructive overlay to guide composition and alignment. It
              is drawn over the canvas and never touches the image, so it is
              absent from every export.
            </>
          }
        />
        <ToolButtonGroup
          options={GRID_TOGGLE}
          value={value.grid ? "on" : "off"}
          onChange={(id) => onChange({ grid: id === "on" })}
        />
      </div>

      {value.grid && (
        <div className="space-y-2">
          <SectionHeader
            title="Layout"
            info={
              <>
                <strong className="font-semibold text-theme-foreground">
                  Square
                </strong>{" "}
                lays uniform squares at the spacing you set.{" "}
                <strong className="font-semibold text-theme-foreground">
                  Golden
                </strong>{" "}
                draws golden-ratio guides and takes no parameters.{" "}
                <strong className="font-semibold text-theme-foreground">
                  Grid
                </strong>{" "}
                divides the canvas into a fixed column × row split. Colour and
                opacity apply to all three.
              </>
            }
          />
          <ToolButtonGroup
            options={GRID_LAYOUTS}
            columns={3}
            stacked
            value={value.gridKind}
            onChange={(id) => onChange({ gridKind: id })}
          />

          {value.gridKind === "square" && (
            <SizeSlider
              label="Spacing"
              value={value.gridSpacing}
              onChange={(v) => onChange({ gridSpacing: v })}
              min={8}
              max={200}
              step={2}
              unit=" px"
            />
          )}

          {value.gridKind === "grid" && (
            <>
              <SizeSlider
                label="Columns"
                value={value.gridCols}
                onChange={(v) => onChange({ gridCols: v })}
                min={1}
                max={16}
                step={1}
                unit=""
              />
              <SizeSlider
                label="Rows"
                value={value.gridRows}
                onChange={(v) => onChange({ gridRows: v })}
                min={1}
                max={16}
                step={1}
                unit=""
              />
            </>
          )}

          <ColorSwatchGrid
            label="Color"
            colors={GRID_COLORS}
            value={value.gridColor}
            onChange={(hex) => onChange({ gridColor: hex })}
            allowCustom={false}
          />

          <SizeSlider
            label="Opacity"
            value={value.gridOpacity}
            onChange={(v) => onChange({ gridOpacity: v })}
            min={5}
            max={100}
            step={5}
            unit="%"
          />
        </div>
      )}
    </div>
  );
}
