import { ToolButton } from "@/components/ui/tool-button";
import { cn } from "@/lib/utils";

export interface ToolButtonOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
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
 * A grid of ToolButtons that act as a single-select group. Shares the
 * border/active styling with the Shapes / Crop / Effects pickers so all
 * "pick one of N" controls look the same across the app.
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
              active={value === opt.id}
              stacked={stacked}
              disabled={disabled}
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
