// ===== FILE: app/src/features/tools/SubtoolRow.tsx =====
// The HOISTED sub-tool grid — new-ui-toolbar arc.
//
// WHAT CHANGED AND WHY: sub-modes used to render inside each settings panel as
// wide labelled tiles (ToolModeToggle -> ToolButtonGroup stacked). That put two
// different button vocabularies in one 252px column — square icon tiles up top,
// wide word-tiles below — and it meant the sub-mode row scrolled away with the
// panel body. Now the sub-tools sit directly under the tool rail in the header,
// in tiles of the SAME shape, and the panel body simply starts lower or higher
// depending on how many sub-tools the active tool has.
//
// SSOT: this component holds no tool knowledge of its own. `modesFor` /
// `useActiveMode` / `setModeOf` (features/tools/toolModes.ts) are the single
// definition of "what sub-modes does tool X have and how do I read/set one",
// shared with the command palette and URL routing. Adding a sub-tool means
// editing toolModes.ts (or the tool's registry module) — never this file.
//
// LAYOUT CONTRACT: both this grid and ToolGrid are `grid-cols-5` with `gap-2`,
// and the tiles are `aspect-square w-full`. That is deliberate — it makes the
// header height move in exact one-tile increments (0 rows / 1 row / 2 rows), so
// the body "step" is always the same distance and never a ragged half-tile.
import { AnimatePresence, motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sizeTween } from "@/lib/animations";
import {
  SUBTILE_DISABLED,
  SUBTILE_IDLE,
  SUBTILE_SELECTED,
} from "@/lib/styles";
import type { ToolType } from "@/lib/types";
import { TOOLS } from "./toolConfig";
import { modesFor, setModeOf, useActiveMode } from "./toolModes";

interface Props {
  activeTool: ToolType;
  /** Fade + block the tiles when there is no image to act on. */
  disabled?: boolean;
}

/** One sub-tool tile. Same silhouette as the tool-rail tile (aspect-square,
 *  icon at 50%) but a step down in radius so the two rows read as parent and
 *  child rather than one undifferentiated field of squares.
 *
 *  THE TIE TO THE RAIL. This used to be colour: the active sub-tile wore the
 *  PARENT tool's gradient, so you matched the two lit tiles by hue. With the
 *  gradients gone the tie is structural instead — the rail and this row each
 *  light exactly one tile, in the SAME accent vocabulary, stacked 12px apart
 *  under one hairline. The grading (2px + `shadow-sm` up top, a finer 1px line
 *  here, on top of the existing radius step) is what says parent-then-child
 *  rather than two peer rows. Deliberately NOT a pointer/connector under the
 *  active column: the rail's last row is short, so a lit column marker would
 *  sit closer to the wrong tile as often as the right one. */
function SubtoolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  disabled: boolean;
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
            // Hover channels only — selection snaps. See ToolButton.tsx.
            "transition-[background-color,color,scale] duration-200 ease-out",
            disabled
              ? SUBTILE_DISABLED
              : [
                  // Hover is a surface change here too — see lib/styles.ts.
                  active ? SUBTILE_SELECTED : SUBTILE_IDLE,
                ].join(" "),
          ].join(" ")}
        >
          {Icon ? (
            <Icon className="h-1/2 w-1/2 transition-transform duration-200 ease-out group-hover:scale-110" />
          ) : (
            // Icon-less mode (shouldn't happen once every mode carries one) —
            // fall back to the first two characters so the tile is never blank.
            <span className="text-2xs font-semibold">{label.slice(0, 2)}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="text-xs font-semibold">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Sub-tool grid for the active tool. Renders NOTHING (and animates its height
 * to zero, taking the panel body up with it) when the active tool has fewer
 * than two sub-modes — a one-tile row is noise, and Adjust / Effects / Layer
 * Settings legitimately have none at all.
 */
export function SubtoolRow({ activeTool, disabled = false }: Props) {
  const modes = modesFor(activeTool);
  const activeMode = useActiveMode(activeTool);
  const tool = TOOLS.find((t) => t.id === activeTool);

  // Hooks above this line — the early bail is a RENDER decision, not a hook
  // decision, so it lives inside AnimatePresence rather than as a `return null`
  // before the hooks (which would break the rules-of-hooks on tool switch).
  const show = modes.length > 1;

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          // STABLE key, deliberately NOT `activeTool`.
          //
          // Keying on the tool made every tool switch an unmount + remount, so
          // AnimatePresence ran the exit animation on the outgoing row and then
          // mounted the incoming one. Measured on a Vector -> Paint switch: the
          // row collapsed 111px -> 0 over ~7 frames, sat at 0 for ~14 more, then
          // POPPED to 64px with no enter animation (AnimatePresence's
          // `initial={false}` suppresses it), with both rows briefly in the DOM.
          // The panel body below rode all of it up and back down. That is the
          // flicker.
          //
          // With one stable key the container never leaves: switching tools just
          // swaps the tiles inside it (they carry their own `key={m.id}`), and
          // the height animation covers the difference — 6 modes to 3 is one
          // smooth 111 -> 64. AnimatePresence still does its real job, which is
          // the genuine appear/disappear when a tool has fewer than two
          // sub-modes.
          key="subtool-row"
          // NO `layout` prop, deliberately. It and the explicit height
          // animation below are two different mechanisms for the same job and
          // they fight: `layout` animates a box change by applying a SCALE
          // transform, while `height: auto` animates the real box. Measured
          // mid-switch in Chrome, the row carried
          // `transform: matrix(1, 0, 0, 0.728, ...)` — squashed to 73% of its
          // height and stretching back — while its height was independently
          // growing 64 -> 111. The compound effect squashes the icons inside
          // and shoves the rail above by ~21px. Chris: "see the bunny hop".
          // The height animation alone is smooth and moves nothing else.
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={sizeTween}
          className="overflow-hidden"
        >
          {/* Hairline separating rail from sub-rail. Inside the animated box so
              it collapses with the row instead of leaving a stray line. */}
          <div className="mt-3 mb-3 h-px bg-border/60" />
          <div
            className="grid grid-cols-5 gap-2"
            role="toolbar"
            aria-label={`${tool?.label ?? "Tool"} sub-tools`}
          >
            {modes.map((m) => (
              <SubtoolButton
                key={m.id}
                icon={m.icon}
                label={m.label}
                active={m.id === activeMode}
                disabled={disabled}
                onClick={() => setModeOf(activeTool, m.id)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
