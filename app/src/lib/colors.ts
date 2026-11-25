/** Shared color palettes for tool settings panels. */

/** The one palette every panel's swatches are drawn from. */
export const PALETTE = {
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

/** The checkerboard swatch every ColorSwatchGrid shows just before its "+":
 *  the CSS keyword, which both Rust color parsers read as alpha 0
 *  (`drawing::parse_hex_color`, `parse_color`), so a transparent fill draws
 *  nothing. Offered on fills and backgrounds; a grid whose color is INK (a
 *  stroke, text, a brush, a guide, a redaction) turns it off. */
export const TRANSPARENT = "transparent";

/** The keyword, or any color with alpha 0: the picker hands back
 *  `#00000000` when it is confirmed on the checkerboard swatch, and that
 *  must stay "transparent", not become an opaque black background. */
export function isTransparent(color: string | null | undefined): boolean {
  const c = color?.trim().toLowerCase();
  if (!c) return false;
  if (c === TRANSPARENT) return true;
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/.exec(c)?.[1];
  return hex !== undefined && (hex.length === 4 ? hex[3] === "0" : hex.slice(6) === "00");
}

/** Every color the site ships with, in hue order — what the Fill Color
 *  palette starts as. The user can replace, remove and add to it
 *  (`useEditablePalette`); Reset brings this back. White first, so the
 *  default fill (`TEXT_COLORS[0]`) is still the first swatch. */
export const FILL_COLORS = [
  p.white, p.red, p.orange, p.yellow, p.green, p.teal,
  p.cyan, p.blue, p.violet, p.purple, p.pink, p.black,
] as const;
