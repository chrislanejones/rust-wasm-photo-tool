import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * Sizing matches the tool rail's rule: the icon is a PERCENTAGE of the button
 * (55%), not a fixed `h-4 w-4`, so the glyph keeps its proportion if the button
 * size ever changes. Idle/hover/active colours mirror ToggleButtonGroup so the
 * whole bar reads as one system.
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
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
        "transition-all duration-150",
        active
          ? "bg-bg-elevated text-text-primary shadow-md"
          : "text-text-muted hover:text-text-primary hover:bg-bg-elevated",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      <Icon className="h-[55%] w-[55%]" />
    </button>
  ),
);
IconButton.displayName = "IconButton";
