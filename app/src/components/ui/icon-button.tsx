import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOVER_RING } from "@/lib/styles";

/**
 * A single square icon button — the top bar's Undo / Redo / Zoom controls.
 *
 * WHY THIS EXISTS. Those four were raw `<button className="btn-icon">` markup
 * repeated inline in TopBar, while the panel toggles beside them came from
 * `ToggleButtonGroup` and the tool rail came from `ToolButton`. Three
 * vocabularies within about 200px of each other, and `.btn-icon` was a bare CSS
 * class in styles.css with its own hover and disabled rules that nothing else
 * shared. This is the one definition for a standalone icon button.
 *
 * DELIBERATELY NOT part of ToggleButtonGroup. That component owns a *group* of
 * related toggles and its own pill container; these are individually-meaningful
 * actions that happen to sit next to each other. The group container
 * (`flex gap-1 p-1 rounded-lg bg-bg-tertiary`) stays exactly where it was in
 * TopBar — this only replaces what goes inside it, so the grouped look is
 * untouched.
 *
 * VOCABULARY: the tool rail's, deliberately — border for state, HOVER_RING for
 * hover, icon sized as a PERCENTAGE (55%) rather than a fixed `h-4 w-4` so the
 * glyph keeps its proportion. That makes the top bar and the tool rail read as
 * one system instead of two.
 *
 * Two departures from ToolButton:
 *  - `rounded-xl`, not `rounded-2xl` — one step down, the same relationship the
 *    sub-tool tiles have to the rail tiles.
 *  - The idle FILL depends on `standalone` — see below. This is the one thing
 *    about these buttons that isn't uniform, and it has to be: a tile whose
 *    fill matches its container is invisible.
 *
 * SIZE: 36px, so the GLYPH lands at ~20px — within a pixel of the tool rail's
 * (55% of its ~39px tile). Matching the icon was the point; matching the tile
 * exactly would have cost more bar height for no extra legibility. At 28px the
 * same 55% rule produced a 13px glyph, which read as a different, smaller
 * control sitting next to the rail.
 */
export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  /** Accessible name. Required — these are icon-only, so there is no text. */
  label: string;
  /** Persistent-on state (e.g. a toggle). Omit for plain actions. */
  active?: boolean;
  /** Set when the button does NOT sit inside a group pill.
   *
   *  Grouped buttons (Undo/Redo, the two Zooms) are transparent at rest and let
   *  the pill's own `bg-bg-tertiary` show through — giving them the same fill as
   *  their container would erase them. Standalone buttons (the Settings cog, the
   *  signed-out user icon) have no container, so transparent leaves them looking
   *  like a bare glyph with no button around it until you hover. They carry the
   *  fill themselves. */
  standalone?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, active = false, standalone = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "group flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        "transition-all duration-200 ease-out",
        // Same border-carries-state rule as the rail: the width is on BOTH
        // branches so the content box never changes size between them.
        active
          ? "border-2 border-theme-primary bg-bg-elevated text-text-primary shadow-sm"
          : [
              "border-2 border-transparent text-text-muted",
              // The rail's own idle fill when there is no pill to supply one.
              standalone && "bg-bg-tertiary",
              "hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]",
            ]
              .filter(Boolean)
              .join(" "),
        !active && HOVER_RING,
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        "disabled:hover:ring-0 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      <Icon className="h-[55%] w-[55%] transition-transform duration-200 ease-out group-hover:scale-110" />
    </button>
  ),
);
IconButton.displayName = "IconButton";
