// ===== FILE: app/src/features/tools/SubtoolRow.tsx =====
// The SUB-TOOL GRID — the active group's exclusive set.
//
// WHAT CHANGED AND WHY: sub-modes used to render inside each settings panel as
// wide labelled tiles (ToolModeToggle -> ToolButtonGroup stacked). That put two
// different button vocabularies in one 252px column — square icon tiles up top,
// wide word-tiles below — and it meant the sub-mode row scrolled away with the
// panel body. Now the sub-tools sit directly under the rail in the header, in
// tiles of the SAME shape, and the panel body starts lower or higher depending
// on how many the active group has.
//
// SSOT: this component holds no tool knowledge of its own. `toolGroups.ts` is
// the single definition of which sub-tools a group owns; `activateSubTool.ts`
// is the single definition of what clicking one does. Adding a sub-tool means
// editing the registry — never this file.
//
// LAYOUT CONTRACT: both this grid and ToolGrid are `grid-cols-5` with `gap-2`,
// and the tiles are `aspect-square w-full`. That is deliberate — it makes the
// header height move in exact one-tile increments, so the body "step" is always
// the same distance and never a ragged half-tile. Create is the tall case at 13
// sub-tools (three rows); Batch is the short one at three (one row).
import { AnimatePresence, motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { panelSpacingTransition } from "@/lib/animations";
import {
  HOVER_RING,
  SUBTILE_DISABLED,
  SUBTILE_IDLE,
  SUBTILE_SELECTED,
} from "@/lib/styles";
import { activateSubTool, useActiveGroup, useActiveSubTool } from "./activateSubTool";
import type { ResolvedSubTool } from "./toolGroups";

interface Props {
  /** Fade + block the tiles when there is no image to act on. */
  disabled?: boolean;
}

/** One sub-tool tile. Same silhouette as the rail tile (aspect-square, icon at
 *  50%) but a step down in radius so the two rows read as parent and child
 *  rather than one undifferentiated field of squares.
 *
 *  THE TIE TO THE RAIL. This used to be colour: the active sub-tile wore the
 *  PARENT tool's gradient, so you matched the two lit tiles by hue. With the
 *  gradients gone the tie is structural instead — the rail and this row each
 *  light exactly one tile, in the SAME accent vocabulary, stacked 12px apart
 *  under one hairline. The grading (2px + `shadow-sm` up top, a finer 1px line
 *  here, on top of the existing radius step) is what says parent-then-child
 *  rather than two peer rows. Deliberately NOT a pointer/connector under the
 *  active column: the rail's rows don't align with this grid's wrap. */
function SubtoolButton({
  icon: Icon,
  label,
  active,
  disabled,
  description,
  note,
  onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  disabled: boolean;
  /** Second tooltip line — what the sub-tool does. */
  description: string;
  /** Replaces `description` for a Coming Soon tile. */
  note?: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={[
            "group flex aspect-square w-full items-center justify-center rounded-xl",
            "transition-all duration-200 ease-out",
            disabled
              ? SUBTILE_DISABLED
              : [
                  active ? SUBTILE_SELECTED : SUBTILE_IDLE,
                  HOVER_RING,
                ].join(" "),
          ].join(" ")}
        >
          {Icon ? (
            <Icon className="h-[55%] w-[55%] transition-transform duration-200 ease-out group-hover:scale-110" />
          ) : (
            <span className="text-2xs font-semibold">{label.slice(0, 2)}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-muted-foreground text-2xs">{note ?? description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Sub-tool grid for the active group. Every group ships at least three
 * sub-tools, so unlike the old per-tool version this effectively always
 * renders; the AnimatePresence wrapper stays because the row's HEIGHT still
 * changes between groups (one row for Batch, three for Create) and the panel
 * body below should slide rather than jump.
 */
export function SubtoolRow({ disabled = false }: Props) {
  const group = useActiveGroup();
  const activeSubTool = useActiveSubTool();

  const show = Boolean(group && group.subTools.length > 1);

  return (
    <AnimatePresence initial={false}>
      {show && group && (
        <motion.div
          key={group.id}
          layout
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={panelSpacingTransition}
          // `overflow-hidden` is what makes the height animation clip cleanly —
          // but it also clipped the hover ring off the tiles in the outer
          // columns and the bottom row. HOVER_RING is `ring-2` at
          // `ring-offset-2`, i.e. it extends 4px OUTSIDE the tile, and the grid
          // fills this box exactly, so on an edge tile that 4px fell outside
          // the clip box and the halo came out flat-sided.
          //
          // The negative margin + equal padding widens the CLIP box by 8px a
          // side while leaving the grid's own position and width untouched, so
          // the ring has somewhere to land. It borrows from the header's `px-4`
          // / `pb-4`, which has 16px to give, so nothing shifts.
          className="overflow-hidden -mx-2 px-2 -mb-2 pb-2"
        >
          {/* Hairline separating rail from sub-rail. Inside the animated box so
              it collapses with the row instead of leaving a stray line. */}
          <div className="mt-3 mb-3 h-px bg-border/60" />
          <div
            className="grid grid-cols-5 gap-2"
            role="toolbar"
            aria-label={`${group.label} sub-tools`}
          >
            {group.subTools.map((subTool) => {
              // Coming Soon tiles render disabled with their note and are not
              // clickable. They are also absent from LIVE_SUB_TOOLS, which is
              // what keeps them off routes and out of the palette.
              const comingSoon = subTool.comingSoon === true;
              const resolved: ResolvedSubTool = {
                group,
                subTool,
                key: `${group.id}/${subTool.id}`,
              };
              return (
                <SubtoolButton
                  key={subTool.id}
                  icon={subTool.icon}
                  label={subTool.label}
                  active={!comingSoon && resolved.key === activeSubTool?.key}
                  disabled={disabled || comingSoon}
                  description={subTool.description}
                  note={comingSoon ? subTool.note : undefined}
                  onClick={() => {
                    if (disabled || comingSoon) return;
                    activateSubTool(resolved);
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
