// Standard header row for tool-settings panel sections: title on the left,
// a lightbulb info icon on the right (space-between). Hover/focus the
// lightbulb for the section's explanation + shortcuts — the panel body
// itself stays button-only, no inline paragraphs.
import * as React from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  /** Explanation + shortcut info shown in the lightbulb tooltip — what used
   *  to live in an inline paragraph below the section. */
  info: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, info, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
        {title}
      </span>
      <InfoTooltip info={info} label={title} />
    </div>
  );
}
