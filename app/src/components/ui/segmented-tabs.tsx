// The mono, uppercase segmented tab row — the Diagnostics window's section rail
// and the Command Palette's group tabs. The palette's copy said in its own
// comment that it was "the Diagnostics window's segmented rail"; the two had
// already drifted (tab semantics on one, 1.5 vs 1 padding, an icon slot on the
// other). One component, and both get `role="tab"`.
import type { LucideIcon } from "lucide-react";
import { BUTTON_PILL } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface SegmentedTab<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** A count shown after the label, e.g. Telemetry's entry total. */
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name for the tablist. */
  label: string;
  /** Stretch edge to edge, every tab an equal share. */
  fill?: boolean;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  fill = false,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex items-center", fill && "w-full", BUTTON_PILL)}
    >
      {tabs.map(({ id, label: tabLabel, icon: Icon, count }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wider transition-colors",
              fill && "flex-1",
              active
                ? "bg-bg-elevated text-text-primary"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {tabLabel}
            {count != null && (
              <span className={active ? "text-text-secondary" : "text-text-muted"}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
