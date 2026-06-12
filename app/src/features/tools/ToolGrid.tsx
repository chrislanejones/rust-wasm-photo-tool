import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLS } from "./toolConfig";
import type { ToolType } from "@/lib/types";
import { ToolButton } from "./ToolButton";

interface Props {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  /** Tools whose icon should render faded + non-clickable, keyed by id.
   *  Values may be a boolean (disabled) or a short reason string shown in
   *  the tooltip instead of the regular description. */
  disabledTools?: Partial<Record<ToolType, boolean | string>>;
}

export function ToolGrid({ activeTool, onToolChange, disabledTools }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {TOOLS.map((tool) => {
        const disabledEntry = disabledTools?.[tool.id];
        const isDisabled = Boolean(disabledEntry);
        const disabledReason =
          typeof disabledEntry === "string" ? disabledEntry : null;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <div>
                <ToolButton
                  tool={tool}
                  active={tool.id === activeTool}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onToolChange(tool.id);
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p className="font-medium">{tool.tooltipTitle ?? tool.label}</p>
              <p className="text-muted-foreground text-xs">
                {disabledReason ?? tool.description}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
