import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { HOVER_RING } from "@/lib/styles";
import { KeyRound } from "lucide-react";

export interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  asChild?: boolean;
  /** Icon-on-top, text-below tile layout with a larger icon (vs the default
   *  icon-left row). Used by the Shapes picker + the Download action tiles. */
  stacked?: boolean;
  /** Key in the top-left corner — "this one is Pro". The badge was hand-rolled
   *  in NewActions first (an absolutely-positioned span beside `ActionTile`
   *  inside a `relative` wrapper); it lives here now so `ActionTile` AND
   *  `ToolButtonGroup` both get it from one definition.
   *
   *  Ignored when `asChild` is set: Slot accepts exactly one child, and the
   *  badge would be a second. Nothing passes both today. */
  pro?: boolean;
}

const base =
  // transition (not just -colors) so the shared HOVER_RING fades. Applies to
  // every variant (toggle group, stacked tiles, action tiles).
  //
  // No focus-visible ring of its own (removed 2026-07-28). It used to carry
  // `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-ring`,
  // which lost twice over: `--ring` IS the warm accent, so focus looked like the
  // active state (`border-theme-primary` below) — and a `ring-*` focus ring
  // writes the SAME box-shadow as the shared HOVER_RING, so on a hovered button
  // the two silently replaced each other. Dropping it lets the global
  // `:focus-visible` rule (styles.css) apply: neutral dashed ink on `outline`,
  // a channel nothing else here uses. Focus is now identical across the app.
  `inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-2xs font-semibold transition ${HOVER_RING} disabled:opacity-40 disabled:pointer-events-none disabled:hover:ring-0 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0`;

// Stacked tile: icon on top, label below, larger icon, a bit more vertical pad.
const stackedCls = "flex-col gap-1.5 py-3 [&_svg]:h-6 [&_svg]:w-6";

const inactive =
  "border-border bg-theme-muted/20 text-theme-muted-foreground hover:text-theme-foreground hover:bg-theme-muted/30";

const activeCls =
  "border-theme-primary bg-theme-primary/20 text-theme-primary";

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  (
    {
      className,
      active = false,
      asChild = false,
      stacked = false,
      pro = false,
      type,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const showBadge = pro && !asChild;
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(
          base,
          stacked && stackedCls,
          showBadge && "relative",
          active ? activeCls : inactive,
          className,
        )}
        {...props}
      >
        {showBadge && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute left-1.5 top-1.5 text-theme-primary"
            >
              {/* Size is INLINE, not a class, and that is load-bearing. `base`
                  carries `[&_svg]:h-3.5` and `stackedCls` raises it to
                  `[&_svg]:h-6` — both descendant selectors, so they outrank a
                  plain `h-3` on this icon and would blow the key up to tile-icon
                  size. An inline style outranks every class and needs no guess
                  about utility sort order. This is also why the original badge
                  sat OUTSIDE the button. */}
              <KeyRound style={{ height: 12, width: 12 }} />
            </span>
            <span className="sr-only">Pro feature</span>
          </>
        )}
        {children}
      </Comp>
    );
  },
);
ToolButton.displayName = "ToolButton";
