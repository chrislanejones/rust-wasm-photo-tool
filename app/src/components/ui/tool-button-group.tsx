import { ToolButton } from "@/components/ui/tool-button";
import { cn } from "@/lib/utils";

export interface ToolButtonOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface Props<T extends string> {
  options: readonly ToolButtonOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Column count for the grid. Defaults to 2. */
  columns?: 2 | 3 | 4 | 5;
  /** Optional small label rendered above the grid. */
  label?: string;
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
  className,
}: Props<T>) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-[11px] text-theme-muted-foreground">
          {label}
        </label>
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
