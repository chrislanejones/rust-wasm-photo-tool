import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLS } from "./toolConfig";
import type { ToolType } from "@/lib/types";
import { ToolButton } from "./ToolButton";

interface Props {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export function ToolGrid({ activeTool, onToolChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 justify-items-center">
      {TOOLS.map((tool) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <div>
              <ToolButton
                tool={tool}
                active={tool.id === activeTool}
                onClick={() => onToolChange(tool.id)}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p className="font-medium">{tool.label}</p>
            <p className="text-muted-foreground text-xs">{tool.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
