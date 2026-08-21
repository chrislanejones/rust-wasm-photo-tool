import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOVER_RING } from "@/lib/styles";

/**
 * A single square icon button — the top bar's Undo / Redo / Zoom controls,
 * plus the Settings cog and the signed-out user icon.
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
 * (`flex gap-1 p-1 rounded-lg bg-bg-tertiary`) lives in TopBar — this only
 * defines what goes inside it.
 *
 * VOCABULARY: the tool rail's, deliberately — border for state, HOVER_RING for
 * hover, icon sized as a PERCENTAGE (55%) rather than a fixed `h-4 w-4` so the
 * glyph keeps its proportion. That makes the top bar and the tool rail read as
 * one system instead of two.
 *
 * Two departures from ToolButton:
 *  - `rounded-md`, not `rounded-2xl` — what `ToggleButtonGroup`'s buttons have
 *    always used. The Review panel's section toggles are the reference for
 *    both bars (Chris, 2026-08-20), so Undo, Redo, both Zooms, the cog and the
 *    user icon were matched to THEM rather than the other way round.
 *
 *    The GROUP CONTAINER around this button is `rounded-lg` (10px), not 6px.
 *    That mismatch is the point and is copied from the panel, where 6px
 *    buttons have always nested inside a 10px container. Do not "fix" it by
 *    aligning them.
 *
 *    An oval (`rounded-full`) treatment was built and rejected the same day,
 *    both as buttons-in-oval-groups and as oval-groups-only. Recorded so it is
 *    not re-proposed as an obvious improvement: it is not one.
 *  - The idle FILL depends on `standalone` — see below. This is the one thing
 *    about these buttons that isn't uniform, and it has to be: a tile whose
 *    fill matches its container is invisible.
 *
 * SIZE: 30px with an 18px glyph — byte-for-byte the box `ToggleButtonGroup`'s
 * buttons make from `px-3 py-1.5` around an `h-[18px]` icon. The Review panel's
 * section toggles are the reference Chris named (2026-08-20); every group in
 * both bars is now that button in a `p-1` container, so 30px buttons in a 38px
 * group, everywhere.
 *
 * THE GLYPH IS A FIXED 18px, NOT 55%. The percentage rule was here to track the
 * tool rail's tile-to-icon proportion, and it is the wrong rule the moment the
 * reference becomes a button whose icon is pinned at 18px: 55% of 30px is
 * 16.5px, which lands this button's glyph a pixel and a half under its
 * neighbour's inside the same group. Proportion was never the goal — matching
 * the icon was, and that is what the doc above already said it was for.
 *
 * HISTORY: this was 36px with a 55% (~20px) glyph until 2026-08-20, sized to
 * the tool rail rather than to the bar it lives in. That made the bar taller
 * than its own toggle group and is what "the buttons are too tall" was.
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
   *  Grouped buttons are transparent at rest and let the pill's own
   *  `bg-bg-tertiary` show through — giving them the same fill as their
   *  container would erase them. Standalone buttons have no container, so
   *  transparent leaves them looking like a bare glyph with no button around it
   *  until you hover. They carry the fill themselves.
   *
   *  STILL LOAD-BEARING, though the bars no longer use it: every control in the
   *  top bar and the master bar is now inside a pill, INCLUDING the cog and the
   *  user icon. What keeps this alive is `UserMenu` — it also renders in the
   *  upload dialog and inside the Settings modal, where there is no pill. Those
   *  two pass it via `UserMenu`'s `grouped={false}` default. */
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
        "group flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md",
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
      <Icon className="h-[18px] w-[18px] transition-transform duration-200 ease-out group-hover:scale-110" />
    </button>
  ),
);
IconButton.displayName = "IconButton";
