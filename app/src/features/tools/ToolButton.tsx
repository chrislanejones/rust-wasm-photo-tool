import type { ToolDefinition } from "./toolConfig";

interface Props {
  tool: ToolDefinition;
  active: boolean;
  onClick: () => void;
}

export function ToolButton({ tool, active, onClick }: Props) {
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      className={`relative p-0.5 rounded-xl transition-all duration-200 ${
        active
          ? "ring-2 ring-accent ring-offset-2 ring-offset-bg-secondary shadow-xl"
          : "hover:ring-2 hover:ring-accent/50 hover:ring-offset-2 hover:ring-offset-bg-secondary"
      }`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg transition-all duration-200 ${
          active 
            ? "scale-110 shadow-2xl" 
            : "hover:scale-105 hover:shadow-xl"
        }`}
      >
        <Icon className="h-5 w-5 text-white drop-shadow-sm" />
      </span>
    </button>
  );
}
