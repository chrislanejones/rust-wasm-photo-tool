/** Shared color palettes for tool settings panels. */

const PALETTE = {
  white:  "#ffffff",
  black:  "#000000",
  red:    "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green:  "#22c55e",
  teal:   "#14b8a6",
  blue:   "#3b82f6",
  violet: "#8b5cf6",
  purple: "#a855f7",
  pink:   "#ec4899",
} as const;

const p = PALETTE;

export const TEXT_COLORS = [
  p.white, p.red, p.orange, p.yellow, p.green, p.blue, p.violet, p.pink, p.black,
] as const;
