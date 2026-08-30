/** Shared color palettes for tool settings panels. */

const PALETTE = {
  white:  "#ffffff",
  black:  "#000000",
  red:    "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green:  "#22c55e",
  teal:   "#14b8a6",
  cyan:   "#22d3ee",
  blue:   "#3b82f6",
  violet: "#8b5cf6",
  purple: "#a855f7",
  pink:   "#ec4899",
} as const;

const p = PALETTE;

export const TEXT_COLORS = [
  p.white, p.red, p.orange, p.yellow, p.green, p.blue, p.violet, p.pink, p.black,
] as const;

/** Cyan first — the Photoshop guide convention and the pre-picker default. */
export const GUIDE_COLORS = [
  p.cyan, p.red, p.orange, p.yellow, p.green, p.blue, p.violet, p.pink, p.white, p.black,
] as const;

export const DEFAULT_GUIDE_COLOR = p.cyan;

/** Layer Color Overlay tints. Hues first — white and black last, because a
 *  full-strength monochrome overlay flattens the layer to a silhouette: a real
 *  use (and what the opacity slider is for), just rarely the first reach. */
export const OVERLAY_COLORS = [
  p.red, p.orange, p.yellow, p.green, p.teal, p.cyan,
  p.blue, p.violet, p.purple, p.pink, p.white, p.black,
] as const;

/** Photoshop opens Color Overlay at full strength; the slider dials it back. */
export const DEFAULT_OVERLAY_OPACITY = 1;
