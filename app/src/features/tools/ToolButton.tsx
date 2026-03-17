// ===== FILE: app/src/features/tools/ToolButton.tsx =====
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
      className={`relative p-0.8 rounded-xl transition-all duration-200 ${
        active
          ? "ring-2 ring-white ring-offset-1 ring-offset-bg-secondary"
          : "hover:ring-2 hover:ring-accent/50 hover:ring-offset-2 hover:ring-offset-bg-secondary"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg transition-all duration-200 hover:shadow-xl ${
          active ? "h-12 w-12 scale-100" : "h-12 w-12 hover:scale-105"
        }`}
      >
        <Icon
          className={`text-white drop-shadow-sm ${active ? "h-5 w-5" : "h-7 w-7"}`}
        />
      </span>
    </button>
  );
}
