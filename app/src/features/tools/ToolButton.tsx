import type { ToolDefinition } from "./toolConfig";
import { TILE_DISABLED, TILE_IDLE, TILE_SELECTED } from "@/lib/styles";

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
            // Transition the HOVER channels only — NOT `transition-all`.
            //
            // Selection is discrete: a tile either is the active tool or is
            // not. Easing it means the tile you just left keeps its accent
            // border and fades through grey for 200ms while the new one lights
            // up, so clicking along the rail leaves a trail of half-lit tiles
            // glowing and dying behind you. Chris: "looks like people at a
            // stadium doing the wave". Caught by stretching the transition to
            // 2s and screenshotting: at 570ms BOTH tiles were still bordered.
            //
            // So `border-color` and `box-shadow` — the two channels selection
            // owns — snap, and only what hover changes is animated. Tailwind v4
            // puts `scale-*` on the `scale` property, not `transform`, hence
            // the name in this list.
        "transition-[background-color,color,scale] duration-200 ease-out",
        disabled
          ? TILE_DISABLED
          : [
              // Hover is a SURFACE change, not a ring — see the note in
              // lib/styles.ts. TILE_IDLE carries it.
              active ? TILE_SELECTED : TILE_IDLE,
            ].join(" "),
      ].join(" ")}
    >
      <Icon className="h-1/2 w-1/2 transition-transform duration-200 ease-out group-hover:scale-110" />
    </button>
  );
}
