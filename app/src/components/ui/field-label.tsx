// Small field-level label row: title-cased text on the left, an optional
// lightbulb info tooltip on the right — the compact counterpart to
// `SectionHeader` (which is for whole-panel section titles). Use this above
// an individual control (a button grid, a color picker, etc.) rather than an
// inline paragraph.
import * as React from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

interface FieldLabelProps {
  title: string;
  /** Omit to render a plain label with no tooltip. */
  info?: React.ReactNode;
  className?: string;
}

export function FieldLabel({ title, info, className }: FieldLabelProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-2xs text-theme-muted-foreground">{title}</span>
      {info && <InfoTooltip info={info} label={title} />}
    </div>
  );
}
