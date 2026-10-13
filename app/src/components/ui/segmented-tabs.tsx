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
  orientation?: "horizontal" | "vertical";
  className?: string;
  idPrefix?: string;
  panelId?: string;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  fill = false,
  orientation = "horizontal",
  className,
  idPrefix,
  panelId,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={(event) => {
        if (orientation !== "vertical" || !tabs.length) return;
        const index = Math.max(0, tabs.findIndex((t) => t.id === value));
        const next = event.key === "ArrowDown" ? (index + 1) % tabs.length
          : event.key === "ArrowUp" ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(tabs[next]!.id);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}
      className={cn(orientation === "vertical" ? "space-y-1" : cn("flex items-center", fill && "w-full", BUTTON_PILL), className)}
    >
      {tabs.map(({ id, label: tabLabel, icon: Icon, count }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            id={idPrefix ? `${idPrefix}-${id}` : undefined}
            aria-controls={panelId}
            tabIndex={orientation === "vertical" ? (active ? 0 : -1) : undefined}
            onClick={() => onChange(id)}
            className={cn(
              orientation === "vertical"
                ? "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors"
                : "flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wider transition-colors",
              fill && "flex-1",
              active
                ? "bg-bg-elevated text-text-primary"
                : orientation === "vertical" ? "text-text-secondary hover:bg-bg-elevated/60" : "text-text-muted hover:text-text-primary",
            )}
          >
            {Icon && <Icon aria-hidden className={orientation === "vertical" ? "size-4 shrink-0" : "h-3.5 w-3.5"} />}
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
