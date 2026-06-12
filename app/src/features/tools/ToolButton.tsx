import type { ToolDefinition } from "./toolConfig";

interface Props {
  tool: ToolDefinition;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function ToolButton({ tool, active, disabled = false, onClick }: Props) {
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`relative p-0.8 rounded-xl transition-all duration-200 ${
        disabled
          ? "opacity-40 cursor-not-allowed grayscale"
          : active
            ? "ring-2 ring-white ring-offset-1 ring-offset-bg-secondary"
            : "hover:ring-2 hover:ring-accent/50 hover:ring-offset-2 hover:ring-offset-bg-secondary"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg transition-all duration-200 max-[999px]:h-10 max-[999px]:w-10 ${
          disabled
            ? "h-12 w-12"
            : active
              ? "h-12 w-12 scale-100 hover:shadow-xl"
              : "h-12 w-12 hover:scale-105 hover:shadow-xl"
        }`}
      >
        <Icon className="h-7 w-7 max-[999px]:h-5 max-[999px]:w-5 text-white drop-shadow-sm" />
      </span>
    </button>
  );
}
