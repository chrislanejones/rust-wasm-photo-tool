// A collapsed section at the end of a tool panel, named for what is inside it
// ("Placement"), never a generic "Advanced". Chris, 10-05-2026: the word told
// nobody what they would find, so the header is now the thing itself.
//
// A disclosure (WAI-ARIA APG): a real button with `aria-expanded` and
// `aria-controls`, the region `hidden` while shut. An optional `summary` sits
// on the right while it is shut, so a setting that is ON is never hidden. The
// optional `info` lightbulb sits beside the button, not inside it — a button
// cannot hold another button.
//
// The hairline above is `PANEL_DIVIDER`, the same rule that opens every other
// group inside a tool panel.
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { PANEL_DIVIDER } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  /** What is inside — the header's name, e.g. "Placement". */
  label: string;
  /** Shown on the right while closed, e.g. "Stabilizer: Off". */
  summary?: React.ReactNode;
  /** Lightbulb tooltip beside the header. */
  info?: React.ReactNode;
  /** Open on first render. Default false: collapsed is the point. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  label,
  summary,
  info,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const regionId = React.useId();
  return (
    <div data-slot="collapsible" className={cn(PANEL_DIVIDER, className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-between gap-2 rounded-sm text-2xs text-theme-muted-foreground transition-colors hover:text-theme-foreground"
        >
          <span className="flex items-center gap-1">
            <ChevronRight
              aria-hidden
              className={cn("size-3 transition-transform", open && "rotate-90")}
            />
            {label}
          </span>
          {!open && summary != null && (
            <span className="tabular-nums text-theme-foreground">{summary}</span>
          )}
        </button>
        {info && <InfoTooltip info={info} label={label} />}
      </div>
      {/* Always in the DOM, `hidden` while shut, so `aria-controls` never
          points at an id that is not there. */}
      <div id={regionId} hidden={!open} className="mt-4 space-y-4">
        {children}
      </div>
    </div>
  );
}
