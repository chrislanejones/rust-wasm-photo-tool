import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The action(s) you take at the bottom of a settings panel — Apply Crop,
 * Reset/Apply on Levels, Resize/Remove canvas, the eyedropper toggle.
 *
 * ONE VOCABULARY. Before this, that job was done four different ways across
 * six panels: a `Button size="large" w-full`, a `flex gap-2` of two `flex-1`
 * buttons, a segmented Off/On `ToolButtonGroup`, and a bare `ToolButton`. The
 * `Button` primitive was never the problem — `size="large"` is exactly right
 * and its own doc comment already names "Apply Crop" as the reference. The
 * drift was LAYOUT, so that is all this owns: how the actions sit in the row.
 * The button itself is still `Button size="large"`.
 *
 * FIVE of the six adopt this: Crop, Levels, Canvas Size, Color Picker and
 * Remove Object. The sixth — Rulers & Grid — is two on/off SETTINGS, not
 * commits, so it took the tile vocabulary instead (`ToolButtonGroup` with a
 * per-option `active`). A commit-weight button for "is the grid showing" would
 * have been the same mismatch in the other direction.
 *
 * INLINE, NOT STICKY. The bar is the last thing in the panel's content and
 * scrolls with it. A sidebar panel is short enough that a pinned footer would
 * cost more vertical room than it buys, and it would need a second scroll
 * container to sit outside of.
 *
 * NO ICONS. Crop carried a `<Crop/>`, Color Picker a `<Pipette/>` and Remove
 * Object an `<Eraser/>`; the other three carried none. The label is doing the
 * work in every one of them ("Apply Crop" does not need a picture of a crop),
 * and one icon among six is how the drift this file exists to end got started.
 * If an action ever genuinely needs a glyph, `children` still takes one — but
 * it should be the odd one out for a reason, not by inheritance.
 */

/** Two-up layouts push the pair APART (Chris, 2026-09-16): the secondary hugs
 *  the left edge, the primary hugs the right, and each is only as wide as its
 *  own label. NOT two `flex-1` halves — Canvas Size's primary label is dynamic
 *  ("Resize canvas → 1920×1080") and under `flex-1` it wrapped to three lines
 *  and dragged its sibling to the same height (measured: 54px → 70px for BOTH
 *  buttons the moment the target dimensions changed). */
type PanelActionBarLayout = "full" | "split";

interface PanelActionBarProps {
  /** `full` (default) — one action, full width. `split` — two actions pushed
   *  to opposite edges, secondary first in source order. */
  layout?: PanelActionBarLayout;
  children: React.ReactNode;
  className?: string;
}

export function PanelActionBar({
  layout = "full",
  children,
  className,
}: PanelActionBarProps) {
  return (
    <div
      className={cn(
        layout === "full"
          ? // A one-column grid, not a flex row: a grid item stretches to the
            // track by default, so the single action is full-width without the
            // action itself having to carry `w-full` (which would then have to
            // be un-set for the split layout).
            "grid"
          : [
              // `justify-between` is the two-on-one-line case. `flex-wrap` plus
              // the last child's `ml-auto` is the OVERFLOW case: a pair too wide
              // for a 226px sidebar column drops the primary onto its own row
              // and the auto margin keeps it hugging the right edge, so the
              // layout degrades to "secondary left, primary right, stacked"
              // instead of overflowing the panel. `justify-between` alone would
              // left-align the wrapped button, which reads as a bug.
              "flex flex-wrap items-center justify-between gap-2",
              "[&>*:last-child]:ml-auto",
            ],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* Destructive is a real variant now, not six classes copy-pasted at the call
   site (CanvasResize had them inline). Tint, not a solid fill: this is a
   panel control you can reach by accident, not a dialog's final "yes, delete
   it" — lib/styles.ts CONFIRM_DESTRUCTIVE stays the solid one for that. The
   label is `text-destructive-strong`, a token minted for this: plain
   `--destructive` on the tint measures under the 4.5:1 WCAG 1.4.3 asks of
   button text (the same shortfall lib/styles.ts documents for the dialog
   button it replaced). */
const DESTRUCTIVE =
  "border-destructive/40 bg-destructive/15 text-destructive-strong " +
  "hover:border-destructive hover:bg-destructive/25 hover:brightness-100";

/* Pressed — an action that STAYS ON. Two callers, same look: the eyedropper
   ("Activate Eyedropper" ↔ "Click image to pick") and any on/off action that
   wants the large-button weight. Lifted verbatim from the eyedropper's old
   inline string so the lit treatment is unchanged; what is new is the
   `aria-pressed` that goes with it, which it never had. */
const PRESSED =
  "bg-theme-primary text-theme-primary-foreground border-theme-primary " +
  "ring-2 ring-theme-primary/40 hover:brightness-100";

export interface PanelActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `destructive` is the red tint — Remove canvas. */
  tone?: "default" | "destructive";
  /** Lit, and `aria-pressed`. For an action that stays on. Omit it entirely
   *  for a plain action: `aria-pressed="false"` on a button that does not
   *  toggle tells a screen reader the wrong thing. */
  pressed?: boolean;
}

export const PanelAction = React.forwardRef<
  HTMLButtonElement,
  PanelActionProps
>(({ className, tone = "default", pressed, ...props }, ref) => (
  <Button
    ref={ref}
    size="large"
    type="button"
    aria-pressed={pressed}
    className={cn(
      // `whitespace-nowrap` + `shrink-0` is what makes the split layout wrap
      // the BUTTON rather than the button's text: without it both actions
      // shrink to min-content and the labels break mid-phrase, which is the
      // three-line "Resize canvas → 1920×1080" this replaces.
      "whitespace-nowrap shrink-0",
      tone === "destructive" && DESTRUCTIVE,
      pressed && PRESSED,
      className,
    )}
    {...props}
  />
));
PanelAction.displayName = "PanelAction";
