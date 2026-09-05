import { useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { zTargetIndex, type ZMove } from "@/lib/shapeZOrder";

/** What the canvas context menu needs to offer the four stacking moves. */
export interface ShapeZOrderMenu {
  /** Shape under the last right-click, or `null` for empty canvas / a miss. */
  targetId: number | null;
  /** Would `dir` actually change anything for the current target? */
  can: (dir: ZMove) => boolean;
  /** Perform `dir` on the current target. No-op when there is none. */
  move: (dir: ZMove) => void;
  /** Attach to the element wrapped by `ContextMenuTrigger`. */
  onContextMenu: (e: MouseEvent) => void;
  /** Attach to `<ContextMenu onOpenChange={...}>` so a target never outlives
   *  the menu that resolved it. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Resolves which shape a right-click landed on, and which of the four z-order
 * moves apply to it.
 *
 * The same split the ▲/▼ row buttons use (#62): this decides DISABLED, and
 * `moveShape` decides CALL, both off the one pure `zTargetIndex` so the two
 * can't disagree about whether a move is a no-op. The engine refuses a no-op
 * itself, so a wrong answer here is a dishonest menu rather than a corrupt
 * document -- but a menu item that looks live and does nothing is the exact
 * thing this hook exists to prevent.
 */
export function useShapeZOrderMenu({
  shapes,
  shapeAtClient,
  moveShape,
}: {
  /** Live shapes on the ACTIVE layer, in engine draw order (bottom -> top). */
  shapes: readonly { id: number }[];
  shapeAtClient: (clientX: number, clientY: number) => Promise<number>;
  moveShape: (id: number, dir: ZMove) => void | boolean | Promise<boolean>;
}): ShapeZOrderMenu {
  const [targetId, setTargetId] = useState<number | null>(null);

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      // Read the point off the event BEFORE awaiting anything -- same rule the
      // drag path states: after an await, `e` is only safe for values already
      // destructured out of it.
      const { clientX, clientY } = e;
      // Radix opens the menu on THIS event, synchronously, while the hit-test
      // is a worker round trip. Clearing first is what stops the menu offering
      // moves for whatever was right-clicked previously; the items appear when
      // the answer lands, which is well inside the open animation.
      setTargetId(null);
      void shapeAtClient(clientX, clientY).then((id) =>
        setTargetId(id >= 0 ? id : null),
      );
    },
    [shapeAtClient],
  );

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setTargetId(null);
  }, []);

  const ids = useMemo(() => shapes.map((s) => s.id), [shapes]);

  const can = useCallback(
    (dir: ZMove) =>
      targetId !== null && zTargetIndex(ids, targetId, dir) !== null,
    [ids, targetId],
  );

  const move = useCallback(
    (dir: ZMove) => {
      if (targetId === null) return;
      void moveShape(targetId, dir);
    },
    [targetId, moveShape],
  );

  return { targetId, can, move, onContextMenu, onOpenChange };
}
