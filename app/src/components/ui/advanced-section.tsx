// "Advanced" — the settings a panel needs but most strokes do not, collapsed
// by default and last in the panel.
//
// A disclosure (WAI-ARIA APG): a real button with `aria-expanded` and
// `aria-controls`, the region `hidden` while shut. The summary on the
// right says what is inside while it is shut, so a setting that is ON is
// never hidden — "Stabilizer: Med" is visible on a closed section.
//
// The hairline above is `PANEL_DIVIDER`, the same rule that opens every other
// group inside a tool panel.
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { PANEL_DIVIDER } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface AdvancedSectionProps {
  /** What is inside, while closed — e.g. "Stabilizer: Off". */
  summary?: React.ReactNode;
  /** Open on first render. Default false: collapsed is the point. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AdvancedSection({
  summary,
  defaultOpen = false,
  children,
  className,
}: AdvancedSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const regionId = React.useId();
  return (
    <div data-slot="advanced" className={cn(PANEL_DIVIDER, className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-sm text-2xs text-theme-muted-foreground transition-colors hover:text-theme-foreground"
      >
        <span className="flex items-center gap-1">
          <ChevronRight
            aria-hidden
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
          Advanced
        </span>
        {!open && summary != null && (
          <span className="tabular-nums text-theme-foreground">{summary}</span>
        )}
      </button>
      {/* Always in the DOM, `hidden` while shut, so `aria-controls` never
          points at an id that is not there. */}
      <div id={regionId} hidden={!open} className="mt-4 space-y-4">
        {children}
      </div>
    </div>
  );
}
