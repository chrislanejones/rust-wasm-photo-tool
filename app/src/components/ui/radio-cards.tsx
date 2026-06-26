import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOVER_RING } from "@/lib/styles";

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
 * Single-select card group with a checkbox indicator on each card — choose one
 * of N (e.g. export format). Each card shows a checkbox square, but it's a
 * single-select: checking one unchecks the rest. Built on native radio inputs
 * under the hood, so it keeps real radiogroup semantics + arrow-key navigation
 * (the correct "only one can be checked" behaviour), no extra dependency.
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
              // Carries the tile styles over: muted surface + the shared
              // HOVER_RING (single source of truth), like ToolButton.
              "relative flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition",
              HOVER_RING,
              selected
                ? "border-theme-primary bg-theme-primary/20"
                : "border-border bg-theme-muted/20 hover:bg-theme-muted/30",
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
            {/* Checkbox square — ticked only for the chosen one. */}
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                selected
                  ? "border-theme-primary bg-theme-primary text-theme-primary-foreground"
                  : // Higher-contrast empty box for dark mode (border-border was
                    // near-invisible on the card).
                    "border-border-active bg-bg-secondary",
              )}
            >
              {selected && <Check className="h-3 w-3" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-text-primary">
                {opt.label}
              </span>
              {opt.hint && (
                <span className="text-2xs leading-tight text-text-muted">
                  {opt.hint}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
