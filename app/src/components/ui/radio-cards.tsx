import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  /** Short one-liner under the label. */
  hint?: string;
}

interface RadioCardsProps<T extends string> {
  /** Radio group name (groups the native inputs for keyboard arrow nav). */
  name: string;
  value: T;
  onValueChange: (value: T) => void;
  options: RadioCardOption<T>[];
  /** Grid columns (default 2). */
  columns?: number;
  className?: string;
}

/**
 * Single-select card group — a shadcn-style alternative to a dropdown for when
 * the choices benefit from a visible label + hint (e.g. export format). Built on
 * native radio inputs, so it gets real radiogroup semantics and arrow-key
 * navigation for free, no extra dependency.
 */
export function RadioCards<T extends string>({
  name,
  value,
  onValueChange,
  options,
  columns = 2,
  className,
}: RadioCardsProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              "relative flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors",
              selected
                ? "border-theme-primary bg-theme-primary/10"
                : "border-border bg-bg-elevated hover:border-border-active",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onValueChange(opt.value)}
              className="sr-only"
            />
            <span className="flex items-center justify-between text-sm font-semibold text-text-primary">
              {opt.label}
              {selected && <Check className="h-3.5 w-3.5 text-theme-primary" />}
            </span>
            {opt.hint && (
              <span className="text-2xs leading-tight text-text-muted">
                {opt.hint}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
