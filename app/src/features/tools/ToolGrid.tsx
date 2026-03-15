import { TOOLS } from "./toolConfig";
import type { ToolType } from "@/lib/types";
import { ToolButton } from "./ToolButton";

interface Props {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export function ToolGrid({ activeTool, onToolChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {TOOLS.map((tool) => (
        <div key={tool.id} title={`${tool.label} — ${tool.description}`}>
          <ToolButton
            tool={tool}
            active={tool.id === activeTool}
            onClick={() => onToolChange(tool.id)}
          />
        </div>
      ))}
    </div>
  );
}
