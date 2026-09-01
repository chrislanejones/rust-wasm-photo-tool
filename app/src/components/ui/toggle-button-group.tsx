import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HOVER_RING } from "@/lib/styles";

/** One independently-toggleable button in a {@link ToggleButtonGroup}. */
export interface ToggleGroupItem {
  /** Stable React key. */
  key: string;
  icon: LucideIcon;
  label: string;
  /** Whether this button is currently on (multiple may be on at once). */
  active: boolean;
  onToggle: () => void;
  /** Greys the button out and drops it from the tab order. Added for Export,
   *  which is the one item in the top bar's cluster that is an ACTION rather
   *  than a toggle — it fires a download instead of turning a panel on, so it
   *  passes `active: false` permanently and needs a way to say "not yet"
   *  when there is no image to export. */
  disabled?: boolean;
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

/* NO `variant` PROP, and there was one for an afternoon on 2026-08-20 — a
   `bar` variant that gave the top bar's copy 36px buttons and a tighter
   container radius. It is gone because it ended up describing a difference
   that no longer exists: this component IS the reference now. The top bar's
   and master bar's Undo/Redo, Zoom and cog/user groups were all resized and
   re-radiused to match THESE buttons (`IconButton` is 30px with an 18px glyph
   for that reason) and to match this container (`p-1 rounded-lg
   bg-bg-tertiary`, copied literally). One box, one radius, fifteen call sites.

   So: if a bar ever needs to look different from a panel again, prove the
   difference is real before adding the prop back. Last time it was the bar
   that was wrong, not the panel. */

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
      {items.map(({ key, icon: Icon, label, active, onToggle, tooltip, disabled }) => {
        const button = (
          <button
            onClick={onToggle}
            disabled={disabled}
            title={tooltip ? undefined : label}
            aria-label={tooltip?.label ?? label}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono",
              "transition-all duration-200 ease-out",
              // `px-3 py-1.5` around an 18px glyph is a 30px box, and that box
              // is now the reference the bars are built from — IconButton was
              // matched to it, not the reverse. Changing this padding resizes
              // Undo, Redo, both Zooms, the cog and the user icon with it.
              // Same warm-accent hover ring as the tool rail and the top bar's
              // icon buttons — one hover vocabulary across every button group.
              HOVER_RING,
              fill && "flex-1",
              // Active = raised elevated pill. In dark, --accent-ui and
              // --bg-elevated are both #2b2b2b (unchanged); in light, bg-elevated
              // is #fff so the active toggle separates from the #e9e3d8 container
              // (bg-accent/--accent-ui #ece6db was too close to read as active).
              active
                ? "bg-bg-elevated text-text-primary shadow-md"
                : "text-text-muted hover:text-text-primary hover:bg-bg-elevated",
              // Disabled wins over the hover styles above — without this the
              // ring and colour shift still fire on a button that does nothing.
              disabled && "pointer-events-none opacity-40",
            )}
          >
            {/* ONE glyph size, labelled or not: 18px, matching the top bar's
                IconButton. The top bar's New/Tools/Gallery/Review and the
                Review panel's History/Layers/Reselect/Histogram are the same
                component, and they now read at the same weight whether or not
                the label is showing. (14px here made the labelled ones look
                like a different, smaller control than their icon-only twins.) */}
            {!noIcons && <Icon className="h-[18px] w-[18px]" />}
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
              <p className="font-semibold">{tooltip.label ?? label}</p>
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
