import { BringToFront, ChevronDown, ChevronUp, SendToBack } from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import type { ZMove } from "@/lib/shapeZOrder";
import type { ShapeZOrderMenu } from "@/hooks/useShapeZOrderMenu";

/** The four stacking moves, top of the menu = top of the stack. Shortcuts are
 *  the selected-shape chords from `useDrawingTools`; they act on the SELECTED
 *  shape where the menu acts on the right-clicked one, which is why both
 *  surfaces exist. */
const MOVES: {
  dir: ZMove;
  label: string;
  shortcut: string;
  Icon: typeof BringToFront;
  /** Shown as `title` when the move is unavailable. */
  why: string;
}[] = [
  {
    dir: "front",
    label: "Bring to Front",
    shortcut: "Ctrl+Shift+Alt+↑",
    Icon: BringToFront,
    why: "Already at the front",
  },
  {
    dir: "forward",
    label: "Bring Forward",
    shortcut: "Ctrl+Shift+↑",
    Icon: ChevronUp,
    why: "Already at the front",
  },
  {
    dir: "backward",
    label: "Send Backward",
    shortcut: "Ctrl+Shift+↓",
    Icon: ChevronDown,
    why: "Already at the back",
  },
  {
    dir: "back",
    label: "Send to Back",
    shortcut: "Ctrl+Shift+Alt+↓",
    Icon: SendToBack,
    why: "Already at the back",
  },
];

/**
 * Shape stacking for the canvas context menu.
 *
 * Renders NOTHING when the right-click did not land on a shape on the active
 * layer. That is deliberate: four permanently-dead items on empty canvas read
 * as a broken menu, where their absence reads as "not applicable here".
 */
export function ShapeZOrderMenuItems({ menu }: { menu: ShapeZOrderMenu }) {
  if (menu.targetId === null) return null;
  return (
    <>
      <ContextMenuSeparator />
      {MOVES.map(({ dir, label, shortcut, Icon, why }) => {
        const enabled = menu.can(dir);
        return (
          <ContextMenuItem
            key={dir}
            onClick={() => menu.move(dir)}
            disabled={!enabled}
            title={enabled ? label : why}
          >
            <Icon className="h-4 w-4 mr-2" /> {label}
            <ContextMenuShortcut>{shortcut}</ContextMenuShortcut>
          </ContextMenuItem>
        );
      })}
    </>
  );
}
