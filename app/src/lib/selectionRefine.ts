// The Refine section's settings: four operations on the selection plus the
// feather a mask made from it gets. The engine does the work
// (src/selection_refine.rs); this is the shape the panel and the session hook
// agree on.

export interface RefineSettings {
  /** Drop selected specks smaller than this many pixels. 0 = off. */
  islands: number;
  /** Fill unselected pinholes smaller than this many pixels. 0 = off. */
  holes: number;
  /** Open then close, this radius in pixels. 0 = off. */
  smooth: number;
  /** Softens the edge of a MASK made from the selection (Layer Settings →
   *  Add mask → Reveal/Hide selection). The selection itself is on/off per
   *  pixel, so feather cannot live in it. */
  feather: number;
  /** Grow (+) or shrink (−) the selection by this many pixels. */
  expand: number;
}

/** What Clean Up applies in one step. */
export const CLEAN_UP: RefineSettings = { islands: 4, holes: 6, smooth: 2, feather: 1, expand: -1 };

/** The four selection ops as the engine takes them, in its argument order. */
export function refineArgs(r: RefineSettings): [number, number, number, number] {
  return [r.islands, r.holes, r.smooth, r.expand];
}

/** True when Apply would do nothing to the selection (feather is not part of it). */
export function isNoopRefine(r: RefineSettings): boolean {
  return r.islands === 0 && r.holes === 0 && r.smooth === 0 && r.expand === 0;
}

/** Add-mask sources, in the engine's numbering. */
export const MASK_SOURCE = { revealAll: 0, hideAll: 1, revealSelection: 2, hideSelection: 3 } as const;
export type MaskSource = (typeof MASK_SOURCE)[keyof typeof MASK_SOURCE];
