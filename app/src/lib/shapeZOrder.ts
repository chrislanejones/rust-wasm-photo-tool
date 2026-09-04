// Shape z-order — which index a shape should move to for each of the four
// stacking actions, or `null` when the action would change nothing.
//
// The engine's shape list IS the draw order (`render_layer` iterates the Vec,
// so a later index sits on top), and `get_shape_annotations()` hands it back
// in that same order. So "bring forward" is index + 1 and "send to back" is
// index 0. There is no separate z field anywhere — see ADR-044.
//
// Pure on purpose: the Reselect list needs the same answer to decide whether
// to DISABLE a button that the hook needs to decide whether to CALL the
// engine, and one function keeps them from disagreeing. The engine refuses a
// no-op move itself (`move_shape_annotation` returns false and pushes no
// history), so a caller that skips this check is safe, just not honest in
// its UI.

export type ZMove = "forward" | "backward" | "front" | "back";

/**
 * Target index for moving `id` by `dir` within `ids` (bottom → top), or
 * `null` if the id is absent or the move is already satisfied.
 */
export function zTargetIndex(ids: readonly number[], id: number, dir: ZMove): number | null {
  const from = ids.indexOf(id);
  if (from < 0) return null;
  const last = ids.length - 1;
  let to: number;
  switch (dir) {
    case "forward":
      to = from + 1;
      break;
    case "backward":
      to = from - 1;
      break;
    case "front":
      to = last;
      break;
    case "back":
      to = 0;
      break;
  }
  if (to < 0 || to > last || to === from) return null;
  return to;
}

/** A click with Shift held goes all the way; without, one step. */
export function zMoveFor(up: boolean, shiftKey: boolean): ZMove {
  if (up) return shiftKey ? "front" : "forward";
  return shiftKey ? "back" : "backward";
}
