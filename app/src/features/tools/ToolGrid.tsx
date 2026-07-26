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
    // 4 columns, not 5, and it must MATCH SubtoolRow's column count: the two
    // grids then share a tile size, so the header grows in exact one-tile steps
    // as the sub-tool row appears/disappears. (11 tools also sit better as
    // 4/4/3 than as 5/5/1.)
    <div className="grid grid-cols-4 gap-2" role="toolbar" aria-label="Select tool">
      {TOOLS.map((tool) => {
        const disabledEntry = disabledTools?.[tool.id];
        const isDisabled = Boolean(disabledEntry);
        const disabledReason =
          typeof disabledEntry === "string" ? disabledEntry : null;
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <div className="w-full">
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
              <p className="font-semibold">
                {tool.tooltipTitle ?? tool.label}
                {tool.shortcutKey && (
                  <>
                    {" "}
                    <kbd className="font-normal text-muted-foreground">
                      {tool.shortcutKey}
                    </kbd>
                  </>
                )}
              </p>
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
