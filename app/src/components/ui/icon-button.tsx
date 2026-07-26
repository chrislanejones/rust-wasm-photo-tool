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
 * Two departures from ToolButton, both forced by where these sit:
 *  - IDLE IS TRANSPARENT, not `bg-bg-tertiary`. These live INSIDE the group
 *    pills, which are themselves `bg-bg-tertiary` — a tile with the same fill
 *    as its container is invisible. Hover still lifts to `bg-bg-elevated`, so
 *    the affordance survives and the pill background is preserved.
 *  - `rounded-lg`, not `rounded-2xl`. The rail's radius is proportionate at
 *    39px; at 28px it reads as a circle.
 *
 * Height is 28px to match the panel toggles and the user avatar already in the
 * bar, so nothing reflows.
 */
export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  /** Accessible name. Required — these are icon-only, so there is no text. */
  label: string;
  /** Persistent-on state (e.g. a toggle). Omit for plain actions. */
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, active = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "group flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
        "transition-all duration-200 ease-out",
        // Same border-carries-state rule as the rail: the width is on BOTH
        // branches so the content box never changes size between them.
        active
          ? "border-2 border-theme-primary bg-bg-elevated text-text-primary shadow-sm"
          : "border-2 border-transparent text-text-muted hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]",
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
