import { ToolButton } from "@/components/ui/tool-button";
import { cn } from "@/lib/utils";

export interface ToolButtonOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Disable THIS tile only, on top of the group-wide `disabled`. An action
   *  group is rarely uniformly available — Selection's "All" works with
   *  nothing selected while Deselect/Delete/Copy/Cut do not. Without this a
   *  caller has to hand-roll the grid and loses the shared styling. */
  disabled?: boolean;
  /** Native tooltip for this tile. Action groups carry their keyboard
   *  shortcut here ("Select all (Alt+A)"), which is the only place that
   *  shortcut is discoverable from the panel. */
  title?: string;
  /** Light THIS tile from its OWN state instead of from the group's `value`.
   *  For an independent toggle sitting in a group of plain actions — Guides is
   *  H / V / Clear / Lock, where three are actions and Lock is on or off, and
   *  Rulers & Grid is two independent on/off features side by side. A
   *  single-select `value` cannot express either: as an action group (no
   *  `value`) the toggle loses its lit state, and as a select group the
   *  actions gain one they should not have.
   *
   *  Setting it also makes the tile a real toggle button to assistive tech —
   *  `aria-pressed` is emitted for tiles that carry this and for no others, so
   *  a plain action is never announced as "not pressed". */
  active?: boolean;
}

interface Props<T extends string> {
  options: readonly ToolButtonOption<T>[];
  /** The selected id. OMIT IT for an ACTION group — buttons that do something
   *  rather than pick something, so no tile is ever lit (the gallery's
   *  Auto Compress scope). `undefined === opt.id` is false for every option,
   *  which is exactly the wanted behaviour. */
  value?: T;
  onChange: (id: T) => void;
  /** Column count for the grid. Defaults to 2. */
  columns?: 2 | 3 | 4 | 5;
  /** Optional small label rendered above the grid. A ReactNode, not a string,
   *  so a caller can put an icon and a lightbulb beside the words. */
  label?: React.ReactNode;
  /** Centre the label over the grid instead of aligning it left. */
  labelAlign?: "start" | "center";
  /** Icon-on-top, text-below tiles (vs the default icon-left row). */
  stacked?: boolean;
  /** Disable every tile (e.g. no image loaded). Default false. */
  disabled?: boolean;
  className?: string;
}

const COL_CLASS: Record<2 | 3 | 4 | 5, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/**
 * A grid of ToolButtons. Three modes, all the same grid:
 *  - SELECT — pass `value`; one tile is lit (Shapes, Crop ratios, Effects).
 *  - ACTION — omit `value`; nothing ever lights (Wand → Selection).
 *  - TOGGLE — give an option its own `active`; that tile lights from its own
 *    state and gets `aria-pressed` (Guides → Lock, Rulers & Grid).
 *
 * Shares the border/active styling across all three so every "row of tiles"
 * control in the app looks the same.
 */
export function ToolButtonGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  label,
  labelAlign = "start",
  stacked = false,
  disabled = false,
  className,
}: Props<T>) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* A div, not a <label>: it was never associated with a control (no
          htmlFor), so it carried no semantics — and it can now hold a
          lightbulb, which must not be nested inside a label element. */}
      {label && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-2xs text-theme-muted-foreground",
            labelAlign === "center" && "justify-center",
          )}
        >
          {label}
        </div>
      )}
      {/* grid-auto-rows:1fr equalizes every row to the tallest, so a longer
          label (e.g. "Hand-drawn") makes all buttons that size — not just its
          own row. Buttons stretch to fill via the default align-self. */}
      <div className={cn("grid gap-2 [grid-auto-rows:1fr]", COL_CLASS[columns])}>
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <ToolButton
              key={opt.id}
              active={opt.active ?? value === opt.id}
              aria-pressed={opt.active}
              stacked={stacked}
              disabled={disabled || opt.disabled}
              title={opt.title}
              onClick={() => onChange(opt.id)}
            >
              {Icon && <Icon />}
              {opt.label}
            </ToolButton>
          );
        })}
      </div>
    </div>
  );
}
