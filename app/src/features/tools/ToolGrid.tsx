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
    // 5 columns — the original tile size, restored 2026-07-26 at Chris's call
    // after seeing 4-up on screen. It must MATCH SubtoolRow's column count: the
    // two grids then share a tile size, so the header grows in exact one-tile
    // steps as the sub-tool row appears/disappears. Change one, change both.
    // (Retiring Shapes in v7.51 left exactly 10 tools, so 5-up now fills two
    // full rows with no ragged remainder — the arrangement 4-up was chosen to
    // avoid.)
    <div className="grid grid-cols-5 gap-2" role="toolbar" aria-label="Select tool">
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
