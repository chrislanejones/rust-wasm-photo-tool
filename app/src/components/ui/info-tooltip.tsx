// Small lightbulb-icon info trigger, shared by `SectionHeader` (title far
// left, lightbulb far right) and anywhere the lightbulb instead needs to sit
// immediately next to a label (e.g. a slider row whose right side is already
// taken by its live value — see SizeSlider's `labelInfo`).
import * as React from "react";
import { Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  /** Explanation (+ shortcuts) shown in the tooltip. */
  info: React.ReactNode;
  /** Used only for the accessible label, e.g. "Brightness info". */
  label: string;
  className?: string;
}

export function InfoTooltip({ info, label, className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-theme-muted-foreground hover:text-theme-foreground transition",
            className,
          )}
          aria-label={`${label} info`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-64 text-2xs leading-relaxed">
        {info}
      </TooltipContent>
    </Tooltip>
  );
}
