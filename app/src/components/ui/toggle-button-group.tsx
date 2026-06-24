import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** One independently-toggleable button in a {@link ToggleButtonGroup}. */
export interface ToggleGroupItem {
  /** Stable React key. */
  key: string;
  icon: LucideIcon;
  label: string;
  /** Whether this button is currently on (multiple may be on at once). */
  active: boolean;
  onToggle: () => void;
  /** Optional rich hover tooltip (e.g. label + keyboard shortcut). When
   *  omitted the label is used as a plain `title`. */
  tooltip?: { label?: string; shortcut?: string };
}

interface ToggleButtonGroupProps {
  items: ToggleGroupItem[];
  /** Icon-only buttons (labels hidden) for tight layouts. */
  compact?: boolean;
  /** Label-only buttons (icons hidden) so longer labels have room. */
  noIcons?: boolean;
  /** Stretch buttons to share the row width evenly. */
  fill?: boolean;
  /** Extra classes on the group container. */
  className?: string;
}

/**
 * A pill-style group of multi-select toggle buttons — the Upload / Tools /
 * Gallery cluster in the top bar and the History / Reselect / Layers cluster
 * in the Review panel share this component. "Multi-select" because each button
 * toggles on/off independently; any number can be active at once.
 */
export function ToggleButtonGroup({
  items,
  compact = false,
  noIcons = false,
  fill = false,
  className,
}: ToggleButtonGroupProps) {
  return (
    <div className={cn("flex gap-1 p-1 rounded-lg bg-bg-tertiary", className)}>
      {items.map(({ key, icon: Icon, label, active, onToggle, tooltip }) => {
        const button = (
          <button
            onClick={onToggle}
            title={tooltip ? undefined : label}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-all",
              fill && "flex-1",
              // Active = raised elevated pill. In dark, --accent-ui and
              // --bg-elevated are both #2b2b2b (unchanged); in light, bg-elevated
              // is #fff so the active toggle separates from the #e9e3d8 container
              // (bg-accent/--accent-ui #ece6db was too close to read as active).
              active
                ? "bg-bg-elevated text-text-primary shadow-md"
                : "text-text-muted hover:text-text-primary hover:bg-bg-elevated",
            )}
          >
            {!noIcons && <Icon className="h-3.5 w-3.5" />}
            {!compact && <span>{label}</span>}
          </button>
        );

        // Fragment (no DOM node) keeps the button a direct flex child so
        // `fill` / flex-1 still divides the row evenly.
        if (!tooltip) return <Fragment key={key}>{button}</Fragment>;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-medium">{tooltip.label ?? label}</p>
              {tooltip.shortcut && (
                <p className="text-muted-foreground text-xs">
                  {tooltip.shortcut}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
