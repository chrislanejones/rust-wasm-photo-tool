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
      className={`relative p-0.5 rounded-xl transition-all ${
        active
          ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-secondary)]"
          : ""
      }`}
    >
      <span
        className={`flex h-12 w-full aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg transition-transform hover:scale-105 ${
          active ? "scale-105" : ""
        }`}
      >
        <Icon className="h-6 w-6 text-white" />
      </span>
    </button>
  );
}
