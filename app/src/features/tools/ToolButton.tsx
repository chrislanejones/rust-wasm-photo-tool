import type { ToolDefinition } from "./toolConfig";

interface Props {
  tool: ToolDefinition;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * One tool tile. Sizing is fully spatial — `aspect-square w-full` fills its
 * grid cell, and the icon is a percentage of the tile — so the toolbar reflows
 * cleanly at any panel width. Inactive tiles stay neutral/monochrome (no
 * rainbow grid); only the active tool wears its accent gradient.
 */
export function ToolButton({ tool, active, disabled = false, onClick }: Props) {
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={tool.label}
      aria-pressed={active}
      title={tool.label}
      className={[
        "group flex aspect-square w-full items-center justify-center rounded-2xl",
        "transition-all duration-200 ease-out",
        disabled
          ? "cursor-not-allowed bg-bg-tertiary/40 opacity-40 grayscale"
          : [
              active
                ? `bg-gradient-to-br ${tool.gradient} text-white shadow-md shadow-black/25`
                : "bg-bg-tertiary text-text-muted hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]",
              // Warm accent ("brown") ring on hover, like the app's other buttons.
              "hover:ring-2 hover:ring-theme-primary/60 hover:ring-offset-2 hover:ring-offset-bg-secondary",
            ].join(" "),
      ].join(" ")}
    >
      <Icon className="h-1/2 w-1/2 transition-transform duration-200 ease-out group-hover:scale-110" />
    </button>
  );
}
