// Standard header row for tool-settings panel sections: title on the left,
// a lightbulb info icon on the right (space-between). Hover/focus the
// lightbulb for the section's explanation + shortcuts — the panel body
// itself stays button-only, no inline paragraphs.
import * as React from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  /** The current choice, shown between the title and the lightbulb. For a
   *  section whose control is icon-only (Combine's segmented strip): the
   *  icons carry the options, this carries which one is on, so the answer to
   *  "what is selected" is readable without hovering anything. */
  value?: React.ReactNode;
  /** Explanation + shortcut info shown in the lightbulb tooltip — what used
   *  to live in an inline paragraph below the section. */
  info: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, value, info, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-xs font-semibold font-mono text-theme-muted-foreground">
        {title}
      </span>
      <span className="flex items-center gap-2">
        {value != null && (
          <span className="text-2xs text-theme-foreground">{value}</span>
        )}
        <InfoTooltip info={info} label={title} />
      </span>
    </div>
  );
}
