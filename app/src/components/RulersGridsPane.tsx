import { Frame, Grid3x3, LayoutGrid, Ruler } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { GridKind, Preferences } from "@/lib/preferences";

/**
 * Settings → Rulers & Grids pane. Non-destructive canvas overlays persisted via
 * `lib/preferences.ts` (`usePreferences`, localStorage key `image-horse-prefs`):
 * - Rulers — top + left pixel rulers whose tick labels track the zoom level.
 * - Grid — a composition/alignment overlay in one of three layouts:
 *     • "square" — uniform px squares (driven by `gridSpacing`).
 *     • "golden" — golden-ratio guide lines (no parameters).
 *     • "grid"   — an N×M division (driven by `gridCols` / `gridRows`).
 *   Color + opacity apply to every layout.
 */
interface RulersGridsPaneProps {
  /** The draft being edited (owned by the Settings modal). */
  value: Preferences;
  /** Patch the draft; the Settings footer's Apply commits it. */
  onChange: (patch: Partial<Preferences>) => void;
}

const GRID_LAYOUTS: { kind: GridKind; label: string; icon: typeof Grid3x3 }[] = [
  { kind: "square", label: "Square", icon: Grid3x3 },
  { kind: "golden", label: "Golden", icon: Frame },
  { kind: "grid", label: "Grid", icon: LayoutGrid },
];

const GRID_COLORS: string[] = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#06b6d4",
];

export function RulersGridsPane({ value, onChange }: RulersGridsPaneProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Rulers</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Top + left pixel rulers along the canvas; tick labels track zoom.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          items={[
            {
              key: "rulers-off",
              icon: Ruler,
              label: "Off",
              active: !value.rulers,
              onToggle: () => onChange({ rulers: false }),
            },
            {
              key: "rulers-on",
              icon: Ruler,
              label: "On",
              active: value.rulers,
              onToggle: () => onChange({ rulers: true }),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Grid</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            A non-destructive overlay to guide composition and alignment.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          items={[
            {
              key: "grid-off",
              icon: Grid3x3,
              label: "Off",
              active: !value.grid,
              onToggle: () => onChange({ grid: false }),
            },
            {
              key: "grid-on",
              icon: Grid3x3,
              label: "On",
              active: value.grid,
              onToggle: () => onChange({ grid: true }),
            },
          ]}
        />
      </section>

      {value.grid && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Layout</h3>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Uniform squares, golden-ratio guides, or a fixed column × row split.
            </p>
          </div>
          <ToggleButtonGroup
            fill
            items={GRID_LAYOUTS.map(({ kind, label, icon }) => ({
              key: kind,
              icon,
              label,
              active: value.gridKind === kind,
              onToggle: () => onChange({ gridKind: kind }),
            }))}
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

          {value.gridKind === "golden" && (
            <p className="text-xs text-text-muted">
              Golden-ratio lines have no parameters.
            </p>
          )}

          <div className="space-y-1.5">
            <span className="text-2xs text-text-muted">Color</span>
            <div className="flex gap-2">
              {GRID_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onChange({ gridColor: hex })}
                  aria-label={`Grid color ${hex}`}
                  className={
                    "h-7 w-7 rounded-md border border-border" +
                    (value.gridColor === hex ? " ring-2 ring-border-active" : "")
                  }
                  style={{ background: hex }}
                />
              ))}
            </div>
          </div>

          <SizeSlider
            label="Opacity"
            value={value.gridOpacity}
            onChange={(v) => onChange({ gridOpacity: v })}
            min={5}
            max={100}
            step={5}
            unit="%"
          />
        </section>
      )}
    </div>
  );
}
