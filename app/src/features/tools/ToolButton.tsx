import type { ToolDefinition } from "./toolConfig";
import { HOVER_RING, TILE_DISABLED, TILE_IDLE, TILE_SELECTED } from "@/lib/styles";

interface Props {
  tool: ToolDefinition;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * One tool tile. Sizing is fully spatial — `aspect-square w-full` fills its
 * grid cell, and the icon is a percentage of the tile — so the toolbar reflows
 * cleanly at any panel width.
 *
 * The whole rail is monochrome. The active tool is marked by an INK BORDER
 * plus a surface lift, not a fill: per-tool accent gradients are gone, and the
 * accent colour now belongs exclusively to the transient hover ring and the
 * `:focus-visible` outline. TILE_SELECTED / TILE_IDLE / TILE_DISABLED are the
 * single definition (lib/styles.ts) — that header carries the full reasoning
 * for why selection lives on `border-color` and not on a ring.
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
          ? TILE_DISABLED
          : [
              active ? TILE_SELECTED : TILE_IDLE,
              // Warm-accent ("brown") ring on hover — shared HOVER_RING. Kept
              // on the ACTIVE tile too: selection is on `border-color`, so the
              // hover ring still has a free channel to land in.
              HOVER_RING,
            ].join(" "),
      ].join(" ")}
    >
      <Icon className="h-1/2 w-1/2 transition-transform duration-200 ease-out group-hover:scale-110" />
    </button>
  );
}
