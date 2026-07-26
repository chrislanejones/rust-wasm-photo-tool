import { HOVER_RING, TILE_DISABLED, TILE_IDLE, TILE_SELECTED } from "@/lib/styles";

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * One top-level rail tile — a tool GROUP since the five-group restructure.
 * Sizing is fully spatial — `aspect-square w-full` fills its grid cell, and the
 * icon is a percentage of the tile — so the toolbar reflows cleanly at any
 * panel width.
 *
 * Takes `icon` + `label` rather than a whole definition object: the rail draws
 * groups now, the sub-tool row draws sub-tools, and both are the same
 * silhouette. Keeping the props primitive means neither row owns the other's
 * data shape.
 *
 * The whole rail is monochrome. The active group is marked by a BORDER plus a
 * surface lift, not a fill: per-tool accent gradients are gone. TILE_SELECTED /
 * TILE_IDLE / TILE_DISABLED are the single definition (lib/styles.ts) — that
 * header carries the full reasoning for why selection lives on `border-color`
 * and not on a ring.
 */
export function ToolButton({ icon: Icon, label, active, disabled = false, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
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
      <Icon className="h-[55%] w-[55%] transition-transform duration-200 ease-out group-hover:scale-110" />
    </button>
  );
}
