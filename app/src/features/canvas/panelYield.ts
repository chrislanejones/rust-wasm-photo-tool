// Floating panels that give way to a box on the canvas. Shared by the paste
// box (PastePlacementOverlay) and the Shapes edit box (ShapeEditOverlay, whose
// action-bar ports in ShapeActionsOverlay sit at the same --z-topbar).
//
// Both boxes sit UNDER the Tools, Gallery and Review panels, never over them.
// Drag one into a panel and that panel closes (its own X would do the same; the
// top bar or Alt+T/G/R brings it back), so a big box never fights the chrome
// for the screen. Only panels that are closable in the current layout opt in,
// by carrying `data-paste-yields`, so the dock and narrow drawers are untouched.

import { boxCorners } from "@/hooks/usePastePlacementTool";
import { useUIStore } from "@/stores/useUIStore";

/** Attribute a floating panel carries while it can be closed. Its value says
 *  which panel; see `closePanel` below. */
const PANEL_YIELDS_ATTR = "data-paste-yields";

type Pt = { x: number; y: number };

function closePanel(which: string | null) {
  const ui = useUIStore.getState();
  if (which === "tools") ui.setShowTools(false);
  else if (which === "gallery") ui.setShowGallery(false);
  else if (which === "review") ui.setShowHistory(false);
}

function bounds(corners: Pt[]) {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
}

/** Close every closable panel the box (corners in SCREEN px) runs into.
 *  Panels the box already overlapped when the drag began are left alone: a box
 *  can start partly under one, and that is not a push. The pointer itself
 *  going into a panel always closes it. */
export function closePanelsHitBy(corners: Pt[], pointer: Pt, spared: Set<Element>) {
  const box = bounds(corners);
  for (const el of document.querySelectorAll(`[${PANEL_YIELDS_ATTR}]`)) {
    const p = el.getBoundingClientRect();
    const pointerIn =
      pointer.x >= p.left && pointer.x <= p.right && pointer.y >= p.top && pointer.y <= p.bottom;
    const boxIn = box.l < p.right && box.r > p.left && box.t < p.bottom && box.b > p.top;
    if (pointerIn || (boxIn && !spared.has(el))) closePanel(el.getAttribute(PANEL_YIELDS_ATTR));
  }
}

/** The panels the box already overlaps, so a drag that starts there doesn't
 *  close them on its first frame. */
export function panelsUnder(corners: Pt[]): Set<Element> {
  const hit = new Set<Element>();
  const box = bounds(corners);
  for (const el of document.querySelectorAll(`[${PANEL_YIELDS_ATTR}]`)) {
    const p = el.getBoundingClientRect();
    if (box.l < p.right && box.r > p.left && box.t < p.bottom && box.b > p.top) hit.add(el);
  }
  return hit;
}

/** A box given by two opposite corners in CANVAS px, turned `rotation`° about
 *  its center, as four SCREEN px corners. A line's angle lives in its
 *  endpoints and its rotation is 0, so its box is the plain bbox. */
export function screenCorners(
  start: Pt,
  end: Pt,
  rotation: number,
  f: { originX: number; originY: number; scaleX: number; scaleY: number },
): Pt[] {
  return boxCorners({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    rotation,
  }).map((p) => ({ x: f.originX + p.x * f.scaleX, y: f.originY + p.y * f.scaleY }));
}
