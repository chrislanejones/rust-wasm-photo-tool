// Shift-to-preserve-aspect-ratio for bounding-box resize handles (crop, the
// paste-placement box, shape/arrow annotations). Only corner handles
// (nw/ne/se/sw) have two free axes to reconcile; edge handles (n/e/s/w) are
// left unchanged when Shift is held — matches how Figma/Illustrator/
// Photoshop treat a single-axis drag. Text annotations need no equivalent:
// their resize is already a single uniform scalar (font-size distance
// scaling), which can't distort proportions.

/** Force two independent scale factors (1 = no change) to whichever implies
 *  the larger magnitude of change — i.e. uniform scale, which by
 *  construction preserves the start-of-drag aspect ratio. */
export function lockScaleFactors(
  kx: number,
  ky: number,
): { kx: number; ky: number } {
  const k = Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky;
  return { kx: k, ky: k };
}

/** Shift-to-axis-lock for whole-box translate drags (crop/paste/shape "move"
 *  handle). Zeroes out whichever axis moved less, so a drag that's mostly
 *  horizontal snaps to purely horizontal (and vice versa) — the classic
 *  design-tool "constrain to horizontal/vertical" behavior. */
export function lockAxisDelta(
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  return Math.abs(dx) >= Math.abs(dy) ? { dx, dy: 0 } : { dx: 0, dy };
}

/** Shift-to-90°-snap for re-angling a line/arrow endpoint. Snaps the vector
 *  from the fixed anchor to the dragged point to the nearest quarter-turn
 *  (0/90/180/270°), preserving the vector's length — lets an arrow go
 *  cleanly left/right/up/down instead of drifting off-axis. */
export function lockPointToAxis(
  anchorX: number,
  anchorY: number,
  freeX: number,
  freeY: number,
): { x: number; y: number } {
  const vx = freeX - anchorX;
  const vy = freeY - anchorY;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return { x: freeX, y: freeY };
  const snapped = Math.round(Math.atan2(vy, vx) / (Math.PI / 2)) * (Math.PI / 2);
  return {
    x: anchorX + Math.cos(snapped) * len,
    y: anchorY + Math.sin(snapped) * len,
  };
}

/** Adapter for box-model (x, y, w, h) resize math — crop's switch and the
 *  paste-placement overlay. Converts a corner handle's raw cursor-space
 *  (dx, dy) into width/height scale factors (respecting each handle's sign
 *  convention — "w"/"n" handles SHRINK the box on a positive delta), locks
 *  them via `lockScaleFactors`, then converts back to a corrected (dx, dy) in
 *  the exact sign convention the caller's existing switch/case already
 *  expects. No-ops for edge handles (single-char names) — only corner
 *  handles (2-char names) have two free axes to reconcile. */
export function lockCornerDelta(
  handle: string,
  dx: number,
  dy: number,
  startW: number,
  startH: number,
): { dx: number; dy: number } {
  if (handle.length !== 2 || startW <= 0 || startH <= 0) return { dx, dy };
  const wSign = handle.includes("w") ? -1 : 1;
  const hSign = handle.includes("n") ? -1 : 1;
  const kx = (startW + dx * wSign) / startW;
  const ky = (startH + dy * hSign) / startH;
  const { kx: lkx, ky: lky } = lockScaleFactors(kx, ky);
  return {
    dx: (startW * lkx - startW) * wSign,
    dy: (startH * lky - startH) * hSign,
  };
}
