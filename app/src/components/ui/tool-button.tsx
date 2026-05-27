import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  asChild?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-ring focus-visible:ring-offset-1 focus-visible:ring-offset-theme-sidebar disabled:opacity-40 disabled:pointer-events-none [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0";

const inactive =
  "border-border bg-theme-muted/20 text-theme-muted-foreground hover:text-theme-foreground hover:bg-theme-muted/30";

const activeCls =
  "border-theme-primary bg-theme-primary/20 text-theme-primary";

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ className, active = false, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(base, active ? activeCls : inactive, className)}
        {...props}
      />
    );
  },
);
ToolButton.displayName = "ToolButton";
