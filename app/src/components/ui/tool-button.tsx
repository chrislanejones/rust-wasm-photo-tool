import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { HOVER_RING } from "@/lib/styles";

export interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  asChild?: boolean;
  /** Icon-on-top, text-below tile layout with a larger icon (vs the default
   *  icon-left row). Used by the Shapes picker + the Download action tiles. */
  stacked?: boolean;
}

const base =
  // transition (not just -colors) so the shared HOVER_RING fades. Applies to
  // every variant (toggle group, stacked tiles, action tiles).
  `inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-2xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-ring focus-visible:ring-offset-1 focus-visible:ring-offset-theme-sidebar ${HOVER_RING} disabled:opacity-40 disabled:pointer-events-none disabled:hover:ring-0 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0`;

// Stacked tile: icon on top, label below, larger icon, a bit more vertical pad.
const stackedCls = "flex-col gap-1.5 py-3 [&_svg]:h-6 [&_svg]:w-6";

const inactive =
  "border-border bg-theme-muted/20 text-theme-muted-foreground hover:text-theme-foreground hover:bg-theme-muted/30";

const activeCls =
  "border-theme-primary bg-theme-primary/20 text-theme-primary";

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ className, active = false, asChild = false, stacked = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(base, stacked && stackedCls, active ? activeCls : inactive, className)}
        {...props}
      />
    );
  },
);
ToolButton.displayName = "ToolButton";
