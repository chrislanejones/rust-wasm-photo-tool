// A stacked action tile — big icon on top, label below — sharing the Shapes
// picker button style (via ToolButton's `stacked` variant). This is the
// NON-TOGGLE variant: it never carries an `active` state (it runs an action, it
// isn't a selection), so a clear accent hover is its only affordance. Used by
// the Download dialog footer and the Effects → Quick Adjust grid.
import * as React from "react";
import { cn } from "@/lib/utils";
import { ToolButton, type ToolButtonProps } from "@/components/ui/tool-button";

interface ActionTileProps extends Omit<ToolButtonProps, "children" | "active"> {
  icon: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
}

export function ActionTile({
  icon: Icon,
  label,
  className,
  ...props
}: ActionTileProps) {
  return (
    <ToolButton stacked className={cn("flex-1", className)} {...props}>
      <Icon />
      <span>{label}</span>
    </ToolButton>
  );
}
